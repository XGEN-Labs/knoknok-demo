import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('preview serves public assets and proxies only approved same-origin API requests', async t => {
  const calls = [];
  const backend = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    calls.push({ url: req.url, headers: req.headers, body });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': 'vouch_token=test; HttpOnly; Path=/; SameSite=Lax' });
    res.end(JSON.stringify({ ok: true }));
  });
  backend.listen(0, '127.0.0.1');
  await once(backend, 'listening');
  t.after(() => backend.close());
  const child = spawn(process.execPath, ['scripts/preview.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: '0', VOUCH_BACKEND_URL: `http://127.0.0.1:${backend.address().port}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill());
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Preview did not start')), 5000);
    child.once('error', reject);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Preview exited ${code}`)); });
    child.stdout.on('data', data => {
      const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
  });
  for (const file of ['/', '/api.mjs', '/model.mjs']) assert.equal((await fetch(base + file)).status, 200);
  for (const file of ['/.env', '/.git/config', '/scripts/preview.mjs', '/package.json', '/api/admin', '/%2e%2e%2f.env']) {
    assert.equal((await fetch(base + file)).status, 404, file);
  }
  assert.equal((await fetch(base + '/api/web/chat', { method: 'POST', headers: { Origin: 'https://foreign.test' } })).status, 403);
  assert.equal(calls.length, 0);
  const body = JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] });
  const response = await fetch(base + '/api/web/chat', {
    method: 'POST', headers: { Origin: base, Cookie: 'vouch_token=test', 'X-Knok-User-Id': '7', Authorization: 'must-not-forward' }, body,
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.equal(calls[0].headers.cookie, 'vouch_token=test');
  assert.equal(calls[0].headers['x-knok-user-id'], '7');
  assert.equal(calls[0].headers.authorization, undefined);
  assert.equal(calls[0].body, body);
  assert.equal(calls[0].url, '/api/web/chat');
});
