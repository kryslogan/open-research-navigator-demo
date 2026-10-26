const $=id=>document.getElementById(id);
const API_BASE=(window.ORN_API_BASE||"").replace(/\/$/,"");
const PROFILE_KEY="orn-daughters-profile-review-v2";
const SESSION_KEY="orn-daughters-session-review-v2";
let content=null,reviewSources=null,lastResults=[],fontScale=1,drawing=false;
const ROUTER=window.ORNRouter;

let profile=load(PROFILE_KEY)||null;
let state=load(SESSION_KEY)||{started:new Date().toISOString(),log:[],selected:{}};

function load(k){try{return JSON.parse(localStorage.getItem(k)||"null")}catch{return null}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
const now=()=>new Date().toISOString();
const nice=x=>new Date(x).toLocaleString();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function log(kind,text,extra={}){state.log.push({time:now(),kind,text,...extra});save(SESSION_KEY,state);renderTrail()}
function normDoi(v=""){return String(v||"").toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//,"").replace(/^doi:\s*/,"").trim()}
function rid(r){return normDoi(r.doi)||"t-"+btoa(unescape(encodeURIComponent((r.title||"untitled").slice(0,80)))).replace(/=+$/,"")}
function words(s=""){return (s.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}\-’']{3,}/gu)||[])}
const STOP=new Set(["what","which","with","from","that","this","there","their","about","into","does","have","more","research","scholarship","would","could","should","where","when","they","them","your","find","show","work","works","daughters","dust"]);

function depth(){
  if(!profile)return "public";
  if(profile.age==="adult" && profile.purpose==="research")return "research";
  if(profile.age==="adult" && profile.purpose==="teach")return "educator";
  if(profile.age==="child")return profile.guided?"family":"child";
  if(profile.age==="teen")return profile.guided?"guided-teen":"teen";
  return profile.purpose==="learn"?"learning":"public";
}
function isAdultContentAllowed(){return profile?.age!=="child"}

async function init(){
  [content,reviewSources]=await Promise.all([
    fetch("daughters-content.json",{cache:"no-store"}).then(r=>r.json()),
    fetch("review-sources.json",{cache:"no-store"}).then(r=>r.json())
  ]);
  wire();
  if(!profile)openProfile();else {$("profileOverlay").hidden=true;applyProfile();}
  renderTrail();updateCount();
}
function wire(){
  $("enterSite").onclick=saveProfile;
  $("changeProfile").onclick=openProfile;
  document.querySelectorAll('input[name="age"]').forEach(x=>x.onchange=()=>{$("guidedWrap").hidden=x.value==="adult"});
  $("searchBtn").onclick=search;
  $("query").onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")search()};
  $("helpToggle").onclick=()=>{let h=$("help");h.classList.toggle("open");$("helpToggle").setAttribute("aria-expanded",String(h.classList.contains("open")))};
  document.querySelectorAll(".ask").forEach(b=>b.onclick=()=>{prefill(b.dataset.query)});
  $("txtExport").onclick=exportTxt;$("htmlExport").onclick=exportHtml;
  $("trailToggle").onclick=()=>{$("trail").hidden=!$("trail").hidden};
  $("resetSession").onclick=()=>{if(confirm("Start a new local research session? This clears saved selections, notes, drawings, and the search trail in this browser.")){state={started:now(),log:[],selected:{}};save(SESSION_KEY,state);location.reload()}};
  $("accessibilityBtn").onclick=()=>{$("accessibilityPanel").hidden=false};
  $("closeAccessibility").onclick=()=>{$("accessibilityPanel").hidden=true};
  $("fontUp").onclick=()=>{fontScale=Math.min(1.35,fontScale+.08);document.documentElement.style.setProperty("--font-scale",fontScale)};
  $("fontDown").onclick=()=>{fontScale=Math.max(.85,fontScale-.08);document.documentElement.style.setProperty("--font-scale",fontScale)};
  $("contrast").onclick=()=>document.body.classList.toggle("contrast");
}
function openProfile(){
  $("profileOverlay").hidden=false;
  if(profile){
    let a=document.querySelector(`input[name="age"][value="${profile.age}"]`);if(a)a.checked=true;
    let p=document.querySelector(`input[name="purpose"][value="${profile.purpose}"]`);if(p)p.checked=true;
    $("guided").checked=!!profile.guided;$("guidedWrap").hidden=profile.age==="adult";$("confirmProfile").checked=true;
  }
}
function saveProfile(){
  let age=document.querySelector('input[name="age"]:checked')?.value;
  let purpose=document.querySelector('input[name="purpose"]:checked')?.value;
  if(!age||!purpose||!$("confirmProfile").checked){alert("Choose an age group and purpose, then confirm the temporary profile.");return}
  if(profile && profile.age !== age){
    // Prevent adult research selections from being exported during a Child visit.
    state={started:now(),log:[],selected:{}};
    save(SESSION_KEY,state);
    $("results").innerHTML='<div class="empty">Profile changed. Start a new search with this age group.</div>';
    $("searchPlan").hidden=true;
    renderTrail();updateCount();
  }
  profile={age,purpose,guided:age==="adult"?false:$("guided").checked,created:now()};
  save(PROFILE_KEY,profile);$("profileOverlay").hidden=true;applyProfile();
}
function applyProfile(){
  let d=depth();
  $("changeProfile").textContent=`${profile.age==="adult"?"Adult":profile.age==="teen"?"Teen":"Child / Family"} · ${profile.purpose==="browse"?"Browse":profile.purpose==="learn"?"Learn":profile.purpose==="teach"?"Teach":"Research"}`;
  document.querySelectorAll(".sensitive").forEach(x=>x.dataset.hidden=String(profile.age==="child"));
  document.querySelectorAll(".child-only").forEach(x=>x.hidden=profile.age!=="child");
  let ten=$("limit").querySelector('option[value="10"]');
  if(["child","teen","family","guided-teen","learning","public"].includes(d)){ $("limit").value="5"; ten.disabled=true } else ten.disabled=false;
  $("htmlExport").style.display=profile.age==="adult"?"":"none";
  renderHelp();
  renderSourcePaths();
}
function renderHelp(){
  if(!content||!profile)return;
  let child=[
    ["Who made the film?", "Who is Julie Dash and why is her film important?"],
    ["Explore family and memory", "What does Daughters of the Dust show about family, ancestors, and memory?"],
    ["Discover the Sea Islands", "What can I learn about the Sea Islands and Gullah Geechee culture?"],
    ["Leaving home", "Why do members of the Peazant family want different futures?"],
    ["How the story is told", "How does Daughters of the Dust tell a story across generations?"]
  ];
  let teen=[
    ["Julie Dash and Black film history", "How did Julie Dash change Black independent film history?"],
    ["Gullah Geechee history", "What is the relationship between the Sea Islands, Gullah Geechee history, and Daughters of the Dust?"],
    ["Family, memory, and migration", "How does Daughters of the Dust connect family memory to migration?"],
    ["Black women and cinema", "What role do Black women filmmakers play in the L.A. Rebellion?"],
    ["Storytelling and film form", "How does Daughters of the Dust use nonlinear storytelling?"],
    ["My own question", ""]
  ];
  let adult=[
    ["Film-specific scholarship", "What scholarship addresses Daughters of the Dust, Julie Dash, and Gullah Geechee cultural memory?"],
    ["Migration and memory", "How does Daughters of the Dust connect migration, ancestry, and memory?"],
    ["Black independent filmmaking", "How does Julie Dash relate to the L.A. Rebellion and Black women's cinema?"],
    ["Film form", "What scholarship examines nonlinear time and collective narration in Daughters of the Dust?"],
    ["Preservation and influence", "What scholarship discusses the film's restoration, circulation, or reception?"],
    ["My own question", ""]
  ];
  let items=profile.age==="child"?child:profile.age==="teen"?teen:adult;
  let g=$("helpGrid");g.innerHTML="";
  items.forEach(([label,query])=>{
    let b=document.createElement("button");b.type="button";b.textContent=label;
    b.onclick=()=>{if(query)$("query").value=query;$("query").focus()};
    g.appendChild(b)
  });
}
function renderSourcePaths(){
  const box=$("sourcePaths");if(!box||!profile||!reviewSources)return;
  if(profile.age==="adult"){
    box.textContent="Source type: scholarly discovery via Open Research Navigator. Library access varies by institution.";
    return;
  }
  const sources=reviewSources.library_followup||[];
  box.innerHTML='<strong>Other places to continue</strong><p style="color:#e9ddd0;margin:.4rem 0">These are optional school/library and public-resource pathways, not databases searched by this demo. Access varies.</p>';
  sources.forEach(x=>{
    let p=document.createElement("p");p.style.margin='.55rem 0';
    let link=document.createElement("a");link.href=ROUTER.safeExternalUrl(x.url)||"#sources";link.textContent=x.title;link.target="_blank";link.rel="noopener noreferrer";link.style.color="#f8e6bb";
    p.append(link,document.createTextNode(' — '+x.access));box.appendChild(p);
  });
}
function showSearchPlan(plan,note=""){
  const p=$("searchPlan");p.hidden=false;
  p.textContent=note || (plan?.needsGuidance ? "This sounds like a request for help. Choose a direction below; no database search has been sent." :
    `Search route: ${plan.route}. Searching for: ${plan.query}. You can edit your question and search again.`);
  p.style.cssText="margin-top:.8rem;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);border-radius:10px;padding:.7rem;font: .8rem/1.5 system-ui,sans-serif;color:#fff";
}
function normalizedCurated(record){
  return {
    title:record.title,authors:[record.creator],venue:record.publisher,
    year:null,doi:null,found_in:[record.publisher],
    landing_page_url:record.url,curated:true,
    description:record.description,kind:record.kind,why:record.why,
    abstract:null,subjects:record.topics||[],access:"Curated source",
  };
}
function showCurated(question,limit=5,reason=""){
  const route=ROUTER.ageRoute(profile);
  const curated=ROUTER.rankedCurated(question,profile,reviewSources.curated,limit).map(normalizedCurated);
  lastResults=curated;
  renderResults(curated,question,0);
  $("searchStatus").textContent=curated.length+" curated starting point"+(curated.length===1?"":"s");
  if(reason)showSearchPlan(null,reason);
  document.querySelector('#research').scrollIntoView({behavior:'smooth'});
}
function prefill(q){$("query").value=q;document.querySelector("#ask").scrollIntoView({behavior:"smooth",block:"center"});$("query").focus()}
function connectionTerms(r,q){
  let hay=`${r.title||""} ${r.abstract||""} ${(r.subjects||[]).join(" ")}`.toLowerCase();
  let c=[...(content?.context_terms||[]),...words(q).filter(x=>!STOP.has(x))],out=[];
  for(let t of c){t=String(t).toLowerCase().trim();if(t.length>=4&&hay.includes(t)&&!out.includes(t))out.push(t)}
  return out.slice(0,8);
}
function highlight(text,terms){
  let safe=esc(text||"");
  [...new Set(terms)].sort((a,b)=>b.length-a.length).slice(0,10).forEach(t=>{
    let e=esc(t).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    if(e)safe=safe.replace(new RegExp(`(${e})`,"ig"),"<mark>$1</mark>");
  });return safe;
}
function quickRead(abs){if(!abs)return"";let bits=abs.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[abs];let s=bits.slice(0,2).join(" ").trim();return s.length>520?s.slice(0,517)+"…":s}
async function search(){
  const original=$("query").value.trim();if(!original)return;
  const plan=ROUTER.plan(original,profile);
  const limit=Number($("limit").value);
  log("user input",original,{age:profile.age,purpose:profile.purpose,intent:plan.kind});
  if(plan.needsGuidance){
    showSearchPlan(plan);
    $("help").classList.add("open");$("helpToggle").setAttribute("aria-expanded","true");
    $("searchStatus").textContent="Choose a direction — no search sent";
    $("helpToggle").focus();return;
  }
  showSearchPlan(plan);
  // Child never invokes unrestricted scholarly search. Use inspected, age-labeled resources.
  if(profile.age==="child"){
    log("curated route",plan.query,{source:"hand-selected website/public-history guides"});
    showCurated(original,5);
    return;
  }
  if(!API_BASE){
    $("searchStatus").textContent="Research service unavailable — curated sources shown";
    showCurated(original,5,"Research service is offline. Curated sources are still available.");return;
  }
  $("searchStatus").textContent="Searching…";
  log("search query",plan.query,{route:plan.route});
  const headers={"Content-Type":"application/json","X-Navigator-Key":sessionStorage.getItem("orn-code")||""};
  const body=JSON.stringify({query:plan.query,limit:10,context:{known_sources:[]}});
  try{
    let response=await fetch(`${API_BASE}/api/search`,{method:"POST",headers,body});
    if(response.status===401){
      let code=prompt("Enter the Navigator access code for this demonstration:")||"";
      sessionStorage.setItem("orn-code",code);headers["X-Navigator-Key"]=code;
      response=await fetch(`${API_BASE}/api/search`,{method:"POST",headers,body});
    }
    let data=await response.json();
    if(!response.ok)throw new Error(data.detail||"Search failed");
    const all=data.results||[];
    const valid=all.filter(r=>ROUTER.scholarlyRelevance(r,original,profile));
    let shown;
    if(profile.age==="teen"){
      // Teen route begins with public-history/curated sources; at most two tightly vetted scholarly leads.
      let curated=ROUTER.rankedCurated(original,profile,reviewSources.curated,3).map(normalizedCurated);
      shown=[...curated,...valid.slice(0,2)].slice(0,5);
    }else{
      if(plan.route==="scholarly-public"){
        // General public: a few interpretive/public resources beside a small scholarly selection.
        const curated=ROUTER.rankedCurated(original,profile,reviewSources.curated,2).map(normalizedCurated);
        shown=[...curated,...valid.slice(0,Math.max(0,limit-curated.length))].slice(0,limit);
      }else shown=valid.slice(0,limit);
      if(!shown.length){
        showCurated(original,5,"Scholarly results did not pass the film-context relevance check. Here are curated starting points instead; no unrelated scholarly results are shown.");
        return;
      }
    }
    lastResults=shown;
    renderResults(shown,original,0);
    $("searchStatus").textContent=`${shown.length} result${shown.length===1?"":"s"}`;
    let gate=all.length-valid.length;
    if(gate)showSearchPlan(plan,`Searching for: ${plan.query}. ${gate} off-topic or profile-inappropriate scholarly result${gate===1?' was':'s were'} excluded before display.`);
    document.querySelector("#research").scrollIntoView({behavior:"smooth"});
  }catch(e){
    showCurated(original,5,"The live research service did not complete this search. You can still explore the curated sources while the service is unavailable.");
    $("searchStatus").textContent="Live search unavailable";
  }
}
function entry(id,r){let e=state.selected[id]||{selected:false,result:r,related:[]};e.result=r;e.related=e.related||[];state.selected[id]=e;return e}
function renderResults(rows,q,withheld=0){
  let area=$("results");area.innerHTML="";
  if(withheld){let n=document.createElement("div");n.className="content-notice";n.innerHTML=`<strong>${withheld} result${withheld===1?"":"s"} not shown for this temporary profile.</strong> Change the profile if an adult is guiding the session.`;area.appendChild(n)}
  if(!rows.length){let n=document.createElement("div");n.className="empty";n.textContent="No results are available in this small set for the current profile. Try another question or change the profile.";area.appendChild(n);return}
  let d=depth();
  rows.forEach((r,i)=>{
    let id=rid(r),saved=state.selected[id]||{},terms=r.curated?[]:connectionTerms(r,q),abs=r.abstract||"",qr=r.curated?"":quickRead(abs),subjects=r.curated?[]:(r.subjects||[]).slice(0,8);
    let safeLanding=ROUTER.safeExternalUrl(r.landing_page_url,!!r.curated);
    let safePdf=ROUTER.safeExternalUrl(r.pdf_url);
    let card=document.createElement("article");card.className="result"+(saved.selected?" selected":"");
    let showFull=["research","educator"].includes(d);
    card.innerHTML=`
      <div class="rhead">
        <input type="checkbox" aria-label="Select result ${i+1}" ${saved.selected?"checked":""}>
        <div><h3>${esc(r.title||"Untitled result")}</h3><div class="rmeta">${esc((r.authors||[]).join(", ")||"Author unavailable")} · ${esc(r.year||"Year unavailable")} · ${esc(r.venue||r.type||"")}</div></div>
        <span class="access">${esc(r.access||"Discovered")}</span>
      </div>
      <div class="rbody">
        <div class="connection"><strong>Why this may connect</strong>${r.curated?`<p style="margin:.4rem 0">${esc(r.why||"")}</p>`:`<div class="chips">${terms.map(t=>`<span class="chip">${esc(t)}</span>`).join("")||'<span class="chip">Retrieved by provider — check relevance</span>'}</div>`}</div>
        ${r.curated?`<p><span class="label">${esc(r.kind||"Curated reference")}</span><br>${esc(r.description||"")}</p><p class="rmeta">This is a project-selected starting point, not a live database result or a provider-supplied abstract.</p>${safeLanding?`<p><a href="${esc(safeLanding)}" ${safeLanding.startsWith('#')?'':'target="_blank" rel="noopener noreferrer"'}>Explore this source</a>${profile.age==='child'&&!safeLanding.startsWith('#')?' · An adult can help review external websites.':''}</p>`:''}`:''}
        ${qr?`<div style="margin-top:.7rem"><span class="label">Quick read — from the available abstract</span><p>${highlight(qr,terms)}</p></div>`:""}
        ${r.curated?"":showFull?`<div><span class="label">Abstract</span><p class="abstract">${abs?highlight(abs,terms):"No abstract was available from the indexed sources."}</p></div>`:
          `<details><summary>View available abstract</summary><p class="abstract">${abs?highlight(abs,terms):"No abstract was available from the indexed sources."}</p></details>`}
        ${subjects.length?`<div><span class="label">Indexed subjects / keywords</span><div class="chips">${subjects.map(s=>`<span class="chip">${esc(s)}</span>`).join("")}</div></div>`:""}
        ${!r.curated&&showFull?`<div class="rmeta" style="margin-top:.65rem">${r.doi?`DOI: ${esc(r.doi)} · `:""}Found in: ${esc((r.found_in||[]).join(", ")||"source unavailable")}${safePdf?` · <a href="${esc(safePdf)}" target="_blank" rel="noopener noreferrer">Open PDF</a>`:safeLanding?` · <a href="${esc(safeLanding)}" target="_blank" rel="noopener noreferrer">Open record</a>`:""}</div>`:""}
        <details ${saved.selected?"open":""}>
          <summary>Notes, handwriting, and related material</summary>
          <div class="notes-grid">
            <div><label class="label" for="note-${id}">My note / why I saved this</label><textarea id="note-${id}" placeholder="A short note for later…">${esc(saved.note||"")}</textarea>
            <label class="label" for="trans-${id}">Text to save from handwriting</label><textarea id="trans-${id}" placeholder="Optional transcription or description of the drawing…">${esc(saved.transcript||"")}</textarea></div>
            <div class="canvaswrap"><div class="canvasbar"><span>Scratchpad</span><button type="button" data-clear>Clear</button></div><canvas class="scratch" width="700" height="340" aria-label="Scratchpad for this source"></canvas></div>
          </div>
          <div style="margin-top:.7rem"><span class="label">Add related material</span>
            <div class="related-form"><input data-title placeholder="Title"><input data-url placeholder="https://…"><select data-type><option>Video</option><option>News</option><option>Blog</option><option>Wikipedia / Reference</option><option>Museum / Archive</option><option>Website</option><option>Other</option></select><textarea data-note placeholder="Why are you adding this?"></textarea></div>
            <button type="button" data-add>Add related material</button><ul class="related-list"></ul>
          </div>
        </details>
      </div>`;
    area.appendChild(card);
    let box=card.querySelector('input[type="checkbox"]');box.onchange=()=>{let e=entry(id,r);e.selected=box.checked;card.classList.toggle("selected",box.checked);save(SESSION_KEY,state);log(box.checked?"select":"unselect",r.title||"Untitled");updateCount()};
    card.querySelector(`#note-${CSS.escape(id)}`).onchange=e=>{entry(id,r).note=e.target.value;save(SESSION_KEY,state)};
    card.querySelector(`#trans-${CSS.escape(id)}`).onchange=e=>{entry(id,r).transcript=e.target.value;save(SESSION_KEY,state)};
    setupCanvas(card.querySelector("canvas"),id,r);
    renderRelated(card,id,r);
    card.querySelector("[data-add]").onclick=()=>{let title=card.querySelector("[data-title]").value.trim(),url=card.querySelector("[data-url]").value.trim(),type=card.querySelector("[data-type]").value,note=card.querySelector("[data-note]").value.trim();if(!title&&!url)return;if(url&&!ROUTER.safeExternalUrl(url)){alert("Please use a valid http:// or https:// URL.");return}let e=entry(id,r);e.related.push({time:now(),title,url,type,note});save(SESSION_KEY,state);log("related material",title||url,{result:r.title});card.querySelector("[data-title]").value="";card.querySelector("[data-url]").value="";card.querySelector("[data-note]").value="";renderRelated(card,id,r)};
  });updateCount()
}
function setupCanvas(canvas,id,r){
  let ctx=canvas.getContext("2d");ctx.lineWidth=3;ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#211d1a";
  let saved=state.selected[id]?.drawing;if(saved){let img=new Image();img.onload=()=>ctx.drawImage(img,0,0,canvas.width,canvas.height);img.src=saved}
  const point=e=>{let rect=canvas.getBoundingClientRect();return{x:(e.clientX-rect.left)*canvas.width/rect.width,y:(e.clientY-rect.top)*canvas.height/rect.height}};
  canvas.onpointerdown=e=>{drawing=true;canvas.setPointerCapture(e.pointerId);let p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y)};
  canvas.onpointermove=e=>{if(!drawing)return;let p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke()};
  const end=()=>{if(!drawing)return;drawing=false;entry(id,r).drawing=canvas.toDataURL("image/png");save(SESSION_KEY,state)};
  canvas.onpointerup=end;canvas.onpointercancel=end;
  canvas.parentElement.querySelector("[data-clear]").onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);entry(id,r).drawing="";save(SESSION_KEY,state)}
}
function renderRelated(card,id,r){let ul=card.querySelector(".related-list");ul.innerHTML="";(state.selected[id]?.related||[]).forEach((x,i)=>{let li=document.createElement("li");li.innerHTML=`<strong>${esc(x.type)}</strong>: ${x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title||x.url)}</a>`:esc(x.title)}${x.note?` — ${esc(x.note)}`:""}`;let b=document.createElement("button");b.type="button";b.textContent=" remove";b.onclick=()=>{state.selected[id].related.splice(i,1);save(SESSION_KEY,state);renderRelated(card,id,r)};li.appendChild(b);ul.appendChild(li)})}
function selected(){return Object.values(state.selected).filter(x=>x.selected)}
function updateCount(){$("selectedCount").textContent=selected().length}
function renderTrail(){let t=$("trail");t.innerHTML=state.log.length?state.log.map(x=>`<div><strong>${esc(nice(x.time))}</strong><br>${esc(x.kind)}: ${esc(x.text)}</div>`).join("<hr style='border:0;border-top:1px solid rgba(255,255,255,.1)'>"):"No searches yet."}
function stamp(){return new Date().toISOString().slice(0,16).replace("T","-").replace(":","")}
function dl(name,text,type){let blob=new Blob([text],{type}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportTxt(){
  let es=selected();if(!es.length){alert("Select at least one result first.");return}
  let out=["OPEN RESEARCH NAVIGATOR","Daughters of the Dust — Research Session","",`Temporary profile: ${profile.age} / ${profile.purpose}${profile.guided?" / adult-guided":""}`,`Started: ${nice(state.started)}`,`Downloaded: ${new Date().toLocaleString()}`,"","SEARCH TRAIL","============"];
  state.log.filter(x=>x.kind==="search").forEach(x=>out.push(`${nice(x.time)}\n${x.text}\n`));
  es.forEach((e,i)=>{let r=e.result;out.push("","=".repeat(72),`RESULT ${i+1}`,"=".repeat(72),`Title: ${r.title||""}`,`Authors: ${(r.authors||[]).join(", ")}`,`Year: ${r.year||""}`,`Source: ${r.venue||""}`,`DOI: ${r.doi||""}`,`Access: ${r.access||""}`,`Source URL: ${r.landing_page_url||""}`,"",r.curated?"Curated description:":"Abstract:",r.curated?(r.description||"No description available."):(r.abstract||"No abstract available."),"","My note:",e.note||"","Handwriting / scratchpad text:",e.transcript||"");if(e.related?.length){out.push("Related material:");e.related.forEach(x=>out.push(`- ${x.type}: ${x.title||x.url}${x.url?` — ${x.url}`:""}${x.note?` — ${x.note}`:""}`))}});
  dl(`open-research-navigator-daughters-${stamp()}.txt`,out.join("\n"),"text/plain;charset=utf-8");log("export","Downloaded selected results as text")
}
function exportHtml(){
  let es=selected();if(!es.length){alert("Select at least one result first.");return}
  let trail=state.log.map(x=>`<li><time>${esc(nice(x.time))}</time> — <strong>${esc(x.kind)}</strong>: ${esc(x.text)}</li>`).join("");
  let cards=es.map((e,i)=>{let r=e.result,rel=(e.related||[]).map(x=>`<li><strong>${esc(x.type)}</strong>: ${x.url?`<a href="${esc(x.url)}">${esc(x.title||x.url)}</a>`:esc(x.title||"")}${x.note?` — ${esc(x.note)}`:""}</li>`).join("");return `<article><h2>${i+1}. ${esc(r.title||"Untitled")}</h2><p>${esc((r.authors||[]).join(", "))} · ${esc(r.year||"")} · ${esc(r.venue||"")}</p><p><strong>DOI:</strong> ${esc(r.doi||"")}<br><strong>Access:</strong> ${esc(r.access||"")}<br><strong>Found in:</strong> ${esc((r.found_in||[]).join(", "))}</p>${r.curated?`<h3>Curated description</h3><p>${esc(r.description||"")}</p>`:`<h3>Abstract</h3><p>${esc(r.abstract||"No abstract available.")}</p>`}${r.landing_page_url?`<p><a href="${esc(ROUTER.safeExternalUrl(r.landing_page_url,!!r.curated)||'#')}">Open original source</a></p>`:""}<h3>My note</h3><p>${esc(e.note||"")}</p>${e.transcript?`<h3>Scratchpad text</h3><p>${esc(e.transcript)}</p>`:""}${e.drawing?`<h3>Scratchpad</h3><img style="max-width:100%;border:1px solid #bbb" src="${e.drawing}" alt="Researcher's handwritten or drawn annotation">`:""}${rel?`<h3>Related material</h3><ul>${rel}</ul>`:""}</article>`}).join("");
  let doc=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Open Research Navigator — Daughters of the Dust Session</title><style>body{max-width:900px;margin:auto;padding:2rem;font:18px/1.55 Georgia,serif;color:#222;background:#faf8f4}article{border-top:2px solid #a67d34;padding-top:1rem;margin-top:2rem}a{color:#5f4519}time{font: .85em system-ui}</style></head><body><h1>Open Research Navigator — Research Session</h1><p><em>Daughters of the Dust</em> (Julie Dash, 1991)</p><p><strong>Profile:</strong> ${esc(profile.age)} / ${esc(profile.purpose)}${profile.guided?" / adult-guided":""}<br><strong>Started:</strong> ${esc(nice(state.started))}<br><strong>Downloaded:</strong> ${esc(new Date().toLocaleString())}</p><p>External links require internet access. Check original sources before quoting, citing, or relying on an abstract-based quick read.</p><h2>Session trail</h2><ol>${trail}</ol><h2>Selected research</h2>${cards}</body></html>`;
  dl(`open-research-session-daughters-${stamp()}.html`,doc,"text/html;charset=utf-8");log("export","Downloaded HTML research session")
}
init().catch(e=>{console.error(e);$("searchStatus").textContent="Prototype initialization failed."});
