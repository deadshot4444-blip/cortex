#!/usr/bin/env python3
"""Build lab.html: index.html with the Alzheimer's Histology Lab's own title, description, canonical
URL and share card (Open Graph / X tags), so a shared https://cortexmedical.academy/lab link previews
the lab instead of the whole site. _redirects serves it at /lab (a 200 rewrite before the SPA
fallback); everything else on the page is index.html byte for byte, so the app boots the same way.

    python3 scripts/build-lab-page.py          # write lab.html
    python3 scripts/build-lab-page.py --check  # fail when lab.html is stale (npm run check)

Run it after any edit to index.html (bump-cache.py edits both files' ?v= pins already).
"""
from pathlib import Path
import html
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SRC, OUT = ROOT / 'index.html', ROOT / 'lab.html'
URL = 'https://cortexmedical.academy/lab'
IMAGE = 'https://cortexmedical.academy/og-lab.jpg'
TITLE = 'Alzheimer’s Histology Lab — Cortex Medical Academy'
DESCRIPTION = (
    'Practice the modified Bielschowsky silver stain step by step, or mix anything on the free bench '
    'and see what happens. 3D bench, 2D microscope and real reference slides. Free, no account.'
)
IMAGE_ALT = 'Cortex Medical Academy — Alzheimer’s Histology Lab, with a real Bielschowsky-stained slide.'
KEYWORDS = 'Bielschowsky silver stain, Alzheimer histology, neuropathology lab simulation, silver stain practice, neuritic plaques, neurofibrillary tangles'

META = {
    ('name', 'description'): DESCRIPTION,
    ('name', 'keywords'): KEYWORDS,
    ('name', 'twitter:title'): TITLE,
    ('name', 'twitter:description'): DESCRIPTION,
    ('name', 'twitter:image'): IMAGE,
    ('name', 'twitter:image:alt'): IMAGE_ALT,
    ('property', 'og:url'): URL,
    ('property', 'og:title'): TITLE,
    ('property', 'og:description'): DESCRIPTION,
    ('property', 'og:image'): IMAGE,
    ('property', 'og:image:secure_url'): IMAGE,
    ('property', 'og:image:alt'): IMAGE_ALT,
    ('name', 'theme-color'): '#17150f',
}


def build() -> str:
    text = SRC.read_text()
    for (attr, key), value in META.items():
        pattern = re.compile(r'(<meta ' + attr + r'="' + re.escape(key) + r'" content=")[^"]*(")')
        text, n = pattern.subn(lambda m: m.group(1) + html.escape(value, quote=True) + m.group(2), text)
        if n != 1:
            raise SystemExit(f'index.html: expected one <meta {attr}="{key}">, found {n}')
    replacements = [
        (r'<title>[^<]*</title>', f'<title>{html.escape(TITLE, quote=False)}</title>'),
        (r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{URL}">'),
        (r'<link rel="image_src" href="[^"]*">', f'<link rel="image_src" href="{IMAGE}">'),
    ]
    for pattern, value in replacements:
        text, n = re.subn(pattern, lambda m: value, text, count=1)
        if n != 1:
            raise SystemExit(f'index.html: expected one match for {pattern}')
    return text.replace(
        '<!doctype html>',
        '<!doctype html>\n<!-- GENERATED from index.html by scripts/build-lab-page.py (the lab share card). Do not edit. -->',
        1,
    )


def main() -> int:
    page = build()
    if '--check' in sys.argv[1:]:
        if not OUT.exists() or OUT.read_text() != page:
            print('lab.html is stale: run python3 scripts/build-lab-page.py', file=sys.stderr)
            return 1
        print('lab.html is current')
        return 0
    OUT.write_text(page)
    print(f'Wrote {OUT.name}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
