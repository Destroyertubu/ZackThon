"""HTTP boundary smoke checks. Never prints access codes or session cookies."""
import base64
import http.cookiejar
import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

base, secret_path = sys.argv[1:3]
settings = dict(line.split('=', 1) for line in pathlib.Path(secret_path).read_text().splitlines() if '=' in line)
code = settings['SELKIES_BASIC_AUTH_PASSWORD']
jar = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
anonymous = urllib.request.build_opener()
checks = []


def request(opener, path, *, data=None, headers=None):
    try:
        return opener.open(urllib.request.Request(base + path, data=data, headers=headers or {}), timeout=30)
    except urllib.error.HTTPError as response:
        return response


def check(name, passed):
    checks.append({'check': name, 'passed': bool(passed)})
    if not passed:
        raise AssertionError(name)


page = request(anonymous, '/')
check('login page and same-origin form referrer policy', page.status == 200 and page.headers.get('Referrer-Policy') == 'same-origin' and b'name="code"' in page.read())
check('anonymous stream API denied', request(anonymous, '/api/health').status == 401)
check('cross-origin login denied', request(anonymous, '/cloud/login', data=b'code=wrong', headers={'Origin': 'https://untrusted.invalid'}).status == 403)
check('incorrect access code denied', request(anonymous, '/cloud/login', data=b'code=wrong', headers={'Origin': base}).status == 401)
login = request(client, '/cloud/login', data=urllib.parse.urlencode({'code': code}).encode(), headers={'Origin': base})
check('valid code enters protected stream', login.status == 200 and b'<title>Selkies</title>' in login.read())
cookies = list(jar)
check('secure HttpOnly session cookie', len(cookies) == 1 and cookies[0].secure and cookies[0].has_nonstandard_attr('HttpOnly'))
check('authenticated stream health', request(client, '/api/health').status == 200)
upgrade = {'Connection': 'Upgrade', 'Upgrade': 'websocket', 'Sec-WebSocket-Key': base64.b64encode(os.urandom(16)).decode(), 'Sec-WebSocket-Version': '13', 'Origin': base}
check('anonymous WebSocket upgrade denied', request(anonymous, '/websockets', headers=upgrade).status == 401)
check('cross-origin authenticated WebSocket denied', request(client, '/websockets', headers={**upgrade, 'Origin': 'https://untrusted.invalid'}).status == 403)
print(json.dumps({'base': base, 'checks': checks}, ensure_ascii=False, indent=2))
