#!/usr/bin/env python3
"""Build the course share pages: copies of index.html with one course's own title, description,
canonical URL and share card (Open Graph / X tags), so a shared https://cortexmedical.academy/lab or
/neuro link previews that course instead of the whole site. _redirects serves each at its path (a 200
rewrite before the SPA fallback); everything else on the page is index.html byte for byte, so the app
boots the same way.

    python3 scripts/build-share-pages.py          # write lab.html and neuro.html
    python3 scripts/build-share-pages.py --check  # fail when either is stale (npm run check)

Run it after any edit to index.html (bump-cache.py edits every page's ?v= pins already).
"""
from pathlib import Path
import html
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'index.html'
SITE = 'https://cortexmedical.academy'

PAGES = {
    'lab': {
        'note': 'the lab share card',
        'title': 'Alzheimer’s Histology Lab — Cortex Medical Academy',
        'description': (
            'Practice the modified Bielschowsky silver stain step by step, or mix anything on the free bench '
            'and see what happens. 3D bench, 2D microscope and real reference slides. Free, no account.'
        ),
        'image': 'og-lab.jpg',
        'image_alt': 'Cortex Medical Academy — Alzheimer’s Histology Lab, with a real Bielschowsky-stained slide.',
        'keywords': 'Bielschowsky silver stain, Alzheimer histology, neuropathology lab simulation, silver stain practice, neuritic plaques, neurofibrillary tangles',
        'theme': '#17150f',
    },
    'neuro': {
        'note': 'the Neuroengineering share card',
        'title': 'Neuroengineering — Cortex Medical Academy',
        'description': (
            'Move from neurons and signals to code, simulations and reproducible analysis: foundation units, '
            'checked Python exercises that run in the browser, interactive simulations and projects. Free, no account.'
        ),
        'image': 'og-neuro.jpg',
        'image_alt': 'Cortex Medical Academy — Neuroengineering: where the mind meets the machine.',
        'keywords': 'neuroengineering course, brain-computer interface, computational neuroscience, neural signal processing, Python for neuroscience, action potential simulation',
        'theme': '#0b0b0d',
    },
}


def build(slug: str) -> str:
    page = PAGES[slug]
    url, image = f'{SITE}/{slug}', f'{SITE}/{page["image"]}'
    meta = {
        ('name', 'description'): page['description'],
        ('name', 'keywords'): page['keywords'],
        ('name', 'twitter:title'): page['title'],
        ('name', 'twitter:description'): page['description'],
        ('name', 'twitter:image'): image,
        ('name', 'twitter:image:alt'): page['image_alt'],
        ('property', 'og:url'): url,
        ('property', 'og:title'): page['title'],
        ('property', 'og:description'): page['description'],
        ('property', 'og:image'): image,
        ('property', 'og:image:secure_url'): image,
        ('property', 'og:image:alt'): page['image_alt'],
        ('name', 'theme-color'): page['theme'],
    }
    text = SRC.read_text()
    for (attr, key), value in meta.items():
        pattern = re.compile(r'(<meta ' + attr + r'="' + re.escape(key) + r'" content=")[^"]*(")')
        text, n = pattern.subn(lambda m: m.group(1) + html.escape(value, quote=True) + m.group(2), text)
        if n != 1:
            raise SystemExit(f'index.html: expected one <meta {attr}="{key}">, found {n}')
    replacements = [
        (r'<title>[^<]*</title>', f'<title>{html.escape(page["title"], quote=False)}</title>'),
        (r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{url}">'),
        (r'<link rel="image_src" href="[^"]*">', f'<link rel="image_src" href="{image}">'),
    ]
    for pattern, value in replacements:
        text, n = re.subn(pattern, lambda m: value, text, count=1)
        if n != 1:
            raise SystemExit(f'index.html: expected one match for {pattern}')
    return text.replace(
        '<!doctype html>',
        f'<!doctype html>\n<!-- GENERATED from index.html by scripts/build-share-pages.py ({page["note"]}). Do not edit. -->',
        1,
    )


def main() -> int:
    check = '--check' in sys.argv[1:]
    stale = []
    for slug in PAGES:
        out, page = ROOT / f'{slug}.html', build(slug)
        if check:
            if not out.exists() or out.read_text() != page:
                stale.append(out.name)
            continue
        out.write_text(page)
        print(f'Wrote {out.name}')
    if check:
        if stale:
            print(f'{", ".join(stale)} stale: run python3 scripts/build-share-pages.py', file=sys.stderr)
            return 1
        print('share pages are current')
    return 0


if __name__ == '__main__':
    sys.exit(main())
