#!/usr/bin/env python3
"""Local static server that mirrors the Netlify routing rules in _redirects.

`python3 -m http.server` can only serve files that exist, so deep links such as /mcat or
/practice 404 locally and the retired-course redirects never fire. This server:

  * serves the repository root,
  * applies the rules in _redirects (200 rewrites, 301/302 redirects, and the /* SPA
    fallback, which Netlify only applies when no real file matches). Unknown paths
    still receive index.html, with HTTP 404, matching route-meta.js,
  * answers proxied external rules (the visitor counter) with 404 so the app degrades
    the same way it does offline,
  * sends Cache-Control: no-cache so browsers revalidate every file while developing
    (no-store would stop headless Chromium from finishing unread error bodies).

    python3 scripts/serve.py            # http://127.0.0.1:8765
    python3 scripts/serve.py --port 8805
"""
from __future__ import annotations

import argparse
import posixpath
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def load_rules() -> list[tuple[str, str, int]]:
    rules: list[tuple[str, str, int]] = []
    redirects = ROOT / '_redirects'
    if not redirects.exists():
        return [('/*', '/index.html', 200)]
    for line in redirects.read_text().splitlines():
        line = line.split('#', 1)[0].strip()
        if not line:
            continue
        parts = line.split()
        source, target = parts[0], parts[1]
        status = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 301
        rules.append((source, target, status))
    return rules


RULES = load_rules()

# Keep in step with ROUTES in netlify/edge-functions/route-meta.js. One segment,
# with or without a trailing slash. Anything else that falls through to the SPA
# shell is a not-found page.
KNOWN_ROUTES = {
    'mcat',
    'dat',
    'learn',
    'practice',
    'anatomy',
    'medicine',
    'neuro',
    'academy',
    'stats',
    'utsa',
    'focus',
    'updates',
}


def is_known_route(path: str) -> bool:
    parts = [part for part in path.split('/') if part]
    return len(parts) == 1 and parts[0].lower() in KNOWN_ROUTES


def match(rule: str, path: str) -> str | None:
    """Return the splat for a matching rule ('' for exact matches), else None."""
    if rule.endswith('/*'):
        prefix = rule[:-1]
        if path.startswith(prefix):
            return path[len(prefix):]
        return None
    return '' if path == rule else None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):  # quieter than the default, still shows each request
        print(f'{self.address_string()} {fmt % args}')

    def send_response(self, code, message=None):
        # Unknown SPA paths are the app shell with a real 404, same as route-meta.js.
        forced = getattr(self, '_rewrite_status', None)
        if forced and int(code) == 200:
            code = forced
            self._rewrite_status = None
        super().send_response(code, message)

    def _prepare(self):
        """Apply _redirects. Return True when the response has already been sent."""
        parsed = urlsplit(self.path)
        path = parsed.path
        if self.file_exists(path):
            return False
        for source, target, status in RULES:
            splat = match(source, path)
            if splat is None:
                continue
            if target.startswith(('http://', 'https://')):
                self.send_error(404, 'External proxy rules are not available locally')
                return True
            target = target.replace(':splat', splat)
            if status in (301, 302, 307, 308):
                if parsed.query:
                    target = f'{target}{"&" if "?" in target else "?"}{parsed.query}'
                self.send_response(status)
                self.send_header('Location', target)
                self.end_headers()
                return True
            if self.file_exists(target):
                self.path = target
                if source == '/*' and status == 200 and not is_known_route(path):
                    self._rewrite_status = 404
                return False
        return False

    def do_GET(self):
        if self._prepare():
            return None
        return super().do_GET()

    def do_HEAD(self):
        if self._prepare():
            return None
        return super().do_HEAD()

    def file_exists(self, path: str) -> bool:
        clean = posixpath.normpath(path)
        if clean.startswith('..'):
            return False
        candidate = ROOT / clean.lstrip('/')
        if candidate.is_dir():
            candidate = candidate / 'index.html'
        return candidate.is_file()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--bind', default='127.0.0.1')
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.bind, args.port), Handler)
    print(f'Serving {ROOT} at http://{args.bind}:{args.port} (Ctrl+C to stop)')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
