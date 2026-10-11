import type { APIRoute } from 'astro';
import { clientAddress, fail, json } from '@/lib/http';
import { issueChallenge } from '@/server/challenge.ts';
import { addressKey, allow, LIMITS } from '@/server/ratelimit.ts';

export const prerender = false;

export const GET: APIRoute = (context) => {
  if (!allow(`challenge:${addressKey(clientAddress(context))}`, LIMITS.challenge)) {
    return fail('rate_limited', '操作太频繁了，请稍后再试', 429);
  }
  return json(issueChallenge());
};