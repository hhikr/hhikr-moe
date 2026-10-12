import type { APIRoute } from 'astro';
import { fail, failFrom, json } from '@/lib/http';
import { maxFileBytes, storeAsset } from '@/server/projects.ts';

export const prerender = false;

/**
 * Upload a file to a version. The request body is the file itself and is
 * streamed straight to disk; `?releaseId=` says where it belongs, `?name=`
 * carries its name and `?note=` an optional remark shown next to it.
 */
export const PUT: APIRoute = async ({ request, url }) => {
  if (Number(request.headers.get('content-length') ?? 0) > maxFileBytes()) return fail('too_large', '文件太大了', 413);
  try {
    const file = await storeAsset(Number(url.searchParams.get('releaseId')), url.searchParams.get('name'), request.body, url.searchParams.get('note'));
    return json({ id: file.id, filename: file.filename, size: file.size, sha256: file.sha256 }, 201);
  } catch (err) {
    return failFrom(err);
  }
};
