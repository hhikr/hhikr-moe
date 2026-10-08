// One-off migration: Hugo (Blowfish) bundles -> Astro content collection.
// - TOML front matter  -> YAML front matter
// - {{< katex >}}       -> removed (math is always on)
// - {{< alert >}}       -> Obsidian-style callout  > [!note]
// - {{< figure >}}      -> ![alt](src "caption")
// - {{< mask >}} / cloze-span -> ||spoiler||
// - \\( x \\)           -> $x$
// Usage: node scripts/migrate-hugo.mjs src/content/posts
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (!root) {
  console.error('usage: node scripts/migrate-hugo.mjs <posts-dir>');
  process.exit(1);
}

function parseToml(src) {
  const data = {};
  for (const line of src.split(/\r?\n/)) {
    const m = line.match(/^\s*([\w-]+)\s*=\s*(.+?)\s*$/);
    if (!m) continue;
    const [, key, raw] = m;
    let value;
    if (/^\[.*\]$/.test(raw)) {
      value = [...raw.matchAll(/["']([^"']*)["']/g)].map((x) => x[1]);
    } else if (/^["'].*["']$/.test(raw)) {
      value = raw.slice(1, -1);
    } else if (raw === 'true' || raw === 'false') {
      value = raw === 'true';
    } else if (/^-?\d+$/.test(raw)) {
      value = Number(raw);
    } else {
      value = raw;
    }
    data[key] = value;
  }
  return data;
}

const yamlString = (s) => JSON.stringify(String(s));

function toYaml(fm, dir) {
  const out = [];
  out.push(`title: ${yamlString(fm.title)}`);
  out.push(`date: ${fm.date}`);
  if (fm.summary) out.push(`summary: ${yamlString(fm.summary)}`);
  if (fm.categories?.length) out.push(`category: ${yamlString(fm.categories[0])}`);
  if (fm.tags?.length) out.push(`tags: [${fm.tags.map(yamlString).join(', ')}]`);
  if (fm.series?.length) {
    out.push(`series: ${yamlString(fm.series[0])}`);
    if (typeof fm.series_order === 'number' && fm.series_order > 0) {
      out.push(`seriesOrder: ${fm.series_order}`);
    }
  }
  if (fs.existsSync(path.join(dir, 'featured.png'))) out.push(`cover: ./featured.png`);
  if (fm.draft) out.push(`draft: true`);
  return `---\n${out.join('\n')}\n---\n`;
}

function convertBody(body) {
  // Alerts may wrap code blocks, so convert them before splitting those out.
  body = body.replace(
    /\{\{<\s*alert([^>]*)>\}\}\s*\n?([\s\S]*?)\{\{<\s*\/alert\s*>\}\}/g,
    (_, args, inner) => {
      const type = /scope/.test(args) ? 'tip' : 'note';
      const lines = inner.replace(/\s+$/, '').split(/\r?\n/);
      return `> [!${type}]\n` + lines.map((l) => (l.trim() ? `> ${l}` : '>')).join('\n') + '\n';
    },
  );
  // Leave fenced code blocks untouched.
  const parts = body.split(/(^\s*```[\s\S]*?^\s*```)/m);
  return parts
    .map((part, i) => (i % 2 === 1 ? part : convertProse(part)))
    .join('')
    .replace(/\n{4,}/g, '\n\n\n');
}

function convertProse(text) {
  return (
    text
      .replace(/^\s*\{\{<\s*katex\s*>\}\}\s*$/gm, '')
      // figures -> markdown images
      .replace(/\{\{<\s*figure\s+([^>]*?)\s*>\}\}/g, (_, args) => {
        const src = args.match(/src="([^"]*)"/)?.[1] ?? '';
        let title = args.match(/title="([^"]*)"/)?.[1] ?? '';
        if (/^\d*$/.test(title)) title = '';
        return title ? `![${title}](${src} "${title.replace(/"/g, '\\"')}")` : `![](${src})`;
      })
      // spoilers
      .replace(/\{\{<\s*mask\s*>\}\}([\s\S]*?)\{\{<\s*\/mask\s*>\}\}/g, (_, t) => `||${t.trim()}||`)
      .replace(/<span class="cloze-span">([\s\S]*?)<\/span>/g, (_, t) => `||${t.trim()}||`)
      // inline math written for Hugo's escaping rules
      .replace(/\\\\\(([\s\S]+?)\\\\\)/g, (_, m) => `$${m.trim().replace(/\\\\/g, '\\')}$`)
  );
}

let count = 0;
for (const slug of fs.readdirSync(root)) {
  const dir = path.join(root, slug);
  const file = path.join(dir, 'index.md');
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+\r?\n?/);
  if (!m) {
    console.warn(`skip (no TOML front matter): ${file}`);
    continue;
  }
  const fm = parseToml(m[1]);
  const body = convertBody(src.slice(m[0].length).replace(/\r\n/g, '\n'));
  fs.writeFileSync(file, toYaml(fm, dir) + body);
  count++;
}
console.log(`migrated ${count} posts`);
