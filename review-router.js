/* Open Research Navigator review-routing layer. No credentials or server-side changes. */
(function (root) {
  "use strict";
  const FILM = 'Daughters of the Dust';
  const STOP = new Set(('i im my me we our is am are was were a an the to for in on of by with about can could would will please help do does did ' +
  'you your write writing essay paper assignment class homework school research scholarly scholarship find search show give some any ' +
  'source sources film movie daughters dust julie dash what who why how when where which something know understand').split(/\s+/));
  const HELP = /\b(help me|can you help|need help|not sure|do not know|don't know|no idea|getting started|where do i start|how do i start|essay|assignment|homework|class project|school project|stuck|write my paper|write an essay)\b/i;
  const SPECIFIC = /\b(how does|how do|what role|what is the relationship|why does|why do|compare|difference between|how did|what connects|what evidence|how is|how are)\b/i;
  const SENSITIVE = /\b(rape|sexual assault|sexual abuse|sexual violence|incest|pornograph\w*|prostitut\w*)\b/i;
  const GRAPHIC = /\b(graphic descriptions? of|explicit sexual|how to assault|depict rape in detail)\b/i;
  const ANCHORS = ["daughters of the dust", "julie dash", "gullah", "geechee", "sea islands", "l.a. rebellion", "la rebellion", "peazant"];
  const RELATED = ["black women", "black feminist", "cultural memory", "african american film", "black independent cinema", "matrilineal", "ancestral memory"];
  function terms(s) { return (String(s || '').toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []).filter(w=>!STOP.has(w)); }
  function intent(input) {
    const q = String(input || '').trim();
    if (!q) return 'empty';
    // Questions about how to complete an assignment should offer guidance, not database hits.
    if (/\bhow (?:do|can|should) i (?:write|start|plan|structure|choose)\b/i.test(q)) return 'help';
    if (HELP.test(q) && !SPECIFIC.test(q)) return 'help';
    if (terms(q).length < 5 && !/[?]/.test(q)) return 'topic';
    return 'question';
  }
  function ageRoute(profile) {
    if (profile?.age === 'child') return 'curated-child';
    if (profile?.age === 'teen') return 'curated-teen';
    if (profile?.purpose === 'research') return 'scholarly-research';
    return 'scholarly-public';
  }
  function plan(input, profile) {
    const kind = intent(input), route = ageRoute(profile);
    if (kind === 'help' || kind === 'empty') return {kind,route,needsGuidance:true,original:input};
    let meaningful = terms(input).filter(w => !['daughters', 'dust', 'julie', 'dash'].includes(w));
    let unique = [...new Set(meaningful)].slice(0,7);
    const query = `"${FILM}" Julie Dash${unique.length ? ' ' + unique.join(' ') : ''}`;
    return {kind,route,needsGuidance:false,original:input,query,terms:unique};
  }
  function rankedCurated(query, profile, catalogue, count=5) {
    const allowed = (catalogue || []).filter(r => (r.audiences || []).includes(profile?.age || 'adult'));
    const qwords = terms(query);
    // A curated record is a hand-chosen resource, not a live search hit.
    const scored = allowed.map((r,order)=>{
      const t = (r.topics || []).join(' ').toLowerCase();
      const hay = `${r.title} ${r.description}`.toLowerCase();
      let score = 0;
      for (const term of qwords) {
        if (t.split(/\W+/).includes(term)) score += 3;
        else if (hay.includes(term)) score += 1;
      }
      if (r.url?.startsWith('#')) score += profile?.age==='child'?2:0;
      if (r.id === 'film-overview') score += 1;
      return {record:r,score,order};
    });
    scored.sort((a,b)=>b.score-a.score || a.order-b.order);
    const relevant = scored.filter(x=>x.score>0);
    return relevant.slice(0,Math.max(1,Math.min(count,10))).map(x=>x.record);
  }
  function scholarlyRelevance(result, original, profile) {
    const hay = `${result.title||''} ${result.abstract||result.abstract_snippet||''} ${(result.subjects||[]).join(' ')}`.toLowerCase();
    if (profile?.age==='child') return false; // Child never receives arbitrary provider records.
    // Teen readers can encounter non-graphic difficult history; only clearly graphic framing is filtered.
    if (GRAPHIC.test(hay) && profile?.age!=='adult') return false;
    if (ANCHORS.some(a=>hay.includes(a))) return true;
    // Contextual work without the film title needs TWO independently meaningful connections.
    const queryTerms = [...new Set(terms(original))].filter(x=>x.length>=5);
    const matches = queryTerms.filter(x=>hay.includes(x));
    const contextual = RELATED.some(x=>hay.includes(x));
    return contextual && matches.length>=2;
  }
  function safeExternalUrl(value, allowFragment=false) {
    const v=String(value||'').trim();
    if (allowFragment && /^#[a-z][\w-]*$/i.test(v)) return v;
    try { const u = new URL(v); return ['https:','http:'].includes(u.protocol)?u.href:null; }
    catch {return null;}
  }
  root.ORNRouter = {terms,intent,ageRoute,plan,rankedCurated,scholarlyRelevance,safeExternalUrl};
})(typeof window !== 'undefined' ? window : globalThis);
