// Browser-side helpers for signing in and registering.

export interface ApiError {
  code: string;
  message: string;
}

export async function api<T = any>(path: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  try {
    const res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data };
    return { ok: false, error: data.error ?? { code: 'unknown', message: '请求失败，请稍后再试' } };
  } catch {
    return { ok: false, error: { code: 'network', message: '网络连接出了问题，请稍后再试' } };
  }
}

function leadingZeroBits(bytes: Uint8Array): number {
  let bits = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    return bits + Math.clz32(byte) - 24;
  }
  return bits;
}

/** Fetch a proof-of-work challenge and solve it. Takes well under a second on ordinary hardware. */
export async function solveChallenge(): Promise<Record<string, unknown> | undefined> {
  const res = await api('/api/challenge');
  if (!res.ok) return undefined;
  const { salt, bits } = res.data as { salt: string; bits: number };
  const encoder = new TextEncoder();
  for (let nonce = 0; ; nonce++) {
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${salt}:${nonce}`));
    if (leadingZeroBits(new Uint8Array(digest)) >= bits) return { ...res.data, nonce: String(nonce) };
  }
}
