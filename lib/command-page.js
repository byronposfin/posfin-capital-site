// Signed-in shell for /staff/command. Case and finance figures are not rendered here.

import { esc } from './case-portal.js';

const TABS = [
  ['overview', 'Overview'],
  ['hub', 'Team Lizzy Hub'],
  ['pipeline', 'Pipeline'],
  ['tasks', 'Tasks'],
  ['lenders', 'Lender metrics'],
  ['files', 'Files & sheets'],
];

function shell(title, body) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer"><title>${esc(title)}</title><link rel="stylesheet" href="/staff/command.css"></head><body>${body}</body></html>`;
}

export function renderCommandLogin(message) {
  const body = `<header class="mast"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><p class="eyebrow">Staff</p></div><div><h1>Team Lizzy &amp; Posfin Command Dashboard</h1><p class="lede">Sign in with your staff email and password.</p></div></header><main class="wrap"><article class="card narrow"><h2>Staff sign-in</h2><p>This is the same sign-in as the staff cockpit.</p><form method="post" action="/staff/command"><label for="email">Work email</label><input id="email" name="email" type="email" autocomplete="username" required><label for="password">Staff password</label><input id="password" name="password" type="password" autocomplete="current-password" required minlength="8"><p class="warn" role="status">${esc(message || '')}</p><button class="send" type="submit">Open the dashboard</button></form><p class="links"><a href="/staff/set-password">Forgot password?</a> · <a href="/staff/cockpit">Staff Cockpit / Run Sheet</a></p></article></main>`;
  return shell('Sign in — Team Lizzy & Posfin Command Dashboard', body);
}

export function renderCommandMessage(title, text) {
  const body = `<header class="mast"><div><h1>${esc(title)}</h1></div></header><main class="wrap"><article class="card"><p>${esc(text)}</p><p class="links"><a href="/staff/command">Command dashboard</a> · <a href="/staff/cockpit">Staff Cockpit / Run Sheet</a></p></article></main>`;
  return shell(`${title} — Posfin`, body);
}

export function renderCommandPage(actor) {
  const finance = actor.seat === 'byron';
  const tabs = finance
    ? TABS.slice(0, 5).concat([['finance', 'P&L & cash flow']]).concat(TABS.slice(5))
    : TABS;
  const buttons = tabs.map(([id, label], index) => {
    const selected = index === 0 ? 'true' : 'false';
    const current = index === 0 ? ' aria-current="page"' : '';
    return `<button type="button" class="tab${index === 0 ? ' on' : ''}" role="tab" id="tab-${esc(id)}" data-tab="${esc(id)}" aria-selected="${selected}" aria-controls="panel"${current}>${esc(label)}</button>`;
  }).join('');
  const body = `<header class="mast"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><p class="eyebrow">Staff</p></div><div class="titles"><h1>Team Lizzy &amp; Posfin Command Dashboard</h1><p class="lede" id="fresh">Loading the latest snapshot…</p></div><div class="who"><span class="badge" id="seat-badge">${esc(actor.displayName)}</span><a class="ghost" href="/staff/cockpit">Staff Cockpit / Run Sheet</a><form method="post" action="/staff/command"><input type="hidden" name="action" value="logout"><button class="ghost" type="submit">Log out</button></form></div></header><nav class="tabs" id="tabs" role="tablist" aria-label="Dashboard sections">${buttons}</nav><main class="wrap" id="panel" role="tabpanel" tabindex="0" aria-labelledby="tab-overview"><p>Loading the latest snapshot…</p></main><footer class="foot">Staff only. Tom, the gateway and OpenClaw are not connected. No external systems are connected.</footer><script src="/staff/command-app.js"></script>`;
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer"><title>Team Lizzy &amp; Posfin Command Dashboard</title><link rel="stylesheet" href="/staff/command.css"></head><body data-seat="${esc(actor.seat)}" data-name="${esc(actor.displayName)}" data-finance="${finance ? '1' : '0'}">${body}</body></html>`;
}
