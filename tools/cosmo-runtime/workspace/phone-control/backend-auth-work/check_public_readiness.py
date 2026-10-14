"""Anonymous gate deployment checks. Never logs bodies, redirects, cookies or query strings.

Run: python3 check_public_readiness.py
Exit 0 means public prerequisites pass; Google/device acceptance is still manual.
"""
import json
from pathlib import Path
import sys
import urllib.error
import urllib.request

ORIGIN = 'https://cosmo.hhikr.moe'
EXPECTED = json.loads((Path(__file__).resolve().parents[4] / 'cosmo/gate/association/assetlinks.json').read_text())
ROUTES = (
    ('/.well-known/assetlinks.json', 200, 'application/json'),
    ('/android/auth/callback', 200, 'text/html'),
    ('/auth/native/authorize', 400, 'application/json'),
    ('/auth/native/token', 405, 'application/json'),
    ('/api/plugins/cosmo-tasks/rules', 401, 'application/json'),
)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def check_public(origin=ORIGIN):
    # Alternate origin is for local fixture servers only; CLI always checks production.
    opener = urllib.request.build_opener(NoRedirect)
    checks = []
    for path, expected_status, expected_type in ROUTES:
        row = {'path': path, 'expected_status': expected_status, 'ok': False}
        try:
            try:
                response = opener.open(origin + path, timeout=20)
            except urllib.error.HTTPError as error:
                response = error
            with response:
                row['status'] = response.code
                row['content_type'] = response.headers.get_content_type()
                row['redirect'] = bool(response.headers.get('Location'))
                row['ok'] = (response.code == expected_status and
                             row['content_type'] == expected_type and not row['redirect'])
                if path != '/api/plugins/cosmo-tasks/rules':
                    row['no_store'] = 'no-store' in {item.strip().lower() for item in response.headers.get('Cache-Control', '').split(',')}
                    row['no_referrer'] = response.headers.get('Referrer-Policy', '').lower() == 'no-referrer'
                    row['ok'] = row['ok'] and row['no_store'] and row['no_referrer']
                if path.endswith('assetlinks.json') and row['ok']:
                    raw = response.read(65537)
                    row['association_matches'] = len(raw) <= 65536 and json.loads(raw) == EXPECTED
                    row['ok'] = row['ok'] and row['association_matches']
        except Exception as error:
            # Exception text may contain a URL or response body; only record its type.
            row['ok'] = False
            row['error_type'] = type(error).__name__
        checks.append(row)
    return {'origin': origin, 'ready': all(row['ok'] for row in checks), 'checks': checks}


if __name__ == '__main__':
    result = check_public()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0 if result['ready'] else 1)
