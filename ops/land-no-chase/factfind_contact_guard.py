"""Read-only send-time no-chase check. Fail closed on missing access or unknown response."""
import os
import requests
URL='https://vgflcrfaudrvrdmxjdtl.supabase.co/rest/v1/rpc/web_lead_contact_suppressed'
def factfind_suppressed(email, phone, *, env=None, post=None):
    env=os.environ if env is None else env
    key=env.get('SUPABASE_MAIN_SERVICE_ROLE_KEY')
    if not key:
        raise RuntimeError('Fact Find suppression check unavailable')
    r=(post or requests.post)(URL,headers={'apikey':key,'Authorization':'Bearer '+key},json={'p_email':str(email or ''),'p_phone':str(phone or '')},timeout=15)
    r.raise_for_status()
    result=r.json()
    if not isinstance(result,bool):
        raise RuntimeError('Fact Find suppression result unavailable')
    return result
