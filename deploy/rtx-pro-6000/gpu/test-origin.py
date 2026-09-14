import hashlib
import http.client
import http.server
import importlib.util
import json
import pathlib
import threading
import unittest
import urllib.request

spec = importlib.util.spec_from_file_location('cloud_origin', pathlib.Path(__file__).with_name('origin.py'))
origin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(origin)


class ReleaseTest(unittest.TestCase):
    def test_decorated_html_and_version_share_the_actual_deployed_bytes(self):
        state = {'body': b'<html><body>release A</body></html>', 'status': 200}

        class Upstream(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(state['status'])
                self.send_header('Content-Type', 'text/html')
                self.send_header('Content-Length', str(len(state['body'])))
                self.end_headers()
                self.wfile.write(state['body'])

            def log_message(self, *_):
                pass

        upstream = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Upstream)

        class Connection(http.client.HTTPConnection):
            def __init__(self, *_args, **_kwargs):
                super().__init__('127.0.0.1', upstream.server_port, timeout=5)

        original = origin.OriginConnection
        origin.OriginConnection = Connection
        proxy = http.server.ThreadingHTTPServer(('127.0.0.1', 0), origin.Handler)
        for server in (upstream, proxy):
            threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            base = f'http://127.0.0.1:{proxy.server_port}'
            for body in (state['body'], b'<html><body>release B</body></html>'):
                state['body'] = body
                expected = hashlib.sha256(body).hexdigest()
                request = urllib.request.Request(base + '/home', headers={'Sec-Fetch-Dest': 'document', 'If-None-Match': 'old'})
                with urllib.request.urlopen(request) as response:
                    self.assertEqual(response.headers['Cache-Control'], 'no-store')
                    self.assertIn(f'data-cloud-build="{expected}"', response.read().decode())
                with urllib.request.urlopen(base + '/__cloud/version') as response:
                    self.assertEqual(json.load(response)['build'], expected)
            state['status'] = 503
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(base + '/__cloud/version')
            self.assertEqual(error.exception.code, 503)
        finally:
            for server in (proxy, upstream):
                server.shutdown()
                server.server_close()
            origin.OriginConnection = original


if __name__ == '__main__':
    unittest.main()
