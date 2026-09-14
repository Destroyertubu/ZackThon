"""Expose only the existing app inside the otherwise networkless renderer."""
import http.client
import http.server
import hashlib
import json
import pathlib
import socket


class OriginConnection(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(90)
        self.sock.connect('/run/wanderwise/origin.sock')


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def forward(self):
        length = int(self.headers.get('Content-Length', '0'))
        if self.path == '/__cloud/version' and self.command == 'GET':
            connection = OriginConnection('127.0.0.1', 4187, timeout=5)
            try:
                connection.request('GET', '/', headers={'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache'})
                response = connection.getresponse()
                if response.status != 200 or 'text/html' not in response.getheader('Content-Type', ''):
                    self.send_error(503)
                    return
                body = json.dumps({'build': hashlib.sha256(response.read()).hexdigest()}).encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(body)))
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                self.wfile.write(body)
            finally:
                connection.close()
            return
        if self.path == '/__cloud/status.js' and self.command == 'GET':
            body = pathlib.Path('/opt/wanderwise/cloud-status.js').read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == '/__cloud/metrics' and self.command == 'POST':
            if length <= 0 or length > 8192:
                self.send_error(413)
                return
            try:
                data = json.loads(self.rfile.read(length))
                allowed = ('renderer', 'fps', 'p95Ms', 'triangles', 'drawCalls', 'path', 'at',
                           'build', 'landscape', 'islandCount', 'pointerLocked', 'lookAllowed', 'width', 'height')
                data = {key: data[key] for key in allowed if isinstance(data.get(key), (str, int, float))}
                target = pathlib.Path('/run/wanderwise/metrics.json')
                temporary = target.with_suffix('.tmp')
                temporary.write_text(json.dumps(data))
                temporary.replace(target)
            except (ValueError, TypeError, AttributeError):
                self.send_error(400)
                return
            self.send_response(204)
            self.end_headers()
            return
        if length > 2_000_000 or not self.path.startswith('/'):
            self.send_error(413)
            return
        body = self.rfile.read(length) if length else None
        headers = {k: v for k, v in self.headers.items() if k.lower() not in ('connection', 'transfer-encoding')}
        document = self.headers.get('Sec-Fetch-Dest') == 'document'
        if document:
            headers = {k: v for k, v in headers.items() if k.lower() not in ('if-none-match', 'if-modified-since')}
            headers['Accept-Encoding'] = 'identity'
        connection = OriginConnection('127.0.0.1', 4187, timeout=90)
        try:
            connection.request(self.command, self.path, body, headers)
            response = connection.getresponse()
            decorate = document and response.status == 200 and 'text/html' in response.getheader('Content-Type', '')
            page = None
            if decorate:
                page = response.read()
                build = hashlib.sha256(page).hexdigest()
                script = f'<script data-cloud-build="{build}" src="/__cloud/status.js"></script></body>'.encode()
                page = page.replace(b'</body>', script)
            self.send_response(response.status)
            for key, value in response.getheaders():
                blocked = ('connection', 'transfer-encoding', 'keep-alive') + (('content-length', 'etag', 'cache-control', 'last-modified') if decorate else ())
                if key.lower() not in blocked:
                    self.send_header(key, value)
            if decorate:
                self.send_header('Content-Length', str(len(page)))
                self.send_header('Cache-Control', 'no-store')
            self.send_header('Connection', 'close')
            self.end_headers()
            if self.command != 'HEAD':
                if page is not None:
                    self.wfile.write(page)
                else:
                    while chunk := response.read(256 * 1024):
                        self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            self.close_connection = True
            connection.close()

    do_GET = do_HEAD = do_POST = do_PUT = do_DELETE = do_OPTIONS = forward

    def log_message(self, *_):
        pass


if __name__ == '__main__':
    http.server.ThreadingHTTPServer(('127.0.0.1', 4187), Handler).serve_forever()
