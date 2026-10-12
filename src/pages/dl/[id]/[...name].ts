import fs from 'node:fs';
import { Readable } from 'node:stream';
import type { APIRoute } from 'astro';
import { countDownload, findDownload, parseRange } from '@/server/projects.ts';

export const prerender = false;

/**
 * Send a file of a work. Always as a download, never rendered in the browser.
 * Supports resuming (Range); a download is counted when it starts from the
 * beginning, so resumed pieces are not counted again.
 */
const send: APIRoute = ({ params, request, locals }) => {
  const id = Number(params.id);
  const found = Number.isInteger(id) ? findDownload(id, locals.viewer) : undefined;
  if (!found) return new Response(null, { status: 404 });

  const ascii = found.filename.replace(/[^\x20-\x7e]|["\\]/g, '_');
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(found.filename)}`,
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
    ETag: `"${found.sha256}"`,
    'Cache-Control': found.hidden ? 'private, no-store' : 'no-cache',
  };

  const range = parseRange(request.headers.get('range'), found.size);
  if (range === null) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${found.size}` } });
  const start = range?.start ?? 0;
  const end = range?.end ?? found.size - 1;
  headers['Content-Length'] = String(end - start + 1);
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${found.size}`;
  const status = range ? 206 : 200;
  if (request.method === 'HEAD') return new Response(null, { status, headers });

  if (start === 0) countDownload(id);
  return new Response(Readable.toWeb(fs.createReadStream(found.file, { start, end })) as any, { status, headers });
};

export const GET = send;
export const HEAD = send;
