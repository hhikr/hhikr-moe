import type { APIRoute } from 'astro';
import { fail, json } from '@/lib/http';
import { deleteMedia } from '@/server/media.ts';

export const prerender = false;

export const DELETE: APIRoute = ({ params }) =>
  deleteMedia(Number(params.id)) ? json({ ok: true }) : fail('in_use', '这个文件还在被文章使用，或者已经不存在', 409);