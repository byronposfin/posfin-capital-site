import { esc } from './case-portal.js';

const CSS = `
:root{--navy:#1C184F;--ink:#13113A;--gold:#D4A853;--paper:#F6F4EF;--line:#E4DFD4;--teal:#0E7C78;--urgent:#9F1239;--urgent-bg:#FDECEC;--wait:#8A5A00;--wait-bg:#FFF6DF;--ok:#E7F6F3}
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper);font-size:16px;line-height:1.45;padding-bottom:40px}
button,input,textarea{font:inherit}a{color:var(--teal)}
header.top{background:linear-gradient(180deg,#1C184F 0%,#13113A 100%);color:#fff;padding:14px 16px 16px;position:sticky;top:0;z-index:5}
.top-inner{max-width:760px;margin:0 auto}.brand{display:flex;align-items:center;justify-content:space-between;gap:12px}.brand img{height:28px}
.private{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.72)}
header.top h1{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:26px;margin:10px 0 4px}
.sub{margin:0;color:rgba(255,255,255,.82);font-size:14px}.counts{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:12px}.counts span{background:rgba(255,255,255,.12);border-radius:999px;padding:3px 10px}
.wrap{max-width:760px;margin:0 auto;padding:12px 12px 64px}
.banner{background:#FFF6DF;border:1px solid #E2C98A;color:#5C4300;border-radius:16px;padding:10px 12px;margin:0 0 12px;font-weight:700;font-size:14px}
.kicker{margin:16px 0 0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--teal);font-weight:700}
h2{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:24px;margin:0 0 8px}
.card{background:#fff;border:1px solid var(--line);border-left:5px solid var(--teal);border-radius:18px;padding:14px;margin:0 0 12px}
.card.Emergency{border-left-color:var(--urgent)}.card.Urgent{border-left-color:#d98a00}.card.Watch{border-left-color:#1C3D73}
.card h3{margin:8px 0 6px;font-size:18px;line-height:1.25}.card p{margin:0 0 8px}
.pill{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;padding:4px 8px;border-radius:999px;background:#E7E2D8;color:var(--navy);margin-right:4px}
.pill.Emergency{background:var(--urgent-bg);color:var(--urgent)}.pill.Urgent{background:var(--wait-bg);color:var(--wait)}.pill.Watch{background:#E8EEF8;color:#1C3D73}.pill.time{background:var(--ok);color:var(--teal)}.pill.src{background:#ECEAF3}
.meta{color:#5C5670;font-size:14px}
.lines{margin:8px 0;padding:0;list-style:none;font-size:14px}.lines li{padding:4px 0;border-top:1px solid var(--line)}.lines strong{display:inline-block;min-width:6.2rem}
.act{background:var(--ok);border:1px solid #cfe9e4;border-radius:12px;padding:10px;font-weight:700;color:var(--navy);font-size:15px}
.links{margin:8px 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px}.links a{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:6px 10px;font-size:13px;text-decoration:none}
.btns{display:flex;gap:8px;margin-top:10px}.btns button{flex:1;min-height:48px;border-radius:999px;border:1px solid var(--line);background:#fff;font-weight:700;color:var(--navy);cursor:pointer}
.btns .yes{background:var(--navy);color:#fff;border-color:var(--navy)}.btns .on{outline:3px solid var(--gold)}
textarea{width:100%;border:1px solid var(--line);border-radius:12px;padding:12px;min-height:88px;margin-top:8px;display:none}
.card.editing textarea,.card.editing .editbar{display:block}.editbar{display:none;margin-top:8px}
.editbar button,.rec{min-height:44px;border-radius:999px;padding:8px 14px;border:1px solid var(--line);background:#fff;cursor:pointer;font-weight:700}
.editbar .save{background:var(--navy);color:#fff;border-color:var(--navy)}.rec.live{background:var(--urgent);color:#fff;border-color:var(--urgent)}
.state{font-size:13px;font-weight:700;margin-left:8px}.state.ok{color:#135C24}.state.q{color:var(--wait)}.state.err{color:var(--urgent)}
.voice{font-size:14px;background:#F7F4EA;border-radius:10px;padding:8px;margin-top:8px}
details.audit{margin-top:8px;font-size:14px}details.audit li{border-top:1px solid var(--line);padding:4px 0}
.done .card{opacity:.75;border-left-color:#135C24}.done .card .btns,.done .card .ctl{display:none}
.toggle{display:flex;gap:0;margin:0 0 10px;border:1px solid var(--line);border-radius:999px;overflow:hidden;background:#fff}.toggle a{flex:1;text-align:center;padding:10px;text-decoration:none;font-weight:700;color:var(--navy)}.toggle a[aria-current=page]{background:var(--navy);color:#fff}.allclear{border-left-color:#135C24;text-align:center}
.toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.toolbar a,.toolbar button{font-size:13px}
`;

function shell(title, body, extra = '') {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Playfair+Display:wght@500&display=swap" rel="stylesheet"><style>${CSS}${extra}</style></head><body>${body}</body></html>`;
}

function head(sub, title = 'Run sheet') {
  return `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">Staff · ${esc(title)}</span></div><h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p><div class="counts"><span id="c-open">…</span><span id="c-done">…</span><span id="c-sync">Saved</span></div></div></header>`;
}

export function renderRunSheetLogin(message, next) {
  const hidden = next === '/staff/tasks' ? '<input type="hidden" name="next" value="/staff/tasks">' : '';
  const body = `${head('Sign in with your own work email.')}<main class="wrap"><article class="card"><form method="post" action="/staff/run"><label for="email">Work email</label><br><input id="email" name="email" type="email" autocomplete="username" style="width:100%;min-height:48px;border:1px solid #E4DFD4;border-radius:12px;padding:12px"><br><label for="password">Password</label><br><input id="password" name="password" type="password" autocomplete="current-password" required minlength="8" style="width:100%;min-height:48px;border:1px solid #E4DFD4;border-radius:12px;padding:12px">${hidden}<p>${esc(message || '')}</p><div class="btns"><button class="yes" type="submit">Open the run sheet</button></div></form><p><a href="/staff/set-password">Forgot password?</a></p></article></main>`;
  return shell('Run sheet — Posfin', body);
}

export function renderRunSheetMessage(title, text) {
  return shell(`${title} — Posfin`, `${head(title)}<main class="wrap"><article class="card"><p>${esc(text)}</p><p><a href="/staff/run">Back to the run sheet</a></p></article></main>`);
}

export function renderRunSheet(model) {
  const data = JSON.stringify({ open: model.open, done: model.done, date: model.date, seat: model.seat || '', canSave: model.canSave, storeOk: model.storeOk }).replace(/</g, '\\u003c');
  const warn = !model.canSave
    ? '<p class="banner">Answers on this sign-in stay on this phone only. Sign in with your own work email to save to the case book.</p>'
    : (!model.storeOk ? '<p class="banner">The run sheet table did not load. Taps are queued on this phone and retried.</p>' : '');
  const body = `${head('Yes, No or Edit. Each tap saves straight away.')}<main class="wrap">${warn}
<nav class="toggle" aria-label="View"><a href="/staff/cockpit">Dashboard</a><a href="/staff/run" aria-current="page">Run sheet</a></nav>${model.seat ? `<p class="meta">Seat: <strong>${esc(model.seat)}</strong> · your cards and shared cards</p>` : ''}
<div class="toolbar"><button class="rec" id="refresh" type="button">Refresh</button><form method="post" action="/staff/run" style="margin:0"><input type="hidden" name="action" value="logout"><button class="rec" type="submit">Log out</button></form></div>
<p class="kicker">Ordered by urgency, due date, then quickest first</p><h2>To do</h2><div id="open"></div>
<section class="done"><p class="kicker">Cleared</p><h2>Done today</h2><div id="done"></div></section>
</main><script>window.__RUN__=${data};</script><script>${CLIENT}</script>`;
  return shell('Run sheet — Posfin', body);
}

const CLIENT = String.raw`
(function(){
var M=window.__RUN__,Q='pf_run_q_'+M.date,L='pf_run_local_'+M.date;
var queue=[];try{queue=JSON.parse(localStorage.getItem(Q)||'[]')}catch(e){}
var local={};try{local=JSON.parse(localStorage.getItem(L)||'{}')}catch(e){}
var editing={},drafts={};
function saveQ(){try{localStorage.setItem(Q,JSON.stringify(queue))}catch(e){};sync()}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function cid(){return 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,10)}
function paris(iso){try{return new Date(iso).toLocaleTimeString('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'})+' Paris'}catch(e){return ''}}
function sync(){var el=document.getElementById('c-sync');var n=queue.length;el.textContent=n?n+' waiting to save':'All saved ✓'}
function safe(h){h=String(h||'');if(/^\/(?!\/)/.test(h)||/^https:\/\//i.test(h)||/^mailto:/i.test(h))return h;return ''}
function kind(k){return k==='email'?'Email':k==='document'?'Document':k==='pr'?'Pull request':k==='url'?'Link':'Case'}
function card(it,isDone){
 var a=it.answer||local[it.ref];var links=(it.links||[]).map(function(l){var h=safe(l.href);return h?'<li><a href="'+esc(h)+'"'+(/^https:/.test(h)?' target="_blank" rel="noopener"':'')+'>'+esc(kind(l.kind))+' · '+esc(l.label)+'</a></li>':''}).join('');
 var lines='';if(it.source==='case'){lines='<ul class="lines"><li><strong>Next</strong> '+esc(it.act||'—')+'</li><li><strong>Status</strong> '+esc(it.status||'—')+'</li><li><strong>Known done</strong> '+esc(it.knownDone||'—')+'</li><li><strong>Release</strong> '+esc(it.releaseLine||'—')+'</li></ul>'}
 var hist=(it.history||[]).slice().reverse().map(function(h){return '<li><strong>'+esc((h.by||'').split('@')[0])+'</strong> · '+esc(paris(h.at))+'<br>'+esc(h.what)+'</li>'}).join('');
 var voice=(it.voice||[]).map(function(v){return '<div class="voice">🎙 '+esc(v.transcript||('Voice note saved '+paris(v.at)+(v.status&&v.status!=='done'?' (transcript to follow)':'')))+'</div>'}).join('');
 var doneLine=isDone&&a?'<p class="meta"><strong>Done by '+esc(String(a.by||'you').split('@')[0])+' at '+esc(paris(a.at))+'</strong> · '+esc(String(a.decision||'').toUpperCase())+(a.edit?': '+esc(a.edit):'')+'</p>':'';
 var num=it.n?'#'+it.n+' · ':'';
 return '<article class="card '+esc(it.urg||'Normal')+(editing[it.ref]?' editing':'')+'" data-ref="'+esc(it.ref)+'">'+
 '<span class="pill '+esc(it.urg||'Normal')+'">'+esc(it.urg||'Normal')+'</span><span class="pill time">⏱ '+esc(it.t||'')+'</span><span class="pill src">'+(it.source==='case'?'Live case':'Task')+'</span>'+
 '<h3>'+esc(num)+esc(it.case)+'</h3><p><strong>'+esc(it.need)+'</strong></p><p class="meta">'+esc(it.ctx)+'</p>'+lines+
 (it.due?'<p class="meta">Due '+esc(it.due)+(it.owner?' · '+esc(it.owner):'')+'</p>':'')+
 '<p class="kicker" style="margin-top:6px">Suggested next step</p><div class="act">'+esc(it.act)+'</div>'+
 (links?'<ul class="links">'+links+'</ul>':'')+doneLine+voice+
 '<div class="btns"><button class="yes" data-d="yes">Yes</button><button data-d="no">No</button><button data-d="edit">Edit</button></div>'+
 '<textarea placeholder="Type or tap the keyboard mic to dictate" autocomplete="on" autocorrect="on" spellcheck="true">'+esc(drafts[it.ref]||(a&&a.edit)||'')+'</textarea>'+
 '<div class="editbar"><button class="save" data-save="1">Save edit</button></div>'+
 '<div class="ctl" style="margin-top:8px"><button class="rec" data-rec="1">🎙 Voice note</button><span class="state" data-state></span></div>'+
 '<details class="audit"><summary>Audit history</summary>'+(hist?'<ol>'+hist+'</ol>':'<p class="meta">No answers yet.</p>')+'</details></article>'}
function render(){
 var open=M.open.filter(function(it){return !local[it.ref]}),moved=M.open.filter(function(it){return local[it.ref]});
 var done=moved.concat(M.done);
 document.getElementById('open').innerHTML=open.map(function(i){return card(i,false)}).join('')||'<article class="card allclear"><h3>All clear ✓</h3><p class="meta">Nothing waiting for you. New cards appear here on their own.</p></article>';
 document.getElementById('done').innerHTML=done.map(function(i){return card(i,true)}).join('')||'<p class="meta">Nothing answered yet.</p>';
 document.getElementById('c-open').textContent=open.length+' to do';document.getElementById('c-done').textContent=done.length+' done';sync()}
function find(ref){return M.open.concat(M.done).filter(function(i){return i.ref===ref})[0]}
function post(job){return fetch('/staff/run',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(job)}).then(function(r){return r.json().then(function(j){if(!r.ok||!j.ok){var e=new Error(j.error||'http'+r.status);e.status=r.status;throw e}return j})})}
function flush(){if(!queue.length||!M.canSave)return Promise.resolve();var job=queue[0];return post(job).then(function(j){queue.shift();saveQ();var it=find(job.ref);if(it&&job.op==='voice'){it.voice=(it.voice||[]).concat([{at:j.at,transcript:j.transcript,status:j.transcript_status}]);render()}return flush()}).catch(function(e){if(e.status===400){queue.shift();saveQ()}})}
function mark(ref,txt,cls){var el=document.querySelector('[data-ref="'+CSS.escape(ref)+'"] [data-state]');if(el){el.textContent=txt;el.className='state '+cls}}
function answer(ref,d,edit){var job={op:'answer',ref:ref,decision:d,edit_text:edit||'',date:M.date,client_id:cid(),client_ts:new Date().toISOString()};
 local[ref]={decision:d,edit:edit||'',by:'you',at:job.client_ts};try{localStorage.setItem(L,JSON.stringify(local))}catch(e){}
 delete editing[ref];queue.push(job);saveQ();render();
 if(!M.canSave){mark(ref,'Saved on this phone','q');return}
 post(job).then(function(){queue=queue.filter(function(x){return x.client_id!==job.client_id});saveQ();var c=document.getElementById('c-sync');c.textContent='Saved ✓ '+paris(new Date().toISOString())}).catch(function(){document.getElementById('c-sync').textContent='Offline · '+queue.length+' waiting'})}
var rec=null,chunks=[],recRef=null,timer=null;
function startRec(ref,btn){if(!navigator.mediaDevices||!window.MediaRecorder){alert('Voice notes need a newer browser. Use the keyboard mic in Edit instead.');return}
 navigator.mediaDevices.getUserMedia({audio:true}).then(function(st){var types=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg'];var t=types.filter(function(x){return MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(x)})[0];
 rec=new MediaRecorder(st,t?{mimeType:t,audioBitsPerSecond:32000}:undefined);chunks=[];recRef=ref;rec.ondataavailable=function(e){if(e.data.size)chunks.push(e.data)};
 rec.onstop=function(){st.getTracks().forEach(function(x){x.stop()});clearTimeout(timer);var blob=new Blob(chunks,{type:rec.mimeType||'audio/webm'});var fr=new FileReader();fr.onload=function(){var b64=String(fr.result).split(',')[1];var job={op:'voice',ref:recRef,mime:blob.type,audio_b64:b64,date:M.date,client_id:cid()};queue.push(job);saveQ();mark(recRef,'Uploading voice note…','q');flush().then(function(){mark(job.ref,queue.some(function(q){return q.client_id===job.client_id})?'Voice note waiting to save':'Voice note saved ✓','ok')})};fr.readAsDataURL(blob);rec=null;render()};
 rec.start();btn.textContent='■ Stop (max 90 s)';btn.classList.add('live');timer=setTimeout(function(){if(rec)rec.stop()},90000)}).catch(function(){alert('Microphone permission was refused.')})}
document.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var c=b.closest('[data-ref]');if(b.id==='refresh'){poll();return}if(!c)return;var ref=c.getAttribute('data-ref');
 if(b.dataset.d==='edit'){editing[ref]=true;render();var ta=document.querySelector('[data-ref="'+CSS.escape(ref)+'"] textarea');if(ta)ta.focus();return}
 if(b.dataset.d){answer(ref,b.dataset.d,'');return}
 if(b.dataset.save){var ta=c.querySelector('textarea');var v=(ta.value||'').trim();if(!v){ta.focus();return}delete drafts[ref];answer(ref,'edit',v);return}
 if(b.dataset.rec){if(rec){rec.stop()}else startRec(ref,b)}});
document.addEventListener('input',function(e){var c=e.target.closest('[data-ref]');if(c&&e.target.tagName==='TEXTAREA')drafts[c.getAttribute('data-ref')]=e.target.value});
function poll(){if(rec||document.activeElement&&document.activeElement.tagName==='TEXTAREA')return;fetch('/staff/run?format=json'+(/[?&]date=/.test(location.search)?'&date='+encodeURIComponent(M.date):'')+(M.seat?'&seat='+encodeURIComponent(M.seat):''),{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(j){if(!j.ok)return;if(j.date&&j.date!==M.date){M.date=j.date;Q='pf_run_q_'+M.date;L='pf_run_local_'+M.date;local={}}M.open=j.open;M.done=j.done;M.storeOk=j.storeOk;
 var server={};j.done.forEach(function(i){server[i.ref]=1});Object.keys(local).forEach(function(k){if(server[k]&&!queue.some(function(q){return q.ref===k&&q.op==='answer'}))delete local[k]});try{localStorage.setItem(L,JSON.stringify(local))}catch(e){};render()}).catch(function(){})}
render();flush();setInterval(function(){flush();poll()},60000);window.addEventListener('focus',function(){flush().then(poll)});window.addEventListener('online',function(){flush().then(poll)});
document.addEventListener('visibilitychange',function(){if(!document.hidden){flush().then(poll)}});
})();`;

const POPUP_CSS = `
.filters{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.filters input,.filters select{min-height:44px;border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:#fff}
.rowbtns{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.rowbtns button,.rowbtns a.btn{min-height:44px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--navy);font-weight:700;padding:8px 12px;text-decoration:none;display:inline-flex;align-items:center}
.rowbtns .yes{background:var(--navy);color:#fff;border-color:var(--navy)}
.block{margin-top:8px}.block label{font-weight:700;font-size:13px;display:block;margin-top:8px}
.block input,.block select,.block textarea{width:100%;min-height:44px;border:1px solid var(--line);border-radius:12px;padding:8px;display:block}
article.card textarea[data-edit]{display:none}
article.card.editing textarea[data-edit]{display:block}
.add{background:#fff;border:1px solid var(--line);border-radius:18px;padding:14px;margin:0 0 12px}
.stamp{font-size:13px;font-weight:700;color:#135C24}
#done-wrap .card .ctl{display:block}
.key{background:#FDECEC;border:1px solid #E7B4BE;color:#9F1239}
`;

export function renderPopup(model) {
  const data = JSON.stringify({
    open: model.open,
    done: model.done,
    date: model.date,
    seat: model.seat || '',
    viewer: model.viewer || model.seat || '',
    canSave: model.canSave,
    storeOk: model.storeOk,
    transcription: 'no_key',
  }).replace(/</g, '\\u003c');
  const warn = !model.canSave
    ? '<p class="banner">Answers on this sign-in stay on this phone only. Sign in with your own work email to save to the case book.</p>'
    : (!model.storeOk ? '<p class="banner">The task list did not load. Taps are queued on this phone and retried.</p>' : '');
  const body = `${head('One list. Every tap saves straight away. Nothing is sent.', 'My tasks')}<main class="wrap">${warn}
<p class="banner key" id="voice-key">Voice transcription key is not set. A voice note still saves. There is no transcript until Byron or Tom adds the key on the server. This page does not add one.</p>
<p class="banner">Preview list. Copy only. No email, WhatsApp, SMS, lender, BROKA or borrower message is sent from here.</p>
<nav class="toggle" aria-label="View"><a href="/staff/cockpit">Dashboard</a><a href="/staff/tasks" aria-current="page">My tasks</a><a href="/staff/command">Command</a></nav>
<div class="filters" id="filters">
<label>Seat <select id="f-seat"></select></label>
<label>Priority <select id="f-urg"><option value="">All</option><option>Emergency</option><option>Urgent</option><option>Watch</option><option>Normal</option></select></label>
<label>Search <input id="f-q" type="search" placeholder="Case or task"></label>
<label><input id="f-done" type="checkbox"> Show done</label>
<button class="rec" id="refresh" type="button">Refresh</button>
</div>
<section class="add" id="add-task"><h2>Add task</h2>
<label for="add-case">Task</label><input id="add-case" maxlength="200">
<label for="add-need">What is needed</label><input id="add-need" maxlength="500">
<label for="add-owner">Owner</label><select id="add-owner"></select>
<label for="add-due">Due date</label><input id="add-due" type="date">
<button class="yes rec" id="add-go" type="button">Add task</button>
</section>
<p class="kicker">Ordered by urgency, due date, then quickest first</p><h2>To do</h2><div id="open"></div>
<section class="done" id="done-wrap" hidden><p class="kicker">Cleared</p><h2>Done</h2><div id="done"></div></section>
</main><script>window.__RUN__=${data};</script><script>${POPUP_CLIENT}</script>`;
  return shell("My tasks — Posfin", body, POPUP_CSS);
}

const POPUP_CLIENT = String.raw`
(function(){
var M=window.__RUN__,Q='pf_pop_q_'+M.date,L='pf_pop_local_'+M.date;
var queue=[];try{queue=JSON.parse(localStorage.getItem(Q)||'[]')}catch(e){}
var local={};try{local=JSON.parse(localStorage.getItem(L)||'{}')}catch(e){}
var editing={},drafts={},notes={};
var OWNERS=['Byron','Chris','Aadi','Jess','Cai','Vanessa','Lizzy','Tom'];
var SEATS=['byron','chris','aadi','jess','cai','vanessa','lizzy','tom'];
function saveQ(){try{localStorage.setItem(Q,JSON.stringify(queue))}catch(e){};sync()}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function cid(){return 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,10)}
function paris(iso){try{return new Date(iso).toLocaleTimeString('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'})}catch(e){return ''}}
function sync(){var el=document.getElementById('c-sync');if(!el)return;var n=queue.length;el.textContent=n?n+' waiting to save':'All saved'}
function safe(h){h=String(h||'');if(h.indexOf('/staff/')===0&&h.indexOf('//')<0&&h.indexOf('..')<0)return h;if(h.indexOf('https://github.com/byronposfin/posfin-capital-site/')===0)return h;return ''}
function caseOk(id){return /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(String(id||''))}
function fileOk(id){return /^[A-Za-z0-9-]{6,48}$/.test(String(id||''))}
function stamp(ref,txt){var el=document.querySelector('[data-ref="'+CSS.escape(ref)+'"] [data-state]');if(el){el.textContent=txt;el.className='stamp'}}
function find(ref){return M.open.concat(M.done).filter(function(i){return i.ref===ref})[0]}
function post(job){return fetch('/staff/run',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(job)}).then(function(r){return r.json().then(function(j){if(!r.ok||!j.ok){var e=new Error(j.error||'http'+r.status);e.status=r.status;throw e}return j})})}
function jobOf(ref,op,extra){var job={op:op,view:'popup',ref:ref,date:M.date,client_id:cid(),client_ts:new Date().toISOString()};if(extra)Object.keys(extra).forEach(function(k){job[k]=extra[k]});return job}
function flush(){if(!queue.length||!M.canSave)return Promise.resolve();var job=queue[0];return post(job).then(function(){queue.shift();saveQ();return flush()}).catch(function(e){if(e.status===400){queue.shift();saveQ()}})}
function remember(ref,patch){local[ref]=Object.assign({at:new Date().toISOString()},local[ref]||{},patch);try{localStorage.setItem(L,JSON.stringify(local))}catch(e){}}
function answer(ref,op,extra){var job=jobOf(ref,op,extra);if(op==='yes'||op==='no'||op==='edit'||op==='done')remember(ref,{closed:true,op:op});if(op==='reopen')remember(ref,{closed:false,op:op});queue.push(job);saveQ();render();
 if(!M.canSave){stamp(ref,'Saved on this phone');return}
 post(job).then(function(j){queue=queue.filter(function(x){return x.client_id!==job.client_id});saveQ();var line='Saved ✓ '+paris(j.at||job.client_ts);if(j.next&&j.next.item)M.open.push(j.next.item);if(j.next&&j.next.kind==='flag'){var it=find(ref);if(it)it.nextFlag=j.next.text;line+=' · Lizzy to generate next'}remember(ref,{stamp:line});render()}).catch(function(){remember(ref,{stamp:'Saved on this phone · waiting'});render()})}
function kept(ref,key,fallback){var bag=pending[ref];if(bag&&bag[key]!=null)return bag[key];return fallback||''}
function card(it,isDone){
 var loc=local[it.ref]||{};var closed=isDone||loc.closed;var num=it.n?'#'+it.n+' ':'';
 var links=(it.links||[]).map(function(l){var h=safe(l.href);return h?'<a class="btn" href="'+esc(h)+'">'+esc(l.label||'Open')+'</a>':''}).join('');
 var id=it.caseId||'';var desks='';
 if(caseOk(id)){desks+='<a class="btn" href="/staff/cockpit/broka/'+encodeURIComponent(id)+'">Submit to BROKA (eligibility check)</a>';desks+='<a class="btn" href="/staff/cockpit/el/'+encodeURIComponent(id)+'">EL / LOR desk</a>';if(fileOk(id))desks+='<a class="btn" href="/staff/cases/'+encodeURIComponent(id)+'">Open case file</a>'}
 else desks+='<button type="button" disabled>Submit to BROKA (eligibility check)</button><span class="meta">No case reference. Nothing on this page contacts BROKA.</span>';
 desks+='<a class="btn" href="/staff/command">Files & sheets</a>';
 var owner=OWNERS.map(function(o){return '<option'+(o===(loc.owner||it.owner)?' selected':'')+'>'+esc(o)+'</option>'}).join('');
 var draft=(it.drafts&&it.drafts.borrower&&it.drafts.borrower.text)||'';
 var voice=(it.voice||[]).map(function(v){var missing=v.status==='no_key'||!v.transcript;return '<div class="voice">'+(missing?'Voice note saved. Transcription key is not set, so there is no transcript.':'Voice: '+esc(v.transcript))+'</div>'}).join('');
 var meet=it.kind==='meeting'?'<div class="rowbtns"><button type="button" data-op="meeting-tick">'+(it.closed?'Reopen meeting item':'Tick meeting item')+'</button><button type="button" data-op="meeting-note">Save meeting note</button></div>':'';
 return '<article class="card '+esc(it.urg||'Normal')+(editing[it.ref]?' editing':'')+'" data-ref="'+esc(it.ref)+'" data-kind="'+esc(it.kind||'task')+'">'+
 '<span class="pill '+esc(it.urg||'Normal')+'">'+esc(it.urg||'Normal')+'</span><span class="pill src">'+esc(it.kind||'task')+(it.carried?' · carried':'')+'</span>'+
 '<h3>'+esc(num)+esc(it.case||it.ref)+'</h3><p><strong>'+esc(it.need||'')+'</strong></p><p class="meta">'+esc(it.ctx||'')+'</p>'+
 (it.due?'<p class="meta">Due '+esc(it.due)+'</p>':'')+(it.partial?'<p class="meta">Part done</p>':'')+(it.nextFlag?'<p class="meta">'+esc(it.nextFlag)+'</p>':'')+
 '<div class="act">'+esc(it.act||'')+'</div>'+voice+
 '<p class="stamp" data-state>'+(loc.stamp||'')+'</p>'+
 '<div class="rowbtns"><button type="button" class="yes" data-op="yes">Yes</button><button type="button" data-op="no">No</button><button type="button" data-op="edit">Edit</button>'+
 '<button type="button" data-op="'+(closed?'reopen':'done')+'">'+(closed?'Reopen':'Done')+'</button><button type="button" data-op="partial">'+(it.partial?'Clear part done':'Part done')+'</button></div>'+
 '<textarea data-edit placeholder="Edit the task">'+esc(kept(it.ref,'edit',drafts[it.ref]||''))+'</textarea><div class="editbar"><button type="button" class="save" data-op="save-edit">Save edit</button></div>'+
 '<div class="block"><label>Owner</label><select data-owner>'+owner+'</select><label>Due date</label><input data-due type="date" value="'+esc(it.due||'')+'"><label>Note</label><textarea data-note>'+esc(kept(it.ref,'note',notes[it.ref]||it.note||''))+'</textarea><button type="button" data-op="note">Save note</button>'+
 '<label>Borrower message draft</label><textarea data-draft="borrower">'+esc(kept(it.ref,'borrower',draft))+'</textarea><button type="button" data-op="copy" data-channel="borrower">Copy</button>'+
 '<label>Draft email</label><input data-subject placeholder="Subject" value="'+esc(kept(it.ref,'subject',(it.drafts&&it.drafts.email&&it.drafts.email.subject)||''))+'"><textarea data-draft="email">'+esc(kept(it.ref,'email',(it.drafts&&it.drafts.email&&it.drafts.email.text)||''))+'</textarea><button type="button" data-op="copy" data-channel="email">Copy text</button><button type="button" data-op="copy-headers">Copy with headers</button>'+
 '<label>Draft WhatsApp</label><textarea data-draft="whatsapp">'+esc(kept(it.ref,'whatsapp',(it.drafts&&it.drafts.whatsapp&&it.drafts.whatsapp.text)||''))+'</textarea><button type="button" data-op="copy" data-channel="whatsapp">Copy</button>'+
 '<label>Ask Lizzy</label><textarea data-ask placeholder="Question for Lizzy">'+esc(kept(it.ref,'ask',''))+'</textarea><button type="button" data-op="ask">Ask Lizzy</button>'+
 '<label>Team thread</label><textarea data-thread placeholder="Note for the team thread">'+esc(kept(it.ref,'thread',''))+'</textarea><button type="button" data-op="thread">Post to team thread</button>'+
 '<div class="rowbtns">'+desks+links+'</div>'+meet+
 '<div class="ctl"><button type="button" class="rec" data-op="voice">Voice note</button></div></div></article>'}
function visible(list){var q=(document.getElementById('f-q').value||'').toLowerCase();var urg=document.getElementById('f-urg').value;return list.filter(function(it){if(urg&&it.urg!==urg)return false;if(!q)return true;return (String(it.case||'')+' '+String(it.need||'')+' '+String(it.ref||'')).toLowerCase().indexOf(q)>=0})}
function render(){
 var open=visible(M.open.filter(function(it){return !(local[it.ref]&&local[it.ref].closed)}));
 var done=visible(M.done.concat(M.open.filter(function(it){return local[it.ref]&&local[it.ref].closed})));
 document.getElementById('open').innerHTML=open.map(function(i){return card(i,false)}).join('')||'<article class="card allclear"><h3>All clear</h3><p class="meta">Nothing waiting on this seat.</p></article>';
 document.getElementById('done').innerHTML=done.map(function(i){return card(i,true)}).join('')||'<p class="meta">Nothing cleared.</p>';
 document.getElementById('done-wrap').hidden=!document.getElementById('f-done').checked;
 document.getElementById('c-open').textContent=open.length+' to do';document.getElementById('c-done').textContent=done.length+' done';sync()}
function val(card,sel){var el=card.querySelector(sel);return el?String(el.value||'').trim():''}
function draftBody(card,channel){return val(card,'[data-draft="'+channel+'"]')}
function saveDraft(ref,card,channel){answer(ref,'draft',{channel:channel,edit_text:draftBody(card,channel),subject:channel==='email'?val(card,'[data-subject]'):''})}
function copyText(text,ref){var done=function(){stamp(ref,'Copied')};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done,function(){done()})}else done()}
function meetingBody(it,card,mode){var progress=JSON.parse(JSON.stringify(it.meetingProgress||{items:{},actions:{},extra_actions:[]}));var key=it.meetingKey;if(it.meetingKind==='action'){progress.actions[key]=progress.actions[key]||{};if(mode==='tick')progress.actions[key].done=it.closed!==true;return progress}progress.items[key]=progress.items[key]||{status:'open',notes:''};if(mode==='tick')progress.items[key].status=it.closed===true?'open':'actioned';var note=val(card,'[data-note]');if(note)progress.items[key].notes=note;return progress}
var rec=null,chunks=[],recRef=null,timer=null;
function startRec(ref,btn){if(!navigator.mediaDevices||!window.MediaRecorder){stamp(ref,'Voice notes need a newer browser. The transcription key is not set.');return}
 navigator.mediaDevices.getUserMedia({audio:true}).then(function(st){var types=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg'];var t=types.filter(function(x){return MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(x)})[0];
 rec=new MediaRecorder(st,t?{mimeType:t,audioBitsPerSecond:32000}:undefined);chunks=[];recRef=ref;rec.ondataavailable=function(e){if(e.data&&e.data.size)chunks.push(e.data)};
 rec.onstop=function(){st.getTracks().forEach(function(x){x.stop()});clearTimeout(timer);var blob=new Blob(chunks,{type:rec.mimeType||'audio/webm'});var fr=new FileReader();fr.onload=function(){var b64=String(fr.result).split(',')[1];var job=jobOf(recRef,'voice',{mime:blob.type,audio_b64:b64});queue.push(job);saveQ();stamp(recRef,'Uploading voice note');flush().then(function(){stamp(job.ref,'Saved ✓ voice note. Transcription key is not set, so there is no transcript.')})};fr.readAsDataURL(blob);rec=null};rec.start();btn.textContent='Stop';btn.classList.add('live');timer=setTimeout(function(){if(rec)rec.stop()},90000)}).catch(function(){stamp(ref,'Microphone permission was refused. Transcription key is not set.')})}
function setup(){
 var seat=document.getElementById('f-seat');var opts=M.viewer==='byron'?SEATS:[M.seat||M.viewer];
 seat.innerHTML=opts.map(function(s){return '<option value="'+s+'"'+(s===M.seat?' selected':'')+'>'+s+'</option>'}).join('');
 if(M.viewer!=='byron')seat.disabled=true;
 document.getElementById('add-owner').innerHTML=OWNERS.map(function(o){return '<option>'+o+'</option>'}).join('');
 seat.addEventListener('change',function(){if(M.viewer!=='byron')return;location.href='/staff/tasks?seat='+encodeURIComponent(seat.value)});
 document.getElementById('f-urg').addEventListener('change',render);
 document.getElementById('f-q').addEventListener('input',render);
 document.getElementById('f-done').addEventListener('change',render);
}
document.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;if(b.id==='refresh'){poll();return}
 if(b.id==='add-go'){var title=document.getElementById('add-case').value.trim();if(!title)return;var ref='add-'+cid();var made={ref:ref,case:title,need:document.getElementById('add-need').value.trim(),owner:document.getElementById('add-owner').value,due:document.getElementById('add-due').value,urg:'Normal',kind:'task',act:document.getElementById('add-need').value.trim(),history:[],voice:[],links:[]};M.open.unshift(made);answer(ref,'add',{case:made.case,need:made.need,owner:made.owner,due:made.due,urg:'Normal'});return}
 var c=b.closest('[data-ref]');if(!c)return;var ref=c.getAttribute('data-ref');var op=b.getAttribute('data-op');var it=find(ref)||{};
 if(op==='edit'){editing[ref]=true;render();return}
 if(op==='yes'||op==='no'){answer(ref,op,{});return}
 if(op==='save-edit'){var text=val(c,'[data-edit]');if(!text)return;delete editing[ref];answer(ref,'edit',{edit_text:text,decision:'edit'});return}
 if(op==='done'||op==='reopen'||op==='partial'){answer(ref,op,op==='partial'?{partial:!(it.partial)}:{});return}
 if(op==='note'){var note=val(c,'[data-note]');if(!note)return;notes[ref]=note;answer(ref,'note',{edit_text:note,note:note});return}
 if(op==='copy'){var ch=b.getAttribute('data-channel');var body=draftBody(c,ch);if(!body)return;saveDraft(ref,c,ch);copyText(body,ref);return}
 if(op==='copy-headers'){var body2=draftBody(c,'email');if(!body2)return;saveDraft(ref,c,'email');copyText('Subject: '+val(c,'[data-subject]')+'\\n\\n'+body2,ref);return}
 if(op==='ask'){var q=val(c,'[data-ask]');if(!q)return;answer(ref,'ask',{edit_text:'['+ref+'] '+q,to_agent:'lizzy'});return}
 if(op==='thread'){var msg=val(c,'[data-thread]');if(!msg)return;answer(ref,'thread',{edit_text:'['+ref+'] '+msg,to_agent:'all'});return}
 if(op==='meeting-tick'||op==='meeting-note'){var progress=meetingBody(it,c,op==='meeting-tick'?'tick':'note');answer(ref,'meeting',{meeting_id:it.meetingId,progress:progress,edit_text:op==='meeting-note'?val(c,'[data-note]'):'tick'});return}
 if(op==='voice'){if(rec)rec.stop();else startRec(ref,b)}});
document.addEventListener('change',function(e){var c=e.target.closest('[data-ref]');if(!c)return;var ref=c.getAttribute('data-ref');
 if(e.target.matches('[data-owner]'))answer(ref,'owner',{owner:e.target.value});
 if(e.target.matches('[data-due]'))answer(ref,'due',{due:e.target.value})});
var pending={};
function rememberField(el){var c=el.closest&&el.closest('[data-ref]');if(!c)return;var ref=c.getAttribute('data-ref');var key=el.getAttribute('data-subject')!=null?'subject':el.getAttribute('data-edit')!=null?'edit':el.getAttribute('data-note')!=null?'note':el.getAttribute('data-ask')!=null?'ask':el.getAttribute('data-thread')!=null?'thread':el.getAttribute('data-draft')||'';if(!key)return;pending[ref]=pending[ref]||{};pending[ref][key]=el.value}
document.addEventListener('input',function(e){rememberField(e.target)});
function poll(){var focus=document.activeElement;if(rec||focus&&/^(TEXTAREA|INPUT|SELECT)$/.test(focus.tagName))return;fetch('/staff/run?format=json&view=popup'+(M.date?'&date='+encodeURIComponent(M.date):'')+(M.seat?'&seat='+encodeURIComponent(M.seat):''),{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(j){if(!j||!j.ok||!j.popup)return;if(document.activeElement&&/^(TEXTAREA|INPUT|SELECT)$/.test(document.activeElement.tagName))return;M.open=j.open;M.done=j.done;M.storeOk=j.storeOk;render()}).catch(function(){})}
setup();render();flush();setInterval(function(){flush();poll()},60000);
window.addEventListener('focus',function(){flush().then(poll)});
window.addEventListener('online',function(){flush().then(poll)});
document.addEventListener('visibilitychange',function(){if(!document.hidden)flush().then(poll)});
})();`;
