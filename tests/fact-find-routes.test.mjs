// /apply and /fact-find must be one page. The file is fact-find.html.
// /apply is a rewrite, so the two URLs cannot drift.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = join(root, 'fact-find.html');
const jsPath = join(root, 'fact-find.js');

function read(path) {
  return readFileSync(path, 'utf8');
}

function borrowerFiles() {
  const seen = new Set();
  const files = [];
  function walk(rel) {
    const abs = resolve(root, rel);
    if (seen.has(abs) || !existsSync(abs) || !statSync(abs).isFile()) return;
    seen.add(abs);
    files.push(abs);
    const text = read(abs);
    const pattern = /(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g;
    for (const match of text.matchAll(pattern)) {
      const spec = match[1].split('?')[0];
      let next = '';
      if (spec.startsWith('/')) next = spec.slice(1);
      else if (spec.startsWith('.')) next = join(dirname(rel), spec);
      else continue;
      if (!next.endsWith('.js')) next += '.js';
      walk(next);
    }
  }
  walk('fact-find.html');
  const script = read(htmlPath).match(/src="([^"]+)"/);
  assert.ok(script, 'fact find page loads a script');
  walk(script[1].split('?')[0].replace(/^\//, ''));
  return files;
}

function staticFile(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const candidates = clean === '/'
    ? ['index.html']
    : [clean.slice(1) + '.html', join(clean.slice(1), 'index.html')];
  for (const rel of candidates) {
    const abs = resolve(root, rel);
    if (abs.startsWith(root) && existsSync(abs) && statSync(abs).isFile()) return abs;
  }
  return null;
}

function rewrite(pathname) {
  const config = JSON.parse(read(join(root, 'vercel.json')));
  for (const rule of config.rewrites) {
    if (rule.source === pathname) return rule.destination.split('?')[0];
  }
  return null;
}

function resolvePage(pathname) {
  const file = staticFile(pathname);
  if (file) return file;
  const next = rewrite(pathname);
  if (!next || next === pathname) return null;
  return staticFile(next);
}

function listen(server) {
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server.address().port)));
}

test('one fact find file is served at both public routes', async () => {
  assert.equal(existsSync(join(root, 'apply.html')), false);
  const config = JSON.parse(read(join(root, 'vercel.json')));
  const applyRules = config.rewrites.filter((rule) => rule.source === '/apply');
  assert.deepEqual(applyRules, [{ source: '/apply', destination: '/fact-find' }]);
  assert.equal(config.rewrites.some((rule) => rule.source === '/apply/:path*' || rule.source === '/apply/(.*)'), false);

  const html = read(htmlPath);
  const js = read(jsPath);
  assert.match(html, /<title>Fact find · Posfin Capital<\/title>/);
  assert.match(html, /<h1>Your fact find/);
  assert.match(html, /This fact find takes about 5 minutes/);
  assert.doesNotMatch(html, /Apply now/i);
  assert.doesNotMatch(js, /Apply now/i);
  assert.match(js, /Submit fact find/);
  assert.match(html, /Prefer to talk first\?/);
  assert.match(html, /href="https:\/\/wa\.me\/447365587773\?/);
  assert.match(html, /href="tel:\+447365587773"/);
  assert.match(html, /07365 587773/);
  assert.match(html, /\.dob\{display:grid/);
  assert.match(html, /\.btn-teal\{[^}]*background:#0A7383/);
  assert.match(js, /applicant_dob/);
  assert.match(js, /data-dob=/);
  assert.match(js, /fetch\("\/api\/factfind"/);
  assert.match(js, /action:"submit"/);
  assert.match(js, /action:"save"/);

  for (const file of borrowerFiles()) {
    const text = read(file);
    assert.doesNotMatch(text, /broka/i, `${file} must not mention BROKA`);
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const file = resolvePage(url.pathname);
    if (!file) {
      res.writeHead(404);
      res.end('missing');
      return;
    }
    const body = readFileSync(file);
    const type = file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8';
    res.writeHead(200, { 'content-type': type });
    res.end(body);
  });
  const port = await listen(server);
  try {
    const base = `http://127.0.0.1:${port}`;
    const factFind = await fetch(base + '/fact-find');
    const apply = await fetch(base + '/apply');
    const applyTagged = await fetch(base + '/apply?b=bh');
    const factFindResume = await fetch(base + '/fact-find?resume=ABCD-EFGH-JKLM');
    const speed = await fetch(base + '/apply/speed');
    const factFindHtml = await factFind.text();
    const applyHtml = await apply.text();
    assert.equal(factFind.status, 200);
    assert.equal(apply.status, 200);
    assert.equal(applyHtml, factFindHtml);
    assert.equal(await applyTagged.text(), factFindHtml);
    assert.equal(await factFindResume.text(), factFindHtml);
    assert.equal(speed.status, 200);
    assert.notEqual(await speed.text(), factFindHtml);
    assert.match(factFindHtml, /id="ff"/);
    assert.match(factFindHtml, /Prefer to talk first\?/);
  } finally {
    await new Promise((ok) => server.close(ok));
  }
});
