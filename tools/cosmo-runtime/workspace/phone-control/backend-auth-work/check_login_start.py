"""Anonymous native -> main-site -> login smoke check, with no sensitive output."""
import hashlib
import secrets
import urllib.request
import urllib.error
from urllib.parse import urlsplit, parse_qs, urlencode
import base64
import json

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

opener = urllib.request.build_opener(NoRedirect())
def get(url):
    try:
        response = opener.open(url, timeout=15)
    except urllib.error.HTTPError as response:
        return response
    return response

verifier = secrets.token_urlsafe(32)
state = secrets.token_urlsafe(32)
challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
params = {'code_challenge_method':'S256', 'code_challenge':challenge, 'state':state, 'redirect_uri':'https://cosmo.hhikr.moe/android/auth/callback'}
with get('https://cosmo.hhikr.moe/auth/native/authorize?' + urlencode(params)) as response:
    assert response.status == 302
    location = response.headers['Location']
    target = urlsplit(location)
    assert (target.scheme, target.netloc, target.path) == ('https', 'hhikr.moe', '/api/auth/cosmo')
    assert len(parse_qs(target.query)['state'][0]) == 43
with get(location) as response:
    assert response.status == 302
    login = response.headers['Location']
    target = urlsplit(login)
    assert target.path == '/login/'
    return_to = parse_qs(target.query)['return'][0]
    assert urlsplit(return_to).path == '/api/auth/cosmo'
    if not target.netloc:
        login = 'https://hhikr.moe' + login
    else:
        assert (target.scheme, target.netloc) == ('https', 'hhikr.moe')
with get(login) as response:
    assert response.status == 200
    html = response.read().decode()
    assert '/api/auth/google/start' in html
print(json.dumps({'native_authorize_status':302,'main_site_status':302,'login_page_status':200,'native_return_preserved':True,'google_entry_present':True}))
