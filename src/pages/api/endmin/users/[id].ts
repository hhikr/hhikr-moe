import type { APIRoute } from 'astro';
import { fail, json, readJson } from '@/lib/http';
import { deleteUser, setAvatar, setUserStatus } from '@/server/users.ts';

export const prerender = false;

// There is deliberately no way to change a role here.
export const PATCH: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  const body = await readJson(request);
  if (body.removeAvatar === true) {
    setAvatar(id, null);
    return json({ ok: true });
  }
  if (body.status !== 'active' && body.status !== 'banned') return fail('invalid', '状态不正确');
  return setUserStatus(id, body.status) ? json({ ok: true }) : fail('not_found', '用户不存在，或不能对其执行这个操作', 404);
};

export const DELETE: APIRoute = ({ params }) =>
  deleteUser(Number(params.id)) ? json({ ok: true }) : fail('not_found', '用户不存在，或不能对其执行这个操作', 404);