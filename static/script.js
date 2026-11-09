"use strict";
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const HISTORY_KEY = "truthlens_analysis_history_v1";
let toastTimer;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function getHistory() {
  try { const x = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); return Array.isArray(x) ? x : []; }
  catch { return []; }
}
function saveHistory(items) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0,100))); }
  catch { showToast("Browser storage unavailable; history was not saved.", true); }
}
function showToast(message, error=false) {
  const el=$("#toast"); el.textContent=message; el.classList.toggle("error",error); el.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),3200);
}
function navigate(name) {
  const target=$(`#view-${name}`); if(!target)return;
  $$(".view-section").forEach(x=>x.classList.remove("active")); target.classList.add("active");
  $$(".nav-link").forEach(x=>x.classList.toggle("active",x.dataset.viewLink===name));
  const labels={overview:"Overview",analyze:"Analyze News",history:"Analysis History",model:"Model Details",about:"About Project"};
  $("#breadcrumbCurrent").textContent=labels[name]||"Overview"; $("#sidebar").classList.remove("open");
  if(name==="history")renderHistory(); if(name==="overview")renderRecent();
  window.scrollTo({top:0,behavior:"smooth"});
}
function setupNavigation() {
  $$("[data-view-link]").forEach(b=>b.addEventListener("click",e=>{e.preventDefault();navigate(b.dataset.viewLink)}));
  $("#mobileMenu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  document.addEventListener("click",e=>{if(innerWidth<=850&&$("#sidebar").classList.contains("open")&&!$("#sidebar").contains(e.target)&&!$("#mobileMenu").contains(e.target))$("#sidebar").classList.remove("open")});
}
function setupTabs() {
  $("#textTab").addEventListener("click",()=>{ $("#textTab").classList.add("active");$("#urlTab").classList.remove("active");$("#textMode").classList.remove("hidden");$("#urlMode").classList.add("hidden");$("#textTab").setAttribute("aria-selected","true");$("#urlTab").setAttribute("aria-selected","false");});
  $("#urlTab").addEventListener("click",()=>{ $("#urlTab").classList.add("active");$("#textTab").classList.remove("active");$("#textMode").classList.add("hidden");$("#urlMode").classList.remove("hidden");$("#urlTab").setAttribute("aria-selected","true");$("#textTab").setAttribute("aria-selected","false");});
  $("#backToText").addEventListener("click",()=>$("#textTab").click());
}
function updateWordCount(){const t=$("#newsText").value.trim();const n=t?t.split(/\s+/).length:0;$("#wordCounter").textContent=`${n.toLocaleString()} ${n===1?"word":"words"}`;}
function fmt(v){return v===null||v===undefined?"—":typeof v==="number"?(Number.isInteger(v)?v.toLocaleString():v>=0&&v<=1?`${(v*100).toFixed(2)}%`:v.toFixed(4)):String(v);}
async function loadStatus(){
  try{
    const r=await fetch("/api/status");const d=await r.json();if(!r.ok||d.status!=="ok")throw Error(d.details||d.message||"Model unavailable");
    $("#sidebarStatusDot").className="status-dot online";$("#sidebarStatus").textContent="Model connected";$("#sidebarStatusText").textContent="Prediction API responding";
    $("#statModel").textContent=d.model||"Classifier";$("#modelFoot").textContent="API connected";$("#detailStatus").textContent="Online";$("#modelName").textContent=d.model||"Trained classifier";$("#modelStatusPill").textContent="● Connected";$("#modelStatusPill").className="status-pill online";
    $("#statTraining").textContent=fmt(d.articles_trained);$("#detailTraining").textContent=fmt(d.articles_trained);
    const f=d.cv_f1_mean??d.metrics?.cv_f1_mean;$("#detailF1").textContent=typeof f==="number"?`${(f*100).toFixed(2)}%`:"Not provided";
    const metrics={...(d.metrics||{})};if(typeof d.cv_f1_mean==="number"&&!Object.hasOwn(metrics,"cv_f1_mean"))metrics.cv_f1_mean=d.cv_f1_mean;
    const entries=Object.entries(metrics);$("#metricsTable").innerHTML=entries.length?entries.map(([k,v])=>`<div class="metric-item"><span>${escapeHTML(k.replaceAll("_"," "))}</span><strong>${escapeHTML(fmt(v))}</strong></div>`).join(""):'<p class="muted-text">No evaluation metrics were saved in this bundle.</p>';
  }catch(e){
    console.error(e);$("#sidebarStatusDot").className="status-dot offline";$("#sidebarStatus").textContent="Model unavailable";$("#sidebarStatusText").textContent="Check model path and server";
    $("#statModel").textContent="Offline";$("#modelFoot").textContent="Connection unavailable";$("#detailStatus").textContent="Offline";$("#modelName").textContent="Not loaded";$("#modelStatusPill").textContent="● Disconnected";$("#modelStatusPill").className="status-pill offline";
    $("#metricsTable").innerHTML=`<p class="muted-text">Model status unavailable. ${escapeHTML(e.message)}</p>`;
  }
}
function setLoading(on){$("#analyzeButton").disabled=on;$("#analyzeButtonText").textContent=on?"Analyzing article…":"Analyze article";}
function renderChips(target,items,fake=false){
  if(!Array.isArray(items)||!items.length){target.innerHTML='<span class="muted-text">No influential terms returned.</span>';return;}
  target.innerHTML=items.map(x=>{const word=Array.isArray(x)?x[0]:x?.word??x?.term??x;const score=Array.isArray(x)?Number(x[1]):Number(x?.contribution??x?.score);return `<span class="word-chip ${fake?"fake-chip":""}" title="${escapeHTML(Number.isFinite(score)?score.toFixed(4):word)}">${escapeHTML(word)}</span>`}).join("");
}
function renderResult(d){
  const p=Number(d.p_real);if(!Number.isFinite(p)||p<0||p>1)throw Error("API returned an invalid REAL probability.");
  const label=String(d.label||"").toUpperCase();if(!["REAL","FAKE"].includes(label))throw Error("API returned an invalid label.");
  const confidence=Number.isFinite(Number(d.confidence))?Number(d.confidence):Math.max(p,1-p)*100;
  $("#resultPlaceholder").classList.add("hidden");$("#resultContent").classList.remove("hidden");
  $("#resultBadge").textContent=label+" PREDICTION";$("#resultBadge").className="prediction-badge "+label.toLowerCase();
  $("#predictionTitle").textContent=label;$("#predictionTitle").className="prediction-title "+label.toLowerCase();
  $("#predictionDescription").textContent=label==="REAL"?"The classifier predicts REAL based on patterns learned during training. This is not independent fact verification.":"The classifier predicts FAKE based on patterns learned during training. Verify the claim with reliable independent sources.";
  $("#confidenceValue").textContent=confidence.toFixed(2)+"%";$("#confidenceFill").style.width=Math.max(0,Math.min(100,confidence))+"%";
  $("#realScore").textContent=(p*100).toFixed(2)+"%";$("#fakeScore").textContent=((1-p)*100).toFixed(2)+"%";$("#resultWords").textContent=fmt(d.n_words)+" words";
  renderChips($("#realWords"),d.real_words);renderChips($("#fakeWords"),d.fake_words,true);
  $("#resultPanel").scrollIntoView({behavior:"smooth",block:"start"});
}
async function analyze(){
  const title=$("#newsTitle").value.trim(),text=$("#newsText").value.trim(),err=$("#formError");err.classList.add("hidden");
  if(!text){err.textContent="Please paste article text first.";err.classList.remove("hidden");$("#newsText").focus();return;}
  if(text.split(/\s+/).length<3){err.textContent="Please enter at least a few words.";err.classList.remove("hidden");return;}
  setLoading(true);
  try{
    const r=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({title,text})});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||d.details||`Request failed (${r.status})`);
    renderResult(d);
    const item={id:Date.now()+"-"+Math.random().toString(36).slice(2,7),title:title||text.slice(0,85).replace(/\s+/g," "),preview:text.slice(0,5000),label:d.label,p_real:Number(d.p_real),confidence:Number(d.confidence??Math.max(Number(d.p_real),1-Number(d.p_real))*100),n_words:Number(d.n_words??text.split(/\s+/).length),created_at:new Date().toISOString()};
    const history=getHistory();history.unshift(item);saveHistory(history);updateStats();renderRecent();showToast("Analysis completed.");
  }catch(e){console.error(e);err.textContent=e.message||"Analysis failed. Check the Flask server.";err.classList.remove("hidden");}
  finally{setLoading(false);}
}
function dateFmt(s){const d=new Date(s);return Number.isNaN(d.getTime())?"Unknown date":d.toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"});}
function activity(item){
 const real=String(item.label).toUpperCase()==="REAL";
 return `<div class="activity-item"><div class="activity-symbol ${real?"real":"fake"}">${real?"✓":"!"}</div><div class="activity-copy"><strong title="${escapeHTML(item.title)}">${escapeHTML(item.title||"Untitled article")}</strong><small>${escapeHTML(dateFmt(item.created_at))}</small></div><span class="activity-label ${real?"real":"fake"}">${real?"REAL":"FAKE"}</span></div>`;
}
function renderRecent(){const h=getHistory().slice(0,4);$("#recentActivity").innerHTML=h.length?h.map(activity).join():'<div class="empty-state compact-empty"><span class="empty-icon">◷</span><strong>No activity yet</strong><p>Your completed analyses will appear here.</p></div>';}
function updateStats(){$("#statAnalyzed").textContent=getHistory().length.toLocaleString();}
function renderHistory(){
 const q=$("#historySearch").value.trim().toLowerCase();const h=getHistory().filter(x=>`${x.title||""} ${x.preview||""} ${x.label||""}`.toLowerCase().includes(q));
 $("#historyCount").textContent=`${h.length} ${h.length===1?"analysis":"analyses"}`;
 if(!h.length){$("#historyList").innerHTML=`<div class="empty-state"><span class="empty-icon">◷</span><strong>${q?"No matching articles":"Your history is empty"}</strong><p>${q?"Try another search term.":"Analyze an article to see it here."}</p></div>`;return;}
 $("#historyList").innerHTML=h.map(x=>{const real=String(x.label).toUpperCase()==="REAL";return `<div class="history-row"><div class="activity-symbol ${real?"real":"fake"}">${real?"✓":"!"}</div><div class="history-row-main"><strong title="${escapeHTML(x.title)}">${escapeHTML(x.title)}</strong><small>${escapeHTML(dateFmt(x.created_at))} · ${fmt(x.n_words)} words</small></div><div class="history-confidence">${Number(x.confidence).toFixed(1)}%</div><span class="activity-label ${real?"real":"fake"}">${real?"REAL":"FAKE"}</span><button class="history-open" data-history-id="${escapeHTML(x.id)}">View</button></div>`}).join("");
 $("#historyList").querySelectorAll("[data-history-id]").forEach(b=>b.addEventListener("click",()=>{const x=getHistory().find(y=>y.id===b.dataset.historyId);if(!x)return;navigate("analyze");$("#newsTitle").value=x.title||"";$("#newsText").value=x.preview||"";updateWordCount();showToast("Saved text preview loaded. Re-analyze for a fresh prediction.");}));
}
document.addEventListener("DOMContentLoaded",()=>{
 setupNavigation();setupTabs();$("#newsText").addEventListener("input",updateWordCount);$("#analyzeButton").addEventListener("click",analyze);
 $("#newsText").addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")analyze();});
 $("#analyzeAnother").addEventListener("click",()=>{$("#newsTitle").value="";$("#newsText").value="";updateWordCount();$("#resultContent").classList.add("hidden");$("#resultPlaceholder").classList.remove("hidden");$("#newsTitle").focus();});
 $("#historySearch").addEventListener("input",renderHistory);$("#clearHistory").addEventListener("click",()=>{if(!getHistory().length){showToast("No history to clear.");return;}if(confirm("Clear all analysis history saved in this browser?")){saveHistory([]);renderHistory();renderRecent();updateStats();showToast("History cleared.");}});
 $("#currentDate").textContent=new Date().toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});updateWordCount();updateStats();renderRecent();renderHistory();loadStatus();
});
