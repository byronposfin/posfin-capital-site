import { esc } from './case-portal.js';

export function portalMode(env = process.env) {
  return String(env.PORTAL_MODE || '').trim() === 'live' ? 'live' : 'demo';
}

export function flowActionsHtml(caseRef) {
  const ref = encodeURIComponent(caseRef);
  const safe = esc(caseRef);
  return `<div class="actions" data-flow-actions="${safe}"><form method="get" action="/staff/flow/doc/${ref}/el"><button class="secondary" type="submit">Generate EL</button></form><form method="get" action="/staff/flow/doc/${ref}/lor"><button class="secondary" type="submit">Generate LOR</button></form><form method="post" action="/staff/flow/place/${ref}"><input type="hidden" name="via" value="broka"><button class="secondary" type="submit">Place on BROKA</button></form><form method="post" action="/staff/flow/place/${ref}"><input type="hidden" name="via" value="placed"><button class="secondary" type="submit">Place on Placed</button></form></div>`;
}
