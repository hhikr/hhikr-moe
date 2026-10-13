// Fills a local database with made-up users, comments, works and visits, so
// the pages that are empty after `node scripts/import-posts.mjs` can be seen
// with something in them. Uses the site's own functions; it never touches the
// tables directly. For a development database only:
//   node scripts/seed-sample-data.mjs --local
// Every name and text it writes is invented and says it is sample data.
import { Readable } from 'node:stream';
import sharp from 'sharp';

if (!process.argv.includes('--local')) {
  console.error('This writes sample data into the database in DATA_DIR. Run it with --local, and only against a development database.');
  process.exit(1);
}

const { closeDb } = await import('../src/server/db.ts');
const { createUser, listUsers, setUserStatus, endminUser } = await import('../src/server/users.ts');
const { addComment, setCommentStatus, setModeratingFirstComments } = await import('../src/server/comments.ts');
const { listAllPosts } = await import('../src/server/posts.ts');
const { ingestUpload } = await import('../src/server/media.ts');
const P = await import('../src/server/projects.ts');
const { recordHit } = await import('../src/server/stats.ts');

const ENDMIN = { role: 'endmin' };
const USER = { role: 'user' };

// ---- users ----
const names = ['示例读者甲', '示例读者乙', 'sample-reader', '测试用户丙'];
const existing = new Set(listUsers().map((u) => u.nickname));
const users = names.map((nickname) => (existing.has(nickname) ? listUsers().find((u) => u.nickname === nickname) : createUser({ nickname })));
setUserStatus(users[3].id, 'banned');
console.log(`users: ${users.length}`);

// ---- comments ----
const posts = listAllPosts().filter((p) => p.status === 'published' && !p.hidden);
const owner = endminUser();
setModeratingFirstComments(false);
const lines = [
  '示例评论：这一章的图解很清楚，[b]信号量[/b]那段终于看懂了。',
  '示例评论：第二个例子里的 [code]wait()[/code] 是不是应该放在循环里？',
  '示例评论：期待下一篇。',
  '示例评论：[quote]建站的乐趣大概就在这里吧[/quote] 同感。',
];
let made = 0;
for (const [i, post] of posts.slice(0, 3).entries()) {
  for (const [j, author] of users.slice(0, 3).entries()) {
    try {
      const c = addComment({ slug: post.slug, source: lines[(i + j) % lines.length] }, USER, author);
      made++;
      if (i === 0 && j === 0 && owner) addComment({ slug: post.slug, source: '示例回复：谢谢，已经改过来了。', parentId: c.id }, ENDMIN, owner), made++;
      if (i === 2 && j === 2) setCommentStatus(c.id, 'hidden');
    } catch (e) {
      console.warn(`comment on ${post.slug}: ${e.message}`);
    }
  }
}
console.log(`comments: ${made}`);

// ---- works ----
const picture = (color, label) =>
  sharp({ create: { width: 1280, height: 720, channels: 3, background: color } })
    .composite([{ input: Buffer.from(`<svg width="1280" height="720"><text x="80" y="400" font-size="96" font-family="sans-serif" fill="#161616">${label}</text></svg>`) }])
    .png()
    .toBuffer();
const works = [
  { slug: 'sample-storage-mod', kind: 'mod', title: '示例作品：仓库整理 Mod', summary: '示例数据。一键把箱子里的物品按类别排好，支持自定义排序规则。', color: '#e4e4e0', versions: ['v1.3.0', 'v1.4.2'], hidden: false },
  { slug: 'sample-progress-export', kind: 'app', title: '示例作品：题单进度导出工具', summary: '示例数据。把浏览器里保存的 Hot 100 进度导出成一份表格。', color: null, versions: ['v0.3.0'], hidden: false },
  { slug: 'sample-draft-work', kind: 'other', title: '示例作品：还没公开的草稿', summary: '示例数据。一件隐藏的作品。', color: null, versions: [], hidden: true },
];
const have = new Set(P.listProjects(ENDMIN).map((w) => w.slug));
for (const w of works) {
  if (have.has(w.slug)) continue;
  const id = P.createProject();
  const shots = w.color ? [await ingestUpload(`${w.slug}-1.png`, await picture(w.color, 'SAMPLE 1')), await ingestUpload(`${w.slug}-2.png`, await picture('#f4f4f2', 'SAMPLE 2'))] : [];
  await P.saveProject(
    id,
    P.normalizeProject({
      title: w.title,
      slug: w.slug,
      kind: w.kind,
      summary: w.summary,
      descriptionMd: `示例数据，不是真实的作品。\n\n## 功能\n\n- 第一项功能\n- 第二项功能\n\n## 安装\n\n把下载的文件放进 \`mods\` 文件夹。`,
      links: [{ label: '源代码（示例）', url: 'https://example.com/sample' }],
      imageIds: shots.map((m) => m.id),
      coverMediaId: shots[0]?.id,
      postId: posts[0]?.id,
      hidden: w.hidden,
    }),
  );
  for (const version of w.versions) {
    const releaseId = await P.addRelease(id, { version, notesMd: `示例数据。${version} 的更新说明。\n\n- 修正了一个问题\n- 加了一个选项` });
    await P.storeAsset(releaseId, `${w.slug}-${version}.zip`, Readable.from([Buffer.alloc(48_000 + version.length * 1000, 7)]), '示例文件');
  }
}
console.log(`works: ${P.listProjects(ENDMIN).length}`);

// ---- visits over the last month ----
const agents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0',
];
const referrers = [undefined, 'https://www.google.com/', 'https://github.com/', 'https://example.com/'];
let hits = 0;
for (let d = 29; d >= 0; d--) {
  const day = new Date(Date.now() - d * 86_400_000);
  const n = 3 + ((d * 7) % 11);
  for (let k = 0; k < n; k++) {
    const post = posts[(d + k) % posts.length];
    recordHit({
      path: k % 4 === 0 ? '/' : `/posts/${post.slug}/`,
      userAgent: agents[k % agents.length],
      address: `192.0.2.${(k % 6) + 1}`,
      referrer: referrers[(d + k) % referrers.length],
      ownHost: 'hhikr.moe',
      now: day,
    });
    hits++;
  }
}
console.log(`visits: ${hits}`);
closeDb();
