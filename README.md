# Cortex Medical Academy

Cortex 2.30.0-beta.1 is a browser-based study Academy. MCAT preparation remains
free. Guest work is saved in the browser; optional accounts synchronize separate
account workspaces. Independent subject review and learner pilots remain pending.
Beta availability is not an accreditation, clinical qualification or demonstrated
learning outcome.

## Available study paths

| Path | Current scope |
| --- | --- |
| MCAT | 45 lessons across 15 chapters, coverage mapping, passage coaching, quantitative practice, weekly planning, concept repair and a 230-question rehearsal |
| Learn to Learn | General, Business and Medical learning-method courses |
| Clinical Scenarios | 18 Clinical Shift cases across three rotations, three longitudinal patient timelines and a separately labeled classic bank |
| Anatomy | 12 foundation and regional lessons, with draft atlas explorers |
| Medicine | 22 mechanism and interpretation lessons, 20 synthetic ECG patterns and a separate draft reference pathway |
| Neuroengineering | Five revised foundations, 13 coding exercises, 15 simulations and six synthetic projects within the draft pathway |

The Academy catalog at `/academy` describes audiences, prerequisites, available
material and review status. Academy Today, lesson discovery, optional retrieval
practice and the private portfolio connect courses while preserving their separate
learning records. Original answers, revisions, assistance and repeated practice
remain distinct. The MCAT rehearsal reports raw results, not a scaled MCAT score.

Cognitive Psychology is retired from public discovery, planning and new offline
downloads. Its existing private records remain recoverable.

Generative tutoring, educator groups, public sharing and commercial experiments
are not enabled. Current contextual help uses authored material.

## Development and checks

The application uses plain JavaScript, HTML, CSS and JSON. Hosting must serve
`index.html` for application routes; `_redirects` defines the Netlify fallback.
`start.command` starts a simple local static server for homepage navigation, but
that server does not implement the deep-link fallback.

```sh
npm ci --prefix scripts --ignore-scripts --no-audit --no-fund
npm test --prefix scripts
python3 scripts/build-academy-curriculum.py --check
python3 scripts/build-neuro-projects.py --check
python3 scripts/build-offline-manifest.py --check
```

Use a supported Node.js runtime for the test dependencies. Browser verification
must cover the current public course availability, direct routes, reload/history,
small screens and affected saved-work journeys. Older browser smoke scripts may
describe earlier release scopes; check their assertions before using them as
release evidence.

## Content and saved work

Course JSON, correction records and authored review queues retain stable item and
revision identities. Sources and figure licenses are recorded with the content
and in `assets/CREDITS.md`. Historical draft material does not inherit independent
signoff from a beta release.

Study backups and explicitly downloaded course packs are managed from
`/academy?view=storage`. Downloads describe their exact included files. The Python
runtime for Neuro exercises is an external dependency. Browser storage is not an
encrypted vault; people with access to that browser profile can access its work.

`auth-progress.js` preserves separate guest/account workspaces and recovery copies,
and uses observed cloud revisions for conditional updates. This release requires
no database migration. `SUPABASE_SCHEMA.sql` describes the existing intended row
policies. Local account fixtures do not establish live database permissions.

The optional `scripts/check-auth-rls-readonly.mjs` requires two dedicated existing
test accounts through `CORTEX_TEST_ACCOUNT_A_TOKEN` and
`CORTEX_TEST_ACCOUNT_B_TOKEN`. It checks read isolation only; write-policy,
provider and real-device checks require separate evidence.

## Release recovery

Preserve the exact source/assets and reviewed study backups. Do not downgrade a
workspace containing newer NeuroCode records to unmodified 2.0.0-beta.2: its old
Check handler can replace saved code and comparison details with a pass flag.
Use a compatible candidate or forward repair. Before restoring data, retain both
the incident copy and the reviewed replacement; never clear storage as a rollback
shortcut. Source/data recovery on an isolated copied workspace does not prove
hosting-cache or signed-in cloud rollback behavior.

Contact: cortexmedical.academy.support@gmail.com.
