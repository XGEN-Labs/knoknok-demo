import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const backend = new URL(process.env.VOUCH_BACKEND_URL || 'http://127.0.0.1:8787');
if (backend.username || backend.password || backend.search || backend.hash ||
    backend.pathname !== '/' || !['http:', 'https:'].includes(backend.protocol) ||
    (backend.protocol === 'http:' && !['127.0.0.1', 'localhost', '[::1]'].includes(backend.hostname))) {
  throw new Error('VOUCH_BACKEND_URL must be an HTTPS origin or local HTTP origin');
}
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg' };
const apiPaths = new Map([
  ['/api/auth/me', 'GET'], ['/api/auth/login', 'POST'], ['/api/auth/logout', 'POST'], ['/api/web/chat', 'POST'],
]);
// The static payload is an allowlist: never serve env files, scripts or backend files.
const manifest = JSON.parse(await readFile(path.join(root, 'build-manifest.json'), 'utf8'));
const publicFiles = new Set(manifest.files.map(file => file.path));
export const server = createServer(async (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  res.setHeader('Cache-Control', 'no-store');
  if (pathname.startsWith('/api/')) {
    if (apiPaths.get(pathname) !== req.method) { res.writeHead(404).end(); return; }
    // This is a local preview proxy; require same-origin writes, including logout.
    const origin = req.headers.origin;
    if (req.method === 'POST' && origin !== `http://${req.headers.host}`) {
      res.writeHead(403, { 'Content-Type': 'application/json' }).end('{"error":"Invalid origin"}'); return;
    }
    const headers = { 'content-type': 'application/json' };
    for (const key of ['cookie', 'x-knok-user-id']) if (req.headers[key]) headers[key] = req.headers[key];
    const upstream = (backend.protocol === 'https:' ? httpsRequest : httpRequest)(
      new URL(pathname, backend), { method: req.method, headers }, response => {
        res.writeHead(response.statusCode, {
          'Content-Type': response.headers['content-type'] || 'application/json',
          ...(response.headers['set-cookie'] ? { 'Set-Cookie': response.headers['set-cookie'] } : {}),
        });
        response.on('error', () => res.destroy());
        response.pipe(res);
      },
    );
    upstream.setTimeout(75000, () => upstream.destroy());
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' }).end('{"error":"後端尚未連接，請先啟動 iOS 共用服務。"}');
      else res.destroy();
    });
    res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
    req.pipe(upstream);
    return;
  }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!publicFiles.has(file)) { res.writeHead(404).end(); return; }
  try {
    const data = await readFile(path.join(root, file));
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404).end(); }
});
server.listen(Number(process.env.PORT || 8769), '127.0.0.1', () => {
  console.log(`Knoknok Web: http://127.0.0.1:${server.address().port}`);
});
