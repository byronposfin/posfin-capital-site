#!/usr/bin/env python3
"""Send queued Raw Leads email nurture messages via Byron Outlook.

Queue file: memory/raw_leads_email_nurture_queue_20260627.json
Designed for explicit Byron approval/instruction to send Saturday 27 Jun 2026 at 08:15.
"""
from __future__ import annotations

import json, os, re, sys, time
from datetime import datetime
from pathlib import Path
from factfind_contact_guard import factfind_suppressed
import msal, requests
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

ROOT=Path('/Users/byronhill/.openclaw/workspace')
QUEUE=ROOT/'memory'/'raw_leads_email_nurture_queue_20260627.json'
VAULT=ROOT/'vault.json'
SID='1aqFwX7GabZRLPE3H4cb6OiFYeOmbxms5oKX05HhZksQ'
KEY=ROOT/'posfin-sheets-dfe4ca87fa0e.json'
MAILBOXES={'byron':'byron.hill@posfincapital.com'}
QUIET_OVERRIDE='--force' in sys.argv
LIMIT=None
if '--limit' in sys.argv:
    LIMIT=int(sys.argv[sys.argv.index('--limit')+1])


def now_local(): return datetime.now().astimezone()

def within_window():
    n=now_local()
    # Sunday: never send follow-ups from this script.
    if n.weekday()==6: return False, 'Sunday follow-ups blocked'
    # Saturday: 08:15-18:00
    if n.weekday()==5:
        ok=(n.hour>8 or (n.hour==8 and n.minute>=15)) and n.hour<18
        return ok, 'Saturday window 08:15-18:00'
    # Weekdays: 07:15-22:00
    ok=(n.hour>7 or (n.hour==7 and n.minute>=15)) and n.hour<22
    return ok, 'Weekday window 07:15-22:00'


def load_vault(): return json.loads(VAULT.read_text())

def graph_token():
    v=load_vault(); az=v['microsoft_azure']
    app=msal.ConfidentialClientApplication(az['client_id'], authority=f"https://login.microsoftonline.com/{az['tenant_id']}", client_credential=az['client_secret'])
    res=app.acquire_token_for_client(scopes=['https://graph.microsoft.com/.default'])
    if 'access_token' not in res: raise RuntimeError(res)
    return res['access_token']

def sheets():
    creds=Credentials.from_service_account_file(KEY, scopes=['https://www.googleapis.com/auth/spreadsheets'])
    return build('sheets','v4',credentials=creds).spreadsheets()

def send_mail(token, mailbox, to, subject, body):
    email=MAILBOXES[mailbox]
    url=f'https://graph.microsoft.com/v1.0/users/{email}/sendMail'
    headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'}
    payload={'message':{
        'subject':subject,
        'body':{'contentType':'Text','content':body},
        'toRecipients':[{'emailAddress':{'address':to}}],
    },'saveToSentItems':True}
    r=requests.post(url,headers=headers,json=payload,timeout=45)
    if r.status_code != 202:
        raise RuntimeError(f'{r.status_code} {r.text[:400]}')

def prepend_note(api, row, note):
    # Avoid high-volume read-modify-write during scheduled send; the note is
    # already written to AB and status cells. Keep this script quota-safe.
    return
    rng=f"'Raw Leads'!H{row}"
    cur=api.values().get(spreadsheetId=SID, range=rng, valueRenderOption='FORMATTED_VALUE').execute().get('values',[[]])
    old=cur[0][0] if cur and cur[0] else ''
    api.values().update(spreadsheetId=SID, range=rng, valueInputOption='USER_ENTERED', body={'values':[[note + ('\n'+old if old else '')]]}).execute()

def main():
    ok,why=within_window()
    if not ok and not QUIET_OVERRIDE:
        print(json.dumps({'skipped':'outside_send_window','why':why,'now':now_local().isoformat()})); return
    if not QUEUE.exists():
        print(json.dumps({'sent':0,'reason':'no_queue'})); return
    q=json.loads(QUEUE.read_text())
    api=sheets(); token=graph_token(); sent=0; errors=[]
    raw_vals=api.values().get(spreadsheetId=SID, range="'Raw Leads'!A2:AD500", valueRenderOption='FORMATTED_VALUE').execute().get('values',[])
    raw_by_row={i:r for i,r in enumerate(raw_vals, start=2)}
    stamp=datetime.now().strftime('%d/%m/%Y %H:%M')
    for item in q:
        if LIMIT is not None and sent>=LIMIT: break
        if item.get('status') == 'sent': continue
        if item.get('status') == 'skipped': continue
        if item.get('mailbox') not in MAILBOXES: item['status']='skipped'; item['error']='unknown mailbox'; continue
        try:
            raw=int(item['rawRow'])
            rr=raw_by_row.get(raw, [])
            if any('below minimum value' in str(cell).lower() or 'BELOW_MINIMUM_VALUE' in str(cell) or '"no_chase":true' in str(cell).replace(' ', '') for cell in rr):
                item['status']='skipped'; item['error']='below minimum value — no chase'; continue
            row_phone=re.sub(r'\D+','',str(rr[2] if len(rr)>2 else ''))
            item_phone=re.sub(r'\D+','',str(item.get('phone') or ''))
            row_email=str(rr[3] if len(rr)>3 else '').strip().lower()
            item_email=str(item.get('to') or '').strip().lower()
            row_name=str(rr[1] if len(rr)>1 else '').strip()
            if item_phone and row_phone and item_phone != row_phone:
                item['status']='skipped'; item['error']='row phone mismatch at send-time guard'; errors.append({'rawRow':raw,'to':item.get('to'),'error':'row phone mismatch at send-time guard'}); continue
            if item_email and row_email and item_email != row_email:
                item['status']='skipped'; item['error']='row email mismatch at send-time guard'; errors.append({'rawRow':raw,'to':item.get('to'),'error':'row email mismatch at send-time guard'}); continue
            if row_name and item.get('lead') and row_name.lower() != str(item.get('lead')).strip().lower():
                item['status']='skipped'; item['error']='row lead name mismatch at send-time guard'; errors.append({'rawRow':raw,'to':item.get('to'),'error':'row lead name mismatch at send-time guard'}); continue
            if factfind_suppressed(item.get('to'),item.get('phone') or row_phone):
                item['status']='skipped';item['error']='Below minimum value — no chase';continue
            send_mail(token, item['mailbox'], item['to'], item['subject'], item['body'])
            item['status']='sent'; item['sentAt']=datetime.now().astimezone().isoformat(timespec='seconds')
            sent+=1
            note=f"{stamp} Tom: Email nurture sent from Byron to {item['to']} with subject token RL{raw}. Reply loop will monitor inbound replies and route to Raw Leads/CALLS/PIPELINE."
            api.values().batchUpdate(spreadsheetId=SID, body={'valueInputOption':'USER_ENTERED','data':[
                {'range':f"'Raw Leads'!F{raw}:G{raw}", 'values':[['EMAIL SENT — AWAITING REPLY','RAW LEADS EMAIL NURTURE — AWAITING REPLY']]},
                {'range':f"'Raw Leads'!AB{raw}", 'values':[[note]]},
            ]}).execute()
            prepend_note(api, raw, note)
            time.sleep(1.0)
        except Exception as e:
            item['status']='error'; item['error']=str(e)[:500]; errors.append({'rawRow':item.get('rawRow'),'to':item.get('to'),'error':str(e)[:200]})
    QUEUE.write_text(json.dumps(q,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'sent':sent,'errors':errors,'queue':str(QUEUE.relative_to(ROOT))}, indent=2))

if __name__=='__main__': main()
