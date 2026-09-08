# scripts/

Tooling only; nothing in this directory is served to the browser. Run everything from the
repository root. Node ≥ 20 and Python 3.11+ are required; `npm ci` installs the Node
dependencies (jsdom, Playwright, ESLint, Prettier).

| Prefix / file | What it is | How to run |
| --- | --- | --- |
| `test-*.cjs` | Unit and integration checks. Engines are `require`d directly; UI modules run inside jsdom or a small `vm` harness. No server, no browser. | `npm test` |
| `test-*.mjs`, `smoke-*.mjs` | Playwright journeys against a running site. Read `CORTEX_URL`; some also read `CORTEX_VIEWPORT_WIDTH/HEIGHT`. | `npm run test:browser` (starts its own server on port 8805) or `CORTEX_URL=… node scripts/<name>.mjs` |
| `check-*.cjs` | Authoring-consistency checks for content banks (ids, revisions, review queues). They assert structure, not clinical or educational correctness. `npm run check` runs the four that currently pass; `check-clinical-corrections`, `check-ecg-labs` and `check-neuro-projects` fail on the shipped 2.30 tree because their recorded review baselines lag the authored data (see `context/AUDIT-CODEBASE-2026-09-08.md`) and are run separately. | `npm run check`, `npm run check:content` |
| `build-*.py` | Generators for derived files: `academy-curriculum.json`, `neuro-projects.json`, `offline-manifest.json`, hand hotspots. Each supports `--check` to verify the committed output is current. | `python3 scripts/build-<name>.py [--check]` |
| `bump-cache.py` | Increments the `?v=` cache-bust number of the named assets everywhere they are referenced. Run after editing a runtime file, then rebuild the offline manifest. | `python3 scripts/bump-cache.py app.js styles.css` |
| `serve.py` | Local static server mirroring `_redirects` (SPA fallback, retired-course redirects). | `npm run serve` |
| `run-browser-tests.mjs` | Starts `serve.py`, runs every browser suite, prints one line per suite. | `npm run test:browser` |
| `merge.py`, `build-index.py`, `balance-clinical-mcqs.mjs` | Classic clinical case-bank pipeline: merge `data/raw/*` batches into `data/<specialty>.json` + `manifest.json`, rebuild the flat `index.json`, rebalance MCQ options. `merge.py` refuses to run with no batches. Re-running the balancer reshuffles options; do not run it casually. | see each file's docstring |
| `generate-social-card.py` | Renders `og-v4.jpg` (1200×630) from a frame of `assets/neuro-bg.mp4`. Needs Pillow and ffmpeg. | `python3 scripts/generate-social-card.py` |
| `check-auth-rls-readonly.mjs` | Live Supabase read-isolation check using two dedicated test-account tokens. Never writes. | see `supabase/README.md` |

Conventions:

- Tests must not touch a real learner profile. Browser suites create their own contexts; the
  unit harnesses use in-memory storage.
- After editing any runtime asset: `python3 scripts/bump-cache.py <files>` then
  `python3 scripts/build-offline-manifest.py`, and commit `offline-manifest.json` with the change.
  `npm run check` fails when the manifest is stale.
- `npm run verify` runs lint, format check, unit tests and content checks together.
