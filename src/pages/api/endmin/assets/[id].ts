import type { APIRoute } from 'astro';
import { fail, json } from '@/lib/http';
import { deleteAsset } from '@/server/projects.ts';

export const prerender = false;

export const DELETE: APIRoute = ({ params }) => (deleteAsset(Number(params.id)) ? json({ ok: true }) : fail('not_found', '文件不存在', 404));
