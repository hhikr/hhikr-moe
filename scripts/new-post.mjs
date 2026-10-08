// Scaffold a new post bundle.
// Usage: npm run new -- <slug> ["标题"] [--category StudyBase] [--series 笔记-操作系统]
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const category = flag('category');
const series = flag('series');
const [slug, title = slug] = args;

if (!slug || !/^[\w-]+$/.test(slug)) {
  console.error('usage: npm run new -- <slug> ["标题"] [--category StudyBase] [--series 名称]');
  process.exit(1);
}

const dir = path.join('src', 'content', 'posts', slug);
if (fs.existsSync(dir)) {
  console.error(`already exists: ${dir}`);
  process.exit(1);
}

const offset = '+08:00';
const now = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 19) + offset;
const fm = [
  '---',
  `title: ${JSON.stringify(title)}`,
  `date: ${now}`,
  'summary: ""',
  category && `category: ${JSON.stringify(category)}`,
  'tags: []',
  series && `series: ${JSON.stringify(series)}`,
  'draft: true',
  '---',
  '',
  '> [!note]',
  '> 写点什么。',
  '',
]
  .filter((l) => l !== undefined)
  .join('\n');

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'index.md'), fm);
console.log(`created ${path.join(dir, 'index.md')}`);
