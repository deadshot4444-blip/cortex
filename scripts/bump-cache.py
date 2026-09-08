#!/usr/bin/env python3
"""Bump the ?v= cache-bust number for one or more assets everywhere they are referenced.

The site has no build step: index.html and the SECTION_SCRIPTS table in app.js load raw files
with a hand-maintained ?v=N query so long-lived caches (see _headers) pick up edits. Run this
after editing a runtime asset instead of hunting for the references by hand:

    python3 scripts/bump-cache.py styles.css app.js academy-today.js

Every `name?v=N` reference in index.html and the root *.js files is incremented by one.
The offline manifest hashes file bodies, so rebuild it afterwards:

    python3 scripts/build-offline-manifest.py
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
REFERENCE_FILES = [ROOT / 'index.html', *sorted(ROOT.glob('*.js'))]


def bump(asset: str) -> int:
    # Match the bare name or a path ending in it, but not a longer name that merely ends the same way.
    pattern = re.compile(r'(?<![\w.-])(' + re.escape(asset) + r')\?v=(\d+)')
    total = 0
    for path in REFERENCE_FILES:
        text = path.read_text()
        updated, count = pattern.subn(lambda m: f'{m.group(1)}?v={int(m.group(2)) + 1}', text)
        if count:
            path.write_text(updated)
            total += count
            print(f'{path.name}: {asset} -> {count} reference(s) bumped')
    return total


def main(assets: list[str]) -> int:
    if not assets:
        print(__doc__)
        return 2
    missing = [a for a in assets if bump(a) == 0]
    for asset in missing:
        print(f'warning: no ?v= reference found for {asset}', file=sys.stderr)
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
