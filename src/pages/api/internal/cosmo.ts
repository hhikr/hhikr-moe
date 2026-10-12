import type { APIRoute } from 'astro';
import { json, readJson } from '@/lib/http';
import { cosmoGrantStands, isCosmoGate, redeemCosmoCode, revokeCosmoGrant } from '@/server/cosmo.ts';

export const prerender = false;

/**
 * Called by the Cosmo gate over the loopback interface, never by a browser.
 * It proves itself with the shared secret; without it this address does not exist.
 */
export const POST: APIRoute = async ({ request }) => {
  const presented = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!isCosmoGate(presented)) return new Response(null, { status: 404 });

  const { action, code, grant } = await readJson(request);
  if (action === 'redeem') {
    const redeemed = redeemCosmoCode(code);
    return redeemed ? json({ ok: true, ...redeemed }) : json({ ok: false }, 403);
  }
  if (action === 'check') return json({ ok: true, valid: cosmoGrantStands(grant) });
  if (action === 'revoke') {
    revokeCosmoGrant(grant);
    return json({ ok: true });
  }
  return json({ ok: false }, 400);
};
