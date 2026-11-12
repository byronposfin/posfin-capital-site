#!/usr/bin/env python3
"""Forward-only fact-find first touch. Byron authorised 1 Nov 2026.
Independent channel receipts; never replay legacy/ambiguous sends. No model calls.
"""
import datetime as dt, fcntl, hashlib, html, json, re
from pathlib import Path
from zoneinfo import ZoneInfo
import requests
from factfind_contact_guard import factfind_suppressed
ROOT=Path('/Users/byronhill/.openclaw/workspace')
OUT=ROOT/'outputs/factfind-first-touch'; OUT.mkdir(exist_ok=True)
STATE=OUT/'state.json'; CONFIG=OUT/'config.json'
TEMPLATE='posfin_byron_uk_banner_routecheck_v3'
DONE={'accepted','history_verified','sent_items_verified','existing'}

def now():return dt.datetime.now(dt.timezone.utc)
def phone(v):return re.sub(r'\D','',str(v or ''))
def event_id(x):return hashlib.sha256((phone(x.get('phone'))+'|'+str(x.get('lead_ref'))+'|'+str((x.get('params') or [''])[0])).encode()).hexdigest()[:24]
def outbound(m):return m.get('owner') is True or (bool(m.get('finalText')) and 'Broadcast message' in m.get('eventDescription',''))
def after_enquiry(m,x):
 try:return dt.datetime.fromisoformat(m.replace('Z','+00:00')) >= dt.datetime.fromisoformat(x['queued_at'])
 except (TypeError,ValueError):return True
def eligible(x,cutover):
 if x.get('queued_at','')<cutover or x.get('status')!='queued':return False
 campaign=str(x.get('campaign','')).lower()
 if any(t in campaign for t in ['unsecured','ubf','france','french']):return False
 if not any(t in campaign for t in ['bank bridge','speed desk','equitable charges','secured','property finance','high ticket senior desk']):return False
 return bool(re.fullmatch(r'\d{10,15}',phone(x.get('phone'))) and re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+',str(x.get('email',''))) and x.get('name'))
def suppressed(x,entries):
 for e in entries:
  if phone(x.get('phone')) in [phone(v) for v in e.get('phones',[])]:return True
  if x.get('email','').lower() in [v.lower() for v in e.get('emails',[])]:return True
  if x.get('name','').strip().lower()==e.get('name','').strip().lower():return True
 return False

def body(x,url):
 e=html.escape
 return f'<p><b>Name:</b> {e(x["name"])}<br><b>Mobile:</b> +{e(phone(x["phone"]))}<br><b>Email:</b> {e(x["email"])}<br><b>Enquiry:</b> {e(x["campaign"])}</p><p>Hi {e(x["name"].split()[0])},</p><p>I’m Tom, Byron’s AI assistant at Posfin Capital. Thank you for your enquiry.</p><p>Please complete our short fact find so we can review the property, existing borrowing, amount needed and repayment plan.</p><p><a href="{e(url,quote=True)}">Complete your fact find</a></p><p>Your contact details are prefilled. This is for our initial review, not a formal lender application or credit check.</p><p>You can also reply with any missing information or questions. There is no need to resend details you have already supplied. Once complete, reply DONE and we will review the next step.</p>'

def main():
 with (OUT/'run.lock').open('w') as lock:
  try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError:return {'status':'already_running'}
  cfg=json.loads(CONFIG.read_text());state=json.loads(STATE.read_text()) if STATE.exists() else {}
  q=json.loads((ROOT/'tools/wati_first_touch_queue.json').read_text())
  candidates=[x for x in q if eligible(x,cfg['cutover']) and not state.get(event_id(x),{}).get('closed') and state.get(event_id(x),{}).get('retry_after','') <= now().isoformat()]
  candidates.sort(key=lambda x: (state.get(event_id(x),{}).get('email') in DONE,state.get(event_id(x),{}).get('last_attempt','')))
  candidates=candidates[:3]
  if not cfg.get('enabled') or not candidates:return {'status':'idle','candidates':len(candidates)}
  from check_wati_template_status import _load_wati_from_engine
  from outlook import graph_headers,MAILBOXES,save_draft
  base,token=_load_wati_from_engine();wh={'Authorization':'Bearer '+token};gh=graph_headers()
  entries=json.loads((ROOT/'memory/lead_suppression.json').read_text()).get('entries',[])
  changed=[]
  def save():
   temp=STATE.with_suffix('.tmp');temp.write_text(json.dumps(state,indent=2));temp.replace(STATE)
  templates=[]
  try:
   for pg in [1,2]:
    r=requests.get(base+'/getMessageTemplates',headers=wh,params={'pageSize':100,'pageNumber':pg},timeout=20);r.raise_for_status();templates+=r.json().get('messageTemplates',[])
  except requests.RequestException:
   templates=[]
  approved=any(t.get('elementName')==TEMPLATE and t.get('status')=='APPROVED' and 'https://posfincapital.com/apply?k={{2}}' in t.get('body','') for t in templates)
  for x in candidates:
   key=event_id(x)
   if state.get(key,{}).get('closed'):continue
   s=state.setdefault(key,{'ref':x.get('lead_ref'),'created_at':now().isoformat()});s['last_attempt']=now().isoformat();save()
   try:
    if factfind_suppressed(x.get('email'),x.get('phone')):
     s.update(closed=True,reason='below_minimum_value_no_chase');save();continue
    if suppressed(x,entries):s.update(closed=True,reason='suppressed');save();continue
    if now()-dt.datetime.fromisoformat(x['queued_at'])>dt.timedelta(hours=24):s.update(closed=True,needs_review=True,owner='Tom',reason='stale_needs_review');save();changed.append('stale lead needs review');continue
    # Never substitute a guessed reference/name for a working private link.
    t=(x.get('params') or [''])[0]
    r=requests.get('https://posfincapital.com/api/prefill',params={'k':t},timeout=20);r.raise_for_status();d=r.json().get('prefill',{})
    if phone(d.get('mobile'))!=phone(x['phone']) or d.get('email','').lower()!=x['email'].lower() or d.get('case_ref')!=x.get('lead_ref'):raise ValueError('prefill identity mismatch')
    url='https://posfincapital.com/apply?k='+t
    r=requests.get(base+'/getMessages/'+phone(x['phone']),headers=wh,params={'pageSize':100},timeout=20);r.raise_for_status();d=r.json()
    if d.get('result') is False and 'not found' not in d.get('info','').lower():raise ValueError('WATI history unavailable')
    msgs=(d.get('messages') or {}).get('items',[])
    stop=re.compile(r'\b(stop|unsubscribe|do not contact|don.t contact|not interested|remove me)\b',re.I)
    inbound=[m for m in msgs if m.get('owner') is False]
    if any(stop.search(m.get('text','')) for m in inbound):s.update(closed=True,reason='inbound_no_contact');save();continue
    if any(after_enquiry(m.get('created',''),x) and not m.get('text','').startswith('Hello! I filled in your form') for m in inbound):s.update(closed=True,needs_review=True,owner='Tom',reason='inbound_requires_personal_reply');save();changed.append('inbound reply needs review');continue
    # Latest correspondence is checked separately from WATI before either channel.
    for mailbox in [MAILBOXES['byron'],MAILBOXES['chris']]:
     r=requests.get('https://graph.microsoft.com/v1.0/users/'+mailbox+'/messages',headers=gh,params={'$search':'"participants:'+x['email']+'"','$top':30,'$select':'id,from,toRecipients,sentDateTime,receivedDateTime,isDraft,body'},timeout=25);r.raise_for_status()
     for m in r.json().get('value',[]):
      if m.get('isDraft'):continue
      sender=m.get('from',{}).get('emailAddress',{}).get('address','').lower()
      if sender==x['email'].lower() and (stop.search(m.get('body',{}).get('content','')) or after_enquiry(m.get('receivedDateTime',''),x)):
       s.update(closed=True,needs_review=True,owner='Tom',reason='email_reply_requires_review');save()
      if sender.endswith('@posfincapital.com') and url in m.get('body',{}).get('content',''):s['email']='existing';save()
    if s.get('closed'):changed.append('existing email reply needs review');continue
    if any(outbound(m) and url in (str(m.get('text',''))+str(m.get('finalText',''))) for m in msgs):s['wati']='existing';save()
    # Independent channel delivery: email never waits on a template or send window.
    try:
     if s.get('email') is None:
      did=save_draft('byron',x['email'],'Your Posfin enquiry — complete your fact find',body(x,url),reply=False)
      if not did:raise ValueError('draft creation failed')
      s.update(email='draft',draft_id=did);save()
     if s.get('email')=='draft':
      u='https://graph.microsoft.com/v1.0/users/'+MAILBOXES['byron']+'/messages/'+s['draft_id']
      r=requests.get(u,headers=gh,params={'$select':'toRecipients,body,isDraft'},timeout=25);r.raise_for_status();d=r.json()
      if not d['isDraft'] or [v['emailAddress']['address'].lower() for v in d['toRecipients']]!=[x['email'].lower()] or url not in d['body']['content']:raise ValueError('draft readback mismatch')
      s['email']='sending';save();r=requests.post(u+'/send',headers=gh,timeout=25)
      s['email']='accepted' if r.status_code==202 else 'failed';s['email_http']=r.status_code;save();changed.append('email '+s['email'])
    except requests.RequestException as e:
     s.update(email='ambiguous' if s.get('email')=='sending' else 'needs_review',needs_review=True,owner='Tom',email_error_type=type(e).__name__);save();changed.append(str(x.get('lead_ref'))+': email needs review')
    local=now().astimezone(ZoneInfo('Europe/London'))
    in_window=dt.time(7,35)<=local.time()<dt.time(21)
    if s.get('wati') is None and approved and in_window:
     s['wati']='sending';save()
     r=requests.post(base+'/sendTemplateMessage',headers=wh,params={'whatsappNumber':phone(x['phone'])},json={'template_name':TEMPLATE,'broadcast_name':'factfind_first_touch_'+key,'parameters':[{'name':'1','value':x['name'].split()[0]},{'name':'2','value':t}]},timeout=25)
     d=r.json();s['wati']='accepted' if r.ok and (d.get('result') in [True,'success'] or d.get('ok') is True) else 'failed';s['wati_http']=r.status_code;save();changed.append('WhatsApp '+s['wati'])
    s['waiting_reason']=None if s.get('wati') else ('quiet_hours' if not in_window else 'template_not_approved')
    if s.get('email') in DONE and s.get('wati') in DONE:s['closed']=True
    if any(s.get(ch) in ['sending','failed','ambiguous','needs_review'] for ch in ['email','wati']):s.update(closed=True,needs_review=True,owner='Tom',reason='ambiguous_or_failed_channel_manual_review');changed.append('channel needs review; no automatic resend')
    save()
   except Exception as e:
    s['failures']=s.get('failures',0)+1
    ambiguous=any(s.get(ch) in ['sending','ambiguous'] for ch in ['email','wati'])
    review=ambiguous or s['failures']>=3
    s.update(closed=review,needs_review=review,owner='Tom',reason='ambiguous_send' if ambiguous else 'preflight_retry',error_type=type(e).__name__,retry_after=(now()+dt.timedelta(minutes=5*s['failures'])).isoformat());save();changed.append(str(x.get('lead_ref'))+': '+('manual review' if review else 'preflight retry scheduled'))
  # Reconcile the source queue so a future release of the legacy hold cannot resend.
  legacy_lock=ROOT/'tools/logs/wati_first_touch_queue_runner.lock'
  legacy_lock.parent.mkdir(parents=True,exist_ok=True)
  with legacy_lock.open('a') as lk:
   fcntl.flock(lk,fcntl.LOCK_EX)
   qp=ROOT/'tools/wati_first_touch_queue.json';fresh=json.loads(qp.read_text());dirty=False
   for item in fresh:
    receipt=state.get(event_id(item),{})
    if item.get('status')=='queued' and receipt.get('email') in DONE and receipt.get('wati') in DONE:
     item.update(status='sent',email_status=receipt['email'],last_send_detail='Independent fact-find first-touch channel receipts in outputs/factfind-first-touch/state.json');dirty=True
   if dirty:qp.write_text(json.dumps(fresh,indent=2))
  (OUT/'review-queue.json').write_text(json.dumps({k:v for k,v in state.items() if isinstance(v,dict) and v.get('needs_review')},indent=2))
  return {'status':'processed','events':changed,'notify':('Fact-find first touch: '+ '; '.join(changed)) if changed else None}
if __name__=='__main__':
 import contextlib,io
 # Helpers may print draft receipts; keep scheduler stdout one JSON record.
 with contextlib.redirect_stdout(io.StringIO()):result=main()
 print(json.dumps(result))
