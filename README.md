# Cortex Medical Academy

Free, browser-based study tracks for pre-meds, medical students and people learning
neuroengineering. Live at **https://cortexmedical.academy** (currently 2.30.0-beta.1).

MCAT preparation is free with no account. Progress is saved in the browser; an optional
account (emailed magic link) syncs it across devices. Beta availability is not an
accreditation, a clinical qualification or a demonstrated learning outcome: independent
subject review and learner pilots are still pending, and the content is not a substitute
for official AAMC materials or clinical judgment.

## Study paths

| Path | Route | Scope |
| --- | --- | --- |
| MCAT | `/mcat` | 45 lessons across 15 chapters, coverage mapping, passage coaching, quantitative practice, weekly planning, concept repair, a 230-question rehearsal |
| Learn to Learn | `/learn` | General, Business and Medical learning-method courses |
| Clinical Scenarios | `/practice` | 18 Clinical Shift cases across three rotations, three longitudinal patient timelines, and a separately labeled classic bank of 2,600 cases in 26 specialties |
| Anatomy | `/anatomy` | 12 foundation and regional lessons plus draft atlas explorers |
| Medicine | `/medicine` | 22 mechanism and interpretation lessons, 20 synthetic ECG patterns, a draft reference pathway |
| Neuroengineering | `/neuro` | Five revised foundations, 13 coding exercises, 15 simulations, six synthetic projects |

The Academy catalog at `/academy` describes audiences, prerequisites and review status,
and connects the tracks through Academy Today, lesson discovery and a private portfolio.
Retired class-specific courses (UTSA Genetics, CCMA, Cognitive Psychology) redirect to the
catalog; their saved learner records stay readable and exportable.

## How it is built

Plain HTML, CSS, JavaScript and JSON. There is no framework, bundler or build step:
`index.html` loads classic `<script>` files that share one global scope, and each study
track is lazy-loaded on first visit through the `SECTION_SCRIPTS` table in `app.js`.

```
index.html            entry; loads the shell scripts below with ?v= cache-busting
app.js                shell: routing, navigation, storage helpers, section loader
changelog.js          release notes shown in "What's New"
auth.js, auth-progress.js, study-storage.js, study-backup.js
                      optional accounts, guest/account workspaces, cloud sync, backups
academy*.js           catalog, Today planner, curriculum links, portfolio, storage view
mcat*.js              MCAT course, coaching, rehearsal, repair and item-quality tools
clinical-*.js         Clinical Shift and longitudinal patient timelines
anatomy.js, reference.js, ekg.js, ecg-engine.js, performance-drugs.js
                      Anatomy and Medicine tracks
neuro*.js, code-evaluator.js, python-runtime*.js
                      Neuroengineering track (Python runs in a Pyodide worker)
socrates.js           Learn to Learn
offline*.js           service worker and downloadable course packs (offline-manifest.json)
styles.css + *.css    styling; one stylesheet per feature area
data/                 all course content and question banks (JSON; stable item ids)
content/              authoring contracts, review queues and correction records
assets/               figures, media, vendored supabase-js (credits in assets/CREDITS.md)
netlify/, _redirects, _headers
                      hosting rules: SPA fallback, retired-route redirects, cache policy,
                      per-path social cards
scripts/              tests, content checks, generators and dev tooling (scripts/README.md)
supabase/             database schema and sync notes
```

`*-engine.js` and `*-core.js` files are pure logic with a UMD wrapper so the unit tests can
`require` them; the matching UI modules only run in the browser. Saved work lives in
`localStorage` under `cs-*` keys, guarded by `study-storage.js` (stale-write refusal, draft
retention, recovery downloads).

## Development

Requirements: Node 20+, Python 3.11+. Optional: Pillow and ffmpeg for the social card,
`shapely` for `build-hand-hotspots.py`, `npx playwright install chromium` for browser suites.

```sh
npm ci                 # jsdom, Playwright, ESLint, Prettier
npm run serve          # http://127.0.0.1:8765 with production routing (or double-click start.command)
npm test               # unit and integration suites (node --test)
npm run check          # generated files are current; content banks are consistent
npm run lint           # ESLint
npm run format         # Prettier (JavaScript only; CSS and content are hand-formatted)
npm run test:browser   # Playwright journeys against a throwaway local server
npm run verify         # lint + format check + test + check
```

After editing any runtime file, bump its cache-bust number and rebuild the offline
inventory, then commit both:

```sh
python3 scripts/bump-cache.py app.js styles.css
python3 scripts/build-offline-manifest.py
```

Hosting must serve `index.html` for application routes; `_redirects` defines the Netlify
fallback and `scripts/serve.py` mirrors it locally.

## Content

Course JSON, correction records and review queues keep stable item and revision ids so
learner records survive content updates. Authoring contracts live in `content/`; image
sources and licenses in `assets/CREDITS.md`. Draft material does not inherit sign-off from
a beta release.

Study backups and downloaded course packs are managed at `/academy?view=storage`. The
Python runtime for Neuroengineering exercises is an external dependency. Browser storage
is not an encrypted vault: anyone with access to the browser profile can read its work.

## Accounts and database

Supabase is optional. `supabase/schema.sql` is the entire schema: one `progress` row per
user, protected by row-level security. `auth-progress.js` keeps guest and account
workspaces separate, journals every workspace switch, and uses the observed cloud revision
for conditional updates, so conflicting edits pause for a choice instead of overwriting.
See `supabase/README.md` for setup and checks.

## Deployment

Netlify deploys `main` to https://cortexmedical.academy. Pushing to `main` ships.
`netlify.toml` pins the configuration: the repository root is the publish directory, there
is no build step, and the dependency install is a no-op (the root package.json is developer
tooling only). `_headers` sets long-lived caching for `?v=`-busted scripts and
`netlify/edge-functions/practice-og.js` rewrites social-card metadata for `/practice`.

## Release recovery

Keep the exact source and reviewed study backups. Do not downgrade a workspace containing
newer NeuroCode records to unmodified 2.0.0-beta.2 (its old Check handler could replace
saved code with a pass flag); use a compatible candidate or a forward repair. Before
restoring data, retain both the incident copy and the reviewed replacement, and never
clear storage as a rollback shortcut.

Contact: cortexmedical.academy.support@gmail.com
