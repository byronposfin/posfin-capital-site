import { createHmac, timingSafeEqual } from 'node:crypto';
function signingKey(){
 if(process.env.SCORECARD_TOKEN_SECRET)return process.env.SCORECARD_TOKEN_SECRET;
 const sa=process.env.GOOGLE_SA_B64;
 if(!sa)throw new Error('Scorecard signing key unavailable');
 return 'posfin-scorecard-v1:'+JSON.parse(Buffer.from(sa,'base64').toString()).private_key;
}
export function tokenFor(ref){return createHmac('sha256',signingKey()).update('scorecard:'+ref).digest('base64url');}
export function validToken(ref,token){if(!ref||!token)return false;const expected=Buffer.from(tokenFor(ref));const actual=Buffer.from(String(token));return actual.length===expected.length&&timingSafeEqual(actual,expected);}
export function scorecardLink(base,ref){return `${base}/api/scorecard?ref=${encodeURIComponent(ref)}&token=${tokenFor(ref)}`;}
