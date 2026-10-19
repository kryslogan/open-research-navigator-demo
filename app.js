const $=id=>document.getElementById(id);
const API_BASE=(window.ORN_API_BASE||"").replace(/\/$/,"");
const PROFILE_KEY="orn-daughters-profile-v1";
const SESSION_KEY="orn-daughters-session-v1";
let content=null,lastResults=[],fontScale=1,drawing=false;

let profile=load(PROFILE_KEY)||null;
let state=load(SESSION_KEY)||{started:new Date().toISOString(),log:[],selected:{}};

function load(k){try{return JSON.parse(localStorage.getItem(k)||"null")}catch{return null}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
const now=()=>new Date().toISOString();
const nice=x=>new Date(x).toLocaleString();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function log(kind,text,extra={}){state.log.push({time:now(),kind,text,...extra});save(SESSION_KEY,state);renderTrail()}
function normDoi(v=""){
  return String(v ?? "").toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//,"")
    .replace(/^doi:\s*/,"")
    .trim();
}
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
function isAdultContentAllowed(){return profile?.age==="adult" || !!profile?.guided}

async function init(){
  content=await (await fetch("daughters-content.json",{cache:"no-store"})).json();
  wire();
  if(!profile)openProfile();else applyProfile();
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
  profile={age,purpose,guided:age==="adult"?false:$("guided").checked,created:now()};
  save(PROFILE_KEY,profile);$("profileOverlay").hidden=true;applyProfile();
}
function applyProfile(){
  let d=depth();
  $("changeProfile").textContent=`${profile.age==="adult"?"Adult":profile.age==="teen"?"Teen":"Child / Family"} · ${profile.purpose==="browse"?"Browse":profile.purpose==="learn"?"Learn":profile.purpose==="teach"?"Teach":"Research"}`;
  document.querySelectorAll(".sensitive").forEach(x=>x.dataset.hidden=String(!isAdultContentAllowed()));
  let ten=$("limit").querySelector('option[value="10"]');
  if(["child","teen","family","guided-teen","learning","public"].includes(d)){ $("limit").value="5"; ten.disabled=true } else ten.disabled=false;
  $("htmlExport").style.display=["research","educator"].includes(d)?"":"none";
  renderHelp();
}
function renderHelp(){
  if(!content||!profile)return;
  const sets={
    child:[
      ["Who made this film?","Who is Julie Dash and why is Daughters of the Dust important?"],
      ["Where does the story take place?","What can I learn about the Sea Islands and Gullah Geechee history that helps me understand Daughters of the Dust?"],
      ["Why is memory important?","What research can help explain family memory and ancestry in Daughters of the Dust?"],
      ["What happened to the film later?","What can I learn about how Daughters of the Dust was preserved and restored?"]
    ],
    public:[
      ["Explore the film","What scholarship helps explain Daughters of the Dust and its place in Black cinema?"],
      ["Explore Gullah Geechee context","What scholarship connects Daughters of the Dust to Gullah Geechee history and cultural memory?"],
      ["Explore Julie Dash","What scholarship examines Julie Dash as a filmmaker, writer, and researcher?"],
      ["Explore migration & memory","What scholarship connects migration, memory, ancestry, and family in Daughters of the Dust?"],
      ["Explore L.A. Rebellion","What scholarship situates Daughters of the Dust within the L.A. Rebellion?"],
      ["Explore preservation & influence","What scholarship discusses the restoration, preservation, reception, or influence of Daughters of the Dust?"]
    ],
    research:[
      ["Film-specific scholarship","Find scholarship on Daughters of the Dust, Julie Dash, memory, migration, Gullah Geechee history, Black women's authorship, or diasporic time."],
      ["Citation neighborhood","What scholarship sits closest to research on Daughters of the Dust, Gullah Geechee cultural memory, and Black women's independent filmmaking?"],
      ["Institutional history","What research connects Julie Dash, UCLA, the L.A. Rebellion, and Daughters of the Dust?"],
      ["Form & narrative","What scholarship analyzes nonlinear time, narration, ritual, memory, or collective structure in Daughters of the Dust?"],
      ["Preservation / circulation","What research discusses distribution, restoration, preservation, reception, or later influence of Daughters of the Dust?"],
      ["Ask my own question",""]
    ]
  };
  let d=depth(),items=d==="research"||d==="educator"?sets.research:(d==="child"||d==="family"?sets.child:sets.public);
  let g=$("helpGrid");g.innerHTML="";
  items.forEach(([lab,q])=>{let b=document.createElement("button");b.textContent=lab;b.onclick=()=>{if(q)$("query").value=q;$("query").focus()};g.appendChild(b)});
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
function sensitiveResult(r){
  if(isAdultContentAllowed())return false;
  let hay=`${r.title||""} ${r.abstract||""} ${(r.subjects||[]).join(" ")}`.toLowerCase();
  return ["sexual violence","sexual assault","rape","prostitution","pornograph","sexual abuse","incest"].some(x=>hay.includes(x));
}
async function search(){
  let q=$("query").value.trim();if(!q)return;
  if(!API_BASE){$("searchStatus").textContent="Backend not connected";return}
  let limit=Number($("limit").value);
  $("searchStatus").textContent="Searching…";log("search",q,{limit,profile:{age:profile.age,purpose:profile.purpose}});
  let headers={"Content-Type":"application/json","X-Navigator-Key":sessionStorage.getItem("orn-code")||""};
  let body=JSON.stringify({query:q,limit,context:{known_sources:[]}});
  try{
    let r=await fetch(`${API_BASE}/api/search`,{method:"POST",headers,body});
    if(r.status===401){
      let code=prompt("Enter the Navigator access code for this demonstration:")||"";
      sessionStorage.setItem("orn-code",code);headers["X-Navigator-Key"]=code;
      r=await fetch(`${API_BASE}/api/search`,{method:"POST",headers,body});
    }
    let data=await r.json();if(!r.ok)throw new Error(data.detail||"Search failed.");
    let raw=data.results||[],filtered=raw.filter(x=>!sensitiveResult(x)),withheld=raw.length-filtered.length;
    lastResults=filtered;renderResults(filtered,q,withheld);
    $("searchStatus").textContent=`${filtered.length} result${filtered.length===1?"":"s"}${withheld?` · ${withheld} withheld for this profile`:""}`;
    document.querySelector("#research").scrollIntoView({behavior:"smooth"});
  }catch(e){$("searchStatus").textContent="Search did not complete";$("results").innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}
function entry(id,r){let e=state.selected[id]||{selected:false,result:r,related:[]};e.result=r;e.related=e.related||[];state.selected[id]=e;return e}
function renderResults(rows,q,withheld=0){
  let area=$("results");area.innerHTML="";
  if(withheld){let n=document.createElement("div");n.className="content-notice";n.innerHTML=`<strong>${withheld} result${withheld===1?"":"s"} not shown for this temporary profile.</strong> Change the profile if an adult is guiding the session.`;area.appendChild(n)}
  if(!rows.length){let n=document.createElement("div");n.className="empty";n.textContent="No results are available in this small set for the current profile. Try another question or change the profile.";area.appendChild(n);return}
  let d=depth();
  rows.forEach((r,i)=>{
    let id=rid(r),saved=state.selected[id]||{},terms=connectionTerms(r,q),abs=r.abstract||"",qr=quickRead(abs),subjects=(r.subjects||[]).slice(0,8);
    let card=document.createElement("article");card.className="result"+(saved.selected?" selected":"");
    let showFull=["research","educator"].includes(d);
    card.innerHTML=`
      <div class="rhead">
        <input type="checkbox" aria-label="Select result ${i+1}" ${saved.selected?"checked":""}>
        <div><h3>${esc(r.title||"Untitled result")}</h3><div class="rmeta">${esc((r.authors||[]).join(", ")||"Author unavailable")} · ${esc(r.year||"Year unavailable")} · ${esc(r.venue||r.type||"")}</div></div>
        <span class="access">${esc(r.access||"Discovered")}</span>
      </div>
      <div class="rbody">
        <div class="connection"><strong>Why this may connect</strong><div class="chips">${terms.map(t=>`<span class="chip">${esc(t)}</span>`).join("")||'<span class="chip">Search/provider relevance — inspect the source</span>'}</div></div>
        ${qr?`<div style="margin-top:.7rem"><span class="label">Quick read — from the available abstract</span><p>${highlight(qr,terms)}</p></div>`:""}
        ${showFull?`<div><span class="label">Abstract</span><p class="abstract">${abs?highlight(abs,terms):"No abstract was available from the indexed sources."}</p></div>`:
          `<details><summary>View available abstract</summary><p class="abstract">${abs?highlight(abs,terms):"No abstract was available from the indexed sources."}</p></details>`}
        ${subjects.length?`<div><span class="label">Indexed subjects / keywords</span><div class="chips">${subjects.map(s=>`<span class="chip">${esc(s)}</span>`).join("")}</div></div>`:""}
        ${showFull?`<div class="rmeta" style="margin-top:.65rem">${r.doi?`DOI: ${esc(r.doi)} · `:""}Found in: ${esc((r.found_in||[]).join(", ")||"source unavailable")}${r.pdf_url?` · <a href="${esc(r.pdf_url)}" target="_blank" rel="noopener">Open PDF</a>`:r.landing_page_url?` · <a href="${esc(r.landing_page_url)}" target="_blank" rel="noopener">Open record</a>`:""}</div>`:""}
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
    card.querySelector("[data-add]").onclick=()=>{let title=card.querySelector("[data-title]").value.trim(),url=card.querySelector("[data-url]").value.trim(),type=card.querySelector("[data-type]").value,note=card.querySelector("[data-note]").value.trim();if(!title&&!url)return;let e=entry(id,r);e.related.push({time:now(),title,url,type,note});save(SESSION_KEY,state);log("related material",title||url,{result:r.title});card.querySelector("[data-title]").value="";card.querySelector("[data-url]").value="";card.querySelector("[data-note]").value="";renderRelated(card,id,r)};
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
  es.forEach((e,i)=>{let r=e.result;out.push("","=".repeat(72),`RESULT ${i+1}`,"=".repeat(72),`Title: ${r.title||""}`,`Authors: ${(r.authors||[]).join(", ")}`,`Year: ${r.year||""}`,`Source: ${r.venue||""}`,`DOI: ${r.doi||""}`,`Access: ${r.access||""}`,"","Abstract:",r.abstract||"No abstract available.","","My note:",e.note||"","Handwriting / scratchpad text:",e.transcript||"");if(e.related?.length){out.push("Related material:");e.related.forEach(x=>out.push(`- ${x.type}: ${x.title||x.url}${x.url?` — ${x.url}`:""}${x.note?` — ${x.note}`:""}`))}});
  dl(`open-research-navigator-daughters-${stamp()}.txt`,out.join("\n"),"text/plain;charset=utf-8");log("export","Downloaded selected results as text")
}
function exportHtml(){
  let es=selected();if(!es.length){alert("Select at least one result first.");return}
  let trail=state.log.map(x=>`<li><time>${esc(nice(x.time))}</time> — <strong>${esc(x.kind)}</strong>: ${esc(x.text)}</li>`).join("");
  let cards=es.map((e,i)=>{let r=e.result,rel=(e.related||[]).map(x=>`<li><strong>${esc(x.type)}</strong>: ${x.url?`<a href="${esc(x.url)}">${esc(x.title||x.url)}</a>`:esc(x.title||"")}${x.note?` — ${esc(x.note)}`:""}</li>`).join("");return `<article><h2>${i+1}. ${esc(r.title||"Untitled")}</h2><p>${esc((r.authors||[]).join(", "))} · ${esc(r.year||"")} · ${esc(r.venue||"")}</p><p><strong>DOI:</strong> ${esc(r.doi||"")}<br><strong>Access:</strong> ${esc(r.access||"")}<br><strong>Found in:</strong> ${esc((r.found_in||[]).join(", "))}</p><h3>Abstract</h3><p>${esc(r.abstract||"No abstract available.")}</p><h3>My note</h3><p>${esc(e.note||"")}</p>${e.transcript?`<h3>Scratchpad text</h3><p>${esc(e.transcript)}</p>`:""}${e.drawing?`<h3>Scratchpad</h3><img style="max-width:100%;border:1px solid #bbb" src="${e.drawing}" alt="Researcher's handwritten or drawn annotation">`:""}${rel?`<h3>Related material</h3><ul>${rel}</ul>`:""}</article>`}).join("");
  let doc=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Open Research Navigator — Daughters of the Dust Session</title><style>body{max-width:900px;margin:auto;padding:2rem;font:18px/1.55 Georgia,serif;color:#222;background:#faf8f4}article{border-top:2px solid #a67d34;padding-top:1rem;margin-top:2rem}a{color:#5f4519}time{font: .85em system-ui}</style></head><body><h1>Open Research Navigator — Research Session</h1><p><em>Daughters of the Dust</em> (Julie Dash, 1991)</p><p><strong>Profile:</strong> ${esc(profile.age)} / ${esc(profile.purpose)}${profile.guided?" / adult-guided":""}<br><strong>Started:</strong> ${esc(nice(state.started))}<br><strong>Downloaded:</strong> ${esc(new Date().toLocaleString())}</p><p>External links require internet access. Check original sources before quoting, citing, or relying on an abstract-based quick read.</p><h2>Session trail</h2><ol>${trail}</ol><h2>Selected research</h2>${cards}</body></html>`;
  dl(`open-research-session-daughters-${stamp()}.html`,doc,"text/html;charset=utf-8");log("export","Downloaded HTML research session")
}
init().catch(e=>{console.error(e);$("searchStatus").textContent="Prototype initialization failed."});
