#!/usr/bin/env node
/**
 * Pre-publish check: packs every public package exactly as `changeset publish` would (pnpm pack rewrites
 * `workspace:*`), then verifies the tarball contents and runs publint + arethetypeswrong on it.
 *
 * Usage: pnpm build && pnpm check:packages
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const bin = name => join(root, 'node_modules', '.bin', name);
// When run through `pnpm <script>`, npm_execpath points at the pnpm that is running us.
const pnpm = process.env.npm_execpath?.includes('pnpm')
  ? [process.execPath, process.env.npm_execpath]
  : ['pnpm'];

const packages = ['core', 'dom', 'react', 'vue', 'provider-lucide'];
const out = mkdtempSync(join(tmpdir(), 'icon-picker-pack-'));
const failures = [];

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', ...opts });

try {
  for (const pkg of packages) {
    const dir = join(root, 'packages', pkg);
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const before = new Set(readdirSync(out));
    run(pnpm[0], [...pnpm.slice(1), 'pack', '--pack-destination', out], { cwd: dir });
    const tgz = join(out, readdirSync(out).find(f => !before.has(f)));
    const files = run('tar', ['tzf', tgz]).trim().split('\n').map(f => f.replace(/^package\//, ''));
    const packed = JSON.parse(run('tar', ['xzf', tgz, '-O', 'package/package.json']));
    const problems = [];

    if (manifest.private) problems.push('package is private');
    if (packed.publishConfig?.access !== 'public') problems.push('publishConfig.access is not "public"');
    if (!packed.license) problems.push('missing "license"');
    for (const required of ['LICENSE', 'README.md', 'dist/index.js', 'dist/index.d.ts']) {
      if (!files.includes(required)) problems.push(`missing ${required}`);
    }
    if (files.some(f => f.endsWith('.tsbuildinfo'))) problems.push('tarball contains .tsbuildinfo');
    if (files.some(f => /(^|\/)test\//.test(f))) problems.push('tarball contains tests');
    if (pkg === 'provider-lucide' && !files.includes('generated/LICENSE-lucide')) problems.push('missing Lucide license');
    const deps = { ...packed.dependencies, ...packed.peerDependencies };
    for (const [name, range] of Object.entries(deps)) {
      if (String(range).startsWith('workspace:')) problems.push(`unresolved ${name}@${range}`);
    }

    for (const [label, cmd, args] of [
      ['publint', bin('publint'), [tgz, '--strict']],
      ['attw', bin('attw'), [tgz, '--profile', 'esm-only', '--format', 'ascii']],
    ]) {
      try {
        run(cmd, args);
      } catch (error) {
        problems.push(`${label} failed:\n${error.stdout ?? ''}${error.stderr ?? ''}`);
      }
    }

    const size = (readFileSync(tgz).length / 1024).toFixed(1);
    if (problems.length) {
      failures.push(packed.name);
      console.log(`✗ ${packed.name}@${packed.version} (${size} KB, ${files.length} files)`);
      for (const p of problems) console.log(`    - ${p}`);
    } else {
      console.log(`✓ ${packed.name}@${packed.version} (${size} KB, ${files.length} files)`);
    }
  }
} finally {
  rmSync(out, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n${failures.length} package(s) not ready to publish.`);
  process.exit(1);
}
console.log('\nAll packages are ready to publish.');
