"""Expose only the existing app inside the otherwise networkless renderer."""
import http.client
import http.server
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
        if self.path == '/__cloud/status.js' and self.command == 'GET':
            body = pathlib.Path('/opt/wanderwise/cloud-status.js').read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == '/__cloud/metrics' and self.command == 'POST':
            if length <= 0 or length > 8192:
                self.send_error(413)
                return
            try:
                data = json.loads(self.rfile.read(length))
                allowed = ('renderer', 'fps', 'triangles', 'drawCalls', 'path', 'at')
                data = {key: data[key] for key in allowed if isinstance(data.get(key), (str, int, float))}
                pathlib.Path('/run/wanderwise/metrics.json').write_text(json.dumps(data))
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
        connection = OriginConnection('127.0.0.1', 4187, timeout=90)
        try:
            connection.request(self.command, self.path, body, headers)
            response = connection.getresponse()
            decorate = document and response.status == 200 and 'text/html' in response.getheader('Content-Type', '')
            page = response.read().replace(b'</body>', b'<script src="/__cloud/status.js"></script></body>') if decorate else None
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


http.server.ThreadingHTTPServer(('127.0.0.1', 4187), Handler).serve_forever()
