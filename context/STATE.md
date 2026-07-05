# STATE — Cortex Medical Academy

**Read this first.** Where the project actually is right now. Update it whenever something ships,
lands, or changes. Last verified: **2026-07-03**.

## VERSIONS (verified against live + git)

| Where | Version | Notes |
|---|---|---|
| **Live** (cortexmedical.academy) | **v1.18.0** | ✅ shipped 2026-07-03, verified live (`app.js?v=134`, `genetics.js?v=24`, `APP_VERSION 1.18.0`) |
| `origin/main` | **v1.18.0** | `448b34a`, synced |
| **Local `HEAD`** | **v1.18.0** | synced — 0 ahead / 0 behind origin |

> **v1.18.0 — Shareable section deep-links.** SPA lived only at `/`, so `/genetics` 404'd. Added a Netlify
> SPA catch-all (`/*  /index.html  200` in `_redirects`, kept **last** so real assets still serve) + a small
> client router in `app.js`: inbound path → open the matching section on boot (`routeFromUrl`/`sectionFromPath`/
> `openSection`), and a delegated `[data-go]` click handler that `pushState`-syncs the URL so the current
> section is always a copy-able link; back/forward via `popstate`. Route map `SEC_PATHS`: genetics, mcat, stats,
> utsa, neuro, `/medicine`→reference. Verified end-to-end live: `cortexmedical.academy/genetics` → 200, router
> opens the genetics view (lands on `gen-lock` passphrase for new visitors). Cache-bust `app.js?v=134`.
> **Open:** does the shared `/genetics` link keep the `genetics` passphrase gate, or open straight in? (pending Kevin)

> **Post-v1.17.1 fixes (folded into v1.18.0 cache-busts):** (1) genetics UI says **"level"** not "rank"
> (`genetics.js?v=23`). (2) Purged Ch7-9 leftovers from the Ch10-12 home — Chapter-mastery meters were
> `meter(7/8/9)` (rendered "Ch 7 · undefined"), Exam Boss said "Ch 7-9", and 3 achievements pointed at old
> topics; now Ch 10/11/12 + achievements repointed to Transcription/Genetic Code/lac Operon (`genetics.js?v=24`).

> **v1.17.1 — Genetics progress resets fresh on module swap.** XP/rank/mastery/streak/achievements were
> carrying across the Module 2→3 swap (all genetics progress lives under one `localStorage['cs-genetics']`
> key). Fix: stamp progress with `GEN_MODULE` (`'m3-ch10-12'`); on load, if the stored tag ≠ current, wipe
> all progress fields to fresh defaults (keep only `unlocked` so no re-passphrase) and persist. One-time
> migration, future-proof for the next swap. Verified: planted stale `xp=8200` → loaded genetics → `xp=0`,
> rank `Wild-Type`, achievements cleared, still unlocked. Cache-bust `app.js?v=131`, `genetics.js?v=22`.

> **v1.17.0 — Genetics Module 3 (Ch10-12) relaunch.** From Kevin's 486-pg packet: **303 verified MCQs**
> (RNA/transcription, translation, gene regulation) via convert→adversarial-verify workflow; 19-topic taxonomy;
> **11 interactive textbook-quality SVG figures** (`genetics-figs.js`, `GEN_FIGS` registry — lac/trp operon,
> transcription unit, ribosome A/P/E, processing, tRNA, codon, alt-splice, eukreg, RNAi) mounted above the 93
> diagram questions via a `fig` field; **Smart Review in-session requeue** (miss → back within 2-3 with hint).
> Genetics un-gated; old Module-2 generators cleared; Learn shows "coming soon" (Ch10-12 lessons deferred).
> Passphrase `genetics`. Cache-bust `app.js?v=130`, `styles.css?v=113`, `genetics.js?v=21`,
> `genetics-learn.js?v=6`, `genetics-figs.js?v=1`, `data/genetics-bank.json?v=3`. Build artifacts in
> `context/m3-build/`.

> **v1.16.5 — Whole-site polish + Genetics retired.** Fixed undefined `--muted` CSS var (Medicine labels
> rendered dark → `--dim` grey); smoothed `.card` hover; copy/consistency (arrows, apostrophes, neuro error
> label). **Footers on every view** via a `setView()` inject. MCAT "Science Passages"→"Passage Lab"; neuro
> "NeuroSim Labs"→"NeuroSim Lab". **Genetics gated** (exam term ended) → `COMING_SOON` + "between modules"
> screen; genetics code/data retained for the next module (un-gate + swap when Kevin provides it). Bundled the
> Codex 06-28 fixes (auth cross-tab dirty-token, nucleosome H1 answer). Cache-bust `app.js?v=126`,
> `styles.css?v=111`, `auth.js?v=8`, `mcat.js?v=55`, `neuro.js?v=14`, `genetics-learn.js?v=5`, `reference.js?v=49`.

> **v1.16.4 — Account sync data-loss fix.** `pushCloud()` clears the `cs-sync-dirty` flag only after a
> confirmed successful upload (+ `writeSeq` mid-flight guard), so a reload-time flush can't let a stale cloud
> blob overwrite fresh local progress (e.g. a Smart Review run). `auth.js?v=7`. Verified by node --check + logic
> sim; awaiting Kevin's signed-in real-account confirmation.

> **v1.16.3 — Learn option-tell rebalance.** Every Learn lesson's MC options rebalanced so the correct answer
> is never the longest (was 81%) + answer positions shuffled ([21,19,3,0]→[8,12,8,15]); correctness preserved
> via guarded re-serialize. `genetics-learn.js?v=4`. (Shipped together with v1.16.4.)

> **v1.16.2 — Genetics Learn answer-feedback fix.** `ask`-with-choices Learn steps now show a
> "Correct." / "Not quite." verdict on answer (green/red), mirroring `checkpoint`. Cache-bust
> `genetics-learn.js?v=3`, `styles.css?v=110`, `app.js?v=122`; FIX changelog entry. Verified live.

> **v1.16.1 — +192 Ch7-9 genetics MCQs (from Kevin's flashcard bank).** Converted a 192-card flashcard
> bank into schema-valid MCQs and merged into `data/genetics-bank.json` (**166 → 358**; live `GEN_BANK` 361).
> Built via fan-out convert + independent adversarial verify; deterministic post-processing (collision-free
> `wb*` ids, seeded option shuffle). 12 computational items typed `calc` (scratchpad renders). All stems made
> self-contained; `wb8c-12` 30nm framed as classic textbook model. Cache-bust `app.js?v=121`,
> `data/genetics-bank.json?v=2` (genetics.js?v=18, genetics-learn.js?v=2 unchanged). **Codex re-reviewed —
> 3 content blockers cleared + `.claude/` gitignored before ship.**

> **v1.15.0 — Genetics Module 3 (Ch 7-9) + Socratic Learn mode.** Full Module 3 lesson coverage,
> 166-row genetics bank (Ch7 74 / Ch8 43 / Ch9 49, 20 topics), Exam Boss now samples dynamically from
> live chapters, wrong-first-answer mastery fix, lazy-script-load cache fix, and a hardened bank validator
> (`genValidBankItem()` rejects unsupported topics + built-in id collisions; `genLoadBank()` seeds `seen`
> from `GEN_DIAGRAMS.concat(GEN_GENERATORS)`). Cache-bust `genetics.js?v=17`, `genetics-learn.js?v=2`,
> `app.js?v=119`, `data/genetics-bank.json?v=1`. **Codex signed off — CodeRabbit 0 issues on `71e54a6..HEAD`.**
> (Older commits labeled "NOT shipped" in git log were unshipped *at commit time*; the chain is now pushed & live.)

> Within v1.14.2 (all live, no version bump): `541ab56` Genetics Arcade anonymous analytics
> (`usage_events`, write-only RLS; `genetics.js?v=4`); `5a3f3e6` fixed the blue browser focus ring on
> view-swap headings (`[tabindex="-1"]:focus{outline:none}`; `styles.css?v=103`). Codex verification of the
> arcade + analytics requested — see HANDOFF top entry.

> `f3b0ad5` (2026-06-22) — **Genetics Arcade v1.14.2**: light-theme cards w/ full borders; **endless
> Smart Review** (adaptive spaced-repetition loop → drills weakest until all mastered); **+13 original
> SVG diagram questions** (epistasis pathway, ratio grids, crossing-over, linkage map, AR/XR pedigrees,
> deletion/dup/reciprocal translocation, ploidy, trisomy karyotype) → bank 113→**126**; full **mobile**
> pass. Cache-bust `app.js?v=105`, `styles.css?v=101`, `genetics.js?v=3`.
> Prior: `f7fac7b` = v1.14.1 Genetics Arcade launch (gated, 113 Q); `7b6034f` gated Neuroengineering;
> `a0d79a7` = v1.14.0 Medicine.

> **Note:** Genetics Arcade content is ORIGINAL (verified MCQs + original vector diagrams). We deliberately
> do NOT host cropped lecture-slide figures (copyright). Keep it that way.

- **Branch:** `main` · **Working tree:** clean, fully pushed. `context/` stays untracked (dev-only).
- **Shipped 2026-06-22:** `a0d79a7` (v1.14.0) — Medicine page redesign (unlock-all + flashcards→MCQ/XP +
  advance-stall fix; Pharm resume rebuild; Medicine reset clears `store.progress.medicine`) + the full
  content-accuracy/consistency overhaul (position-independent explanations; CodeRabbit + audit fixes across
  clinical + MCAT). Cache-bust `app.js?v=102`, `reference.js?v=48`. Verified live: APP_VERSION 1.14.0,
  app.js?v=102, security headers active, `im-022` = CHA2DS2-VASc 6, `ps-psych-r2-2` Weber stem clean.
  Codex signed off (CodeRabbit 0 issues) before ship. Nothing unshipped now.
- **Shipped 2026-06-20:** `0e794b5` (v1.13.3) — fixed the v1.13.2 shuffle highlight/truncation bugs +
  audit highs/mediums + content accuracy. v1.13.2 (`338685e`) went live in the same push.
- **Ship rule:** nothing goes live until Kevin says **"ship."** When he does → `git push` origin/main,
  Netlify auto-deploys, then verify live `app.js` shows the new version.

## RECENT TRAJECTORY

`v1.9.0` neuro Foundations + Practitioner roadmap → `v1.10.0` Practitioner M1 (Neural Signal Viewer)
→ `v1.12.0` Performance-drugs course + phased PED hub → `v1.13.0` Medicine tab (unified progress,
guided study, drill persistence; + crash/load fixes) → `v1.13.1` unified 81-step Medicine path
→ `v1.13.2` fairer clinical MCQs → `v1.13.3` shuffle/a11y/perf/content fixes
→ `v1.14.0` Medicine open-access + MCQ/XP guided study + content-accuracy overhaul
→ `v1.14.1/.2` Genetics Arcade launch + endless Smart Review + 126-Q bank
→ `v1.15.0` Genetics Module 3 (Ch 7-9) + Socratic Learn mode + hardened bank validator
→ `v1.16.1` +192 Ch7-9 genetics MCQs from Kevin's flashcard bank (bank 166→358)
→ `v1.16.2` Learn Correct/Not-quite verdict → `v1.16.3` Learn option-tell rebalance
→ `v1.16.4` account-sync data-loss fix (Smart Review progress persists)
→ `v1.16.5` whole-site polish + footers everywhere + Genetics retired (between modules)
→ `v1.17.0` Genetics Module 3 (Ch10-12): 303 MCQs + 11 interactive figures + Quizlet requeue
→ `v1.17.1` Genetics progress resets fresh on module swap + "rank"→"level" + Ch7-9 home leftovers purged
→ **`v1.18.0`** Shareable section deep-links (`/genetics`, `/mcat`, …) via SPA fallback + client router *(live)*.

## IN FLIGHT

**v1.19.0 — Focus Timer study list — BUILT & VERIFIED, awaiting Kevin's "ship" (committed locally `5f3931e`, not pushed).**
Whiteboard-style study queue on the pomodoro page (`pomodoro.js`): add subjects, click to cross off, topmost-unfinished
highlighted as "studying now", and a focus-round completion shows a green "cross it off & switch it up" nudge (gated on
having an undone task) — an anti-hyperfocus swap loop for Kevin's ADHD/ASD. `pomo.tasks[]`/`pomo.swapDue` persist in
`localStorage['cs-pomo']`; the list survives the End-session totals reset. Focus presets 25/35/50 → **15/25/45**; custom
length redesigned (labeled "Custom", underlined input, inverts when active). Cache-bust `pomodoro.js?v=5`, `styles.css?v=114`,
`app.js?v=135`. Verified in preview desktop+mobile: add via form, cross-off auto-promotes next, delete, clear-finished,
custom→active, swap-banner lifecycle (hidden w/ no tasks, shown w/ task, hides on cross-off), 0 console errors.
→ On "ship": `git push origin main`, then verify live `APP_VERSION 1.19.0` + `pomodoro.js?v=5`.

_Previously:_ v1.18.0 (deep-links) + v1.17.x shipped & verified live 2026-07-03. **Open follow-ups:**
- **Genetics Module 3 Socratic Learn lessons** — deferred per Kevin ("bank + diagrams first"). Learn currently
  shows a graceful "coming soon" empty state for Ch10-12. Build teach-lessons (like the old ch7-9 ones, in
  `genetics-learn.js` `GEN_LESSONS` with `chapter: 10/11/12`) when Kevin prioritizes; they auto-appear once
  their chapter matches `GEN_CH`. Reuse the `GEN_FIGS` figures as lesson diagrams.
- Kevin to confirm on his signed-in account that Smart Review progress survives a reload (sync fix never
  browser-E2E-tested without a real session).

## OPEN WATCH-ITEMS (not bugs — context to carry)

- **Built but hidden:** Anatomy explorer, Learn-to-Learn (Socratic), **and Neuroengineering** are
  fully implemented but gated behind `COMING_SOON` in `app.js`. Flip the gate (remove the key) when
  Kevin/Codex want them public. Neuro was re-gated 2026-06-22 — `smoke-neuro.mjs` fails by design while closed.
- **Practitioner Track is 1/6 live:** only Milestone 1 (Neural Signal Viewer) has render code;
  M2–M6 are `planned` placeholders. The expert-training rail is the long arc here.
- **Cache-bust discipline:** bump `?v=N` in `app.js` for any lazy module you edit, or users get stale JS.
- **Shared-global fragility:** `PHARM_UNIQUE_TOTAL` (app.js → reference.js) has bitten before — don't
  redeclare cross-file globals.
- **Stale dist bundle:** `~/Documents/cortex-dist*` is a Jun-16 snapshot — never deploy from it.

## THE NORTH STAR (why this exists)

Two parallel goals, both real: (1) a course that **actually trains people** in neuroengineering / BCI,
and (2) Kevin's own path to **Neuralink** (or equivalent). Foundations = the public course;
Practitioner Track = the expert-training rail. Build the course and live the path at once.

> Full architecture in `ARCHITECTURE.md` · decisions in `DECISIONS.md` · directives in `HANDOFF.md`.
