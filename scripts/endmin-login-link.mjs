// Print a one-time sign-in link for the endministrator, valid for five minutes.
// For use on the server when Google sign-in cannot be reached:
//   runuser -u hhikr-web -- sh -c "set -a; . /etc/hhikr-web/env; set +a; cd /srv/hhikr/app/current && node scripts/endmin-login-link.mjs"
import { createLoginLink } from '../src/server/auth.ts';
import { siteOrigin } from '../src/server/config.ts';
import { closeDb } from '../src/server/db.ts';

const token = createLoginLink();
console.log(`${siteOrigin() ?? 'http://localhost:4321'}/api/auth/link?token=${token}`);
console.log('The link works once and expires in five minutes.');
closeDb();