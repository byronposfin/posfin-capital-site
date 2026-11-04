// Preview-only address lookup. Provider credential remains server-side.
const attempts=new Map();
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  if(process.env.VERCEL_ENV!=='preview')return res.status(404).json({error:'Not available'});
  const postcode=String(req.query.postcode||'').toUpperCase().replace(/\s/g,'');
  if(!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(postcode))return res.status(400).json({error:'Enter a full UK postcode.'});
  const key=process.env.PROPERTYDATA_API_KEY;
  if(!key)return res.status(503).json({error:'Address search unavailable. Please enter your address manually.'});
  const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0],now=Date.now();
  for(const [k,v] of attempts)if(now-v.start>60000)attempts.delete(k);
  const bucket=attempts.get(ip)||{start:now,count:0};bucket.count++;attempts.set(ip,bucket);
  if(bucket.count>12)return res.status(429).json({error:'Please wait a minute before searching again, or enter your address manually.'});
  try{
    const url=new URL('https://api.propertydata.co.uk/uprns');
    url.search=new URLSearchParams({key,postcode,strict:'true',results:'200'}).toString();
    const response=await fetch(url,{signal:AbortSignal.timeout(12000)});const data=await response.json();
    if(!response.ok||data.status!=='success'||!Array.isArray(data.data))throw new Error('provider unavailable');
    const addresses=data.data.filter(a=>a.address&&String(a.addressParts?.postcode||'').replace(/\s/g,'').toUpperCase()===postcode).map(a=>({address:a.address}));
    return res.status(200).json({addresses});
  }catch{return res.status(502).json({error:'Address search unavailable. Please enter your address manually.'});}
}
