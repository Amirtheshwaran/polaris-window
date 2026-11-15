"""Local test server that behaves like GitHub Pages: gzips responses on the fly (Content-Encoding: gzip,
Content-Length = compressed size). Test with this before pushing.
Usage: python tools/serve_like_pages.py web 8000   then open http://localhost:8000/"""
import gzip, http.server, os, sys
ROOT = sys.argv[1] if len(sys.argv) > 1 else "web"; PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def do_GET(self):
        path = self.translate_path(self.path.split('?')[0])
        if os.path.isdir(path): path = os.path.join(path, 'index.html')
        if not os.path.isfile(path): return super().do_GET()
        data = open(path, 'rb').read()
        gz = 'gzip' in self.headers.get('Accept-Encoding', '')
        body = gzip.compress(data, 6) if gz else data
        self.send_response(200); self.send_header('Content-Type', self.guess_type(path))
        if gz: self.send_header('Content-Encoding', 'gzip')
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
