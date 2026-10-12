// Run the gate on this machine against a Hermes backend reached through the
// SSH tunnel (127.0.0.1:9119). No sign-in: it listens on the loopback
// interface only, which is what COSMO_AUTH=none requires.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
process.env.COSMO_LISTEN ??= '127.0.0.1:19140';
process.env.COSMO_AUTH ??= 'none';
process.env.COSMO_STATIC_DIR ??= path.join(root, '.deployment/hermes/cosmo-web/dist');
await import('./server.mjs');
