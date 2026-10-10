#!/usr/bin/env python3
"""Loopback-only static app server. Python standard library; no pip packages."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser

ROOT = Path(__file__).resolve().parent / 'web'
class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.wasm': 'application/wasm', '.cjs': 'text/javascript', '.mjs': 'text/javascript'}
    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Permissions-Policy', 'camera=(self), microphone=()')
        super().end_headers()
    def log_message(self, fmt, *args):
        if len(args) > 1 and str(args[1]) not in ('200', '304'):
            super().log_message(fmt, *args)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    needed = ['index.html', 'vendor/vision_bundle.cjs', 'vendor/wasm/vision_wasm_internal.wasm', 'models/blaze_face_short_range.tflite']
    missing = [p for p in needed if not (ROOT / p).is_file()]
    if missing:
        parser.exit(1, 'Missing files: ' + ', '.join(missing) + '\nExtract the entire ZIP before starting.\n')
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(ROOT)))
    except OSError as exc:
        parser.exit(1, f'Cannot start: {exc}\nTry: python server.py --port 8766\n')
    url = f'http://localhost:{server.server_port}'
    print(f'\nNEO-HUD FACE TRACKING\nOpen {url}\nKeep this terminal open. Press Ctrl+C to stop.\n', flush=True)
    if not args.no_browser:
        threading.Timer(0.7, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
