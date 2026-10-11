// Import the Markdown posts under src/content/posts into the database.
// Images are copied into the media store and their references rewritten to
// /media/... addresses. Safe to run again: posts are matched by slug.
//
//   node scripts/import-posts.mjs            import into DATA_DIR (default ./.data)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { closeDb } from '../src/server/db.ts';
import { displayUrl, ensureCoverVariants, ingestFile } from '../src/server/media.ts';
import { listAllPosts, savePost } from '../src/server/posts.ts';

const root = fileURLToPath(new URL('../src/content/', import.meta.url));
const postsDir = path.join(root, 'posts');
const isLocal = (url) => !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(url);
const used = new Set();
const missing = [];

/** Copy every locally referenced image into the media store and point the Markdown at it. */
async function rewriteImages(body, dir, slug) {
  const tree = unified().use(remarkParse).parse(body);
  const images = [];
  visit(tree, 'image', (node) => {
    if (isLocal(node.url)) images.push(node);
  });
  // Work backwards so earlier offsets stay valid.
  images.sort((a, b) => b.position.start.offset - a.position.start.offset);
  let count = 0;
  for (const node of images) {
    const file = path.resolve(dir, decodeURIComponent(node.url));
    if (!fs.existsSync(file)) {
      missing.push(`${slug}: ${node.url}`);
      continue;
    }
    used.add(file);
    const media = await ingestFile(file);
    const { start, end } = node.position;
    const raw = body.slice(start.offset, end.offset);
    // Replace only the address between "](" and the optional title or ")".
    const open = raw.indexOf('](') + 2;
    const rest = raw.slice(open);
    const written = rest.match(/^(<[^>]*>|[^\s)]+)/)?.[0];
    if (!written) {
      missing.push(`${slug}: could not rewrite ${raw}`);
      continue;
    }
    body = body.slice(0, start.offset) + raw.slice(0, open) + displayUrl(media) + rest.slice(written.length) + body.slice(end.offset);
    count++;
  }
  return { body, count };
}

const slugs = fs.readdirSync(postsDir).filter((name) => fs.existsSync(path.join(postsDir, name, 'index.md'))).sort();
const report = [];

for (const slug of slugs) {
  const dir = path.join(postsDir, slug);
  const { frontmatter: fm, content } = parseFrontmatter(fs.readFileSync(path.join(dir, 'index.md'), 'utf8'));
  const { body, count } = await rewriteImages(content, dir, slug);

  let coverMediaId;
  if (fm.cover) {
    const file = path.resolve(dir, fm.cover);
    if (fs.existsSync(file)) {
      used.add(file);
      const media = await ingestFile(file);
      await ensureCoverVariants(media);
      coverMediaId = media.id;
    } else {
      missing.push(`${slug}: cover ${fm.cover}`);
    }
  }

  await savePost({
    slug,
    title: String(fm.title),
    summary: fm.summary || undefined,
    category: fm.category || undefined,
    series: fm.series || undefined,
    seriesOrder: typeof fm.seriesOrder === 'number' ? fm.seriesOrder : undefined,
    coverMediaId,
    // Posts marked as drafts are no longer shown publicly; see REFACTOR_PLAN.md §5.2.
    status: fm.draft === true ? 'draft' : 'published',
    hidden: false,
    pinned: fm.pinned === true,
    commentsEnabled: fm.comments !== false,
    sourceMd: body,
    publishedAt: new Date(fm.date),
    updatedAt: fm.updated ? new Date(fm.updated) : undefined,
    tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
  });
  report.push({ slug, status: fm.draft === true ? 'draft' : 'published', images: count, cover: coverMediaId ? 'yes' : '' });
}

console.table(report);

// Files that sit next to the posts but that no post refers to.
const unused = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name !== 'index.md' && !used.has(full)) unused.push(path.relative(root, full));
  }
};
walk(root);

const all = listAllPosts();
console.log(`posts: ${all.length} (${all.filter((p) => p.status === 'published').length} published, ${all.filter((p) => p.status === 'draft').length} draft)`);
console.log(`media files referenced: ${used.size}`);
console.log(`missing references: ${missing.length}`);
for (const m of missing) console.log(`  ${m}`);
console.log(`files not referenced by any post: ${unused.length}`);
for (const u of unused.slice(0, 40)) console.log(`  ${u}`);
if (unused.length > 40) console.log(`  … and ${unused.length - 40} more`);
closeDb();
