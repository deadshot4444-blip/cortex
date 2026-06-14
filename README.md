# Cortex

Browser-based study suite for pre-meds, med students, and residents — inspired by Neural Consult. **26 specialties,
~100 detailed multi-step multiple-choice clinical cases each (~2,600 total)**, plus an
Anatomy atlas and the full MCAT PRIME prep suite. No accounts, no backend, fully
offline — progress lives in localStorage (per device).

## Run it

Double-click `start.command` (serves on http://localhost:8765 and opens your browser).

Or manually:

```sh
cd clinical-scenarios
python3 -m http.server 8765
```

## How it works

Three tabs: **Practice**, **Review**, **Stats**.

**Practice**
- Choose a **Difficulty** (All / Easy / Medium / Hard) and **Mode** (No timer / Timer — 90 s per
  question, whole-case countdown).
- Click a specialty for a random unseen case, or hit **Mixed** for a random case across all 12.
- Each case: chief complaint → history → vitals → exam, then step-through stages — multiple-choice
  questions with full explanations, interleaved with labs/imaging reveals — ending in score,
  final diagnosis, and pearls.
- **Bookmark** a case with the ☆ Save button (top bar or summary).
- Keyboard: `A–E` / `1–5` answer, `Enter` continue, `B` bookmark, `Esc` exit.
- Per-specialty **Rank 1–100** (XP bar) on each card. First completion of a case awards XP;
  replays don't (no farming).

**Review** — four tabs:
- **History** — your recent completed cases with scores.
- **Missed** — cases where your last attempt wasn't perfect; click to retry.
- **Bookmarks** — everything you saved.
- **Search** — full-bank search by symptom, diagnosis, or specialty (uses `data/index.json`).

**Stats** — cases done, overall accuracy, daily streak (current + best), total XP, a 21-day
activity strip, strongest/needs-work callouts, and a per-specialty breakdown.

"Reset progress" (Practice footer) clears progress, stats, streak, and bookmarks.

## Anatomy

The **Anatomy** tab is a labeling game over two systems:
- **Skeletal** — Full skeleton, Skull, Spine, Thorax, Hand, Foot.
- **Muscular** — Muscles front, Muscles back (superficial muscles).

Pick a system + region, then a mode:
- **Explore** — hover or click any structure for its name, Latin term, and a clinical pearl.
- **Find it** — named structure → click it on the figure.
- **Name it** — highlighted structure → pick from four choices.

Per-region **best scores** show on each card, and any round counts toward your daily streak.
Facts live in `data/bones.json` (66 bones) and `data/muscles.json` (38 muscles), both
AI-generated then fact-checked. Geometry/clickable
hotspots live in `anatomy.js`. Every figure (`assets/*.svg`) is a colored anatomy illustration from
Wikimedia Commons with labels/leader-lines stripped and cropped; clickable hotspots are overlaid in
% coordinates per region. See `assets/CREDITS.md` for sources and licenses (public domain / CC0 /
CC BY-SA 3.0 for the foot). To add or replace a figure: drop it in `assets/`, set
`VIEWS.<region> = { type:'image', img, ratio, hotspots:[{id,x,y,w,h,route}] }`, and map the hotspots
in % (toggle a `debug` class on `#fig` to see the boxes).

## MCAT PRIME

The **MCAT** tab is an evidence-based prep command center (brings the "Operation MCAT PRIME" spec
into Cortex). Built on the highest-utility learning methods: spaced repetition + retrieval practice,
interleaving, confidence calibration, and remediation.

- **Flashcard Reactor** — spaced-repetition active recall (SM-2-style scheduling: Again/Hard/Good/Easy
  → intervals). 240 high-yield cards across C/P, B/B, P/S.
- **Question Drills** — 121 discrete MCAT-style questions, interleaved or by section, with confidence
  tagging, **distractor autopsy** (why each wrong option is tempting), root-cause tagging, and an
  end-of-set review. Blind-review mode defers all feedback to the end.
- **Blueprint Navigator** — the full AAMC content map (`data/mcat-outline.json`); each category shows
  your accuracy as a coverage heat-check and links to a targeted drill / card deck.
- **Mistake Lab** — confidence-vs-accuracy calibration, weakest categories, root-cause breakdown, and
  a "redo missed" drill. Every miss generates a next action.

- **CARS Studio** — 16 original passages (8 humanities / 8 social science, ~575 words, 96 passage-bound
  questions across the 3 CARS skills), timed/untimed, with justify-the-credited-answer review.
- **Passage Lab** — 18 AAMC-style science passages (6 each C/P, B/B, P/S; research/data scenarios with
  data tables, 90 passage-bound questions across the 4 reasoning skills incl. research design + data/stats).
- **Exam Simulator** — test-day environment: countdown timer, question navigator + flagging, no feedback
  until submit, periodic table (science), pre-submit review screen, then score + full review. **Science
  sections are passage-based** (passage sets then discretes, like the real exam); CARS section uses
  passages. Section sims + a full-length "stamina" chain with breaks.
- **Guide Engine** — study-campaign builder (120/90/60-day, CARS rescue, final-30): generates a
  week-by-week plan distributing content categories with block-then-interleave logic and an exam-prep taper.
- **Course Mapper** — rate each content category by coursework strength → coverage heat map + a
  "start here" list of weak/unrated categories that link to targeted drills.

Content: `data/mcat-cards.json` (240), `data/mcat-questions.json` (121), `data/mcat-cars.json` (16
passages), `data/mcat-science-passages.json` (18 passages / 90 Qs with data tables) — generated then
fact-checked, tagged to the AAMC blueprint. Progress in localStorage (`cs-mcat-*`); any session feeds
the daily streak. Fully offline — no cloud, no accounts.

## Data

- `data/<specialty>.json` — merged case banks (100 cases each)
- `data/manifest.json` — case counts per specialty, drives the home grid
- `data/index.json` — lightweight search index (id, key, title, difficulty, diagnosis per case),
  powers Review → Search
- `data/raw/` — generation batch artifacts (can be deleted after merge)
- `scripts/merge.py` — validates raw batches, dedupes, renumbers ids, writes the
  per-specialty files + manifest. Re-run after adding raw batches: `python3 scripts/merge.py`
- `scripts/build-index.py` — rebuilds `index.json` from the merged data (and tidies option
  wording in explanations). Re-run after changing case content: `python3 scripts/build-index.py`

## Case format

See any `data/*.json`: `title, difficulty, setting, patient, chiefComplaint, history,
vitals{}, exam, stages[] (question|result), diagnosis, pearls[]`. Question stages have
`options[]`, 0-based `answer`, and an `explanation` covering right and wrong answers.
