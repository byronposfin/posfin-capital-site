import sys,json,tempfile,unittest,datetime as dt
from pathlib import Path
from unittest.mock import patch
import requests
import factfind_first_touch_v1 as f
class R:
 def __init__(self,data,status=200):self.data=data;self.status_code=status;self.ok=status<400
 def json(self):return self.data
 def raise_for_status(self):
  if not self.ok:raise requests.HTTPError()
class Checks(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.out=self.root/'out';self.out.mkdir();(self.root/'tools').mkdir();(self.root/'memory').mkdir()
  self.x={'queued_at':'2026-11-02T08:00:00+00:00','status':'queued','phone':'447700900123','email':'synthetic@example.test','name':'Synthetic Example','lead_ref':'TEST-ONLY','campaign':'Posfin — Bank Bridge','params':['fixture-token']}
  (self.root/'tools/wati_first_touch_queue.json').write_text(json.dumps([self.x]));(self.root/'memory/lead_suppression.json').write_text('{"entries":[]}')
  (self.out/'config.json').write_text(json.dumps({'enabled':True,'cutover':'2026-11-01'}));self.posts=[];self.messages=[];self.mail=[];self.template_fail=False;self.prefill_fail=False;self.send_timeout=False
  self.patches=[patch.object(f,'factfind_suppressed',return_value=False),patch.object(f,'ROOT',self.root),patch.object(f,'OUT',self.out),patch.object(f,'STATE',self.out/'state.json'),patch.object(f,'CONFIG',self.out/'config.json'),patch.object(f,'now',lambda:dt.datetime(2026,11,2,9,tzinfo=dt.timezone.utc)),patch('check_wati_template_status._load_wati_from_engine',return_value=('https://fixture.invalid','fixture')),patch('outlook.graph_headers',return_value={}),patch('outlook.save_draft',return_value='fixture-draft'),patch.object(f.requests,'get',side_effect=self.get),patch.object(f.requests,'post',side_effect=self.post)]
  for p in self.patches:p.start()
 def tearDown(self):
  for p in self.patches[::-1]:p.stop()
  self.temp.cleanup()
 def get(self,url,**kw):
  if 'getMessageTemplates' in url:
   if self.template_fail:raise requests.Timeout()
   return R({'messageTemplates':[{'elementName':f.TEMPLATE,'status':'APPROVED','body':'https://posfincapital.com/apply?k={{2}}'}]})
  if '/api/prefill' in url:
   if self.prefill_fail:raise requests.Timeout()
   return R({'prefill':{'mobile':self.x['phone'],'email':self.x['email'],'case_ref':self.x['lead_ref']}})
  if 'getMessages' in url:return R({'result':'success','messages':{'items':self.messages}})
  if url.endswith('/fixture-draft'):return R({'isDraft':True,'toRecipients':[{'emailAddress':{'address':self.x['email']}}],'body':{'content':'https://posfincapital.com/apply?k=fixture-token'}})
  return R({'value':self.mail})
 def post(self,url,**kw):
  self.posts.append(url)
  if self.send_timeout and url.endswith('/send'):raise requests.Timeout()
  return R({'result':True},202 if url.endswith('/send') else 200)
 def state(self):return json.loads((self.out/'state.json').read_text())[f.event_id(self.x)]
 def test_two_channels_once(self):
  f.main();self.assertEqual(len(self.posts),2);f.main();self.assertEqual(len(self.posts),2)
 def test_template_outage_does_not_block_email(self):
  self.template_fail=True;f.main();self.assertEqual(len(self.posts),1);self.assertEqual(self.state()['email'],'accepted');self.assertFalse(self.state().get('closed',False))
 def test_preflight_timeout_retries_without_send(self):
  self.prefill_fail=True;f.main();self.assertFalse(self.state()['closed']);self.assertIn('retry_after',self.state());self.assertFalse(self.posts)
 def test_send_timeout_never_replays_and_wati_still_sent(self):
  self.send_timeout=True;f.main();self.assertEqual(len(self.posts),2);self.assertTrue(self.state()['needs_review']);f.main();self.assertEqual(len(self.posts),2)
 def test_old_inbound_does_not_block_new_enquiry(self):
  self.mail=[{'from':{'emailAddress':{'address':self.x['email']}},'receivedDateTime':'2026-09-01T09:00:00Z','body':{'content':'Thanks for the information'}}];f.main();self.assertEqual(len(self.posts),2)
 def test_fresh_inbound_requires_personal_reply(self):
  self.mail=[{'from':{'emailAddress':{'address':self.x['email']}},'receivedDateTime':'2026-11-02T08:30:00Z','body':{'content':'Can you answer my question?'}}];f.main();self.assertTrue(self.state()['needs_review']);self.assertFalse(self.posts)
 def test_inbound_url_not_mistaken_for_outbound(self):
  self.messages=[{'owner':False,'created':'2026-10-01T08:00:00Z','text':'https://posfincapital.com/apply?k=fixture-token'}];f.main();self.assertEqual(len(self.posts),2)
 def test_duplicate_timestamp_same_enquiry_deduped(self):
  other={**self.x,'queued_at':'2026-11-02T08:01:00+00:00','phone':'+44 7700 900123'}
  self.assertEqual(f.event_id(self.x),f.event_id(other))
  (self.root/'tools/wati_first_touch_queue.json').write_text(json.dumps([self.x,other]));f.main();self.assertEqual(len(self.posts),2)
 def test_land_decline_blocks_both_channels(self):
  with patch.object(f,'factfind_suppressed',return_value=True):f.main()
  self.assertFalse(self.posts);self.assertEqual(self.state()['reason'],'below_minimum_value_no_chase')
 def test_land_guard_failure_sends_nothing(self):
  with patch.object(f,'factfind_suppressed',side_effect=RuntimeError('unavailable')):f.main()
  self.assertFalse(self.posts)
 def test_suppression(self):
  (self.root/'memory/lead_suppression.json').write_text(json.dumps({'entries':[{'emails':[self.x['email']]}]}));f.main();self.assertFalse(self.posts)
if __name__=='__main__':unittest.main()
