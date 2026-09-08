/* Cortex Medical Academy — release notes shown in "What's New" (newest first).
   Loaded by index.html before app.js. Entries tagged LOCAL are unshipped work and are
   filtered out of the public list in app.js. Retired class-specific courses (UTSA
   Genetics, CCMA, Cognitive Psychology) keep their history in git, not here. */

const CHANGELOG = [
  {
    version: '2.30.0-beta.1',
    tag: 'BETA',
    date: 'September 8, 2026',
    title: 'A connected Academy, with your work preserved',
    items: [
      'MCAT now connects 45 lessons, passage coaching, quantitative practice, planning, concept repair and rehearsal.',
      'Anatomy, Medicine and Neuroengineering add guided work, while Clinical Scenarios adds patient timelines.',
      'Academy Today, lesson discovery, optional retrieval and a private portfolio connect your separate course records.',
      'Study backups, downloaded courses and recovery controls preserve original answers, writing and saved versions.',
      'This is an Academy beta. Independent subject review and learner pilots remain pending; course labels describe the available scope. Generative tutoring and group sharing are not enabled.',
    ],
  },
  {
    version: '2.4.0-local.1',
    tag: 'LOCAL',
    date: 'September 7, 2026',
    title: 'Psychology foundations keep your reasoning',
    items: [
      'Seven connected foundations introduce cognition, research, models, attention, and memory with written practice.',
      'Lessons restore drafts, first answers, exact steps, and original completion times after navigation or reload.',
      'Download retries and shared save recovery protect the course without resetting earlier progress.',
      'The broader library remains draft material; review scheduling is no longer described as measured retention.',
    ],
  },
  {
    version: '2.3.0-local.1',
    tag: 'LOCAL',
    date: 'September 7, 2026',
    title: 'Find the MCAT material and the gaps',
    items: [
      'The coverage map links learning objectives to lessons, standalone questions, complete passages, and cards.',
      'The current AAMC category structure replaces inconsistent legacy tags while preserving original saved answers.',
      'Three new biology lessons introduce microbial information exchange, cell-cycle checkpoints, and hormonal feedback.',
      'Available practice, completed work, later checks, and missing topic introductions remain separate.',
    ],
  },
  {
    version: '2.2.0-local.1',
    tag: 'LOCAL',
    date: 'September 7, 2026',
    title: 'Learn to Learn keeps your work',
    items: [
      'Lesson links restore the exact step, submitted answer, written response, and revealed sample.',
      'A shared save-recovery system protects MCAT and learning-course work from failed storage and conflicting tabs.',
      'Course downloads can be retried, and optional medical practice no longer blocks the main course.',
      'Completed lessons keep their original completion time and lead into an Academy study activity.',
    ],
  },
  {
    version: '2.1.0-local.1',
    date: 'September 7, 2026',
    tag: 'LOCAL',
    title: 'An Academy you can navigate',
    items: [
      'A course catalog explains who each learning path is for, what it contains, and its current availability.',
      'Interrupted section downloads offer a retry without clearing saved work.',
      'Course navigation, preview status, and browser-tab titles follow the section you actually opened.',
    ],
  },
  {
    date: 'September 7, 2026', version: '2.0.0-beta.2', tag: 'BETA',
    title: 'MCAT 2.0: a smoother study day',
    items: [
      'A clearer homepage leads into a flexible 15-, 30-, or 60-minute session, with completed work carried into your weekly plan.',
      'MCAT progress now opens one learning record for lessons, practice, and saved sessions, with direct links to unfinished work.',
      'Help after a lesson mistake stays with that question: compare the answers, try a related check, and return to your original place.',
      'Save a Passage Coach workshop for later and switch to another while keeping your answers, notes, hints, and unfinished draft.',
      'Math practice recognizes setups seen in investigations and keeps repeated practice separate from unseen attempts.',
      'Optional notes are clearly labeled, paragraph scratchpads are tucked away, and worked examples require less repetitive writing.',
      'Active study screens have a compact menu, smaller headings, and feedback that moves into view on desktop and phone screens.',
      'Interrupted saves retain recoverable drafts, content downloads can be retried, and resumed practice avoids counting the same saved answer or card rating twice.',
    ],
  },
  {
    date: 'September 6, 2026', version: '2.0.0-beta.1', tag: 'BETA',
    title: 'MCAT 2.0: learn, reason, and plan your week',
    items: [
      'Today, Course, Practice, and Progress connect 36 lessons across 12 chapters, including metabolism, genetics, organ systems, organic chemistry, fluids, perception, and sociology.',
      'Each lesson connects explanations, predictions, worked examples, and two applications with three fresh follow-up questions spaced over time; existing progress is preserved.',
      'Eight Passage Coach workshops make science and CARS reasoning visible, with saved passage maps, staged hints, and a choice of Guided, Light, or Independent support.',
      'Short science mistake investigations compare content, data, and setup; CARS checks compare claim, argument, and transfer. You choose the next focus.',
      'The math and graph gym checks your setup before calculation across six skills and 48 numerical variants, with specific feedback for incorrect methods.',
      'A weekly planner fits available time, saved work, due checks, and chosen priorities, while reserving practice-exam review and recording self-entered official results separately.',
      'Progress separates independent, assisted, repeated, and delayed answers. Private study reflections help you capture what clicked and choose what to work on next.',
      'Interactive science labs, CARS blind review, experiment notebooks, concept repairs, flexible daily sessions, and timed practice with saved answer reviews remain connected to your preparation.',
    ],
  },
  {
    date: 'August 28, 2026', version: '1.25.25', tag: 'NEW',
    title: 'Clinical Shift and a saved-game MCAT hub',
    // Only ship-visible features here — the PED course items are held back until
    // Medicine un-gates (their text is preserved in context/STATE.md's ship entry).
    items: [
      'Clinical Scenarios now opens as Clinical Shift: choose Emergency Medicine, Cardiology, or Neurology, take a handoff, and work one hidden-diagnosis patient at a time.',
      'You decide what to ask and what to examine — each choice adds real findings to the patient chart and counts toward your evidence score.',
      'Charting is write-first: draft your own Assessment and Plan, then reveal a clinically preferred reference note beside your frozen draft for self-review — nothing is auto-graded.',
      'A shift debrief reviews your differential, decisions, and documentation, and the classic case bank stays one click away.',
      'MCAT Prep now opens like a saved game: first-time learners choose a plan, while returning learners land directly on today\'s assignments, progress, and resumable work.',
    ],
  },
  {
    date: 'August 8, 2026', version: '1.25.23', tag: 'NEW',
    title: 'A clearer course experience and a real MCAT study plan',
    items: [
      'MCAT Prep now opens with a calmer home focused on five core study tools instead of competing cards, statistics, and explanations.',
      'The 60, 90, and 120-day plans now assign dated daily work, launch the correct study tools, track completion, and adapt to measured weak areas.',
    ],
  },
  {
    date: 'August 8, 2026', version: '1.25.18', tag: 'POLISH',
    title: 'Navigation, flagship paths, and Neuroengineering: clearer structure',
    items: [
      'Learn to Learn now holds a flagship place in the primary navigation, with its Under construction gate preserved while the course is evaluated.',
      'The bottom of Explore is now reserved for the Focus Timer and UTSA & UT Health access.',
      'Neuroengineering unit headers now give the Unit progress and Stage labels more breathing room inside their corner accents.',
      'NeuroCode run results now sit comfortably inside the terminal frame instead of touching its edge.',
      'The primary navigation now names Clinical Scenarios directly instead of using the generic Practice label, with a compact Clinical label on small screens.',
      'MCAT now leads the navigation as Cortex’s forever-free core, with MCAT Prep and Stats organized together in one focused dropdown.',
    ],
  },
  {
    date: 'August 7, 2026', version: '1.25.13', tag: 'UPDATE',
    title: 'Neuroengineering: a clearer path from Start to completion',
    items: [
      'The main Neuroengineering page is now focused on Foundations and the primary Track. Units sit inside a clear Show units dropdown, while subjects, NeuroCode, NeuroSim, and Practitioner work have their own Lessons & Labs page.',
      'The primary Track now behaves like real progress: it says Start before first use, changes to Continue after you begin, resumes the current unit, and always opens the lesson at the true top of the page.',
      'Lessons have a more polished teaching hierarchy, clearer Objective and Focus rows, obvious Back controls, Track-aligned subject ordering, and cleaner spacing around titles and question counts.',
      'Active recall now has a visible Submit answer then Next flow. Quick Checks show one question at a time and use an explicit fail, inline review, retry, pass, and Continue sequence so the learner can never get stranded at Stage 6.',
      'NeuroCode and NeuroSim progression is repaired from end to end: hidden gates stay hidden, incorrect simulations offer Retry, successful work offers Continue, and Unit 1 reaches Complete. The Lists exercise also shows the correct 7-sample target.',
      'Medicine and Learn to Learn are temporarily closed and clearly marked Under construction while their curriculum and learning flow are evaluated after Neuroengineering.',
    ],
  },
  {
    date: 'August 7, 2026', version: '1.25.1', tag: 'NEW',
    title: 'Neuro: Foundations on-ramp + Milestone 2',
    items: [
      'A new "Start here" row opens the course with zero prerequisites: why brain–computer interfaces exist (the philosophy), the core science of neural signals, and a from-absolute-zero coding on-ramp — then the Track.',
      'Practitioner Milestone 2 is live: on a drifting recording where a fixed threshold fails, compute an adaptive one from the signal’s own statistics, group crossings into discrete spikes, and report a feature vector per spike.',
      'Smoother units: the Continue button now follows you down the page, every quiz links its full topic explainer, code labs open with a never-coded-before orientation, and milestone grading is fixed under the hood.',
    ],
  },
  {
    date: 'August 7, 2026', version: '1.25.0', tag: 'NEW',
    title: 'Neuroengineering is open — one track, start to finish',
    items: [
      'The Neuroengineering division is live. The whole course is now one visible track: 20 BCI Builder units in a straight line from raw neural signals to a working brain–computer interface pipeline, with a Continue button that always knows your next step.',
      'Practitioner milestones sit right on the track where they unlock — clear Unit 7 and the first build lab, the Neural Signal Viewer, opens with a real in-browser Python workspace.',
      'Below the track, explore 12 subjects of Socratic study and quizzes, 13 NeuroCode function exercises with a manual trace option, and 15 NeuroSim decision labs. Independent subject review is pending.',
    ],
  },
  {
    date: 'July 24, 2026', version: '1.23.0', tag: 'NEW',
    title: 'A calmer Explore, a sharper Cortex',
    items: [
      'Explore is now a focused map of Cortex: learning paths sit in one clear list, while the Focus Timer, Learn to Learn, and UTSA & UT Health access stay in a quiet utility row.',
      'The Academy now shares one cohesive visual system — clearer hierarchy, quieter surfaces, more consistent cards and controls, a refined mission page and footer, and tighter responsive spacing across every major section.',
      'Active-section cues, cleaner status labels, Escape-to-close keyboard support, and a fix for the first-open MCAT navigation freeze make moving through Cortex faster and more reliable.',
    ],
  },
  {
    date: 'July 5, 2026', version: '1.19.0', tag: 'NEW',
    title: 'Study list in the Focus Timer',
    items: [
      'The Focus Timer now has a study list — add the subjects you need to get through, and cross each one off as you finish a round. The top unfinished subject is highlighted as “studying now,” and when a focus round ends you get a nudge to cross it off and switch it up, so you keep rotating instead of getting stuck on one thing.',
      'Focus-length presets are now 15 / 25 / 45 min, and the Custom field is clearer — it’s labeled and obviously editable.',
    ],
  },
  {
    date: 'July 3, 2026', version: '1.18.0', tag: 'NEW',
    title: 'Link straight to any section',
    items: [
      'You can now share a direct link to a section instead of the homepage — e.g. cortexmedical.academy/medicine opens Medicine, /mcat opens MCAT, /stats opens your stats. The address bar updates as you move around, so whatever you’re looking at is always a copy-able link.',
    ],
  },
  {
    date: 'June 29, 2026', version: '1.16.5', tag: 'FIX',
    title: 'Polish pass + reliability fixes',
    items: [
      'Site-wide polish: a consistent footer on every page, the Medicine study-path labels now render in the intended muted grey (they were showing too dark), smoother card hovers, consistent button arrows, and small copy/label fixes across sections.',
      'More reliable signed-in progress sync across multiple browser tabs.',
    ],
  },
  {
    date: 'June 22, 2026', version: '1.14.0', tag: 'NEW',
    title: 'Medicine - open access & guided practice',
    items: [
      'Every Medicine area - pharmacology, microbiology, lab values, and ECG - is unlocked to browse, drill, or learn anytime.',
      'Guided study is now multiple-choice with instant feedback and XP, replacing the old flashcards.',
      'Fixed guided lessons that could stall instead of advancing to the next step.',
      'Accuracy pass across hundreds of clinical and MCAT explanations, now written to read cleanly after answer choices shuffle.',
    ],
  },
  {
    date: 'June 20, 2026', version: '1.13.3', tag: 'FIX',
    title: 'Clinical fixes, accessibility & speed',
    items: [
      'Fixed answer highlighting after the shuffle update - the correct choice now lights up green every time, and explanations point to the right option.',
      'Restored full answer wording that was clipped in the previous update.',
      'Faster first load and snappier repeat visits.',
      'Full keyboard navigation, screen-reader announcements, and higher-contrast text.',
      'Accuracy tune-ups across pharmacology, microbiology, and lab references.',
    ],
  },
  {
    date: 'June 20, 2026', version: '1.13.2', tag: 'FIX',
    title: 'Clinical scenarios \u2014 fairer MCQs',
    items: [
      'Answer choices shuffle every time a question loads \u2014 no more \u201calways pick B\u201d position bias.',
      'Rebalanced 11k+ stored options so correct answers aren\u2019t the obvious longest choice.',
      'Future case generation enforces parallel option length and varied correct positions.',
    ],
  },
  {
    date: 'June 20, 2026', version: '1.13.1', tag: 'NEW',
    title: 'Medicine \u2014 unified study path',
    items: [
      'One 81-step path with a single progress bar: pharm classes \u2192 PED course \u2192 micro \u2192 labs \u2192 ECG rhythms.',
      'Continue always opens the next incomplete step; phase strip shows progress per area.',
      'Guided learn respects path order; browse and drill stay open anytime.',
      'Existing progress backfills automatically \u2014 no reset needed.',
    ],
  },
  {
    date: 'June 20, 2026', version: '1.13.0', tag: 'FIX',
    title: 'Medicine tab \u2014 script load fix',
    items: [
      'Fixed Medicine tab not opening: duplicate PHARM_UNIQUE_TOTAL declaration blocked reference.js from loading.',
    ],
  },
  {
    date: 'June 19, 2026', version: '1.13.0', tag: 'FIX',
    title: 'Medicine tab \u2014 load fix',
    items: [
      'Fixed Medicine hub crash when local progress data was corrupted (safe migration on cs-pharm / cs-micro / cs-labs / cs-ekg).',
      'Medicine section load is wrapped in error handling with retry; script cache bust for reference + EKG.',
    ],
  },
  {
    date: 'June 19, 2026', version: '1.13.0', tag: 'NEW',
    title: 'Medicine tab \u2014 unified progress & guided study',
    items: [
      'Medicine hub: overall progress bar, Continue CTA, recommended path, live stats on every card.',
      'Pharmacology: learn resume + step dots, per-class studied counts, unique-name tracking (355).',
      'Microbiology & lab values: guided panel/group learn, persistent drill stats, Stats page blocks.',
      'ECG: reviewed checkmarks, category drill filters, persistent scores, A\u2013E keyboard in all Medicine drills.',
      'Reset progress: new Medicine option clears pharm, PED, micro, labs & ECG.',
    ],
  },
  {
    date: 'June 19, 2026', version: '1.12.0', tag: 'NEW',
    title: 'Performance drugs \u2014 course polish',
    items: [
      'Hub split into 3 parts (hormones → pathways → clinical) with current-module highlight and per-row progress.',
      'Hormone learn: 4-step dots per agent; pathway lessons show orient/build/checkpoint progress bar.',
      'Catalog & clinical modules are guided section-by-section — no more wall-of-cards + mark complete.',
      'Medicine card shows live module progress on the PED tile.',
    ],
  },
  {
    date: 'June 19, 2026', version: '1.11.0', tag: 'NEW',
    title: 'Performance drugs \u2014 structured study path',
    items: [
      'PED rebuilt as 11-module guided course with progress bar and locked sequential unlock.',
      'Hormone modules: study agents in order (where \u2192 pathway \u2192 PED note \u2192 pearl) with per-class tracking.',
      'Pathway modules: orientation \u2192 build flowchart step-by-step \u2192 ordered checkpoint (70% to pass).',
      'Quick reference fold for browse-only hormone map, catalog, and clinical.',
    ],
  },
  {
    date: 'June 19, 2026', version: '1.10.0', tag: 'NEW',
    title: 'Neuroengineering \u2014 Practitioner Track',
    items: [
      'Practitioner Milestone 1: Neural Signal Viewer \u2014 graded OJT lab with waveform preview, Python grading, and project summary export.',
      'Real unlock at BCI Unit 7; Practitioner tile in Labs; celebration banner on unit completion.',
      'BCI path gaps filled: NeuroCode/Sim wired for units 4\u20136 and 11\u201312; new data-minimization ticket.',
      'Neuro stats on Stats page; leaner NeuroCode sandbox; depth rows without orphan arrows.',
    ],
  },
  {
    date: 'June 18, 2026', version: '1.9.4', tag: 'FIX',
    title: 'Neuroengineering \u2014 hub polish',
    items: [
      'Minimal neuro hub: leaner hero, slim BCI progress, collapsed Practitioner Track, clean subject cards.',
      'Brighter text on dark neuro pages; sharper social preview card (og-v4).',
      'MCAT free + Neuro free-for-now pills; video hero restored.',
    ],
  },
  {
    date: 'June 18, 2026', version: '1.9.3', tag: 'NEW',
    title: 'A clearer free note',
    items: [
      'Clinical Scenarios and Neuroengineering now show the same note: they are free to use.',
      'MCAT prep stays free forever.',
    ],
  },
  {
    date: 'June 18, 2026', version: '1.9.2', tag: 'FIX',
    title: 'Neuroengineering \u2014 mobile polish',
    items: [
      'Full mobile pass on the neuro hub, BCI path, quizzes, NeuroSim, and NeuroCode OJT sandbox.',
      'Safe-area padding, 44px touch targets, stacked CTAs, readable code editor + terminal on small screens.',
    ],
  },
  {
    date: 'June 18, 2026', version: '1.9.1', tag: 'NEW',
    title: 'Neuroengineering \u2014 Foundations live',
    items: [
      'Cortex Neuroengineering: 12 subjects, 24 topics, 120 quiz questions, 12 NeuroSim labs, 12 NeuroCode tickets.',
      'BCI Builder Path \u2014 20 guided units with active recall, gated mini-quizzes, sims & real Python OJT.',
      'NeuroCode Lab + NeuroSim browse hubs; real Python 3 runs in-browser (Run / Check).',
      'Socratic study mode, progress sync, social share card. Practitioner Track (expert milestones) next.',
    ],
  },
  {
    date: 'June 18, 2026', version: '1.9.0', tag: 'NEW',
    title: 'Neuroengineering \u2014 Foundations live',
    items: [
      'Neuroengineering course launched on Cortex Medical Academy.',
    ],
  },
  {
    date: 'June 18, 2026', version: '1.8.4', tag: 'FIX',
    title: 'Verification deploy',
    items: [
      'Re-opens the what\u2019s new popup so you can verify the mobile X updates link \u2014 no other changes from v1.8.3.',
    ],
  },
  {
    date: 'June 18, 2026', version: '1.8.3', tag: 'NEW',
    title: 'Clinical Scenarios \u2014 full polish pass',
    items: [
      'Practice landing rebuilt to match the MCAT console aesthetic \u2014 telemetry stat band, engineering hero, corner-frame panels.',
      'Specialty cards upgraded with rank telemetry, progress bars, and hover affordances.',
      'Active case view gets a live progress runbar, framed vitals panel, and tighter stage flow.',
      'Review hub matches the new visual system \u2014 bordered row list, stat band, unified typography.',
      'Constant Cortex updates on X \u2014 popup link copy + mobile wrap fix.',
    ],
  },
  {
    date: 'June 17, 2026', version: '1.8.2', tag: 'NEW',
    title: 'What\u2019s new popup',
    items: [
      'New releases now greet you with a one-time what\u2019s new window \u2014 dismiss it and it stays gone until the next version ships.',
      'The full changelog is still one tap away on the version number anytime.',
      'Follow @kevin__vigil on X for ship notes straight from the popup.',
    ],
  },
  {
    date: 'June 17, 2026', version: '1.8.1', tag: 'NEW',
    title: 'Smarter onboarding & clearer progress',
    items: [
      'MCAT "Enter the system" now resumes where you left off, sends new users to the Guide Engine, then drills.',
      'Hub resume chip on the MCAT landing — one tap back into any in-progress module.',
      'Stats covers MCAT prep, Focus Timer, and clinical scenarios in one place.',
      'Reset progress lets you clear clinical, MCAT, or everything — separately.',
      'XP & streak visible on mobile again; gated sections load on demand for a faster first paint.',
      'Mission page "Enter the Academy" routes to MCAT; clinical free-note clarifies MCAT stays free forever.',
    ],
  },
  {
    date: 'June 17, 2026', version: '1.8.0', tag: 'NEW',
    title: 'Focus Timer (Pomodoro)',
    items: [
      'New Pomodoro focus timer under Explore — preset focus/break lengths (25/35/50 and 5/10/15) plus fully custom times.',
      'It keeps running while you study elsewhere on the site, with a floating timer and a live countdown in your browser tab.',
      'Tracks rounds completed and your total focused time across the whole session.',
    ],
  },
  {
    date: 'June 17, 2026', version: '1.7.1', tag: 'FIX',
    title: 'Reliability & polish pass',
    items: [
      'Hardened progress saving so a full or private-mode browser can never freeze a question mid-answer.',
      'Cross-device sync now protects unsynced progress instead of overwriting it, and a reset syncs everywhere.',
      'MCAT fixes: keyboard answers in drills, smarter Mistake Lab targets, cleaner study plans, no dead ends.',
      'Sharper nav contrast, accurate labels, and dozens of small robustness fixes across the app.',
    ],
  },
  {
    date: 'June 16, 2026', version: '1.6.4', tag: 'NEW',
    title: 'Clinical Scenarios — free while we build',
    items: [
      'Every clinical case is completely free.',
      'MCAT prep stays free forever, no matter what.',
    ],
  },
  {
    date: 'June 16, 2026', version: '1.6.3', tag: 'FIX',
    title: 'No more privacy warning',
    items: [
      'The page no longer makes any third-party request on load, so mobile browsers stop showing the "reduce privacy protections" banner.',
      'The live visitor count now routes through our own domain — same number, fully private.',
    ],
  },
  {
    date: 'June 16, 2026', version: '1.6.2', tag: 'FIX',
    title: 'Mobile polish',
    items: [
      'Fixed the Explore menu running off-screen on phones.',
      'Clearer "Neuro" label on mobile instead of a bare icon.',
      'Self-hosted the sign-in library so the site now loads fully offline.',
    ],
  },
  {
    date: 'June 16, 2026', version: '1.6.1', tag: 'NEW',
    title: 'MCAT — easier to navigate',
    items: [
      'Every MCAT task now shows a breadcrumb of where you are, with one-tap back to the hub — and asks before you quit.',
      'Resume right where you left off: leaving a drill, passage set, or exam no longer loses your place.',
      'Clearer module pages — back buttons everywhere, color legends, honest empty states, and keyboard hints.',
    ],
  },
  {
    date: 'June 15, 2026', version: '1.6', tag: 'NEW',
    title: 'New sections & cleaner navigation',
    items: [
      'A reorganized top navigation that scales as the Academy grows.',
      'UTSA & UT Health San Antonio — our plan to give students from both full access, free, forever.',
      'Neuroengineering — a new division where neuroscience meets engineering.',
      'Clearer previews of what’s next: Anatomy, Medicine (master pharmacology), and Learn to Learn.',
    ],
  },
  {
    date: 'June 15, 2026', version: '1.5', tag: 'NEW',
    title: 'Optional accounts & sync',
    items: [
      'Save your progress to your email and sync it across all your devices — completely optional.',
      'No passwords: sign in with a one-tap link sent to your email.',
      'Signed out? Nothing changes — your progress still saves on your device, as always.',
    ],
  },
  {
    date: 'June 15, 2026', version: '1.4', tag: 'NEW',
    title: 'A note from the founder',
    items: [
      'Cortex is now openly founder-led — a short note on the mission behind the Academy, and a founder credit throughout.',
    ],
  },
  {
    date: 'June 15, 2026', version: '1.3', tag: 'NEW',
    title: 'Brand & identity',
    items: [
      'A refined logo mark in the header and a proper site footer across the Academy.',
      'A sticky, frosted navigation bar and a whisper-faint engineering grid behind the mission.',
      'A branded preview card when you share the link anywhere — plus considered, consistent detailing throughout.',
    ],
  },
  {
    date: 'June 15, 2026', version: '1.2', tag: 'NEW',
    title: 'Interface polish',
    items: [
      'Stats and counters now count up as the page loads, with crisp non-jittering numbers.',
      'Sections and cards glide in as you scroll, with gentle hover feedback throughout.',
      'A live activity indicator, blueprint detailing, and a refined reading experience — all kept deliberately minimal.',
    ],
  },
  {
    date: 'June 15, 2026', version: '1.1', tag: 'NEW',
    title: 'A "What’s New" page',
    items: [
      'Added this updates feed so you can see exactly what’s changing — Cortex is actively built and maintained.',
      'Click the version number in the top-right corner anytime to come back here.',
    ],
  },
  {
    date: 'June 15, 2026', version: '1.0', tag: 'NEW',
    title: 'The Academy, officially v1.0',
    items: [
      'A new mission home page that lays out what Cortex is and why it stays free.',
      'A live visitor counter and mission-progress tracker.',
      'A fully mobile-friendly layout, top to bottom.',
    ],
  },
  {
    date: 'June 14, 2026', version: '0.9', tag: 'NEW',
    title: 'MCAT prep suite — free forever',
    items: [
      '504 high-yield flashcards with built-in spaced repetition.',
      '263 practice questions with full explanations and answer-by-answer breakdowns.',
      'CARS Studio, a full-length Exam Simulator, AAMC-style science passages, and a study planner.',
    ],
  },
  {
    date: 'June 14, 2026', version: '0.9', tag: 'NEW',
    title: '2,599 clinical cases across 26 specialties',
    items: [
      'Interactive, step-by-step case scenarios from emergency medicine to neurosurgery.',
      'Bookmarks, missed-question review, full-text search, a stats dashboard, and a daily streak.',
    ],
  },
  {
    date: 'June 14, 2026', version: '0.9', tag: 'NEW',
    title: 'Live at cortexmedical.academy',
    items: [
      'The site went public — no account needed, and it works offline.',
      'Added a suggestion box so you can help shape what gets built next.',
    ],
  },
  {
    date: 'Coming soon', version: '', tag: 'SOON',
    title: 'In the works',
    items: [
      'Anatomy — interactive, clickable diagrams.',
      'Medicine — pharmacology, microbiology, lab values, and EKG reference.',
      'Learn to Learn — guided, Socratic study sessions.',
    ],
  },
];
