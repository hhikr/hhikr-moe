import type { APIRoute } from 'astro';
import { fail, failFrom, json, readJson } from '@/lib/http';
import { resetPassword } from '@/server/auth.ts';
import { endAllSessions } from '@/server/sessions.ts';
import { deleteUser, handleOf, nicknameProblem, renameUser, setAvatar, setUserStatus, userById } from '@/server/users.ts';

export const prerender = false;

const missing = () => fail('not_found', '用户不存在，或不能对其执行这个操作', 404);

// There is deliberately no way to change a role here.
export const PATCH: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  const body = await readJson(request);
  const user = userById(id);
  if (!user || user.role === 'endmin') return missing();

  if (body.removeAvatar === true) {
    setAvatar(id, null);
    return json({ ok: true });
  }
  if (body.signOut === true) {
    endAllSessions(id);
    return json({ ok: true });
  }
  if (body.resetPassword === true) {
    try {
      return json({ handle: handleOf(user), password: await resetPassword(id) });
    } catch (err) {
      return failFrom(err);
    }
  }
  if (typeof body.nickname === 'string') {
    const problem = nicknameProblem(body.nickname);
    if (problem) return fail('invalid', problem);
    try {
      return json({ handle: handleOf(renameUser(user, body.nickname)) });
    } catch {
      return fail('invalid', '这个昵称用的人太多了，请换一个');
    }
  }
  if (body.status !== 'active' && body.status !== 'banned') return fail('invalid', '状态不正确');
  return setUserStatus(id, body.status) ? json({ ok: true }) : missing();
};

export const DELETE: APIRoute = ({ params }) => (deleteUser(Number(params.id)) ? json({ ok: true }) : missing());