#!/usr/bin/env python3
"""Build the share pages: copies of index.html with one main area's own title, description,
canonical URL and share card (Open Graph / X tags), so a shared https://cortexmedical.academy/mcat,
/dat, /neuro, /lab, /academy or /updates link previews that area instead of the whole site. Every page
inside an area has the same path, so it gets the same card. _redirects serves each page at its path
(a 200 rewrite before the SPA fallback); everything else on the page is index.html byte for byte, so
the app boots the same way.

The card images and their alt text come from og/cards.json, which scripts/generate-social-cards.mjs
writes. index.html carries the home card itself, and Clinical Scenarios gets its tags at the edge
(netlify/edge-functions/practice-og.js); scripts/test-social-cards.cjs keeps all of them in step.

    python3 scripts/build-share-pages.py          # write every share page
    python3 scripts/build-share-pages.py --check  # fail when one is stale (npm run check)

Run it after any edit to index.html (bump-cache.py edits every page's ?v= pins already) and after
generate-social-cards.mjs has written a new card.
"""
from pathlib import Path
import html
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'index.html'
SITE = 'https://cortexmedical.academy'
CARDS = json.loads((ROOT / 'og' / 'cards.json').read_text())['cards']

# slug (the path it is served at) -> the area's words. `card` names its entry in og/cards.json;
# `theme` is optional and overrides the browser-chrome colour index.html sets.
PAGES = {
    'academy': {
        'note': 'the course catalog share card',
        'card': 'academy',
        'title': 'Course catalog — Cortex Medical Academy',
        'description': (
            'Choose what you want to learn: MCAT preparation, DAT preparation, Clinical Scenarios, '
            'Neuroengineering and the Alzheimer’s Histology Lab. Free, no account.'
        ),
        'keywords': 'free medical courses, MCAT prep, DAT prep, clinical case practice, neuroengineering course, histology lab simulation',
    },
    'mcat': {
        'note': 'the MCAT share card',
        'card': 'mcat',
        'title': 'MCAT preparation — Cortex Medical Academy',
        'description': (
            'Learn the foundations, reason through passages, and build a study week you can return to. '
            'Lessons, practice questions, flashcards, and CARS and science passages. Free, no account.'
        ),
        'keywords': 'free MCAT prep, MCAT practice questions, MCAT flashcards, CARS practice, MCAT science passages, MCAT lessons, free MCAT study',
    },
    'dat': {
        'note': 'the DAT share card',
        'card': 'dat',
        'title': 'DAT preparation — Cortex Medical Academy',
        'description': (
            'Drill the sciences on the clock, train perceptual ability against generated figures, and work '
            'timed reading and quantitative sets. Free, no account.'
        ),
        'keywords': 'free DAT prep, DAT practice questions, perceptual ability test practice, DAT reading comprehension, DAT quantitative reasoning, Dental Admission Test',
    },
    'updates': {
        'note': 'the Updates share card',
        'card': 'updates',
        'title': 'Updates — Cortex Medical Academy',
        'description': 'Public release history: what changed in Cortex Medical Academy, release by release.',
        'keywords': 'Cortex Medical Academy updates, changelog, release notes',
    },
    'lab': {
        'note': 'the lab share card',
        'card': 'lab',
        'title': 'Alzheimer’s Histology Lab — Cortex Medical Academy',
        'description': (
            'Practice the modified Bielschowsky silver stain step by step, or mix anything on the free bench '
            'and see what happens. 3D bench, 2D microscope and real reference slides. Free, no account.'
        ),
        'keywords': 'Bielschowsky silver stain, Alzheimer histology, neuropathology lab simulation, silver stain practice, neuritic plaques, neurofibrillary tangles',
        'theme': '#17150f',
    },
    'neuro': {
        'note': 'the Neuroengineering share card',
        'card': 'neuro',
        'title': 'Neuroengineering — Cortex Medical Academy',
        'description': (
            'Move from neurons and signals to code, simulations and reproducible analysis: foundation units, '
            'checked Python exercises that run in the browser, decision labs and projects. Free, no account.'
        ),
        'keywords': 'neuroengineering course, brain-computer interface, computational neuroscience, neural signal processing, Python for neuroscience, action potential simulation',
        'theme': '#0b0b0d',
    },
}


def build(slug: str) -> str:
    page = PAGES[slug]
    card = CARDS[page['card']]
    url, image = f'{SITE}/{slug}', f'{SITE}/{card["file"]}'
    meta = {
        ('name', 'description'): page['description'],
        ('name', 'keywords'): page['keywords'],
        ('name', 'twitter:title'): page['title'],
        ('name', 'twitter:description'): page['description'],
        ('name', 'twitter:image'): image,
        ('name', 'twitter:image:alt'): card['alt'],
        ('property', 'og:url'): url,
        ('property', 'og:title'): page['title'],
        ('property', 'og:description'): page['description'],
        ('property', 'og:image'): image,
        ('property', 'og:image:secure_url'): image,
        ('property', 'og:image:alt'): card['alt'],
    }
    if 'theme' in page:
        meta[('name', 'theme-color')] = page['theme']
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
