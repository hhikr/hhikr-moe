"""Local HTTP fixtures for the anonymous deployment probe; no production credentials."""
import importlib.util
import json
from pathlib import Path
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[1]
ASSETLINKS = json.loads((ROOT.parents[3] / 'cosmo/gate/association/assetlinks.json').read_text())


class PublicReadinessTests(unittest.TestCase):
    def test_deployed_public_routes_are_ready(self):
        result = self.probe_fixture()
        self.assertTrue(result['ready'], result)
        self.assertEqual(len(result['checks']), 5)

    def test_no_store_directive_accepts_compact_header_list(self):
        result = self.probe_fixture(cache_control='no-store,no-cache')
        self.assertTrue(result['ready'], result)

    def probe_fixture(self, cache_control='no-store'):
        path = ROOT / 'check_public_readiness.py'
        self.assertTrue(path.exists(), 'anonymous deployment probe is not implemented')
        spec = importlib.util.spec_from_file_location('readiness', path)
        probe = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(probe)

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                statuses = {'/.well-known/assetlinks.json': 200,
                            '/android/auth/callback': 200,
                            '/auth/native/authorize': 400,
                            '/auth/native/token': 405,
                            '/api/plugins/cosmo-tasks/rules': 401}
                self.send_response(statuses.get(self.path, 404))
                content_type = 'text/html' if self.path == '/android/auth/callback' else 'application/json'
                self.send_header('Content-Type', content_type)
                self.send_header('Cache-Control', cache_control)
                self.send_header('Referrer-Policy', 'no-referrer')
                self.end_headers()
                self.wfile.write(json.dumps(ASSETLINKS).encode() if self.path.endswith('assetlinks.json') else b'{}')

        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            return probe.check_public(f'http://127.0.0.1:{server.server_port}')
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
