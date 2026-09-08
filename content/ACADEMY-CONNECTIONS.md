# Curriculum connections and optional retrieval

Local milestone 20 connects the seven Academy tracks through public discovery metadata, selected teaching relationships and a separate written retrieval queue. It does not merge course scores, infer readiness, alter a study plan or automatically assign work. The displayed application version remains the last browser-verified checkpoint.

## What is indexed

`scripts/build-academy-curriculum.py` builds `data/academy-curriculum.json` from the current course files and the selected relationships in `data/academy-connections.json`. Run the builder after changing indexed course IDs, titles, summaries, prerequisites, review status or connections; `--check` detects stale output. The JavaScript validator also rejects missing prerequisites, prerequisite cycles, duplicate IDs, unknown shared objectives and unsupported destinations.

The current inventory contains 265 entries: 45 MCAT lessons, 26 Learn to Learn lessons, 74 Psychology lessons, 12 Anatomy lessons, 22 Medicine lessons, 20 Neuroengineering units, 13 coding exercises, 15 synthetic simulations, 18 Clinical Shift objective-register entries and 20 synthetic ECG patterns. There are 175 author-revised entries and 90 separate draft entries (63 Psychology lessons, 15 later Neuroengineering units and 12 simulations without detailed source review). Independent subject review is pending for all new material. Revision labels are editorial status, not a qualification.

Twelve selected shared objectives connect 28 pairs of entries. The links include a reason and a limit on the comparison. These are explicit editorial choices, not recommendations inferred from private learner data. Search combines text, course, preparation level, shared objective and optional draft inclusion. It searches descriptions and objective labels, not assessment answers or private writing. Results are paged in groups of 24, preserving filters in the URL. Preparation levels are suggested background, not calibrated item difficulty. MCAT/Psychology prerequisites retain authored references; Neuroengineering preparation follows its ordered guided path. These recommendations do not lock or award readiness.

Clinical search destinations open `/practice?view=content#case-ID`. They name the teaching objective and warn that it can reveal the case target. The system does not infer or advertise a diagnosis from an active blind encounter. It does not open or start an assessment automatically. ECG discovery opens the synthetic pattern library rather than an active drill.

## Return behavior

`returnTo` contains a validated relative Academy/course route. The allowed query parameters retain existing lesson, step, run and offline identities. External, protocol-relative, traversal, account and unknown-parameter targets are rejected. Nested return destinations are stripped. Course-to-course travel preserves the original starting route through subsequent hops, with a visible return link and an option to end it. The return label identifies the starting course; actual screen restoration remains subject to that course's saved-route contract.

`setView` adds a context link to identifiable lesson/unit/library screens without fetching the index or reading queue storage. The catalog is fetched only when opening discovery or retrieval. Existing Medicine lesson and Clinical objective-register links also establish the starting route. Modified clicks use native anchors. Ordinary discovery links reuse the section router and its production/offline gates. A lesson side trip from a standalone retrieval attempt returns to that attempt; an already-established course return destination takes precedence.

All offline packs include the public index and connection scripts. Index presence does not mean every course payload is downloaded. The current pack's route gate refuses unsupported course destinations and offers download recovery navigation. The return link also preserves the original offline pack identity, so it does not silently mix versions.

## Optional written practice

`cs-academy-connections-v1` is off by default. Opening search never reads or writes it. Opening the queue reads the current workspace; the learner must turn it on and explicitly add each prompt. There is no automatic assignment, deadline, overdue count or due algorithm.

The twelve original prompts use fresh comparisons and simple fictional examples. They do not reuse reserved assessment answers or give patient treatment instructions. Source links are copied from the connected authored lessons, with the pressure-flow source explicitly included. Primary teaching references include [OpenStax blood flow](https://openstax.org/books/anatomy-and-physiology-2e/pages/20-2-blood-flow-blood-pressure-and-resistance), the existing course's memory research sources, and the ECG/laboratory sources listed in the Medicine lessons. These sources support the teaching content; they do not constitute independent review of the prompts or guarantee learning outcomes.

Each attempt freezes its prompt, model, comparison guidance, linked entry metadata, sources and revision. A nonblank first explanation is required before revealing the model. That writing is preserved unchanged afterward. The learner must write a comparison before recording completion. The app does not grade either piece of writing or award course credit. A completed comparison is an activity record only.

Pause retains all work and prevents new writing. Set aside and Remove from queue retain records and drafts in history; restoring cannot create duplicate pending attempts for the same prompt. Adding an already unfinished prompt opens the existing attempt. A completed prompt can be explicitly attempted again in a new record. At 1,000 retained records, addition stops without deleting older work; recovery copies remain available. The portable backup size limit still applies to the whole workspace.

StudyStorage guards every write, watches this key and retains the newest in-tab record after quota/conflict/owner errors. The pending new attempt is placed in the URL before its first write so recovery can return to it. Damaged stored structures pause saving instead of replacing them. The account engine already scopes all ordinary `cs-` keys; the portable backup whitelist now includes this key. Other course keys are never written by this feature.

## Verification and outstanding checks

Automated local checks cover index/source consistency, intersecting filters, default draft exclusion, every indexed route's context identity, safe return routes and multiple hops, frozen snapshots, required first writing/comparison, duplicate/deferred/removed attempts, pause, portable round trips, queue handlers, corrupt storage, failed first writes, pending draft recovery and delayed catalog loads after navigation. Shared Anatomy/Medicine lesson handlers and Clinical Shift checks remain part of regression verification. These checks use local data and DOM stand-ins; they are not actual browser evidence.

Actual browser work remains pending while the Mac is locked:

- Search from the catalog and from a lesson in each track; combine all filters, paginate, clear, navigate Back/Forward and inspect empty results at desktop, 390 px and 320 px.
- Follow selected connections, course prerequisites and existing Medicine/Clinical links through multiple hops, reload and use the return banner. Check the exact saved lesson step or attempt and modified clicks.
- Confirm blind MCAT coaching, active Clinical Shift cases and active ECG drills do not acquire a diagnosis-specific context recommendation.
- Toggle retrieval, add/set aside/remove/restore, complete writing/comparison and reload each stage. Confirm pausing survives reload and completed records remain read-only after authored content changes.
- Test actual quota failure and recovery, two tabs, account changes, inaccessible/corrupt storage and late/failed index downloads.
- Export/import the queue through native file controls. Open discovery in a downloaded pack, refuse an unavailable course, and return to the original downloaded version.
- Inspect keyboard focus, labels, screen-reader announcements, long source titles and horizontal overflow. No visual or accessibility pass is claimed from markup tests alone.

The connections and original prompts still need independent subject/editorial review. No learner outcome study or score improvement claim is implied. No commit, push, deployment or publication is authorized by this local checkpoint.
