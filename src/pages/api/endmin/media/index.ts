import type { APIRoute } from 'astro';
import { fail, json } from '@/lib/http';
import { coverOf, displayUrl, ensureCoverVariants, ingestUpload, isRaster, MAX_MEDIA_BYTES } from '@/server/media.ts';

export const prerender = false;

/**
 * Upload an image or attachment. The request body is the file itself;
 * `?name=` carries its original name and `?cover=1` also prepares cover sizes.
 */
export const POST: APIRoute = async ({ request, url }) => {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_MEDIA_BYTES) return fail('too_large', '文件太大了（上限 50 MB）', 413);
  const name = url.searchParams.get('name') ?? 'file';
  try {
    const media = await ingestUpload(name, Buffer.from(await request.arrayBuffer()));
    if (url.searchParams.get('cover') === '1') {
      if (!isRaster(media)) return fail('invalid', '封面必须是图片');
      await ensureCoverVariants(media);
    }
    return json({
      id: media.id,
      url: displayUrl(media),
      filename: media.filename,
      width: media.width,
      height: media.height,
      image: isRaster(media),
      cover: coverOf(media)?.src ?? null,
    }, 201);
  } catch (err) {
    return fail('invalid', err instanceof Error ? err.message : '上传失败');
  }
};