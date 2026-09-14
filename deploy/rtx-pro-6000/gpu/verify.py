"""Anonymous HTTP and real WebSocket boundary checks; no credential files needed."""
import base64
import hashlib
import json
import os
import socket
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request

base = sys.argv[1].rstrip('/')
url = urllib.parse.urlsplit(base)
if url.scheme not in ('http', 'https') or not url.hostname or url.path:
    raise ValueError('Supply an HTTP(S) origin without a path')
client = urllib.request.build_opener()  # Deliberately no cookie jar or login step.
checks = []


def request(path, *, data=None, headers=None):
    try:
        return client.open(urllib.request.Request(base + path, data=data, headers=headers or {}), timeout=30)
    except urllib.error.HTTPError as response:
        return response


def check(name, passed):
    checks.append({'check': name, 'passed': bool(passed)})
    if not passed:
        raise AssertionError(name)


def websocket(origin):
    """Upgrade without Cookie/Authorization; return only public status and validity."""
    key = base64.b64encode(os.urandom(16)).decode()
    expected_accept = base64.b64encode(hashlib.sha1((key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest()).decode()
    connection = socket.create_connection((url.hostname, url.port or (443 if url.scheme == 'https' else 80)), timeout=30)
    if url.scheme == 'https':
        connection = ssl.create_default_context().wrap_socket(connection, server_hostname=url.hostname)
    with connection:
        headers = [
            'GET /api/websockets HTTP/1.1', f'Host: {url.netloc}',
            'Connection: Upgrade', 'Upgrade: websocket',
            f'Sec-WebSocket-Key: {key}', 'Sec-WebSocket-Version: 13',
        ]
        if origin is not None:
            headers.append(f'Origin: {origin}')
        connection.sendall(('\r\n'.join(headers) + '\r\n\r\n').encode())
        received = b''
        while b'\r\n\r\n' not in received:
            chunk = connection.recv(4096)
            if not chunk:
                raise AssertionError('WebSocket handshake ended before response headers')
            received += chunk
            if len(received) > 65536:
                raise AssertionError('WebSocket response headers exceed limit')
        lines = received.split(b'\r\n\r\n', 1)[0].decode('latin1').split('\r\n')
        status = int(lines[0].split()[1])
        response_headers = {key.lower(): value.strip() for key, value in (line.split(':', 1) for line in lines[1:] if ':' in line)}
        valid = response_headers.get('sec-websocket-accept', '') == expected_accept
        # A normal masked close avoids leaving the verification connection open.
        if status == 101:
            mask = os.urandom(4)
            payload = b'\x03\xe8'
            connection.sendall(b'\x88\x82' + mask + bytes(value ^ mask[index % 4] for index, value in enumerate(payload)))
        return status, valid


try:
    page = request('/')
    body = page.read()
    check('anonymous Selkies page with cloud adapter', page.status == 200 and b'<title>Selkies</title>' in body and b'/cloud/client.js' in body and b'name="code"' not in body)
    check('no visitor authentication cookie or challenge', not page.headers.get('Set-Cookie') and not page.headers.get('WWW-Authenticate'))
    check('anonymous stream API', request('/api/health').status == 200)
    check('client authorization cannot override internal service credentials', request('/api/health', headers={'Authorization': 'Basic aW52YWxpZDppbnZhbGlk'}).status == 200)
    adapter = request('/cloud/client.js')
    check('anonymous cloud adapter', adapter.status == 200 and b'selkiesTransport' in adapter.read())
    status = request('/cloud/status')
    check('anonymous cloud status', status.status == 200 and isinstance(json.loads(status.read()), dict))
    for method in ('GET', 'POST'):
        legacy = request('/cloud/login', data=b'' if method == 'POST' else None, headers={'Origin': base})
        check(f'legacy {method} login redirects without a code or cookie', legacy.status == 200 and b'<title>Selkies</title>' in legacy.read() and not legacy.headers.get('Set-Cookie'))
    check('cross-origin HTTP denied', request('/api/health', headers={'Origin': 'https://untrusted.invalid'}).status == 403)
    check('cross-origin legacy form denied', request('/cloud/login', data=b'', headers={'Origin': 'https://untrusted.invalid'}).status == 403)
    status, valid = websocket(base)
    check('anonymous same-origin WebSocket upgrade', status == 101 and valid)
    check('cross-origin WebSocket denied', websocket('https://untrusted.invalid')[0] == 403)
    check('WebSocket without Origin denied', websocket(None)[0] == 403)
finally:
    print(json.dumps({'base': base, 'checks': checks}, ensure_ascii=False, indent=2))
