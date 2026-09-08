# MCAT rehearsal work in progress

Milestone 21 is not complete. The local application loads the pure engine and rehearsal controller. Fixed-form selection, exposure/reservation handling, two timing modes, resumable sessions and retained reviews are connected. Handler verification and local author checks for all four sections are complete. Actual browser walkthroughs remain pending. Independent subject and rights review are separate requirements.

## Form inventory

The current [AAMC 2026 exam overview](https://students-residents.aamc.org/whats-mcat-exam/publication-chapters/whats-mcat-exam), checked September 7, 2026, lists three science sections of 59 questions in 95 minutes each, with ten passage sets and fifteen independent questions per science section. CARS has 53 questions in 90 minutes across nine passage sets. Optional breaks follow the first three sections, with targets of 10, 30 and 10 minutes. The manifest uses these counts and times; it does not copy AAMC questions or claim equivalence to an official practice form.

`data/mcat-rehearsals.json` selects fixed IDs from the existing Cortex bank. Science forms intentionally use four complete five-question selections and six complete four-question selections, plus fifteen independent items. CARS selects five questions for one passage and six for each of the other eight. The original passage text stays intact. The manifest explicitly lists each selected question, so excluded questions are an editorial selection rather than random truncation at runtime.

These four forms total 230 selected questions. They are drafts. All 230 selected questions and their 39 passages have had a local author check, recorded in `data/mcat-rehearsal-author-check.json`. Current form revisions are Chemistry/Physics 3, CARS 2, Biology/Biochemistry 2 and Psychology/Sociology 3. Independent subject review and originality/rights review are pending. Counts and matching fingerprints do not establish those reviews, full outline coverage, item calibration or predicted scores. `fullLengthEligible` remains false for the current inventory. Completing a draft section cannot confer a validated score.

The biology pass corrected the direction of the Wahlund effect, made enzyme consumption and vesicle concentrations computable from consistent units, separated osmolality from tonicity, and removed claims that nonsignificant comparisons prove equivalence. Reporter assays, antibody binding, whole-serum function, hemodynamics and linkage calculations now state their inference limits. An unverified specific claim about HSPB7 regulation was replaced with an explicitly fictional gene/factor model. Related ALP coach and experiment labels use the same rate units as the source table.

The Psychology/Sociology pass corrected signal-detection indices from the displayed hit/false-alarm rates, recalculated the HRT week-eight ANOVA, repaired incompatible conformity-task assumptions and made framing outcomes use the same 30-day horizon. A mathematically incompatible attribution ANOVA was removed while retaining the descriptive interaction. Coefficient attenuation, blinding, treatment components, self-reported motives and cognitive theories now have explicit inference limits. Discrete items distinguish attenuation from mandatory full semantic processing, orientation tuning from simple-cell classification, and punishment avoidance from instrumental reward seeking.

The new original CARS pathway's reserved final essay, `cars-path-archive`, is excluded. Rehearsal source material overlaps existing lessons, workshops and general practice. No “unseen” claim may be made from the absence of saved history; earlier displays, other devices and self-reported exposure still matter.

Each form stores a SHA-256 fingerprint of its exact assembled content: selected questions, options, answer keys, explanations, distractors, passage text, tables, source context, notes, fixed presentation order and duration. `scripts/check-mcat-rehearsals.cjs` verifies those fingerprints and counts without rewriting the manifest. Changed source material requires a deliberate new content check/revision; the UI must not silently reshuffle or substitute unavailable questions.

CARS uses 53 explicit, frozen option-order maps. Correct displayed positions are distributed 14 A, 13 B, 13 C and 13 D, while canonical answer indices remain unchanged. The selected rationales were rewritten without positional letter references. Old snapshots without a presentation map still use their original order, and saved reviews label first answers, final answers and the key using the order that actually belonged to the run.

## Engine contract

`mcat-rehearsal-engine.js` is a pure module. It has no storage, network, DOM or course-credit side effects. `verify` assembles a complete form and checks its fingerprint. A run freezes those sections and its preflight selections before starting.

The state retains first answers separately from final answers, flags, displayed question identities, full result snapshots and timing observations. The first answer remains unchanged when a learner revises a selection before submitting. Repeated submission is rejected. Unanswered and undisplayed items remain distinguishable. Pacing describes recorded display intervals and section time; it is not proof of reading, attention or cognitive processing.

Continuous mode preserves deadlines across navigation and reload. Late recovery retains the original section and break boundaries, including expired subsequent sections. Flexible mode preserves remaining time while recording interruptions. A reload that lacks a final display-close event drops that uncertain open interval instead of calling it observed reading time. A backward device-clock change is flagged and must be disclosed in the run's timing report. Browser sleep and storage failures still require integration testing.

Exposure records distinguish tracked displays from older retained question/passage records. A reservation freezes question and passage IDs in its own saved ledger, allowing practice-entry guards to enforce it even if the form catalog is unavailable or later changes. Reserving a form cannot erase earlier exposure or make reused content fresh.

The engine validates saved structures, answer ranges, first-answer presence, clock/break records, phase progression, unique question IDs and result agreement with the frozen queue and final answers. Invalid records must trigger StudyStorage recovery rather than an empty replacement in the connected runtime.

## Connected runtime

`mcat-rehearsal.js` uses `/mcat?view=rehearsal`, with the attempt ID in `run` for a saved session or archived result. The existing simulator entry opens this screen. Short legacy practice remains available separately and keeps its original resume behavior. Guided short exam tasks still use short practice rather than silently expanding their allotted time.

The exposure/reservation ledger uses `cs-mcat-rehearsal-v1`; the active run uses `cs-mcat-r-sim`, and completed runs use `cs-mcat-exam-reviews`. All are portable-backup records. Compact run snapshots store each passage once per section, retaining every selected question, answer rationale, table and form identity. Restoring a saved snapshot does not require the current catalog. Archives are retained rather than silently evicted after eight runs. A quota failure preserves the active copy until archival succeeds.

The controller owns its clock. It bypasses the legacy remaining-time recovery behavior for continuous rehearsals. Answer buttons update in place so choosing an answer does not rebuild the passage or move focus to a new page. Navigation, flags, periodic-table access, section submission, targeted breaks and partial completion are connected. A navigator screen resumes as a navigator. Completed work pending archival cannot be overwritten by either new fixed forms or legacy short practice.

Reservations are checked before ordinary drill, passage, coach and review displays. Even a first-question untimed session is saved before reservation denial. Tracked exposure is recorded after mounting the allowed view; retained legacy records remain conservative evidence of a prior record, not proof of a fresh question. Absence of history never proves unfamiliarity. Reservations do not apply to the explicitly selected rehearsal itself, and they do not remove prior history.

Results retain raw section counts, unanswered versus displayed questions, first/final answers, timing mode, interruptions, break observations and the preflight exposure report. The general question log receives only questions actually displayed during a new rehearsal; undisplayed items remain in its section denominator. Saving a review takeaway cannot alter the original score. Failed note saves preserve the draft and prevent a false review-complete action. Existing manually entered official/other-provider results stay separate.

New ordinary CARS/science passage reports also retain a complete source snapshot. An older report with only question IDs preserves its saved results but discloses that original wording was not retained and current wording may differ. That limitation cannot be repaired by silently treating the current question bank as the original source.

## Local verification and remaining work

Thirteen pure-engine scenarios and thirteen DOM-handler scenarios exercise the real controller and StudyStorage, including all 230 question interactions, all 53 CARS presentation maps, full snapshots, compact portable backups, an eight-hour continuous reload, flexible hiding/resuming, failed answer and archive writes, review-note failure, missing catalogs, late fetches, reservations, cross-tab changes and ordinary report source retention. Eleven content regression checks include independent signal-detection, ANOVA, enzyme-consumption, population-genetics, hemodynamic and linkage arithmetic. The DOM tests use jsdom with a visible-document setting and a controlled clock. They are not real-browser acceptance evidence.

Existing storage, V2, transfer and portable-backup checks also pass. Run the handler suite with a development installation of jsdom available through `NODE_PATH`; the local scratch installation is outside the production checkout. No jsdom runtime is shipped to learners.

Remaining before calling this milestone complete:

- Recheck every changed form fingerprint deliberately; never auto-accept arbitrary source changes. Keep all four forms labeled draft and `fullLengthEligible` false until actual independent review and rights evidence support the claim.
- Complete actual browser journeys at desktop and narrow widths, including keyboard access, reload, ordinary reserved-practice entry, long breaks, visibility changes, saved reviews, multiple tabs and downloaded content. The Mac was locked at the latest attempt, and no bypass was used.
- Independent reviewers and real learner observations remain external evidence. A passing handler test or local author pass does not supply either.
