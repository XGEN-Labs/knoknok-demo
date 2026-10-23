import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Main also contains newer artwork. This bug fix deliberately builds the exact
// running page baseline, with reviewed application overlays, not those UI changes.
export const PAGE_BASE = '9c28e0a9c0d3e1210ef3339ad28bc08ac3e0a45c';
const root = fileURLToPath(new URL('..', import.meta.url));
const stage = await mkdtemp(path.join(tmpdir(), 'knok-naming-build-'));
const hash = data => createHash('sha256').update(data).digest('hex');
try {
  const source = path.join(stage, 'source');
  const output = path.join(stage, 'web');
  await mkdir(source); await mkdir(output);
  execFileSync('git', ['archive', '--format=tar', `--output=${path.join(stage, 'page.tar')}`, PAGE_BASE], { cwd: root });
  execFileSync('tar', ['-xf', path.join(stage, 'page.tar'), '-C', source]);
  const manifest = JSON.parse(await readFile(path.join(source, 'build-manifest.json'), 'utf8'));
  const files = new Set();
  for (const entry of manifest.files) {
    const name = entry.path;
    if (typeof name !== 'string' || path.isAbsolute(name) || name.split('/').some(p => !p || p === '.' || p === '..')) throw Error('invalid_page_manifest');
    const data = await readFile(path.join(source, name));
    if (hash(data) !== entry.sha256) throw Error(`page_baseline_hash_mismatch:${name}`);
    await mkdir(path.dirname(path.join(output, name)), { recursive: true });
    await writeFile(path.join(output, name), data);
    files.add(name);
  }
  const overlays = [];
  for (const name of (await readdir(path.join(root, 'compat/web-naming'))).sort()) {
    if (!/^[a-z0-9-]+\.(mjs|html)$/u.test(name)) throw Error(`invalid_overlay:${name}`);
    const data = await readFile(path.join(root, 'compat/web-naming', name));
    await writeFile(path.join(output, name), data);
    files.add(name); overlays.push({ path: name, sha256: hash(data) });
  }
  const entries = [];
  for (const name of [...files].sort()) {
    const data = await readFile(path.join(output, name));
    entries.push({ path: name, bytes: data.length, sha256: hash(data) });
  }
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8' }).trim());
  await writeFile(path.join(output, 'build-manifest.json'), JSON.stringify({ format: 'knok-web-landing-handoff/v1', sourceCommit: commit, dirty, pageBase: PAGE_BASE, entry: 'index.html', files: entries, overlays }, null, 2) + '\n');
  await mkdir(path.join(root, 'dist'), { recursive: true });
  await rm(path.join(root, 'dist/web'), { recursive: true, force: true });
  // Copy, rather than cross-device rename, so /tmp and checkout may be separate mounts.
  await cp(output, path.join(root, 'dist/web'), { recursive: true });
  console.log(JSON.stringify({ sourceCommit: commit, dirty, pageBase: PAGE_BASE, files: entries.length, output: 'dist/web' }));
} finally {
  await rm(stage, { recursive: true, force: true });
}
