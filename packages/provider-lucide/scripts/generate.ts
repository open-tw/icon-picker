/**
 * Build-time generator for the Lucide provider.
 *
 * Sources (both pinned to the same Lucide version):
 *   - `lucide-static` (npm): icon nodes (SVG content) and tags
 *   - Lucide GitHub repo tarball at the matching tag: categories, category titles and rename aliases
 *     (lucide-static does not ship categories / aliases)
 *
 * Output (`generated/`, committed so consumers never need network access):
 *   meta.js            [name, tags, categories][]
 *   bodies.js          { name: "<path .../>..." }      (inner SVG only — outer attributes are set by renderers)
 *   aliases.js         { oldName: newName }
 *   categories.js      { categoryId: title }
 *   component-names.js { PascalName: kebab-name }       (incl. aliases, for pascalCodec)
 *   info.js            { version, count }
 *   LICENSE-lucide     Lucide (ISC) / Feather (MIT) license notice — must ship with the data
 *
 * Run: `node scripts/generate.ts` (Node >= 22.18 strips types natively).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

type IconNode = [tag: string, attrs: Record<string, string | number>, children?: IconNode[]];

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const outDir = join(pkgRoot, 'generated');
const cacheDir = join(pkgRoot, '.cache');

const require = createRequire(import.meta.url);
const staticRoot = join(dirname(require.resolve('lucide-static')), '..', '..');
const staticPkg = JSON.parse(readFileSync(join(staticRoot, 'package.json'), 'utf8')) as { version: string };
const version = staticPkg.version;

const iconNodes = JSON.parse(readFileSync(join(staticRoot, 'icon-nodes.json'), 'utf8')) as Record<string, IconNode[]>;
const staticTags = JSON.parse(readFileSync(join(staticRoot, 'tags.json'), 'utf8')) as Record<string, string[]>;

// ------------------------------------------------------------------ repo metadata

async function getRepoTarball(): Promise<Buffer> {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, `lucide-${version}.tar.gz`);
  if (!existsSync(file)) {
    const url = `https://codeload.github.com/lucide-icons/lucide/tar.gz/refs/tags/${version}`;
    console.log(`Downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download Lucide ${version} metadata: HTTP ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(file);
}

/** Minimal ustar reader: returns regular files whose path matches `filter`. */
function readTar(gz: Buffer, filter: (path: string) => boolean): Map<string, string> {
  const tar = gunzipSync(gz);
  const files = new Map<string, string>();
  const str = (start: number, len: number) => {
    const raw = tar.subarray(start, start + len);
    const end = raw.indexOf(0);
    return raw.subarray(0, end === -1 ? len : end).toString('utf8');
  };
  let offset = 0;
  let longName: string | null = null;
  while (offset + 512 <= tar.length) {
    const name = str(offset, 100);
    if (!name) break; // end-of-archive
    const size = parseInt(str(offset + 124, 12).trim() || '0', 8);
    const type = str(offset + 156, 1) || '0';
    const prefix = str(offset + 345, 155);
    const body = offset + 512;
    let path = longName ?? (prefix ? `${prefix}/${name}` : name);
    longName = null;
    if (type === 'x') {
      const pax = tar.subarray(body, body + size).toString('utf8');
      const m = /\d+ path=([^\n]*)\n/.exec(pax);
      if (m) longName = m[1]!;
    } else if (type === 'L') {
      longName = tar.subarray(body, body + size).toString('utf8').replace(/\0+$/, '');
    } else if ((type === '0' || type === '\0') && filter(path)) {
      files.set(path, tar.subarray(body, body + size).toString('utf8'));
    }
    offset = body + Math.ceil(size / 512) * 512;
  }
  return files;
}

interface RepoIconJson {
  tags?: string[];
  categories?: string[];
  aliases?: (string | { name: string })[];
}

const tarball = await getRepoTarball();
const repoFiles = readTar(tarball, p => /^[^/]+\/(icons|categories)\/[^/]+\.json$/.test(p));

const repoIcons = new Map<string, RepoIconJson>();
const categoryTitles: Record<string, string> = {};
for (const [path, content] of repoFiles) {
  const [, dir, file] = /^[^/]+\/(icons|categories)\/([^/]+)\.json$/.exec(path)!;
  const json = JSON.parse(content);
  if (dir === 'icons') repoIcons.set(file!, json as RepoIconJson);
  else categoryTitles[file!] = (json as { title?: string }).title ?? file!;
}

// ------------------------------------------------------------------ build data

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeAttr = (v: string) => v.replace(/[&<>"]/g, c => ESC[c]!);

function nodeToSvg([tag, attrs, children]: IconNode): string {
  const a = Object.entries(attrs)
    .filter(([k]) => k !== 'key')
    .map(([k, v]) => ` ${k}="${escapeAttr(String(v))}"`)
    .join('');
  return children?.length ? `<${tag}${a}>${children.map(nodeToSvg).join('')}</${tag}>` : `<${tag}${a}/>`;
}

function toPascalCase(name: string): string {
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

/** Resolve `$extends:<icon>` entries (inherit that icon's categories) and drop other `$` directives. */
function resolveCategories(name: string, seen = new Set<string>()): string[] {
  if (seen.has(name)) return [];
  seen.add(name);
  const out: string[] = [];
  for (const c of repoIcons.get(name)?.categories ?? []) {
    if (c.startsWith('$extends:')) out.push(...resolveCategories(c.slice('$extends:'.length), seen));
    else if (!c.startsWith('$')) out.push(c);
  }
  return [...new Set(out)];
}

const names = Object.keys(iconNodes).sort();
const meta: [string, string[], string[]][] = [];
const bodies: Record<string, string> = {};
const aliases: Record<string, string> = {};
const componentNames: Record<string, string> = {};
const missingMeta: string[] = [];
const usedCategories = new Set<string>();

for (const name of names) {
  const repo = repoIcons.get(name);
  if (!repo) missingMeta.push(name);
  const tags = staticTags[name] ?? (repo?.tags ?? []).filter(t => !t.startsWith('$'));
  const categories = resolveCategories(name);
  categories.forEach(c => usedCategories.add(c));
  meta.push([name, tags, categories]);
  bodies[name] = iconNodes[name]!.map(nodeToSvg).join('');
  componentNames[toPascalCase(name)] = name;
}

for (const name of names) {
  for (const alias of repoIcons.get(name)?.aliases ?? []) {
    const aliasName = typeof alias === 'string' ? alias : alias.name;
    if (!aliasName || aliasName === name || iconNodes[aliasName]) continue;
    aliases[aliasName] = name;
    const pascal = toPascalCase(aliasName);
    if (!(pascal in componentNames)) componentNames[pascal] = name;
  }
}

// Pascal collisions would make pascalCodec ambiguous: fail loudly.
const pascalSeen = new Map<string, string>();
for (const name of names) {
  const p = toPascalCase(name);
  const prev = pascalSeen.get(p);
  if (prev) throw new Error(`PascalCase collision: ${prev} and ${name} both map to ${p}`);
  pascalSeen.set(p, name);
}

const categories: Record<string, string> = {};
for (const id of [...usedCategories].sort()) categories[id] = categoryTitles[id] ?? id;

// ------------------------------------------------------------------ write

mkdirSync(outDir, { recursive: true });
const banner = `// Generated by scripts/generate.ts from Lucide ${version} (ISC). Do not edit.\n`;

function writeModule(file: string, data: unknown, dts: string) {
  // JSON.parse of a string literal parses faster than an equivalent object literal.
  writeFileSync(join(outDir, `${file}.js`), `${banner}export default JSON.parse(${JSON.stringify(JSON.stringify(data))});\n`);
  writeFileSync(join(outDir, `${file}.d.ts`), `${banner}${dts}\n`);
}

writeModule(
  'meta',
  meta,
  'declare const meta: ReadonlyArray<readonly [name: string, tags: string[], categories: string[]]>;\nexport default meta;',
);
writeModule('bodies', bodies, 'declare const bodies: Readonly<Record<string, string>>;\nexport default bodies;');
writeModule('aliases', aliases, 'declare const aliases: Readonly<Record<string, string>>;\nexport default aliases;');
writeModule('categories', categories, 'declare const categories: Readonly<Record<string, string>>;\nexport default categories;');
writeModule(
  'component-names',
  componentNames,
  'declare const componentNames: Readonly<Record<string, string>>;\nexport default componentNames;',
);
writeFileSync(
  join(outDir, 'info.js'),
  `${banner}export const version = ${JSON.stringify(version)};\nexport const count = ${names.length};\n`,
);
// Lucide (ISC) and the Feather icons it derives from (MIT) require keeping their notices with the data.
writeFileSync(
  join(outDir, 'LICENSE-lucide'),
  `The icon data in this directory is generated from Lucide ${version} (lucide-static and the Lucide repository).\n` +
    `Its original license follows.\n\n${readFileSync(join(staticRoot, 'LICENSE'), 'utf8')}`,
);
writeFileSync(join(outDir, 'info.d.ts'), `${banner}export declare const version: string;\nexport declare const count: number;\n`);

console.log(
  `Lucide ${version}: ${names.length} icons, ${Object.keys(categories).length} categories, ` +
    `${Object.keys(aliases).length} aliases, ${Object.keys(componentNames).length} component names`,
);
if (missingMeta.length) {
  console.warn(`WARNING: ${missingMeta.length} icons have no repo metadata (no categories): ${missingMeta.slice(0, 10).join(', ')}…`);
}
