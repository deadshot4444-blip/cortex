"""Build or check the explicit public course inventory after changing course assets."""
import hashlib
import json
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
app = (root / 'app.js').read_text()
index = (root / 'index.html').read_text()
section_text = app.split('const SECTION_SCRIPTS = {', 1)[1].split('\n};', 1)[0]
sections = {key: re.findall(r"'([^'?]+)(?:\?[^']*)?'", value)
            for key, value in re.findall(r'\s+(\w+): \[([^\]]+)\]', section_text)}
base = {'index.html', 'offline-worker.js', 'data/manifest.json', 'data/index.json', 'data/academy-curriculum.json'}
base.update(re.findall(r'(?:src|href)="([^"?]+)(?:\?[^\"]*)?"', index))
base = {p for p in base if not p.startswith(('https:', 'data:', '/'))}
base.update(sections['academy'])
clinical = list(json.loads((root / 'data/manifest.json').read_text()))
specs = [
    ('mcat', 'MCAT preparation', '/mcat', '45 foundation lessons, available practice banks, CARS coaching, math, investigations and planning.',
     [str(p.relative_to(root)) for p in (root / 'data').glob('mcat-*.json')], []),
    ('socrates', 'Learn to Learn', '/learn', 'General, Business and Medical lessons, with the current review status preserved.',
     ['data/learn-to-learn.json', 'data/socrates.json'], []),
    ('practice', 'Clinical Scenarios', '/practice', '18 Clinical Shift cases, 3 longitudinal patient timelines and the separate classic case bank. Professional review remains pending.',
     [f'data/{key}.json' for key in clinical] + ['data/clinical-shift-pilot.json', 'data/clinical-shift-revisions.json', 'data/clinical-longitudinal.json'], []),
    ('anatomy', 'Anatomy', '/anatomy', '12 foundation and regional lessons plus draft atlas explorers.',
     ['data/anatomy-foundations.json', 'data/bones.json', 'data/muscles.json', 'data/organs.json'], ['assets/skeleton.svg']),
    ('reference', 'Medicine', '/medicine', '22 mechanism and interpretation lessons, 20 synthetic ECG patterns and the separate draft reference pathway. Professional review remains pending.',
     ['data/medicine-foundations.json', 'data/ecg-patterns.json', 'data/medicine-path.json', 'data/pharm.json', 'data/micro.json', 'data/labs.json', 'data/performance-drugs.json'], []),
    ('neuro', 'Neuroengineering', '/neuro', 'Current units, simulations, manual code traces and six reproducible synthetic projects. Running Python still requires its external runtime.',
     ['data/neuro.json', 'data/neuro-milestones.json', 'data/neuro-projects.json', 'data/labs/m1-recording.json', 'data/labs/m2-recording.json'], ['python-runtime-worker.js']),
]

def entry(path):
    body = (root / path).read_bytes()
    return {'url': '/' + path, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}

packs = [{'id': key, 'title': title, 'entry': route, 'scope': scope,
          'routes': [route, '/stats', '/focus', '/updates'],
          'files': [entry(p) for p in sorted(base | set(sections[key]) | set(data) | set(extra))]}
         for key, title, route, scope, data, extra in specs]
build = hashlib.sha256(json.dumps(packs, sort_keys=True, separators=(',', ':')).encode()).hexdigest()[:20]
text = json.dumps({'format': 1, 'build': build, 'packs': packs}, indent=2) + '\n'
path = root / 'offline-manifest.json'
if '--check' in sys.argv:
    if not path.exists() or path.read_text() != text:
        sys.exit('Offline manifest is stale. Run python3 scripts/build-offline-manifest.py.')
else:
    path.write_text(text)
for pack in packs:
    print(f"{pack['id']}: {len(pack['files'])} files, {sum(f['bytes'] for f in pack['files']) / 1024 / 1024:.1f} MB")
print('Offline inventory:', build)
