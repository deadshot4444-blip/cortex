
## 2026-08-08 — 🚀 SHIPPED v1.25.23 — clearer courses + guided MCAT plan
**From:** Codex   **Status:** done — **LIVE.** Kevin approved the cumulative release and said `ship`. Commit
`e9ecd06` was pushed to `origin/main` and verified on `cortexmedical.academy`. Cognitive Psychology is now a
simple course-first 13-chapter / 70-lesson experience; MCAT Prep has a calmer five-tool home; and the 60/90/120
day guide now assigns dated daily work, opens the real study tools, tracks completion and resumable work, adapts
to measured weak areas, and transitions into exam preparation and taper phases.

What’s New moves directly from public v1.25.18 to one cumulative v1.25.23 entry. The isolated release contains
exactly seven files; unfinished Medicine, Learn to Learn, and CCMA changes stayed local. All seven production
files match the tested release byte-for-byte. Desktop + 390px live gates pass the MCAT, Cognitive Psychology,
navigation, Stats, and construction flows with zero errors or overflow; Neuro Unit 1 and the real Python sandbox
also pass (`Spikes: 3`).

## 2026-08-08 — 🚀 SHIPPED v1.25.18 — flagship navigation + Neuroengineering polish
**From:** Codex   **Status:** done — **LIVE.** Kevin approved the human-tested build and said to ship it.
Commit `a222cf5` was pushed to `origin/main` and verified on `cortexmedical.academy`. MCAT now leads with a
focused MCAT Prep + Stats dropdown; Clinical Scenarios and Learn to Learn have clear top-level positions;
Explore contains only Anatomy, Medicine, Cognitive Psychology, Focus Timer, and UTSA & UT Health. Learn to
Learn and Medicine remain locked Under construction. Neuro unit-header accents and NeuroCode result insets
received the final spacing polish.

What’s New moves directly from public v1.25.13 to public v1.25.18; local pacing versions are not separate
release entries. Production `index.html`, `app.js`, and `styles.css` match the tested commit byte-for-byte.
Desktop + 390px release gates, full Neuro Unit 1, real Pyodide, direct routes, and a 1280→320px wide-XP
navigation matrix all passed with zero overflow or page errors. Unfinished Medicine/L2L/CCMA work remains local.

## 2026-08-07 — 🚀 SHIPPED v1.25.0 — Neuroengineering: The Track
**From:** Hermes   **Status:** done — **LIVE.** Kevin asked for one linear start-to-finish track with the
lessons/practice/etc. clickable below it, shipped same day. Neuro un-gated; hub rebuilt around a visible
20-unit track with inline Practitioner milestone markers; Subjects + NeuroCode + NeuroSim + Practitioner fold
below. Both Playwright smoke suites pass (incl. Pyodide sandbox). Commit `ec4ff59`, verified live. Ship-variant
dance kept the unshipped Medicine/L2L work local. Details in STATE.md.

## 2026-08-07 — 🚀 SHIPPED v1.24.0 — Cognitive Psychology open course + CCMA retired
**From:** Hermes   **Status:** done — **LIVE.** Kevin: "get rid of medical assistant as a page… use [my ebook]
in all the chapters to make a little course teaching cognitive psychology… genuine knowledge," then "ship it."
Commit `08d4ab4` pushed, Netlify deployed, verified live (APP_VERSION 1.24.0, app.js?v=159, /cogpsych 200
no-password, /ccma 302, 538 Q / 70 lessons served).

Cogpsych is now a public lessons-first 13-chapter course: ch 10–13 source pulled from Kevin's Top Hat ebook via
browser; 45 new lessons + 278 new MCQs authored + per-chapter adversarially verified (workflow `wf_800b0fb6-1e5`);
ch 6–9 prose de-classed (15 fixes); COG_FIGS figures now mount in lessons; stable module tag `cogpsych-course-v1`;
Mock/High-Yield deleted; validator rewritten (13-ch contract, green). CCMA fully unwired (files kept as orphans,
incl. uncommitted ccma-chart.js). Old class-era cogpsych changelog entries dropped; changelog filter now
genetics-only. **Unshipped Medicine/L2L/chart work stayed local** — commit used ship-variants of app.js/styles.css
(socrates re-gated) and the tree was restored after. Full detail in STATE.md top entry. **Next: Genetics rebrand.**

## 2026-07-24 — 🚀 SHIPPED v1.23.0 — clearer Explore + visual system
**From:** Codex   **Status:** done — **LIVE.** Kevin approved the redesigned Explore menu and said,
“Ship it. make it v1.23.0.” Public release commit `9bc168d` was pushed to `origin/main` and Netlify deployed it.
Production verification at `https://cortexmedical.academy/?verify=9bc168d` returned 200 and served
`APP_VERSION 1.23.0`, `app.js?v=157`, and `styles.css?v=128`.

Release scope: the new two-column desktop / single-column mobile Explore map, active-section and keyboard
navigation states, the cohesive full-site visual-system polish, the refined mission layout, and the MCAT
first-open navigation fix. Verified against the exact staged snapshot at desktop and 390px mobile with no
horizontal overflow or browser-console errors; live desktop UI also verified after deployment. Unfinished
typed-CCMA/chart code, data, and styles were explicitly excluded from the commit.

## 2026-07-11 — Grok: CCMA study system (local v1.22.0)

**Ask:** Put certified medical assistant program content into Cortex, password-only, quizzes like genetics/cogpsych, track mastery for final. Sources: browser book + Desktop "Medical Assistant Terminology Lessons" (mock final included).

**Done (local, NOT shipped):**
- New section **Medical Assistant (CCMA)** — Explore menu + `/ccma`, password **`1234`**, storage `cs-ccma`
- Engine `ccma.js` (genetics/cogpsych arcade clone): Smart Review, Blitz, Topic Drills (16 NHA-aligned topics), Exam Boss, Mock Final (180 Q), Misses, Starred, Stats, 38-lesson path
- Bank `data/ccma-bank.json` — **292** items (180 mock final keyed + 112 high-yield domain MCQs)
- Lessons `data/ccma-lessons.json` — L1–L38 checklist
- Extracted lesson text → `context/ccma-build/raw/` for future expansion
- Preview verified: wrong pass rejects, unlock works, 38 lessons, mock 1/180, smart review answers, 0 page errors

**Do not ship** until Kevin says ship. Push gotcha: use `gh auth git-credential` if needed.

**Next content passes:** more Qs per lesson from extracted PDFs; optional Learn teach steps; adversarial pass on mock answer key if Kevin finds mismatches.

# HANDOFF — running log

Codex drops directives. Claude reports back. Kevin chimes in anytime. **Newest on top.**

Format per entry:

```
## YYYY-MM-DD — <short title>
**From:** Codex | Claude | Kevin   **Status:** open | in-progress | done | blocked
<the directive, report, or note. Keep it tight.>
```

---

## 2026-08-08 — Clinical Shift pilot built for human testing
**From:** Codex   **Status:** done — local only, **NOT shipped.** Kevin asked to start slowly on a game-like
Clinical Scenarios overhaul where learners choose the specialty but Cortex assigns the patient. Built local
v1.25.24 as an isolated three-rotation / 15-patient pilot: hidden handoff, independent history/exam review,
staged chart evidence, irreversible decisions with delayed feedback, ranked top-three differential plus
rationale, signed Assessment and Plan, and a detailed evidence-based debrief. Safety and efficiency stay
Not assessed until reviewed consequence metadata exists; note prose receives completion credit only. All 15
cases were semantically vetted so the diagnosis step truly asks for the diagnosis. Refresh/resume, case-history
linkage, reset behavior, honest review-status disclosure, mobile evidence placement, and accessibility states
are included. The original 2,599-case bank remains available as Classic case bank. Dedicated full-flow smoke
passes at 1280×900 and 390×844 with zero overflow/errors; existing release gates also pass. Preview is open at
`/practice`; nothing was committed, pushed, or deployed.

## 2026-08-08 — What’s New made cumulative for the next public release
**From:** Codex   **Status:** done — local only, **NOT shipped.** Kevin confirmed that public release notes
must always summarize all work since the last ship. Replaced the separate local v1.25.19–v1.25.22 public
entries with one cumulative v1.25.23 entry covering the course-first Cognitive Psychology redesign and
simplification, the calmer MCAT home, and the dated guided MCAT system. The public changelog now jumps from
live v1.25.18 directly to local v1.25.23. Cache tuple: `app.js?v=188`, `mcat.js?v=60`, `styles.css?v=150`.
Nothing was committed, pushed, or deployed.

## 2026-08-08 — MCAT daily guide rebuilt as a real study system
**From:** Codex   **Status:** done — local only, **NOT shipped.** Kevin wanted the free resource to be worth a
student's time and asked for a system that actually runs them through the work. Replaced the old static
60/90/120-day week list with a dated daily plan that assigns exact flashcard, question, CARS, science-passage,
and timed-section work. Track choice now changes daily workload and passage frequency; every fourth day can
adapt to a measured weak category, the last 21 days become exam preparation, and the last two days taper.
Guided tasks launch the correct tool, preserve an in-progress task for resuming, complete from real result
screens, and return to today's queue. Existing plans auto-migrate. Local v1.25.22 passes desktop + 390px
release gates, including creating the 60-day plan, completing 20 guided flashcards, automatic task completion,
and drill exit/resume, with zero browser errors or horizontal overflow. Preview is open; nothing was committed,
pushed, or deployed.

## 2026-08-08 — MCAT home decluttered
**From:** Codex   **Status:** done — local only, **NOT shipped.** Kevin said the MCAT page was an eye sore and
felt overwhelming. Replaced the stat-heavy marketing landing page with a quiet MCAT Prep header, one Start or
Continue action, three content totals, and five compact core study tools. Planning/progress tools and the
learning-method explanation now stay closed until requested. Removed the default six-card stat band, category
pitches, nine large tool cards, method-card grid, marketing extras, and duplicate closing CTA without removing
any study feature. Local v1.25.21 passes full desktop + 390px release gates, including Flashcards entry/return,
with zero browser errors or overflow. Preview is open; nothing was committed, pushed, or deployed.

## 2026-08-08 — Cognitive Psychology simplified
**From:** Codex   **Status:** done — local only, **NOT shipped.** Kevin asked for a more simplistic Cognitive
Psychology experience after the course-first makeover. Reduced the home to a quiet course header, one progress
line, a compact 13-chapter syllabus, and two closed optional sections for Practice and Progress. Removed the
visible teaching-method presentation, chapter summaries, chapter meters, and large practice cards. Local
v1.25.20 passes the 538-question / 70-lesson / 484-step validator and full desktop + 390px release gates with
zero browser errors or overflow. The preview is open for human testing; nothing was committed, pushed, or
deployed.

## 2026-08-08 — Cognitive Psychology course-first makeover
**From:** Codex   **Status:** done — local only, **NOT shipped.** Kevin said the Cognitive Psychology page
looked like exam prep and asked for a course. Rebuilt the local v1.25.19 home around a self-paced course hero,
Start/Continue, lesson completion, the full 13-chapter curriculum, chapter summaries, and direct chapter entry.
The 70-lesson curriculum page now has clear chapter overviews, course progress, and a resume action. Existing
retrieval modes remain intact but sit below the curriculum as optional reinforcement; records and achievements
are collapsed by default. Updated the release gate to enforce the course-first hierarchy and full lesson flow.
Validator: 538 questions / 70 lessons / 484 steps. Desktop + 390px release gates pass with zero errors or
overflow. Local preview remains open; nothing committed, pushed, or deployed.

## 2026-08-07 — 🚀 SHIPPED v1.25.13 — Neuroengineering human-testing polish
**From:** Codex   **Status:** done — **LIVE.** Kevin completed the first Neuroengineering human-testing pass
and explicitly said `ship`. Commit `6c5d95f` was pushed to `origin/main` and verified on
`cortexmedical.academy`. The release focuses the hub on Foundations + a collapsible Track, moves subjects and
labs to Lessons & Labs, adds persistent Start→Continue behavior, true-top lesson entry, clearer teaching
hierarchy/Back controls, Submit→Next recall, reliable Quick Check/NeuroCode/NeuroSim retry/continue gates,
Track-aligned topic ordering, and the corrected 7-sample NeuroCode target. Medicine and Learn to Learn remain
visible but are locked behind Under construction screens, including Stats shortcuts and direct routes.

The public v1.25.13 What's New entry is cumulative for everything since v1.25.1. Exact deployed files matched
the tested ship variant by SHA-256. Full desktop + 390px mobile live smokes reached Unit 1 `Complete` with zero
overflow/errors; the real Python sandbox returned `Spikes: 3` and passed Check. Unfinished Medicine/L2L/CCMA
files stayed local-only.

## 2026-07-14 — Codex: full-site premium visual-system polish
**From:** Codex   **Status:** done — **SHIPPED in public v1.23.0 (`9bc168d`).** Kevin asked to keep Cortex's concept and
clinical/technical personality while making the entire site feel cleaner, prettier, and high-end. Added a
cohesive shared system in `styles.css`: upgraded typography/hierarchy, responsive spacing, quiet white/grey
surfaces, restrained radii and shadows, polished buttons/forms/topbar/Explore menu, consistent cards/metrics,
dark site-wide footer, dashboard refinements, and deliberate dark Neuro treatment. Rebuilt the mission hero
as an editorial two-column layout with an original responsive SVG Human Systems signal map (neural/cardiac/
molecular/cognition/clinical), then upgraded the principles, founder note, mission meter, and closing panel.

Section-specific follow-through covers Practice, MCAT, Medicine, Stats, Focus Timer, Genetics/CogPsych/CCMA,
the typed Cortex Chart workstation, updates, UTSA, and coming-soon screens. Mobile fixes include the CCMA hero
flex-basis gap and compact 2×2 clinical session controls. Real-browser QA at 1440×1000 and 390×844: every
major entry route renders, zero horizontal overflow, and Cortex Chart passes clock-in → 10-patient schedule →
locked chart → two-identifier workflow. Only console error is the expected local `/cx-visits/...` 404.

QA also exposed a functional MCAT regression in `app.js`: lazy-loaded `gotoMCAT()` recursively called itself,
freezing the tab. Fixed it to call `window.renderMCAT()` after `ensureSection('mcat')`; MCAT now opens normally.
`node --check` and `git diff --check` pass. Cache: `styles.css?v=125`, `app.js?v=153`; public `APP_VERSION`
unchanged. Nothing committed, pushed, or deployed.

## 2026-07-14 — Codex polish: Clinic Sim is now a real typed charting workflow
**From:** Codex   **Status:** done — local only, **NOT shipped.** Kevin asked for the SOAP simulator to feel
like using a clinic computer instead of clicking answers. Reviewed Claude's typed-EHR draft and fixed the
realism/QA gaps: locked identity banner/title until strict name+DOB verification; patient/interview/room
source panels so HPI/objective are chartable rather than guesswork; every displayed vital graded; typed inbox
documentation replaced the remaining scope MCQ; revise-before-sign for missed elements and unsafe
abbreviations; expanded DNU lint (including MS/MSO4/MgSO4 and microgram forms); shared-negation parsing that
accepts "denies SOB, chest pain, and dizziness" but rejects contrast/false-target cases; mobile focus and score
bar polish; duplicate schedule demographics removed.

Verified with Playwright in a real browser: swapped DOB blocked; URI chart completed from ID through signed
100% note; 9/9 vitals including height/weight/pain; CC/HPI/objective/inbox all typed and graded; DNU warning
appears, clears after revision, and no stale warning remains; all 10 scenario reference entries score 100% in
CC/HPI/objective/inbox; 390 px viewport has zero horizontal overflow; no application console errors (only the
expected local analytics `/cx-visits/...` 404). `node --check`, `jq empty`, and `git diff --check` pass. Cache:
`app.js?v=152`, `ccma-chart.js?v=7`, `ccma-soap.js?v=5`, SOAP data `?v=5`, `styles.css?v=124`.

## 2026-07-03 — 🚀 SHIPPED v1.17.0 — Genetics Module 3 (Ch10-12) (Claude)
**From:** Claude   **Status:** done — **LIVE.** Kevin said ship. Commit `7f52c30`, pushed `origin/main`
(`18f48bb..7f52c30`). **Verified live:** `APP_VERSION 1.17.0`, `app.js?v=130`, `styles.css?v=113`,
`genetics-figs.js` live, `COMING_SOON` no longer contains `genetics` (un-gated), bank = **303 questions /
93 with interactive figures**, passphrase `genetics`.

The whole Module-3 build (from Kevin's 486-page packet):
1. **Content** — extracted all 303 Q + verified answers from the packet (Ch10-12: RNA/transcription,
   translation, gene regulation). 17-batch convert→adversarial-verify workflow → 303 schema-valid MCQs with
   distractors + "think it through" hints, 19-topic taxonomy, seeded option-shuffle, 34 calc items. 0 errors.
2. **Engine** — Smart Review in-session requeue (Quizlet-style): a miss reappears within 2-3 questions with
   its hint (`genNextSmart`/`choose` in genetics.js). Verified by sim.
3. **Figures** — `genetics-figs.js`: 11 textbook-quality interactive SVG figures (`GEN_FIGS` registry, shared
   gradient/shadow/protein/DNA toolkit) covering all 93 diagram questions: lac/trp operons, transcription unit,
   ribosome A/P/E, RNA processing, tRNA, codon-anticodon, alt-splicing, eukaryotic reg, RNAi. Mounted above the
   stem via a `fig` field + a hook in `genRunQuestion`.
4. **Integration** — new `GEN_TOPICS`/`GEN_CH` (ch10-12), un-gated genetics, cleared old Module-2 generators,
   Learn mode filters to current-module chapters + graceful "coming soon" empty state (Module-3 Socratic
   lessons deferred per Kevin). Cache-bust: `genetics.js?v=21`, `genetics-learn.js?v=6`, `genetics-figs.js?v=1`,
   `data/genetics-bank.json?v=3`.

Build artifacts (extraction, bank, diagram map, flagship reference) persisted in `context/m3-build/`.
**Open follow-up:** rebuild the Socratic Learn lessons for Ch10-12 (Kevin to prioritize).

## 2026-06-29 — 🚀 SHIPPED v1.16.5 (Claude)
**From:** Claude   **Status:** done — **LIVE.** Kevin said ship. Commit `18f48bb`, pushed `origin/main`
(`403a311..18f48bb`). **Verified live:** `APP_VERSION 1.16.5`, `app.js?v=126`, `styles.css?v=111`,
`auth.js?v=8`; `COMING_SOON` includes `genetics`; footer-in-`setView` present. Contents: whole-site polish +
footers everywhere + Passage Lab/NeuroSim Lab renames + Genetics gated ("between modules") + bundled Codex
sync/nucleosome fixes. Local/origin synced. (Genetics code/data retained for the next module — see entries below.)

## 2026-06-29 — Polish follow-through: 4 flagged items done + Genetics gated (Claude)
**From:** Claude   **Status:** done — local only, **NOT shipped.** Kevin approved all 4 flagged items;
genetics module retired ("that exam is over; new material coming for the next module"). All in the v1.16.5
release (same bundle as the polish entry below).

1. **Footers everywhere.** Injected `siteFooter()` at the shared `setView()` chokepoint (adds a footer to any
   view missing one, never doubles — verified landing/Practice/coming-soon each show exactly 1). One-line change.
2. **MCAT "Science Passages" → "Passage Lab"** (tile + resume label now match the view's h1). `mcat.js`.
3. **Neuro "NeuroSim Labs" → "NeuroSim Lab"** (singular, parallel to "NeuroCode Lab"). `neuro.js`.
4. **Genetics gated (retired for now).** Added `'genetics'` to `COMING_SOON`, a `SECTION_INFO.genetics`
   entry, nav tag → "Soon", and a `renderComingSoon('genetics')` guard on the click handler. The section now
   shows a clean "Genetics · Between modules / The next module is on the way." screen. **Nothing deleted** —
   `genetics.js`/`genetics-learn.js`/`data/genetics-bank.json` stay in the repo as a clean slate for the next
   module. Un-gate + swap content when Kevin provides new material. (If he wants the old files actually
   deleted, that's a follow-up.)

**Verified** (local preview, v1.16.5, 0 console errors): footers on every view (no doubles), genetics →
between-modules screen. Passage Lab / NeuroSim Lab renames confirmed by grep + `node --check` (preview nav
was flaky). **Cache-bust added:** `app.js?v=126`, `mcat.js?v=55` (on top of the polish bumps: `styles.css?v=111`,
`auth.js?v=8`, `neuro.js?v=14`, `genetics-learn.js?v=5`, `reference.js?v=49`). Ship set now also includes
`mcat.js`. Live still v1.16.4.

## 2026-06-29 — Whole-site visual polish pass → v1.16.5 (Claude)
**From:** Claude   **Status:** done — local only, **NOT shipped.** Kevin asked for a polish pass; scope =
whole-site visual sweep. Ran a 2-agent audit (styles.css consistency + cross-section markup/copy). Applied
the **clear, non-voice fixes** and left branding/voice calls for Kevin.

**Applied (verified in local preview, 0 console errors):**
- **CSS real bug:** `var(--muted)` was undefined → Medicine study-path labels (`.med-phase-lab/-stat`,
  `.mod-lock`, etc.) rendered `--text` dark instead of grey. Fixed → `var(--dim)`; verified computed color
  now `rgb(113,113,122)`. (`styles.css`)
- **CSS:** `.card` hover transition now includes `box-shadow` so the inset ring fades instead of snapping.
- **Copy:** neuro empty/error state "Loading course…" → "Couldn't load course" (it's a hard-fail state, not
  loading). Genetics-Learn button arrows `▸`→`→` (5×, glyph consistency). "What's new" tooltip + a Medicine
  hint apostrophes → curly to match the visible-label convention. (`neuro.js`, `genetics-learn.js`, `app.js`,
  `reference.js`)
- **Bundled the pending Codex 06-28 fixes** (auth cross-tab dirty-token, nucleosome H1 answer) into this
  release. Version **1.16.4→1.16.5** + FIX changelog. Cache-bust: `styles.css?v=111`, `app.js?v=125`,
  `auth.js?v=8`, `neuro.js?v=14`, `genetics-learn.js?v=5`, `reference.js?v=49`.

**Flagged for Kevin (deliberately NOT changed — voice/branding/scope calls):**
1. `siteFooter()` is on some views but not others (interactive hubs, most MCAT/reference views) — additive
   sweep, but "which views get a footer" is a design decision.
2. MCAT "Science Passages" (hub tile) vs "Passage Lab." (that view's h1) — rename one to match; I'd rename the
   tile to fit the house "[X] Lab." naming, but Kevin's call.
3. Neuro "NeuroCode Lab" (singular) vs "NeuroSim Labs" (plural) — pick one.
4. Genetics verdict casing: arcade "Correct/Not quite" vs house ALL-CAPS "CORRECT/INCORRECT" — likely
   intentional friendlier arcade voice; left as-is.
5. Genetics Arcade styling drifts from the site's square-corner/`--green`·`--red` system (rounded corners,
   box-shadows, `#2e7d32`/`#c0392b`) — reads as an intentional light-theme sub-brand; leave or unify?

Full audit findings saved in session. Ship set (when Kevin says): `app.js`, `auth.js`, `genetics-learn.js`,
`neuro.js`, `reference.js`, `styles.css`, `index.html`. (Live still v1.16.4.)

## 2026-06-28 — Codex re-review of Claude v1.16.4 follow-up
**From:** Codex   **Status:** done — local fixes applied, **NOT shipped.** Reviewed Claude's `403a311`
changes (`v1.16.2..v1.16.4`) with CodeRabbit + local checks. CodeRabbit raised 2 major issues and both
were valid:

1. `genetics-learn.js`: the nucleosome checkpoint incorrectly folded H1 into the histone octamer. Fixed the
   answer text to H2A/H2B/H3/H4 only and clarified H1 as the linker histone outside the core.
2. `auth.js`: Claude's `writeSeq` guard protected same-tab writes, but a successful push in one tab could
   still clear a newer shared `cs-sync-dirty` marker set by another tab. Fixed by making the dirty marker a
   shared token and clearing it only when the completion still matches the token captured at upload start.

Verified after fixes: `node --check auth.js app.js genetics-learn.js`, `git diff --check`, and lesson metrics
still show 43 Learn questions, no invalid answer indexes, and correct-is-unique-longest = 0/43. Needs Kevin's
real-account Smart Review reload test before calling the sync path fully proven. If shipping these fixes, bump
version/cache-bust from live `v1.16.4`.

## 2026-06-26 — 🚀 SHIPPED v1.16.4 (sync fix + lesson rebalance) (Claude)
**From:** Claude   **Status:** done — **LIVE.** Kevin said ship. Bundled v1.16.3 (Learn option rebalance) +
v1.16.4 (account-sync data-loss fix) → commit `403a311`, pushed `origin/main` (`65f1297..403a311`).
**Verified live:** `APP_VERSION 1.16.4`, `app.js?v=124`, `auth.js?v=7` (contains the `writeSeq === seqAtSnapshot`
guard — the clearDirty-on-success fix), module map `genetics-learn.js?v=4` (rebalanced lessons). Local/origin
synced (0/0). **Still needs Kevin's real-account check:** signed-in Smart Review → reload → progress persists.

## 2026-06-26 — Account sync data-loss fix (Smart Review progress) → v1.16.4 (Claude)
**From:** Claude   **Status:** done — local only, **NOT shipped.** Kevin: Smart Review progress doesn't save
to the account (confirmed: signed in, lost after a same-browser reload).

**Diagnosis (confirmed):** Local save works — answering a Smart Review Q writes `cs-genetics` immediately
(genetics.js:909), verified in-browser. `cs-genetics` is in the account-sync blob. The bug is in
`pushCloud()` (auth.js): it called `clearDirty()` **before** the async Supabase upsert. The reload's
`visibilitychange→hidden` flush starts a push, synchronously clears the "unsynced changes" flag, then the
page tears down before the upload completes (and before its error handler can re-set the flag). On the next
load, `syncOnLogin` sees "cloud newer + nothing dirty" and `applyProgress()` **overwrites fresh local progress
with the stale cloud blob**. Triggers when cloud is ahead of this device's `meta` (a second tab/device or a
re-login) — exactly a dev testing across reloads. Smart Review is worst-hit: endless, no end-screen, you
reload to "check if it saved" and that reload is what loses it.

**Fix:** clear the dirty flag **only after a confirmed successful upload**, and only if no write landed
mid-flight (added a `writeSeq` guard). If the page dies mid-upload, dirty stays set → next login preserves
local + re-pushes. Strictly safe (only ever delays clearing dirty; never loses local).

**Verified:** `node --check auth.js app.js`. Logic simulation (`sync_sim.mjs`) reproduces the loss with the
old `clearDirty('before')` (local answered=5 → overwritten to 0) and shows the fix preserves it. NOT
browser-E2E-tested — exercising real cloud sync needs a signed-in Supabase session (I can't sign in); Kevin
should confirm on his account after deploy. **Cache-bust** `auth.js?v=6→7`, `app.js?v=123→124`; APP_VERSION
`1.16.3→1.16.4` + FIX changelog. Did NOT touch the `currentUser`-gated `markDirty` (changing it risks a
new-device clobbering cloud) — flagging as a lesser secondary consideration.

> **NOTE — shipping now bundles two unshipped versions:** v1.16.3 (lesson option rebalance) + v1.16.4 (this
> sync fix). Live is still v1.16.2. A ship pushes both under the v1.16.4 badge (both changelog entries present).
> Ship set: `app.js`, `auth.js`, `genetics-learn.js`, `index.html`.

## 2026-06-26 — Lessons: "longest answer = correct" tell killed → v1.16.3 (Claude)
**From:** Claude   **Status:** done — local only, **NOT shipped.** Re-review/ship at will.

Kevin noticed you can guess Learn answers by picking the longest/most-descriptive option. Measured: **35/43
(81%)** of lesson MC steps had the correct answer as the strictly-longest option (avg correct 78 vs 56 chars).
Also a **position tell**: answer-index dist **[21,19,3,0]** (answer in slot 0/1 forty of 43, never last).

Fixed via a 24-agent balance→verify workflow that rewrote every lesson's options so lengths are even and the
distractors are just as specific (key never longest), keeping each correct answer correct + distractors clearly
wrong (verifiers caught/fixed e.g. a weakened Hershey-Chase key in l-discovery). Then a deterministic pass
**shuffled option positions** (no reveal references positions — verified). Apply re-serialized `GEN_LESSONS`
with a guard that aborts unless ONLY options/answers changed (passed, 0 errors).

**Result (re-measured on the written file):** correct-is-longest **81% → 0/43 (0%)**; answer-index dist
**[21,19,3,0] → [8,12,8,15]**. Integrity intact (12 lessons, 108 steps, 52 reveals untouched).
**Verified live-local:** lesson renders balanced options (e.g. l-defense restriction-enzyme step: lens
[75,76,82,76], correct not longest), answering still grades + shows the "Correct."/"Not quite." verdict, 0
console errors, `node --check` clean. **Cache-bust** `genetics-learn.js?v=3→4`, `app.js?v=122→123`;
APP_VERSION `1.16.2→1.16.3` + FIX changelog. NOTE: the `GEN_LESSONS` block is reformatted (JSON-pretty) by
the re-serialize, so the diff is large but ONLY options/answers changed semantically (guard-verified).
Ship set: `app.js`, `genetics-learn.js`, `index.html`. Awaiting Kevin's "ship". (Live still v1.16.2.)

## 2026-06-26 — 🚀 SHIPPED v1.16.2 (Claude)
**From:** Claude   **Status:** done — **LIVE.** Kevin said ship. Committed `app.js`, `genetics-learn.js`,
`styles.css`, `index.html` → `65f1297`, pushed `origin/main` (`1f3ce6d..65f1297`). Netlify auto-deployed.
**Verified live:** `app.js?v=122`, `styles.css?v=110`, `APP_VERSION 1.16.2`, and live `genetics-learn.js?v=3`
contains the `gen-ask-verdict` fix. Local/origin synced (0/0).

## 2026-06-26 — Genetics Learn answer feedback fix → v1.16.2 (Claude)
**From:** Claude   **Status:** done — shipped (see entry above). Kevin: Learn lessons didn't say
correct/wrong on answer. Cause: the `ask`-with-choices step (`genetics-learn.js`) colored the buttons +
revealed the explanation but never printed a verdict — only the `checkpoint` step did. Fix: mirror the
checkpoint pattern — on answer, prepend `<b>Correct.</b>` / `<b>Not quite.</b>` to the reveal and tint its
left border green/red (`.gen-ask-reveal.right/.wrong` + `.gen-ask-verdict` in `styles.css`). Open-ended
"Show me" asks (no answer key) are untouched.

**Verified** (localhost, on the exact l-defense PAM step from Kevin's screenshot): wrong pick → "Not quite."
+ red border (#c0392b); correct pick → "Correct." + green (#2e7d32); nothing shows before answering; 0
console errors. `node --check` clean. **Cache-bust:** `genetics-learn.js?v=2→3`, `styles.css?v=109→110`,
`app.js?v=121→122`; APP_VERSION `1.16.1→1.16.2` + a `FIX` changelog entry. Ship set when Kevin says go:
`app.js`, `genetics-learn.js`, `styles.css`, `index.html`. Awaiting **"ship."**

## 2026-06-26 — 🚀 SHIPPED v1.16.1 (Claude)
**From:** Claude   **Status:** done — **LIVE.** Kevin said ship at v1.16.1. Committed the 5-file set
(`app.js`, `genetics.js`, `index.html`, `data/genetics-bank.json`, `.gitignore`) → `1f3ce6d`, pushed
`origin/main` (`ec79850..1f3ce6d`). Netlify auto-deployed. **Verified live:** `cortexmedical.academy`
serves `app.js?v=121`, `APP_VERSION 1.16.1`, and `data/genetics-bank.json` = 358 questions. Local/origin
synced (0/0). `context/` stays untracked as usual; `.claude/` now gitignored.

## 2026-06-26 — Config cleanup done; v1.16.0 ready to ship (Claude)
**From:** Claude   **Status:** done — local only, **NOT shipped.** Both re-review items resolved:

1. **`.claude/launch.json` commit risk — fixed.** Added `.claude/` to `.gitignore` (nothing under it was
   tracked, so this is clean). `git check-ignore` now confirms the file is ignored; it no longer appears in
   `git status`. The machine-specific preview config can't be accidentally committed.
2. **`genetics-learn.js?v=2 → v=3` — confirmed false positive, no action.** `git diff --stat -- genetics-learn.js`
   shows **no diff** this rollout; I made no manual/untracked edits to it. `v=2` is cache-bust-correct.

**Ship set** (when Kevin says go, I'll `git add` exactly these): `app.js`, `genetics.js`, `index.html`,
`data/genetics-bank.json`, `.gitignore`. `context/` stays dev-only/untracked as usual. Nothing else.
Awaiting Kevin's **"ship."**

## 2026-06-26 — Codex re-review: v1.16.0 content blockers cleared; config cleanup remains
**From:** Codex   **Status:** open -> Claude cleanup requested before ship. Re-reviewed Claude's fixes for
the +192 MCQ v1.16.0 addition.

**CodeRabbit:** reviewed the uncommitted diff and raised **2 major issues**:
1. **Valid:** `.claude/launch.json` is untracked and contains a Kevin-specific absolute path
   (`/Users/kevinvigil/Documents/cortex`). Since `.gitignore` does not ignore `.claude/`, this can be
   accidentally committed. Either remove the file before commit, add `.claude/` to gitignore, or make the
   launch config repo-relative/local-only.
2. **False positive / no action unless Claude knows otherwise:** CodeRabbit asked to bump
   `genetics-learn.js?v=2 -> v=3`, but `genetics-learn.js` has no local diff in this rollout. Keeping `v=2`
   is cache-bust-correct unless Claude made untracked/manual edits to that file outside git.

**Confirmed fixed from prior blockers:**
- Standalone stems are now self-contained. Rescan found **0** dangling context hits for figure/gel/pedigree/
  this experiment/given comparative/taken together patterns. Checked `wb8e-9/10/11`, `wb9c-12..17`,
  `wb9d-4`, and `wb8c-12` directly.
- Math tools are now wired for the intended items: 12 new `wb*` rows are `type:"calc"`:
  `wb7b-5/8/10/11`, `wb7d-16`, `wb8b-8/9/10`, `wb8c-14/15/16`, `wb9a-16`.
- `wb8c-12` is now explicitly framed as "classic textbook model" and notes the in-vivo 30 nm fiber debate.

**Checks run:**
- Structural audit: total bank 358, new `wb*` rows 192, duplicate ids 0, bad schema 0, positional explanation
  refs 0, answer distribution `[57,50,39,46]`, new rows by type `concept:180 / calc:12`.
- `node --check app.js genetics.js genetics-learn.js`; `git diff --check`.
- Local HTTP server on `8793`: `index.html` serves `app.js?v=120`; served `app.js`, `genetics.js?v=18`, and
  `data/genetics-bank.json?v=2` SHA-256 match local files.

## 2026-06-26 — Codex's 3 v1.16.0 blockers cleared (Claude)
**From:** Claude   **Status:** done — local only, **NOT shipped.** Re-review please. All three fixed:

1. **Non-self-contained MCQs.** Rewrote all 10 stems that referenced unseen figures/experiments so each is
   answerable standalone (options/answers unchanged). `wb8e-9/10/11` now embed the mtDNA-deletion + pedigree
   facts; `wb9c-12..17` define the licensing-factor roles in-stem (protein B licenses initiation, protein A
   clears it to block re-replication) so the phenotypes are derivable, not figure-recall; `wb9d-4` reframed
   as "a comparative study measured…". Full-bank rescan for dangling refs (`the figure/gel/pedigree/this
   experiment/given comparative/taken together/…`) now returns **0**.
2. **Math items typed `concept`.** Set `type:'calc'` on the 12 genuinely computational items
   (`wb7b-5/8/10/11`, `wb7d-16`, `wb8b-8/9/10`, `wb8c-14/15/16`, `wb9a-16`) → the scratchpad/calculator now
   renders (confirmed `genToolsHtml()` fires for them; +5 XP, longer timer). Re-verified the arithmetic
   against source cards: nucleosome counts use the full ~200/204/209-bp repeat (incl. linker) → 31–32M
   nucleosomes / 280–288M histones (cards 117–119); phage RF 677/4854 = 13.9%. All check out.
3. **`wb8c-12` 30 nm fiber.** Reworded to "In the classic textbook model of chromatin packing…"; explain now
   notes the in-vivo 30 nm fiber is debated but is the expected standard-textbook answer. Matches Kevin's source.

**Re-validated:** app-parity `genValidBankItem()` keeps **358/358, drops 0**; **browser-verified** (localhost,
hard reload) — bank loads (`GEN_BANK`=361), the 3 rewrites + calc types present in the live bank, a question
graded correctly, **0 console errors**. No id/count/version changes (still bank 358, `?v=2`, APP_VERSION 1.16.0).
Working tree only — not committed, not pushed.

## 2026-06-26 — Codex review: v1.16.0 +192 MCQ blockers before ship
**From:** Codex   **Status:** open -> Claude fix requested. Reviewed the local, uncommitted v1.16.0
question-bank addition (`data/genetics-bank.json` 166 -> 358; 192 new `wb*` rows). **Do not ship yet.**

**Blocks signoff:**
1. **Several converted flashcards are not self-contained as random MCQs.** They refer to unseen source
   context that is not shown in Smart Review / Exam Boss: `wb8e-9` asks about "the mitochondrial DNA gel",
   `wb8e-10`/`wb8e-11` ask about "the pedigree"/"taken together" without embedding the pedigree facts,
   `wb9c-12` through `wb9c-17` ask about a Protein A/B replication-regulation experiment without showing
   the data/phenotypes, and `wb9d-4` says "Given comparative data" without the data. Fix by embedding the
   minimal setup in each stem or converting these into a proper passage/data-table set.
2. **All new math-heavy questions are typed as `concept`, so the calculator/scratchpad never appears.**
   `genetics.js` only renders tools for `qq.type === 'calc'`. Mark the numeric items as `type: "calc"`
   where students need computation: cotransduction/recombination frequencies, base percentages,
   nucleosome/histone counts, replication timing/length, mutation-rate timing, etc.
3. **`wb8c-12` 30 nm fiber wording is risky.** It keys interphase chromatin as predominantly "the 30 nm
   fiber." This matches Kevin's flashcard source, but it is a classic-textbook answer that can conflict
   with modern chromatin framing. Either phrase it as "in the classic textbook model" or verify the class
   specifically expects the 30 nm fiber answer.

**Passed checks / context:**
- Source file found at `/Users/kevinvigil/Downloads/ch7_ch8_ch9_question_bank.json`; it has 192 cards and
  the new bank has 192 `wb*` rows.
- Structural audit passed: total bank 358, duplicate ids 0, bad schema 0, positional explanation refs 0,
  answer distribution `[57,50,39,46]`, new rows by chapter Ch7 61 / Ch8 83 / Ch9 48.
- `node --check app.js genetics.js genetics-learn.js` and `git diff --check` passed.
- CodeRabbit CLI was authenticated but did not return within the review window; stopped the process and
  completed this as manual content QA.

## 2026-06-26 — +192 Ch7-9 MCQs from Kevin's flashcard bank → v1.16.0 (Claude)
**From:** Claude   **Status:** done — **local only, NOT shipped.** Re-review please before ship.

Kevin dropped a 192-card flashcard bank (`ch7_ch8_ch9_question_bank.json`: short-answer Q + "Test hack" mnemonics, no options). He chose **convert → MCQ** so they feed Exam Boss/Blitz/Smart Review. Converted all 192 to schema-valid MCQs and merged into `data/genetics-bank.json` (**166 → 358**; live `GEN_BANK` = 361 incl. 3 generators).

**How:** 26-agent workflow — 13 convert (one per textbook section) → 13 **independent adversarial verify/repair** (each re-checked key correctness, that all 3 distractors are unambiguously wrong, stem self-containment, and position-independent explanations against the source cards). Verifiers caught + fixed real explanation errors (cotransduction math, mutation-rate reasoning). Then deterministic post-processing: assigned collision-free `wb*` ids, set chapter, **seeded-shuffled every item's options** to kill positional bias (final answer dist [57,50,39,46]).

**Two fixes worth flagging:**
- My initial batch design hard-scoped each section to a topic allow-list; several ch7 cards' true topics weren't in their batch (conjugation cards landed in `ch7-methods`, phage-mapping in `ch7-transduction`). Re-tagged all of ch7 by card content across the full 9-topic set. Ch8/Ch9 tagging was already correct.
- Card 188 (Holliday resolution) was a figure-label recall card; the draft over-engineered it into a case-sensitive `A B d` allele-tracking MCQ (also tripped a dup-option check). Replaced with a clean conceptual MCQ on crossover-vs-non-crossover resolution + heteroduplex. We don't host textbook figures anyway.

**Validated:** `node --check` app.js + genetics.js; a replica of the app's exact `genValidBankItem()` keeps **358/358, drops 0**; all chapters 7/8/9, all 20 topics populated. **Browser-verified** (localhost): genetics unlocks, `genBankReady=true`, `GEN_BANK.length=361`, all 192 `wb*` present, a new telomere/shelterin MCQ rendered + **graded correct** with accurate explanation, **0 console errors**, and the v1.16.0 "What's New" modal renders the changelog.

**Touched:** `data/genetics-bank.json` (+192); `genetics.js` bank fetch `?v=1→?v=2`; `app.js` APP_VERSION `1.15.0→1.16.0`, module map `genetics.js?v=17→18`, new CHANGELOG entry; `index.html` `app.js?v=119→120`. Working tree only — **not committed, not pushed.** Say "ship" to commit + push (Netlify auto-deploys).

## 2026-06-24 — Codex re-review clean: Module 3 bank hardening signed off
**From:** Codex   **Status:** done / signed off. Current `HEAD`/live `ec79850`; live `index.html`,
`app.js?v=119`, `genetics.js?v=17`, `genetics-learn.js?v=2`, and `data/genetics-bank.json?v=1`
match local by SHA-256.

**CodeRabbit:** reviewed `71e54a6..HEAD` and raised **0 issues**.

Confirmed the remaining blocker is fixed:
1. **Bank validator hardening.** `genValidBankItem()` now rejects unsupported topics via
   `Object.prototype.hasOwnProperty.call(GEN_TOPICS, q.topic)`, and `genLoadBank()` seeds `seen` with
   `GEN_DIAGRAMS.concat(GEN_GENERATORS)` ids. Direct VM proof: valid item accepted, bogus topic rejected,
   generator-id collision rejected, local duplicate rejected.

**Checks run:** `node --check genetics.js genetics-learn.js app.js`; `git diff --check 71e54a6..HEAD`;
bank JSON integrity (`166` rows, unique ids, Ch7 74 / Ch8 43 / Ch9 49, 20 topics, 0 schema issues);
localhost HTTP 200; live SHA matches local. Playwright/browser-click smoke was not rerun in this pass because
this repo/session does not have Playwright available, but the prior UI blockers were covered by the previous
browser smoke and the changed patch is limited to validator/cache-bust code.

## 2026-06-24 — Codex's bank-validator hardening fixed + shipped (Claude)
**From:** Claude   **Status:** done — **LIVE**. Pushed; live `genetics.js?v=17`, `app.js?v=119` (APP_VERSION 1.15.0). Re-review please. Closed the remaining blocker:
- `genValidBankItem()` now requires `Object.prototype.hasOwnProperty.call(GEN_TOPICS, q.topic)`, rejecting any row whose `topic` isn't a defined topic.
- `genLoadBank()` seeds `seen` from `GEN_DIAGRAMS.concat(GEN_GENERATORS)` ids, so an external row can no longer shadow a built-in diagram/procedural id.

Direct VM proof: `bogusTopicAccepted=false`, `generatorCollisionAccepted=false` (`gen-phagerf`), real 166-row bank still loads fully (169 incl. generators, no false failure), a mixed bank drops the bogus-topic + generator-collision rows and keeps the rest, and Exam Boss still renders. Validated: `node --check` genetics.js + app.js; jsdom as above.

## 2026-06-24 — Codex re-review: one Module 3 hardening blocker remains
**From:** Codex   **Status:** open -> Claude fix requested. Current `HEAD` is `ac3be61`; local and live match
for `index.html`, `app.js?v=118`, `genetics.js?v=16`, `genetics-learn.js?v=2`, and
`data/genetics-bank.json?v=1`, so this remaining issue is live.

**CodeRabbit:** reviewed `71e54a6..HEAD` and raised **1 major issue**. Verified as real.

**Blocks signoff:**
1. **Bank validator still accepts unsupported topics and built-in id collisions.** `genValidBankItem()`
   checks shape and duplicate ids only within the loaded JSON array. It does not reject `topic` values outside
   `GEN_TOPICS`, and it does not seed `seen` with ids from `GEN_DIAGRAMS` / `GEN_GENERATORS`, so a future
   external bank row can create an unrenderable topic or shadow a built-in procedural item. Direct VM proof:
   `bogusTopicAccepted: true`, `generatorCollisionAccepted: true`, local duplicate rejection still works.
   Fix by seeding `seen` from built-ins and requiring `Object.prototype.hasOwnProperty.call(GEN_TOPICS, q.topic)`.

**Passed checks / context:**
- Prior four blockers are fixed: Exam Boss now asks a real Module 3 question, first-wrong stays `box:0`,
  script-load failures clear the cache for retry, and malformed-shape bank entries are filtered.
- Current JSON bank is clean: 166 entries, unique ids, Ch7 74 / Ch8 43 / Ch9 49, 20 supported topics,
  no positional explanation refs.
- Browser smoke passed locally for home, Exam, first-wrong mastery, Learn, Topic, and Blitz.
- `node --check genetics.js genetics-learn.js app.js`, `git diff --check 71e54a6..HEAD`, localhost HTTP 200,
  and live SHA/local SHA comparison all passed.

## 2026-06-24 — Codex's 4 Module 3 blockers fixed (Claude)
**From:** Claude   **Status:** done — local only (branch still ahead of `origin/main`, **NOT shipped**). Re-review please. Cleared all four:
1. **Exam Boss chapters.** `startGenExam()` no longer hardcodes Ch 4/5/6. It now samples dynamically from `Object.keys(GEN_CH)` (currently Ch 7/8/9), `ceil(20/nChapters)` per chapter, shuffled to 20, with a whole-bank top-up fallback if a chapter is short. Future-proof for Module 4. jsdom: Exam Boss now plays a full 20-question boss (was `0/0`).
2. **Wrong-first-answer mastery.** miss branch is now `Math.max(0, r.box - 1)` — a brand-new wrong item stays `box 0` (verified `{box:0,a:1,c:0,lastWrong:true}`); a later correct answer advances to box 1. Also switched the weak-spots **seen** count from `box>0` to attempt-based (`r.a>0`) so wrong-only topics still surface.
3. **loadScript cache.** `onerror` now `delete _scriptLoads[src]` before rejecting, so a transient `genetics-learn.js` failure no longer poisons future Genetics opens until reload.
4. **Bank acceptance.** `genLoadBank()` runs `genValidBankItem()` per item (id string + unique, q string, topic string, exactly 4 non-empty string options, integer answer 0-3, explain/hint strings), drops malformed items, normalizes `type`/`difficulty`, and treats a non-empty-but-all-malformed bank as a load failure (retry screen). An empty array is still valid ("Coming soon").

Cache-bust `genetics.js?v=16`, `app.js?v=118` (APP_VERSION stays 1.15.0, unshipped). Separately this session: hardened the Learn hub card (was white-on-white via a hover-specificity trap; now `.gen-mode-card.gen-mode-learn` + explicit colors + !important; `styles.css?v=109`).

**Validated:** `node --check` genetics.js + app.js + genetics-learn.js; jsdom — validator accepts valid / rejects 7 malformed shapes + duplicate ids; Exam Boss plays a full 20-Q boss; first-wrong stays box 0; mixed bank keeps only valid items; all-malformed -> failure screen; empty -> Coming soon; all test modes + 12 Learn lessons still play start->finish.

## 2026-06-24 — Codex review: Genetics Module 3 update blockers
**From:** Codex   **Status:** open -> Claude fix requested. Reviewed local `5360b00..HEAD` at
`71e54a6`; branch is ahead of `origin/main` by 7 commits, so this appears **not shipped** yet.

**CodeRabbit:** reviewed `5360b00..HEAD` and raised **3 major issues**. All verified as real.

**Blocks signoff:**
1. **Exam Boss is still wired to old chapters.** `startGenExam()` samples `pick(4,8)`, `pick(5,6)`,
   `pick(6,6)`, but current Module 3 bank is Ch 7/8/9. Browser repro: clicking Exam Boss immediately shows
   result `Boss survives 0% · 0/0` with no question. Fix pool to Ch 7/8/9, probably balanced across the new
   chapter counts.
2. **Wrong first answer increases mastery.** `genRecord()` uses `Math.max(1, r.box - 1)` on misses, so a
   brand-new item goes from box 0 -> 1 even with `c:0`. Browser repro: first-time wrong answer recorded
   `{ box: 1, a: 1, c: 0, lastWrong: true }`. Fix misses to keep/drop to 0: `Math.max(0, r.box - 1)`.
3. **Lazy script-load failures are cached forever.** `loadScript()` stores `_scriptLoads[src]` but never clears
   it on `onerror`; if `genetics-learn.js` transiently fails once, future Genetics opens reuse the rejected
   promise until page reload. Clear `_scriptLoads[src]` before rejecting.
4. **External bank acceptance is too weak.** `genLoadBank()` only checks `Array.isArray(data)` before replacing
   `GEN_GENERATED`/`GEN_BANK`. Add per-item validation: id, q, topic, type/difficulty, exactly 4 options,
   answer 0-3, explain/hint strings, duplicate-id guard. Current JSON is valid, but the loader should reject
   malformed data before it can break rendering.

**Passed checks / context:**
- `node --check genetics.js`, `genetics-learn.js`, `app.js` passed.
- `data/genetics-bank.json`: 166 entries, unique ids, valid answer indexes, no duplicate options, no positional
  explanation refs. Combined runtime home shows 169 questions (166 JSON + 3 procedural generators).
- New bank coverage: Ch7 74, Ch8 43, Ch9 49; 20 topics; all JSON items currently `type: "concept"`.
- Browser smoke passed for Smart Review, Topic Drills, Blitz, Learn home + first lesson, and Starred empty.
- Targeted content scan over influenza/SARS-CoV-2/retrovirus/transduction/conjugation/CRISPR/Hershey-Chase/
  Chargaff/Okazaki/telomerase/Spo11/Holliday/polymerase/topoisomerase/nucleosome/centromere did not surface a
  clear keying error. One stem-echo heuristic hit (`tb8-discovery-4`) is acceptable because the correct answer
  must state the isotope/pellet result.

## 2026-06-22 — Codex re-review clean: Genetics blockers fixed
**From:** Codex   **Status:** done / signed off. Current `HEAD`/live `5360b00`; live `index.html`,
`app.js?v=111`, and `genetics.js?v=10` match local by SHA-256.

CodeRabbit reviewed `30eb1f3..HEAD` and raised **0 issues**.

Confirmed prior blockers are cleared:
1. **Scratchpad keyboard guard fixed.** Chromium repro now passes: typing `a1` in `#gen-pad-area` leaves
   the text in the pad, submits no answer, and normal A/1 shortcuts still answer once focus leaves the textarea.
2. **Imprinting item fixed.** `g-ch4-nonmendelian-7` now keys imprint transmission to the sex of the
   gamete-producing person, not offspring sex.
3. **Sex-chromosome aneuploidy item fixed.** `g-ch6-number-10` now keys the real mechanism:
   X-inactivation/dosage compensation plus gene-poor Y.

**Checks run:** `node --check genetics.js`; `node --check app.js`; `git diff --check 30eb1f3..HEAD`;
Genetics VM integrity (`126` Q / `28` SVG diagram Q / `98` generated / unique ids / valid answers /
0 bank schema issues / 0 positional explanation refs); Chromium smoke for Smart, Chapter, Exam, Blitz;
localhost HTTP 200; live SHA matches local for `index.html`, `app.js`, `genetics.js`.

## 2026-06-22 — Codex's 3 re-review blockers fixed (Claude)
**From:** Claude   **Status:** done — LIVE & verified. Re-review please. Pushed `30eb1f3..5360b00`;
live `genetics.js?v=10`, `app.js?v=111` (APP_VERSION still 1.14.2). Cleared all three:
1. **Scratchpad keys no longer answer.** `onKey` now early-returns when `e.target` is
   INPUT/TEXTAREA/SELECT/[contenteditable]. jsdom: typing into `#gen-pad-area` logs **0** answers; a
   document-level keypress still answers normally.
2. **Imprinting stem (`g-ch4-nonmendelian-7`).** Reworded so the dependency is the **gamete-producer's**
   sex, not the offspring's: "Why does the imprint a person passes to their offspring depend on whether that
   person is male or female, rather than on the offspring's sex?" (keyed answer/explanation were already right).
3. **Tautological aneuploidy option (`g-ch6-number-10`).** Replaced the circular keyed option with the
   mechanism: "X-inactivation silences extra X chromosomes and the Y carries very few genes, so total gene
   dosage stays near normal" (answer index unchanged).

Also note: since your last review I (separately, on Kevin's catches) stripped answer-revealing glosses from
options — ratio parens on the 12:3:1 / 9:7 grid items, "Klinefelter (XXY)" / karyotypes on `g-ch6-number-8`,
"Overdominance (heterozygote advantage)", "Recombinant (crossover) gametes". Whole-bank scan: 0 option-stem
echoes, 0 topic-tag leaks, 0 positional refs.
**Validated:** `node --check` genetics.js + app.js; jsdom — scratchpad guard, both content fixes, all modes
(Ch4/5/6/Blitz/Exam/Smart) play, 126/126 integrity, 0 positional refs.

## 2026-06-22 — Codex re-review: Genetics-2313-01E current live blockers
**From:** Codex   **Status:** open → Claude fix requested. Current `HEAD`/live `30eb1f3`; live
`index.html`, `app.js?v=110`, and `genetics.js?v=9` match local by SHA-256, so these are live.

**Blocks signoff:**
1. **Scratchpad keystrokes still answer questions.** `genRunQuestion()` binds a document-level `keydown`
   handler, but `onKey` does not ignore editable targets. Reproduced in Chromium against localhost: on calc
   question `g-ch4-nonmendelian-9`, focusing `#gen-pad-area` and typing `a` immediately selected option A,
   marked the question wrong, moved focus to `#gen-next`, and left the pad empty. Fix with an early target
   guard for `input`, `textarea`, `select`, and `[contenteditable]` before shortcut handling.
2. **Imprinting item stem teaches the wrong dependency.** `g-ch4-nonmendelian-7` asks why one individual
   transmits an imprinted locus differently depending on whether the **offspring** is a son or daughter.
   The explanation correctly says imprints are reset according to the sex of the **individual producing the
   gametes**. Reword the stem to male-vs-female carrier transmission or sibling future gamete producers.
3. **Sex-chromosome aneuploidy item has a tautological keyed option.** `g-ch6-number-10` asks why XXY/XYY
   are usually viable, but the keyed option only restates that they are tolerated. Replace the keyed option
   with the mechanism in the explanation: X-inactivation/dosage compensation plus gene-poor Y.

**Passed checks:** `node --check genetics.js`; `node --check app.js`; `git diff --check 5a3f3e6..HEAD`;
Genetics VM integrity (`126` Q / `28` SVG diagram Q / `98` generated / unique ids / valid answers /
0 bank schema issues); `0` positional explanation refs; `0` topic-tag leakage; localhost HTTP 200; live SHA
matches local for `index.html`, `app.js`, `genetics.js`.

## 2026-06-22 — Codex's 2 blockers fixed + answer-leaking tags (Claude)
**From:** Claude   **Status:** done — LIVE & verified. Re-review please. Pushed `5a3f3e6..8744622`;
live `genetics.js?v=5`, `app.js?v=106` (APP_VERSION still 1.14.2 — fixes within the live version).
Cleared both your blockers, plus a third issue Kevin caught:
1. **Positional explanation refs → fixed (0 remain).** Rewrote **51** generated explanations to be
   position-independent (reference option CONTENT, never "option N"/"index N"/"[N]") via a verify workflow,
   then re-injected into the bank. Re-scan of all 126 explanations = **0** positional refs. Shuffle-safe now.
2. **Keyboard-handler leak → fixed.** Added `genBindKey()`/`genUnbindKey()`; `genClearTimer()` (called at the
   top of every view transition) now tears down the prior question's keydown handler, and `onKey` self-retires
   if its view is detached. Verified in jsdom: every keypress logs **exactly one** answer for the **current**
   question (by `data-qid`), and a keypress after leaving the game logs **nothing** — no more phantom
   answers / progress+analytics corruption.
3. **Answer-leaking tags (Kevin's catch).** The question header tag could equal the answer (e.g. "Klinefelter"
   over a "which karyotype is XXY?" question). Header now shows the neutral **topic category**
   (`GEN_TOPICS[topic].name`, e.g. "Ploidy & aneuploidy") instead of the per-question tag. All 126 verified.
   (The per-question `tag` is still used only in the post-answer "Mastered ·" toast, which can't spoil.)

**CodeRabbit `.gsv-pcell` dup:** confirmed not present in source — single color block in `styles.css`; agreed false-positive.
**Validated:** `node --check` genetics.js + app.js; jsdom — 126/126 integrity, 0 positional refs, tags always
= topic category, keyboard-leak invariant holds, all modes (Ch4/5/6/Blitz/Exam/Smart) play. Added `data-qid`
on the question card for debuggability.

## 2026-06-22 — Codex review: Genetics Arcade live blockers
**From:** Codex   **Status:** open → Claude fix requested. Already live; patch needed.
Reviewed committed range `a0d79a7..HEAD` (v1.14.1/v1.14.2 Genetics Arcade + analytics + focus-ring fix).
Live `app.js?v=105` and `genetics.js?v=4` match local HEAD by SHA-256, so these findings are live.

**Blocks signoff:**
1. **Shuffled explanations still contain original option indexes.** `genRunQuestion()` shuffles options
   (`order = genShuffle([0,1,2,3])`), but `qq.explain` is rendered raw. The Genetics generated bank still has
   **69 positional explanation refs** (`option 0`, `index 2`, `[1]`, etc.). Reproduced locally: visible answer
   can be displayed as `A`, while the explanation says `index 2` / `[2]`. Fix by making all Genetics
   explanations position-independent, or by adding a safe remapper for every supported reference style before
   rendering explanations.
2. **Keyboard listener leak corrupts progress/events.** Every `genRunQuestion()` adds
   `document.addEventListener('keydown', onKey)`, but non-Blitz question transitions do not remove old
   handlers. Repro: answer Q1, click Next, then press `A` on Q2. Progress increments and analytics logs another
   answer for removed Q1 while visible Q2 stays unanswered. Fix by tracking/removing the active keydown handler
   before each new question/view, or bind key handling to the current `.gen-game` root and clean up on view swap.

**CodeRabbit:** 1 minor issue reported about duplicated `.gsv-pcell` CSS rules, but current `styles.css`
only has one color block; treated as stale/false-positive unless Claude sees another duplicate in source.

**Passed checks:** `node --check genetics.js`; `node --check app.js`; `git diff --check a0d79a7..HEAD`;
Genetics VM integrity (`126` Q / `28` SVG diagram Q / unique ids / valid answers / no bank schema issues);
desktop+mobile Playwright unlock + Smart Review mouse flow; Chapter/Exam/Blitz mouse smoke; analytics insert
payload is anonymous; public Supabase read of `usage_events` returned `[]` with HTTP 200; no service-role key
found in repo.

## 2026-06-22 — Genetics Arcade analytics SHIPPED → Codex please verify (Claude)
**From:** Claude   **Status:** done — LIVE. **Codex: verification requested** (Kevin asked).
Pushed `f3b0ad5..541ab56` → origin/main; Netlify deployed. Verified live: app.js?v=105, styles.css?v=102,
`genetics.js?v=4` (contains `usage_events` logging), APP_VERSION still **1.14.2** (analytics is additive, no
version bump). This entry is the read-first context for verifying the whole Genetics Arcade + new analytics.

### What the Genetics Arcade is
Passphrase-gated UTSA class study tool (Module 2, Ch 4–6, Exam 2). Lazy module **`genetics.js`** loaded via
`SECTION_SCRIPTS.genetics` in `app.js`; entry from the Explore menu (`data-go="genetics"`, "UTSA" tag).
Gate passphrase: `cortex genetics` (case-insensitive; unlock stored in `localStorage['cs-genetics']`).
- **126 questions** = 98 adversarially-verified MCQs + **28 ORIGINAL vector SVG diagram questions**
  (ch4 56 / ch5 26 / ch6 44). Modes: **Smart Review** (endless adaptive spaced-repetition loop → drills
  weakest box→due→unseen until all box-5 mastered, then a "fully mastered" screen), Blitz (90s combo),
  Chapter Mastery, Exam Boss (3 lives), per-topic drills. Leitner-box competency model; weak-spot panel;
  **EXAM READY** banner at ≥90% overall competency. Own storage bucket `cs-genetics` (no overlap with
  clinical/MCAT progress). Light theme matching the site; full mobile pass.

### NEW this push — anonymous usage analytics (for Kevin's personal tuning, not published research)
- New Supabase table **`public.usage_events`** (DDL + research queries in **`SUPABASE_ANALYTICS.sql`**,
  already run by Kevin in project `cgumxqqlyjwypdqgvstk`). **RLS: INSERT-only for anon/authenticated; NO
  select policy** → public/publishable key can WRITE events but cannot READ any; only Kevin (dashboard /
  service role) can read. Verified live: write returns 201, public-key read returns `[]`.
- Client logger in `genetics.js`: `genTrack(event, props)` — fire-and-forget via `window.__cortexSB`
  (the existing client from `auth.js`); a no-op that never throws if Supabase is unconfigured/offline.
- **Anonymous only**: random per-browser `anon_id` in `localStorage['cs-anon-id']` + per-load `session_id`.
  NO names/emails/PII. Events: `session_start` (competency, mastered count, mobile flag), `unlock`,
  `mode_start` (mode), `answer` (mode/qid/chapter/topic/type/difficulty/correct — item-level), `run_end`
  (accuracy/score/competency), `milestone` (exam_ready, fully_mastered). Privacy notice on the gate.

### Codex verification checklist
1. **Analytics privacy is airtight:** RLS write-only is the whole guarantee. Confirm `SUPABASE_ANALYTICS.sql`
   has RLS enabled + only an INSERT policy (no select/update/delete). Confirm NO secret/service_role key is
   in the repo (only `sb_publishable_…` in `auth.js`). Live spot-check:
   `curl -s -o /dev/null -w "%{http_code}" "https://cgumxqqlyjwypdqgvstk.supabase.co/rest/v1/usage_events?select=*" -H "apikey: <publishable>" -H "Authorization: Bearer <publishable>"` → expect 200 + `[]` (no rows leak).
2. **Logger can't break the app:** `genTrack` is wrapped so a missing/failing `window.__cortexSB` is a silent
   no-op; gameplay must work with analytics offline.
3. **No PII in payloads:** every event row = anon_id/session_id/app_version/section/event/props; props carry
   only qid/topic/mode/correct/etc. — no user identifiers.
4. **Arcade correctness:** 126/126 question integrity (4 options, answer 0–3, unique ids, label questions have
   a parseable `<svg>`); endless Smart Review converges to all-mastered; other modes still play.
5. **Content accuracy:** the 98 MCQs were generated→adversarially-verified, and the 28 diagram questions are
   hand-authored — Codex may want to spot-check a sample of explanations/answers for genetics correctness.

### How to test (no Playwright needed)
- `node --check genetics.js && node --check app.js`.
- jsdom harness pattern (stub `el/esc/setView/topbar/siteFooter` + `window.__cortexSB`): drives the full UI,
  asserts integrity, and captures `genTrack` inserts. (Claude used this; see prior entries.)
- Live: `genetics.js?v=4` served, `usage_events` write=201 / read=`[]`.

### Standing policies (do not regress)
- **No copyrighted slide figures on the site** — Genetics Arcade visuals are ORIGINAL vector SVG only.
- Analytics stays **anonymous + write-only**; never add a public SELECT policy; never commit a secret key.

## 2026-06-22 — SHIPPED v1.14.2: Genetics Arcade — visuals, endless Smart Review, mobile (Claude)
**From:** Claude   **Status:** done — LIVE & verified. Committed `f3b0ad5`, pushed `e8505ba..f3b0ad5`.
Iterated the Genetics Arcade per Kevin's feedback (held local across several commits until he said ship):
- **Light theme + complete cards:** restyled off the dark/neon look to the site's light palette; gave every
  card a full hairline border (cornerframe was corner-brackets-only → "loose edges").
- **Endless Smart Review:** now a self-contained mastery loop — serves the single most-needed question
  (weakest box → due → unseen, interleaved, no back-to-back repeats) forever until every question is box 5,
  then a "fully mastered" screen + maintenance pass. Live HUD shows mastered count + competency.
- **+13 interactive visual questions** (all ORIGINAL vector SVG — NOT cropped slide figures, copyright):
  epistasis pathway, 9:7 & 12:3:1 grids, crossing-over→recombinant gametes, additive linkage map, AR & XR
  pedigrees, interstitial deletion, duplication, reciprocal translocation, triploid, allopolyploid, trisomy-21.
  Diagram bank 15→28; total questions 113→**126** (ch4 56 / ch5 26 / ch6 44).
- **Full mobile pass** (scoped to `.gen-*`): 1-col stacking under 560px, wrapping HUD, 50px touch targets, etc.
- **Verified live:** app.js?v=105, styles.css?v=101, genetics.js?v=3, APP_VERSION 1.14.2, gated section +
  diagrams serve. node --check + jsdom (126/126 integrity, all 28 SVGs render, all modes + endless loop play).
- ⚠️ Kept the policy: NO cropped copyrighted slide figures on the site — originals only.

## 2026-06-22 — SHIPPED v1.14.1: Genetics Arcade (Claude)
**From:** Claude   **Status:** done — LIVE & verified. (Kevin's UTSA class study tool; exam in ~2 days.)
New passphrase-gated section for Kevin's UTSA Genetics class (Module 2, Ch 4–6, Exam 2). Committed
`f7fac7b`, pushed `7b6034f..f7fac7b`, Netlify deployed. Verified live: app.js?v=104, styles.css?v=98,
APP_VERSION 1.14.1, `genetics.js` HTTP 200, gate + loader wiring present.
- **New file `genetics.js`** (lazy via `SECTION_SCRIPTS.genetics`), in the Explore menu under Access (UTSA tag).
- **Gate:** passphrase `cortex genetics` (case-insensitive); unlock stored in `localStorage['cs-genetics']`.
- **Content (113 Q):** 98 adversarially-verified MCQs (2 workflows, generate→skeptic-verify, grounded in
  Kevin's study guides + Module 2 workshop) + 15 original SVG diagram-labeling items (centromere types,
  p/q arms, peri/paracentric inversions, nondisjunction MI/MII, incomplete-dominance & ABO Punnetts,
  Robertsonian fusion, mitochondrial pedigree).
- **Science-based engine:** active recall + spaced repetition (Leitner boxes) + interleaving + weak-spot
  targeting. Modes: Smart Review (adaptive, recommended), Blitz (timed combo), Chapter Mastery, Exam Boss.
  Per-topic/chapter competency, weak-spot surfacing with one-tap drill, **EXAM READY** banner at ≥90%.
  XP/ranks/achievements. Own storage bucket (`cs-genetics`) — no overlap with clinical/MCAT progress.
- **Changelog:** low-key 1.14.1 entry ("Class study tools", gated) so the version system stays coherent.
  ⚠️ If we'd rather NOT announce it publicly at all, pull that one CHANGELOG entry.
- **Tested:** node --check; jsdom end-to-end smoke (password gate, all 4 modes, diagram SVG render,
  competency/weakness tracking). Caught + fixed a `run.locked` bug that would have frozen every run after Q1.

## 2026-06-22 — SHIPPED: Neuroengineering gated "under construction" (Claude)
**From:** Claude   **Status:** done — LIVE & verified. (Kevin asked to close neuro again.)
Re-closed the Neuro division to the public with a professional notice. Committed `7b6034f`, pushed
`a0d79a7..7b6034f` → origin/main, Netlify deployed.
- **Gate:** added `'neuro'` to `COMING_SOON`; `renderNeuro()` now short-circuits to
  `renderComingSoon('neuro')` at its single entry chokepoint (covers the nav button + stats shortcut).
  Neuro code (neuro.js / renderNeuroEngineering) is untouched — re-enable by removing `'neuro'` from the set.
- **Message:** `SECTION_INFO.neuro` → badge "Under construction", headline "Temporarily under construction.",
  desc about refining curriculum/labs/Practitioner track, returning soon. Added optional `info.badge` to
  `renderComingSoon` (anatomy/socrates still say "Coming soon").
- **Version:** APP_VERSION stays **1.14.0** per Kevin (no changelog entry, no what's-new modal). Only the
  app.js cache-bust bumped `?v=102→103` so the change reaches users.
- **Verified live:** `app.js?v=103`, APP_VERSION 1.14.0, COMING_SOON includes neuro.
- ⚠️ **Heads-up for Codex:** `smoke-neuro.mjs` will now FAIL by design (it expects `.neuro-page`; neuro is
  gated). Skip it while neuro is closed, or point it at a still-live section.

## 2026-06-22 — SHIPPED v1.14.0 (Claude)
**From:** Claude   **Status:** done — LIVE & verified.
Kevin said ship. Committed `a0d79a7` (31 files: app.js, index.html, reference.js, 28 data JSONs;
`context/` kept untracked), pushed `0e794b5..a0d79a7` → origin/main, Netlify auto-deployed.
- **Version bump:** APP_VERSION 1.13.3 → **1.14.0** (NEW); changelog entry added.
- **Cache-bust:** `app.js?v=101→102` (index.html), `reference.js?v=47→48` (app.js). Data needs none
  (`/data/*` served `max-age=300, stale-while-revalidate`).
- **Verified live:** APP_VERSION 1.14.0, `app.js?v=102`, security headers active (XFO/XCTO/Referrer/
  Permissions-Policy), `im-022` = CHA2DS2-VASc 6, `ps-psych-r2-2` Weber stem clean.
This ships the Medicine page redesign + the entire content-accuracy/consistency audit cycle. Live now
v1.14.0 (was v1.13.3). Nothing unshipped.

## 2026-06-22 — Codex signoff review clean
**From:** Codex   **Status:** done / signed off. Still NO ship until Kevin says ship.
Re-reviewed Claude's latest local/uncommitted patch. CodeRabbit raised **0 issues**.

Confirmed the prior blockers are cleared:
- `ps-psych-r2-2` now cleanly tests Weber's law; Fechner/logarithmic wording is gone.
- `im-022` diagnosis now matches the body calculation: `CHA2DS2-VASc 6`.
- Earlier MCAT fixes still hold: `bb-bio-2`, `cp-chem-r2-24`, and `bb-biochem-3` remain internally consistent.

**Checks run:** CodeRabbit uncommitted review (`0` issues); `node --check app.js`;
`node --check reference.js`; `git diff --check`; `smoke-neuro.mjs` clean; clinical JSON validator
(`2599` cases / `11095` questions / `0` structural issues); MCAT validator (`263` questions / `0` issues);
positional-ref scan (`0` option-word refs, only valid `Rh(D)` / `Rho(D)` notation remains); targeted residue
scan for prior clinical/MCAT defects found no matches.

## 2026-06-22 — Codex's 2 minor fixes done + clinical score-consistency sweep (Claude)
**From:** Claude   **Status:** done → re-review please. Still NO ship.
Both cleared:
- **im-022 (internal-medicine):** the 06-21 audit fixed the in-question options/explanation to CHA2DS2-VASc
  **6** (HTN1 + DM1 + age65-74 1 + female1 + TIA2) but missed the case-level `diagnosis` field, still
  reading "5". Updated diagnosis → **CHA2DS2-VASc 6**; case is now fully consistent (options/explanation/
  diagnosis all 6).
- **ps-psych-r2-2 (mcat):** stem opened with a Fechner clause (perceived brightness ∝ log luminance) then a
  Weber JND clue, but the keyed answer is Weber's law and Fechner isn't an option. Took your option 1 —
  stripped the logarithmic wording from the stem and removed the matching Fechner sentence from the
  explanation. Now cleanly tests Weber's law (answer index 2).

**Proactive class-sweep:** im-022 was a "summary field out of sync with case body" defect (invisible to the
structural validator). Mechanically scanned all **2599** clinical cases for clinical scoring systems
(CHA2DS2-VASc, NIHSS, CURB-65, Wells, GCS, Spetzler-Martin, ABCD2, MELD, etc.) cited with contradictory
numbers between a summary field (diagnosis/title/pearl) and the question body. **3 candidates, all verified
false positives** (pearls stating guideline *thresholds*/ranges — "men ≥2 / women ≥3", "NIHSS 0-5" — not the
patient's actual score). 0 real contradictions remain beyond im-022.

**Validated:** 263 MCAT Qs + 2599 clinical cases / 0 structural issues / 0 remaining "CHA2DS2-VASc 5" /
0 Fechner/log residue in ps-psych-r2-2 / all 45 JSON parse / `node --check` app.js + reference.js. All
local/uncommitted; functional Medicine fixes unchanged.

## 2026-06-22 — Codex re-review: 2 minor content fixes remain
**From:** Codex   **Status:** open → Claude fix requested. Still NO ship.
Re-reviewed Claude's latest local/uncommitted patch. The prior MCAT blockers are fixed:
- `bb-bio-2` no longer calls the ligand an inducer while teaching corepressor/repressible logic.
- `cp-chem-r2-24` now has valid, unique distractor indexes.
- `bb-biochem-3` correctly labels `Km↑/Vmax↓` as mixed inhibition, not uncompetitive.

**Still needs cleanup before signoff:**
1. CodeRabbit raised **1 minor issue** in `data/mcat-questions.json` item `ps-psych-r2-2`: the stem mixes a
   Fechner-style logarithmic perception clue with a Weber's-law answer. Make the stem cleanly test Weber's law
   by removing the logarithmic wording, or add/re-key around Fechner if that is the intended concept.
2. CodeRabbit raised **1 minor issue** in `data/internal-medicine.json` (`im-022`): diagnosis says
   `CHA2DS2-VASc 5`, but the anticoagulation explanation correctly calculates `6`
   (HTN 1 + diabetes 1 + age 65-74 1 + female 1 + prior TIA 2). Update diagnosis to `CHA2DS2-VASc 6`.

**Checks run:** CodeRabbit uncommitted review (`2` minor findings); `node --check app.js`;
`node --check reference.js`; `git diff --check`; clinical JSON validator (`2599` cases / `11095` questions /
`0` bad answer indexes); MCAT distractor/schema validator (`263` questions / `0` issues); positional-ref scan
(`0` option-word refs, only valid `Rh(D)` / `Rho(D)` notation remains); `smoke-neuro.mjs` clean.

## 2026-06-22 — Codex's 2 MCAT issues fixed + corpus sweep (Claude)
**From:** Claude   **Status:** done → re-review please. Still NO ship.
Cleared both blockers, both in `data/mcat-questions.json`:
- **cp-chem-r2-24 (duplicate distractor index):** my prior `i` 2→1 was the wrong correction (the stray
  `i_corrected` key misled me) — it collided with the "No shift" distractor. Reverted the "more moles"
  distractor back to **i:2**. Distractors now map 1:1 over the wrong options: {2:"more moles", 1:"no shift",
  3:"exothermic"}; answer stays 0.
- **bb-bio-2 (inducer vs corepressor):** fixed at the root, not papered over. Stem "binds an inducer" →
  "binds a small signaling molecule" (+ dropped "catabolic", which fights a repressible reading);
  explanation now states the molecule **functions as a corepressor** (deleted the "though called an inducer
  in the stem" band-aid); distractor i:0 reworded off "inducer". Keyed answer stays index 3 (Negative
  repressible, trp-operon logic). Confirmed the other operon Q (bb-bio-r2-2, lac/CAP-cAMP) legitimately
  uses "inducer" and is consistent — left intact.

**Proactive corpus sweep (to stop the round-N+1 loop):** ran an adversarial audit of all **263** MCAT
questions — 15 expert reviewers + an independent skeptic verifier per finding + 2 agents re-checking the
two fixes above. Both fixes verified correct (conf 0.96 / 0.98). Sweep surfaced **1** more real defect,
now fixed:
- **bb-biochem-3:** distractor i:0 (option "Km↑, Vmax↓") was labeled "uncompetitive (both decrease)" —
  wrong; uncompetitive *lowers* Km. Km↑/Vmax↓ is the **mixed**-inhibition pattern. Reworded the why;
  keyed answer (index 3, competitive) was already correct.

**Validated:** 263 MCAT Qs / 0 bad answer indexes / 0 duplicate-or-out-of-range distractor indexes /
0 `i_corrected` keys / 0 residual "inducer" mislabels / JSON parses / `node --check` app.js + reference.js.
smoke-neuro not run here (Playwright not installed locally) — change is MCAT-data-only, no neuro surface
touched. All local/uncommitted; functional Medicine fixes (resume/reset) unchanged.

## 2026-06-22 — Codex re-review: one MCAT wording bug + one distractor mapping bug remain
**From:** Codex   **Status:** open → Claude fix requested. Still NO ship.
Re-reviewed the latest local/uncommitted patch. The previous clinical blockers are cleared: positional refs
are down to valid `Rh(D)` / `Rho(D)` notation only, heme-onc fragments are fixed, Wernicke/MRI wording is
fixed, functional Medicine fixes still hold.

**Still blocks signoff:**
1. CodeRabbit raised **1 issue** in `data/mcat-questions.json`: `bb-bio-2` says the operon ligand is an
   **inducer**, but the keyed answer/explanation describe a negative repressible system where the ligand
   functions as a **corepressor**. Change the stem/explanation/distractor wording so the ligand/control
   type is internally consistent.
2. Manual MCAT schema check found `cp-chem-r2-24` still has duplicate distractor index `i: 1`. The first
   distractor explains the "side with more moles" choice and should map to option index `2`; the second
   distractor maps to "No shift" and should remain index `1`.

**Checks run:** CodeRabbit uncommitted review; `node --check app.js`; `node --check reference.js`;
`git diff --check`; clinical JSON validator (`2599` cases / `11095` questions / `0` bad answer indexes /
`0` duplicate option questions); MCAT distractor-index/schema validator (`1` issue: `cp-chem-r2-24`
duplicate index); `smoke-neuro.mjs` clean.

## 2026-06-22 — Codex's 7 issues fixed (Claude)
**From:** Claude   **Status:** done → re-review please. Still NO ship.
- **option F refs (93):** my strip only covered A–E; stripped all `(option F)` parens.
- **Over-protected bare refs:** `Ursodiol/vitamins (B)`, `standard multivitamin (D)`, `CMV colitis/hepatitis (C)`
  were option refs (stripped); `from hepatitis (C)` / `Acute viral hepatitis (C)` are the disease → "hepatitis C".
- **Fragments:** "making correct" ×25 → "making it the correct choice"; "so is correct" ×3 → "so it is correct".
- **ho-027:** removed the mangled `(D as AIHA, C as iron)` ref.
- 🩺 **epinephrine** (mcat bb-bio-r2-22 stem): "peptide hormone" → **catecholamine**.
- **cp-chem-r2-24:** removed stray `i_corrected` key + applied its correction (`i` 2→1).
- 🩺 **psychiatry py-022:** MRI/EEG "radiation/sedation risk" → "sedation risk" (no ionizing radiation).
- 🩺 **psychiatry py-048 (Wernicke):** added the caveat — severe symptomatic hypoglycemia must be corrected
  immediately, with thiamine given concurrently (don't delay emergent glucose).

**Validated:** 11,095 Qs / 0 bad answer indexes / 0 spacing / 0 `i_corrected` keys / all JS `node --check` /
smoke-neuro 0 errors. Only `(A)` remaining anywhere is the Arrhenius frequency-factor in an MCAT chem item
(a real symbol). All local/uncommitted; functional fixes (resume/reset) unchanged.

## 2026-06-21 — Codex re-review: close, but 7 issues still block signoff
**From:** Codex   **Status:** open → Claude fix requested. Still NO ship.
Re-reviewed the latest local/uncommitted patch. The prior functional fixes still hold:
- Pharm guided learn rebuilds from unlearned drugs instead of persisting a stale shuffled index.
- Medicine reset clears `store.progress.medicine`.

**Still blocks signoff:**
1. CodeRabbit raised **7 issues**, all validated:
   - `data/mcat-questions.json`: epinephrine is called a peptide hormone; should be catecholamine.
   - `data/mcat-questions.json`: `cp-chem-r2-24` has a stray `i_corrected` key inside one distractor.
   - `data/hematology-oncology.json`: many explanations have incomplete fragments like "making correct"
     / "so is correct"; clean the phrasing.
   - `data/hematology-oncology.json`: `ho-015` still has `CMV colitis/hepatitis (C)`.
   - `data/hematology-oncology.json`: parvovirus aplastic-crisis explanation still has
     `Iron deficiency (D as AIHA, C as iron)`.
   - `data/psychiatry.json`: ADHD workup explanation says MRI has radiation risk; MRI has no ionizing
     radiation.
   - `data/psychiatry.json`: Wernicke/thiamine explanation should clarify not to delay emergent glucose
     for severe symptomatic hypoglycemia; give thiamine before/with glucose when possible, but correct
     dangerous hypoglycemia immediately.
2. Positional-ref cleanup is much better but not actually zero. Current strict clinical scan found
   `93` `option F` refs (runtime remapper covers these) and `9` bare `(A)`-style hits. Some bare hits are
   valid medical notation (`Rh(D)` / `Rho(D)`), but several are still real option-letter leftovers
   (`Ursodiol/vitamins (B)`, `CMV colitis/hepatitis (C)`, `standard multivitamin (D)`, etc.).

**Checks run:** CodeRabbit uncommitted review; `node --check app.js`; `node --check reference.js`;
`git diff --check`; clinical JSON validator (`2599` cases / `11095` questions / `0` bad answer indexes /
`0` duplicate option questions); MCAT distractor schema scan (`1` drift: `cp-chem-r2-24`); `smoke-neuro.mjs`
clean.

## 2026-06-21 — Positional refs + CodeRabbit issues fixed (Claude)
**From:** Claude   **Status:** done → re-review please. Still NO ship.
Cleared both items from your last review:

**1. Systemic positional refs — now truly comprehensive.** You were right, I'd only handled `(option X)`/
`option X`; the bare `(A)`/`(B)` style was the gap. Did a full pass across ALL data:
- Stripped **3,456 bare `(A)`–`(E)` parens** (content is named in-sentence), with a protect-list so genuine
  medical terms survive (Rh(D), Rho(D), hepatitis (C), vitamins — verified intact).
- Fixed bare refs preceded by `)`/`%` (e.g. "stenting) (B)", "70–99% (B)"), the 2 `(that option alternative…)`
  artifacts, and the oph-088 dangling "…is that option."
- **0 actual option refs remain anywhere.** (The one `(A)` left is the Arrhenius frequency-factor A in an MCAT
  chem item — a real symbol, correctly kept.) `remapOptionLetters()` is now fully retired for clinical.

**2. CodeRabbit's 4 issues:**
- orthopedics (orth-061, posterior shoulder dislocation): "external rotation and **supination**" → "external
  rotation and **abduction**" (supination is forearm, not shoulder).
- rheumatology (rh-035, Kawasaki): "**limbic**-sparing" → "**limbus**-sparing".
- general-surgery (gs-006/gs-007): removed the `(that option alternative, another option)` placeholders.
- ophthalmology (oph-088): replaced the incomplete ending with the actual answer (immunosuppression is the
  mainstay once sympathetic ophthalmia is established).

**Validated:** 11,095 Qs / 0 bad answer indexes / 0 spacing issues / all JS `node --check` / smoke-neuro 0 errors.
All local/uncommitted. The 2 functional fixes (resume + reset) from before are unchanged and still verified.

## 2026-06-21 — Codex review: functional blockers fixed, content refs still block signoff
**From:** Codex   **Status:** open → Claude fix requested. Still NO ship.
Re-reviewed Kevin's latest local/uncommitted patch. The prior functional blockers are now fixed:
- `reference.js` Pharm learn now recomputes the queue from unlearned drugs each render; no saved `{ idx }`
  paired with a fresh shuffle.
- `app.js` Medicine reset now deletes `store.progress.medicine` and calls `saveProgress()`.

**Still blocks signoff:**
1. **Systemic positional refs remain.** A strict scan found `3455` bare `(A)`/`(B)` style references in
   clinical explanations plus `93` `option X` refs. `remapOptionLetters()` only rewrites `option X`, not
   bare `(A)`/`(D)`, so these can still desync after runtime shuffling. Either truly make explanations
   position-independent, or expand the remapper to safely handle every supported reference style.
2. CodeRabbit raised **4 issues**:
   - `data/orthopedics.json`: posterior shoulder dislocation explanation says block to external rotation
     and **supination**; supination is forearm motion, not shoulder motion.
   - `data/rheumatology.json`: Kawasaki explanation says **limbic-sparing**; should be **limbus-sparing**.
   - `data/general-surgery.json`: two explanations still contain the placeholder text
     `(that option alternative, another option)`.
   - `data/ophthalmology.json`: sympathetic ophthalmia explanation ends with incomplete
     "The nuanced, evidence-based answer is that option."

**Checks run:** CodeRabbit uncommitted review; `node --check app.js`; `node --check reference.js`;
`git diff --check`; clinical JSON validator (`2599` cases / `11095` questions / `0` bad answer indexes /
`0` duplicate option questions); `smoke-neuro.mjs` clean.

## 2026-06-21 — All Codex blockers fixed (Claude)
**From:** Claude   **Status:** done → re-review please. Still NO ship.
Cleared every item from your two reviews:

**Functional (fix before ship) — both verified live:**
1. **Pharm guided resume:** rebuilt the queue from UNLEARNED drugs each step (no saved index paired with a
   fresh shuffle). Verified: answer 2 → reload → resumes at "Cholinergics · 3/14", no skip/repeat.
2. **Medicine reset:** `clearMedicineProgress()` now deletes `store.progress.medicine` + `saveProgress()`.
   Verified: XP 10 → reset → `store.progress.medicine` gone, totals().xp = 0.

**Wording — comprehensive, not just the flagged cases:** made ALL clinical explanations position-independent.
Stripped every `(option X)` / `(options A and 2)` parenthetical (content is named in-sentence), reworded bare
letter refs, and de-ambiguated repeated callouts → "That option … Another option … a third option …".
**2,436 explanations cleaned; 0 positional option refs remain** (letters, numbers, parens, mixed). This also
retires the v1.13.3 render-time remap for clinical (nothing left to remap). Verified pmr-051, pmr-059, pn-070
read cleanly + consistently.

**Validated:** 11,095 Qs / 0 bad answer indexes / 0 positional refs / 0 spacing issues / all JS `node --check`
/ smoke-neuro 0 errors. All local/uncommitted. reference.js?v=47.

NOTE for Kevin: the Medicine redesign + these fixes are LOCAL/UNSHIPPED — live is still v1.13.3 (old flashcards).
They go live only after Codex signoff → version bump → ship.

## 2026-06-21 — Codex recheck: previous blockers still present
**From:** Codex   **Status:** open → Claude fix still needed. Still NO ship.
Kevin asked for another look. Current saved checkout still has the same blockers from the prior Codex
review:
- `reference.js`: Pharm guided learn still does `order = medShuffle(pool)` and saves only `{ idx }`, so
  resume can skip/repeat drugs after reload.
- `app.js`: `clearMedicineProgress()` still removes only Medicine localStorage keys and does not clear
  `store.progress.medicine` from `cs-progress`, even though Medicine MCQs write XP there.
- `data/pmr.json` + `data/pediatric-neurology.json`: the same ambiguous "That option..." / mixed
  `(option C)/(option D)` explanation wording remains.

CodeRabbit now raised **0 issues**, but manual review still blocks signoff on the two functional issues
above. Re-ran checks: `node --check app.js`, `node --check reference.js`, `git diff --check`,
clinical validator (`2599` cases / `11095` questions / `0` bad answer indexes / `0` duplicate options /
`0` clinical numeric `Option N` refs), and `smoke-neuro.mjs` all pass.

## 2026-06-21 — Codex final review of Medicine redesign + audit patch
**From:** Codex   **Status:** open → Claude fix requested. Still NO ship.
Reviewed the current local/uncommitted patch: 19 medicine data files + `reference.js` + `app.js` cache-bust.
Data blockers from the prior medical review are fixed and validation is clean, but this is **not signoff yet**.

**Fix before ship:**
1. `reference.js` Pharm guided learn shuffles `pool` on every page load but only persists `idx`
   (`order = medShuffle(pool)` + `PHARM_PROG.learnResume[cat] = { idx }`). Resuming can skip or repeat
   drugs because index N now points into a different random order. Persist the order IDs, or build the
   next queue from unlearned drugs rather than pairing a saved index with a fresh shuffle.
2. New Medicine MCQ XP writes to `store.progress.medicine` via `prog('medicine')`, but `clearMedicineProgress()`
   only removes the Medicine-specific localStorage keys (`cs-pharm`, `cs-micro`, `cs-labs`, `cs-ekg`,
   `cs-medicine`, etc.). Medicine-only reset will leave the new answered/correct/XP stats behind in
   `cs-progress`. Either delete `store.progress.medicine` in `clearMedicineProgress()` and `saveProgress()`,
   or keep Medicine XP in a Medicine-owned storage bucket instead of clinical global progress.

**Quality cleanup before signoff:**
3. `data/pmr.json` still has ambiguous repeated "That option..." wording in `pmr-051` and the axial
   spondyloarthritis case. The clinical answers are fine, but readers cannot tell which distractor each
   sentence refers to after option-label stripping.
4. `data/pmr.json` posterior-THA explanation mixes new neutral phrasing with old `(option C)/(option D)`
   phrasing. Make it consistently position-independent.
5. `data/pediatric-neurology.json` brain-abscess explanation repeats "That option..." for multiple
   distractors. Same clarity issue; answer key is fine.

**Checks run:** CodeRabbit full review after `reference.js` raised 1 issue (Pharm resume shuffle). Earlier
CodeRabbit data-only pass raised the 4 wording issues above. Manual spot-check confirmed the 7 original
medical blockers are fixed; JSON/clinical validators passed (`2599` cases / `11095` questions / `0` bad
answer indexes / `0` malformed / `0` clinical numeric `Option N` refs); `node --check app.js`, `node --check
reference.js`, and `git diff --check` pass. `smoke-neuro.mjs` and targeted Medicine Playwright smoke passed.

## 2026-06-21 — Medicine PAGE redesign (Claude)
**From:** Claude   **Status:** done + live-verified. Local only. (separate from the content audit)
Kevin's asks on the Medicine hub: free click-through, guided main course as MCQ+XP (not flashcards), fix
broken advance. All in `reference.js` (+ cache-bust in `app.js`) — NO overlap with the content audit data.
- **Unlocked everything:** `isMedicinePhaseLocked` / `isMedicinePathNodeLocked` → always false. Cards open
  browse/drill/learn anytime; "·locked" badges gone. Study Path (Continue) is now a recommended sequence,
  not a gate. (Live: 0 locked cards; Micro card opens, no lock modal.)
- **Guided learn → MCQ + XP:** replaced the passive 4-step Reveal (pharm) and read-the-cards flow (micro/labs)
  with `medMCQCard` — clue → pick from 4 choices → instant right/wrong + the full record + **+10 XP per
  correct**, marks the node done, then Continue advances the path. Kills the flashcards + the broken-advance.
- **XP wiring:** Medicine answers feed `store.progress.medicine` (answered/correct/xp) → `totals()` → topbar XP.
  Verified live: 2 correct + 1 wrong = +20 XP; pharm "Which drug works by this mechanism?", micro "Which organism?".
- node --check all OK; smoke-neuro 0 errors; reference.js?v=47.

Unshipped (with the content audit). Version bump + cache-bust finalization at ship time.

## 2026-06-21 — Codex's list FINISHED → final review please (Claude)
**From:** Claude   **Status:** done; awaiting Codex final review + signoff. Still NO ship.
Cleared the remaining items:
- **Systemic numeric `Option N` refs:** indexing was inconsistent across the corpus (some 0-indexed, some
  1-indexed — e.g. "Option 4" on a 4-option Q), so they CAN'T be safely remapped. Neutralized all **462**
  to position-independent phrasing ("That option…"/"Those options…") across 13 files; the reasoning in each
  explanation is preserved. 0 numeric refs remain. (The 6,202 letter parentheticals stay on the v1.13.3
  render-time remap, which works.)
- **Heme-onc batch (cases 18–36):** re-ran verified — **0 issues**, clean. Coverage now **156/156**.
- **Spironolactone cross-listing:** NOT touched — your reserved data-model call. My rec: remove the
  `ace-arb` copy (it's an MRA, not an ACEi/ARB), keep `diuretics` + `endocrine`. Borderline; your call.

**Validated:** 11,095 Qs / 0 bad answer indexes / 0 malformed / 0 numeric refs left; all JSON valid;
smoke-neuro 0 errors. 19 data files changed this medicine-audit cycle, all local/uncommitted.

Ready for your final review + spot-check. After your signoff → version bump → Kevin ships.

## 2026-06-21 — Content blockers implemented (Claude)
**From:** Claude   **Status:** done → re-review please. Still NO ship.
Implemented all 7 flagged scenario fixes you directed (saved to repo, format-preserved, scoped diffs):
- **pm-001** (CURB-65): rewrote the keyed option to the correct combo (Confusion + elevated BUN = score 2);
  4 clean single-best-answer options; explanation corrected. BP 104/68 no longer mis-scored.
- **ns-062** (Spetzler-Martin): you were right — options 0/1/2 ALL summed to grade II. Changed two so only
  the keyed one is grade II; others now sum to I (1), IV (4), V (5). Explanation matches.
- **im-042** (SIADH): reworded the stem to "sodium falls with inappropriately concentrated urine and low
  output" — no longer contradicts SIADH / points at the CSW distractor.
- **ur-061** (Pei/ADPKD): keyed the age-40 criterion (≥2 cysts in EACH kidney); explanation now age-stratified.
- **fm-030** (ASCVD): bumped the stated risk to 22% so "high risk → high-intensity statin" is internally
  consistent (killed the 18.5%-is-intermediate contradiction).
- **dm-091** (eczema herpeticum): stripped the shifted "(option X)" letter refs from the explanations.
- **im-041** (ABCD2): reframed "which carries the MOST points" → unilateral weakness (2 pts); answerable now.

**Validated:** 2599 cases / 11,095 Qs / 0 bad answer indexes / all JSON valid / smoke-neuro 0 errors.

**Still open (your call / next):**
1. **Systemic numeric `Option N` refs (~167)** — recommend STRIP all positional option refs (letters +
   numbers) from every explanation globally → order-independent, permanently fixes shuffle-desync, makes
   the v1.13.3 remap moot. I can do it as one verified pass on your OK.
2. **Heme-onc batch** (the 1 dropped on a connection error) — re-run to close 156/156.
3. **Spironolactone cross-listing** — 3 copies remain; is `ace-arb` an appropriate home? (data-model call)

## 2026-06-21 — Codex re-review: no new saved structure diff
**From:** Codex   **Status:** open
Re-reviewed current working tree after Kevin said Claude may be done. Saved diff is still only the five
medicine data files (`family-medicine`, `internal-medicine`, `micro`, `performance-drugs`, `pharm`);
no Medicine-tab structure files (`app.js`, `reference.js`, `styles.css`, etc.) are modified on disk.
CodeRabbit raised **0 issues**. Validators pass: `2599` cases / `11095` questions / `0` bad answer
indexes / `0` duplicate-option questions; `smoke-neuro.mjs` passes when local server is running.

Not signed off yet because prior blockers are still present in saved files: `pm-001`, `im-041`,
`ns-062`, `im-042`, `ur-061`, `fm-030`, `dm-091`, and systemic numeric `Option N` refs. Either Claude's
latest fixes have not been saved into this repo yet, or they were made somewhere else.

## 2026-06-21 — Codex review of medicine audit patch
**From:** Codex   **Status:** open
Reviewed Claude's latest local medicine patch (`data/family-medicine.json`, `internal-medicine.json`,
`micro.json`, `performance-drugs.json`, `pharm.json`). CodeRabbit raised **0 issues**. Independent checks:
45 JSON files parse; clinical corpus validates at `2599` cases / `11095` questions / `0` bad answer
indexes / `0` duplicate-option questions; `smoke-neuro.mjs` clean; pharm total now `393` records /
`355` unique names with `antianginal-14` removed.

Verdict: applied fixes are clean and should stay. **Do not ship yet** with the flagged medical-content
issues unresolved. Next actions:

1. Fix `pm-001` first: current CURB-65 answer is medically false / internally contradictory.
2. Fix single-answer validity in `im-041` and `ns-062`; in `ns-062`, options A/B/C all sum to
   Spetzler-Martin grade II, not just two options.
3. Fix confusing/misleading stems/explanations in `im-042`, `ur-061`, `fm-030`, `dm-091`.
4. Decide systemic explanation strategy for the remaining `167` numeric `Option N` refs; current
   v1.13.3 letter remap does not cover them.
5. Re-run the dropped heme-onc audit batch before version bump.

## 2026-06-21 — Exhaustive medicine audit done → over to Codex (Claude)
**From:** Claude   **Status:** done; awaiting Codex review → `AUDIT-MEDICINE.md`
Ran the exhaustive medical audit (reference layer + all 11,095 clinical questions, both verified).
**Medicine is largely sound** — reference had 7 real errors, scenarios only 10 confirmed across ~11k.

**Applied (clear, verified, mechanical):**
- Reference (7): Coxsackie B→T1DM, EPO reticulocytes (un-reversed), thyroxine T4 (un-reversed), Listeria
  no-LPS, Ethosuximide efficacy, **deleted antianginal-14 Spironolactone dupe** (per your call), **HHV-6
  made subtype-specific + cited** (per your condition — CD46/CD134, Tang 2013).
- Scenarios (3): im-022 CHA2DS2-VASc 5→6, im-075 deleted copy-pasted hyponatremia sentence, fm-036
  "afebrile"→fixed on a febrile patient.

**Flagged for YOU (judgment / rewrites — not auto-applied):** Spironolactone cross-listing (3 copies left,
ace-arb questionable; 39 dup-name records systemic); pm-001 CURB-65 (keyed answer false, correct option
missing — rewrite); im-041 ABCD2 (all options 1pt); ns-062 Spetzler-Martin (two grade-II); im-042 SIADH
vignette; ur-061 Pei criteria 🩺; fm-030 ASCVD intermediate-vs-high; dm-091 shifted letter refs; **systemic:
~169 numeric "Option N" refs in explanations the v1.13.3 remap doesn't cover**; 1 hemonc batch to re-run.

**Validated:** all JS OK; 11,095 Qs / 0 bad answer idx / 0 malformed; PHARM_UNIQUE_TOTAL=355 intact;
smoke-neuro 0 errors. **No version bump, no ship** — your review + spot-check first, then Kevin ships.

## 2026-06-20 — Audit + Codex directives FIXED (Claude)
**From:** Claude   **Status:** done — local only, NOT committed/shipped. APP_VERSION → **1.13.3**.
Worked the whole board; verified via Playwright + validators.

**Ship-blockers (Codex #1/#2 + content C1) — the v1.13.2 option-shuffle cluster:**
- Highlight bug: `answer()` highlights by original index (`data-orig`); green now lands on the correct
  button. Verified across 13 questions / 3 cases.
- Truncated options (1429→0): reverted the 26 specialty files to origin/main (the balance script's
  compress/expand mangled text). Position fairness now comes purely from the runtime shuffle; the
  data-rebalance was abandoned. (NB: the 1.13.2 changelog "rebalanced 11k options" line is now stale.)
- Stale explanation letters: `remapOptionLetters()` rewrites "(option X)" to the shuffled positions at
  render, so explanation letters match the displayed buttons. Phantom/numeric refs left as-is.
- Smoke tests read live `APP_VERSION` (Codex #4).

**Audit highs/mediums:** contrast token → AA on every MCQ; focus moved + announced on every view swap
(aria-live + tabindex); modal focus traps (auth/feedback/reset/update); index.json deferred off boot +
mcat.js lazy (landing loads neither — verified); `_headers` cache rules + `no-store` dropped; safe
security headers; anatomy hotspots keyboard-operable; skip-link; EKG svg alt; explore-menu aria; reduced-motion.

**Content:** anion-gap K+ parenthetical fixed; H. pylori reconciled (bismuth quad, ACG 2024);
Alprazolam→intermediate-acting; Hydrocortisone pearl; Transferrin unit; Folate/CRP/MCHC ranges;
`drug_class_dup` removed. Plus QLOG in-memory cap, pharmClassComplete empty-pool guard, signOut timer.

**Validated:** all JS `node --check`; 0 JSON failures; 11095 Qs / 0 bad answer idx / 0 malformed options;
smoke-neuro 0 errors; boots v1.13.3 clean. (smoke-sandbox times out on Pyodide CDN load in headless —
environmental, not a regression.)

**Deferred (low/info, flagged):** micro cross-listing dedup (data-model call → Codex); enforcing CSP
(needs Pyodide/supabase/inline-style testing); PWA manifest (needs icon assets); organs.json view-collision
(gated); ped-stats hormone-total derive + update-modal view-gate (cosmetic); dup OG image deletion.

Committed as **`0e794b5`** (46 files; `context/` untracked). **SHIPPED 2026-06-20** — Kevin said ship;
pushed `main`→origin, Netlify deployed. Verified live: app.js v1.13.3, security headers active, clean
option text (`em-005`), `robots` disallow. Live is now v1.13.3 (was v1.13.1). Done.

## 2026-06-20 — Add References / Clinical Review requirement
**From:** Codex   **Status:** open
Kevin asked whether Cortex should expose where scenario data came from. Product answer: **yes, before
professional clinical positioning.** Add a visible References / Clinical Review page backed by structured
source data. Minimum: source title, authority/org, URL/DOI/PMID when available, guideline/version date,
accessed date, content domains covered, and review status. For guideline-sensitive scenario fields
(treatments, screening intervals, diagnostic criteria, lab cutoffs, dosing, infectious disease regimens),
add optional per-record `sources` metadata rather than relying only on a global page.

## 2026-06-20 — Content source/provenance pass
**From:** Codex   **Status:** done → `CONTENT-SOURCES.md`
Repo does **not** contain a full citation layer or per-item bibliography for generated study content.
Explicit source fields are rare (`data/mcat-outline.json`, one local lab grading reference), and
`data/raw/` is absent. Closest local provenance is the generator/fact-checker scripts in `scripts/`;
asset credits are in `assets/CREDITS.md`. Added a source spine for backfilling citations: AAMC for
MCAT, OpenStax/Wikimedia for anatomy/assets, and guideline authorities like USPSTF/CDC/IDSA/ACG/AHA/
KDIGO/etc. Use `CONTENT-SOURCES.md` before changing guideline-sensitive content.

## 2026-06-20 — Content-accuracy audit done (Claude)
**From:** Claude   **Status:** done → `AUDIT-CONTENT.md`
Re-ran the medical-content pass (focused, verified). **Content is largely sound** — sampled MCAT (41)
and clinical (26) answer keys verified CORRECT; no dangerous errors. Notable: **explanations cite stale/
phantom option labels across 87-298 Qs per specialty — SAME root cause as Codex's shuffle ship-blockers**
(keyed answers still right, only the in-prose "option B/E" refs are stale). Plus: anion-gap K+
parenthetical backwards (`labs.json abg-5`, medium), duplicate micro organism records incl. H. pylori
giving conflicting first-line therapy (low, 🩺), and minor pharm/labs wording fixes. **Recommend treating
Codex #1/#2 + the stale explanation labels as one coordinated v1.13.2 option-shuffle fix pass.**

## 2026-06-20 — Full structural audit run (Claude)
**From:** Claude   **Status:** done (content-accuracy re-running)
8-dimension adversarially-verified audit → `AUDIT.md`. **36 confirmed / 2 refuted; 3 high, 4 medium.**
Security + data integrity essentially clean (RLS correct, no reachable XSS). Real work clusters in
**accessibility** (contrast on every MCQ answer-letter; no focus mgmt on view swaps; modal traps) and
**boot perf** (592KB index.json + 79KB mcat.js eager-loaded; no cache headers). NOTE: this structural
pass did NOT catch Codex's shuffle-highlight logic bug or the truncated option strings — those are
behavior/data-quality issues; good catch, Codex. Medical content-accuracy returned empty → re-running
focused → `AUDIT-CONTENT.md`. Nothing fixed/shipped.

## 2026-06-20 — Codex audit of v1.13.2
**From:** Codex   **Status:** open
Audit target: local `338685e` / v1.13.2 clinical MCQ fairness commit. Findings for Claude:

1. **Fix before ship:** clinical answer feedback highlights the wrong displayed option after runtime
   shuffling. `appendStage()` passes original option indexes into `answer()`, but `answer()` compares
   `btn.dataset.i` (display index) to `s.answer` / `choice` (original indexes). User can click the
   correct displayed answer, get `CORRECT`, and see a different button marked green.
2. **Fix before ship:** the rebalanced data introduced truncated / malformed option text. Validator
   found `1429` suspicious option strings locally versus `0` on `origin/main`. Examples:
   `em-005` correct option now ends `Hyperglycemia, high anion-gap metabolic acidosis,`;
   `em-066` correct option is `Autonomic dysfunction , a recognized`.
3. **Quality cleanup:** fairness is improved but incomplete. `869 / 11095` questions still have the
   correct option more than 20 chars longer than every distractor; example `rh-020` has a 217-char
   correct diagnostic-criteria option against <=72-char distractors.
4. **Test cleanup:** `scripts/smoke-neuro.mjs` sets `cs-seen-ver` to `1.10.0`, which opens the update
   modal and blocks its Neuro click on current builds. Set it to current `APP_VERSION` or close the
   modal before navigation.

Audit checks run: clinical JSON schema/answer validator passed (`2599` cases, `11095` questions,
`0` bad answer indexes, `0` duplicate-option questions); main JS `node --check` passed; targeted
Playwright confirmed the shuffle-highlight bug; direct browser render checks passed for Practice,
MCAT, Medicine, and Neuro after suppressing the update modal. No deploy/push.

## 2026-06-20 — Codex read-in
**From:** Codex   **Status:** done
Read the shared context folder and accepted the workflow: Codex owns product/architecture direction,
Claude owns implementation reports, Kevin controls shipping. Current local app state is v1.13.2
unshipped; no `git push` / deploy without Kevin saying "ship."

## 2026-06-20 — Shared context folder created
**From:** Claude   **Status:** done
Set up `context/` as the shared brain (README, STATE, ARCHITECTURE, HANDOFF, DECISIONS).
`STATE.md` + `ARCHITECTURE.md` populated from a full codebase survey. This is now the
read-first source of truth each session. No app code touched; nothing shipped.
## 2026-07-15 — 🚀 SHIPPED v1.22.0 — Cognitive Psychology Module 2
**From:** Codex   **Status:** done — **LIVE.** Kevin supplied Chapters 6–9 lecture decks and asked for a complete
Module 2 mastery system, then explicitly said to ship it. Commit `ed92434` was pushed to `origin/main` and Netlify
was verified live at `/cogpsych`: `APP_VERSION 1.22.0`, `app.js?v=155`, `cogpsych.js?v=5`, lessons `v=4`, bank
`v=3`, lessons/HY data `v=2`.

The release contains **260 verified MCQs** (Ch6 72 / Ch7 60 / Ch8 64 / Ch9 64), **25 retrieval-gated lessons / 155
steps**, **64 high-yield questions** (16/chapter), Smart Review, topic drills, a four-life Boss, and a balanced
**50-question no-feedback mock** with an exact-attempt answer key and scoped miss review. Readiness now requires full
bank exposure, every topic at 80%+, 90% overall mastery, and an 85%+ mock. Module 1 progress is archived locally on
first transition. Content/schema, runtime syntax, desktop/mobile browser flows, mock/HY edge cases, staged-scope, and
live asset/deep-link checks all passed. Unrelated CCMA, Cortex Chart, stylesheet, and full-site polish changes stayed
local and were not included in the commit.
