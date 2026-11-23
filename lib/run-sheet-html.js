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

function shell(title, body) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Playfair+Display:wght@500&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${body}</body></html>`;
}

function head(sub) {
  return `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">Staff · Run sheet</span></div><h1>Run sheet</h1><p class="sub">${esc(sub)}</p><div class="counts"><span id="c-open">…</span><span id="c-done">…</span><span id="c-sync">Saved</span></div></div></header>`;
}

export function renderRunSheetLogin(message) {
  const body = `${head('Sign in with your own work email.')}<main class="wrap"><article class="card"><form method="post" action="/staff/run"><label for="email">Work email</label><br><input id="email" name="email" type="email" autocomplete="username" style="width:100%;min-height:48px;border:1px solid #E4DFD4;border-radius:12px;padding:12px"><br><label for="password">Password</label><br><input id="password" name="password" type="password" autocomplete="current-password" required minlength="8" style="width:100%;min-height:48px;border:1px solid #E4DFD4;border-radius:12px;padding:12px"><p>${esc(message || '')}</p><div class="btns"><button class="yes" type="submit">Open the run sheet</button></div></form><p><a href="/staff/set-password">Forgot password?</a></p></article></main>`;
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
