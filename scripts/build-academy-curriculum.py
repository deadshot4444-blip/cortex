"""Build public discovery metadata from authored course IDs, never learner records."""
import html
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
entries, source_map = [], {}
PENDING = 'Author-revised material. Independent subject review is pending.'


def read(name):
    return json.loads((ROOT / 'data' / name).read_text())


def plain(value):
    return html.unescape(re.sub('<[^>]+>', '', str(value))).strip()


def add(key, track, title, summary, path, params, *, prerequisites=(), level='foundation',
        status='revised', revision=1, kind='Lesson', sources=(), fragment=''):
    entry = dict(id=key, track=track, title=plain(title), summary=plain(summary), kind=kind,
                 level=level, status=status, revision=revision, reviewStatus=PENDING if status == 'revised' else 'Draft material; detailed revision and independent review are pending.',
                 url=path + ('?' + urlencode(params) if params else '') + fragment,
                 prerequisites=list(prerequisites), objectives=[])
    entries.append(entry)
    source_map[key] = [dict(title=s['title'], url=s['url']) for s in sources
                       if isinstance(s, dict) and s.get('title') and s.get('url', '').startswith('https://')]


for unit in read('mcat-course.json')['units']:
    add('mcat:' + unit['id'], 'mcat', unit['title'], unit['subtitle'], '/mcat',
        dict(view='course', unit=unit['id']), prerequisites=['mcat:' + p for p in unit['prerequisites']])

learning = read('learn-to-learn.json')
learning_sources = {s['id']: s for s in learning['sources']}
for track in learning['tracks']:
    for lesson in track['lessons']:
        add('socrates:' + track['id'] + ':' + lesson['id'], 'socrates', lesson['title'], lesson['question'], '/learn',
            dict(track=track['id'], lesson=lesson['id'], step=1),
            level='foundation' if track['id'] == 'general' else 'applied',
            sources=[learning_sources[s] for s in lesson['sources']])

for filename, track, path in [('anatomy-foundations.json', 'anatomy', '/anatomy'),
                              ('medicine-foundations.json', 'reference', '/medicine')]:
    for lesson in read(filename)['lessons']:
        add(track + ':' + lesson['id'], track, lesson['title'], lesson['objective'], path,
            dict(lesson=lesson['id'], step=1), level='applied' if lesson.get('reflectRequired') or lesson['id'].startswith(('med-ecg', 'med-lab-interval', 'med-potassium', 'med-acid-base-comp', 'med-st-', 'med-ddimer', 'med-hemoglobin')) else 'foundation',
            revision=lesson.get('revision', 1), sources=lesson['sources'])

neuro = read('neuro.json')
previous = None
for step in neuro['learningPaths'][0]['steps']:
    unit = neuro['unitLessons'][str(step['order'])]
    key = 'neuro-unit:' + step['id']
    add(key, 'neuro', step['title'], step['stepObjective'], '/neuro', dict(unit=step['id']),
        prerequisites=[previous] if previous else [], level='foundation' if step['order'] <= 5 else 'advanced',
        status='revised' if unit.get('revision') else 'draft', revision=unit.get('revision', 1), kind='Guided unit', sources=unit.get('sources', []))
    previous = key
for lesson in neuro['neuroCodeLessons']:
    add('neuro-code:' + lesson['id'], 'neuro', lesson['title'], lesson['neuroengineeringConcept'], '/neuro',
        dict(code=lesson['id']), level='foundation' if lesson['difficulty'] == 'beginner' else 'applied',
        kind='Coding exercise', sources=lesson.get('sources', []), revision=lesson.get('revision', 1))
for sim in neuro['simulations']:
    add('neuro-sim:' + sim['id'], 'neuro', sim['title'], sim['scenario'], '/neuro', dict(sim=sim['id']),
        level='applied', kind='Synthetic simulation', status=sim.get('curriculumStatus', 'draft'),
        revision=sim.get('revision', 1), sources=sim.get('sources', []))

clinical = read('clinical-shift-pilot.json')
for project in read('neuro-projects.json')['projects']:
    add('neuro-project:' + project['id'], 'neuro', project['title'], project['objective'], '/neuro',
        dict(project=project['id']), prerequisites=['neuro-unit:' + p for p in project['prerequisites']] +
        (['neuro-project:' + project['previousProject']] if project.get('previousProject') else []),
        level='applied', kind='Synthetic engineering project', revision=project['revision'], sources=project['sources'])
for rotation in clinical['rotations']:
    for case in rotation['caseIds']:
        review = clinical['caseReviews'][case]
        add('practice:' + case, 'practice', 'Case teaching focus: ' + case,
            review['objective'], '/practice', dict(view='content'), fragment='#case-' + case,
            kind='Case objective register', level='applied', sources=review['sources'])
for case in read('clinical-longitudinal.json')['cases']:
    add('practice-timeline:' + case['id'], 'practice', case['title'], case['objective'],
        '/practice', dict(view='longitudinal', case=case['id']), kind='Patient timeline',
        level='applied', revision=case['revision'], sources=case['sources'])
for pattern in read('ecg-patterns.json')['patterns']:
    add('ecg:' + pattern['id'], 'reference', pattern['name'], pattern['clue'], '/medicine',
        dict(tool='ecg', mode='library', focus=pattern['id']), level='applied', kind='Synthetic ECG pattern',
        revision=pattern['revision'], sources=pattern['sources'])

lookup = {e['id']: e for e in entries}
if len(lookup) != len(entries):
    raise ValueError('Duplicate curriculum entry')
authored = read('academy-connections.json')
objectives, connections, cards = [], [], []
for group in authored['groups']:
    objectives.append({k: group[k] for k in ['id', 'title', 'description']})
    members = [group['anchor']] + [link['to'] for link in group['links']]
    for member in members:
        lookup[member]['objectives'].append(group['id'])
    for link in group['links']:
        connections.append(dict(from_=group['anchor'], **link))
        connections[-1]['from'] = connections[-1].pop('from_')
    card = group['card']
    sources = {s['url']: s for member in members for s in source_map[member]}
    sources.update({s['url']: s for s in card.get('sources', [])})
    if not sources:
        raise ValueError('Retrieval needs sources: ' + group['id'])
    cards.append(dict(id=group['id'], revision=card['revision'], title=group['title'], level=card['level'],
                      prompt=card['prompt'], model=card['model'], compare=card['compare'],
                      reviewStatus=PENDING, links=[lookup[member] for member in members], sources=list(sources.values())))

# The complete index is plain public metadata. No answers from course questions,
# saved attempts, case hidden findings or live account data are copied here.
result = dict(format=1, objectives=objectives, entries=entries, connections=connections, cards=cards)
output = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
target = ROOT / 'data' / 'academy-curriculum.json'
if '--check' in sys.argv:
    if not target.exists() or target.read_text() != output:
        sys.exit('Curriculum index is stale. Run python3 scripts/build-academy-curriculum.py.')
else:
    target.write_text(output)
print(f'Curriculum: {len(entries)} entries, {len(objectives)} shared objectives, {len(connections)} authored links, {len(cards)} optional prompts.')
