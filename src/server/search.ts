// Full-text search index, built at runtime because posts are no longer part
// of the static build. The index holds the prerendered pages plus every post a
// guest can read; hidden posts and drafts are never indexed.
import fs from 'node:fs';
import * as pagefind from 'pagefind';
import { dataPath } from './config.ts';
import { GUEST, listPosts } from './posts.ts';

export interface SearchIndexResult {
  pages: number;
  posts: number;
}

/**
 * Rebuild the index into <DATA_DIR>/pagefind.
 * @param origin    where the running site answers, e.g. http://127.0.0.1:4400
 * @param clientDir the build's prerendered output (dist/client)
 */
export async function rebuildSearchIndex(origin: string, clientDir: string): Promise<SearchIndexResult> {
  const { index, errors } = await pagefind.createIndex({});
  if (!index) throw new Error(`pagefind: ${errors.join('; ')}`);
  try {
    const dir = await index.addDirectory({ path: clientDir });
    if (dir.errors.length) throw new Error(`pagefind: ${dir.errors.join('; ')}`);

    const posts = listPosts(GUEST);
    for (const post of posts) {
      const url = `/posts/${post.slug}/`;
      // Fetch the page exactly as a guest receives it.
      const res = await fetch(new URL(url, origin));
      if (!res.ok) throw new Error(`${url} answered ${res.status}`);
      const added = await index.addHTMLFile({ url, content: await res.text() });
      if (added.errors.length) throw new Error(`pagefind: ${added.errors.join('; ')}`);
    }

    // Write beside the live index, then swap, so readers never see a half-written one.
    const live = dataPath('pagefind');
    const next = dataPath('pagefind.next');
    const old = dataPath('pagefind.old');
    fs.rmSync(next, { recursive: true, force: true });
    const written = await index.writeFiles({ outputPath: next });
    if (written.errors.length) throw new Error(`pagefind: ${written.errors.join('; ')}`);
    fs.rmSync(old, { recursive: true, force: true });
    if (fs.existsSync(live)) fs.renameSync(live, old);
    fs.renameSync(next, live);
    fs.rmSync(old, { recursive: true, force: true });

    return { pages: dir.page_count, posts: posts.length };
  } finally {
    await pagefind.close();
  }
}
