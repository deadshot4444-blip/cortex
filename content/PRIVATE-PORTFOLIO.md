# Private learner portfolio

`/academy?view=portfolio` summarizes selected saved work from all seven Academy tracks. Nothing is automatically added or selected for export. An explicit addition freezes the displayed summary and its provenance in `cs-academy-portfolio-v1`; later changes to a course do not rewrite that copy. Learner reflections append separately with a recorded time and self-reported assistance choice. Hiding is reversible and never removes the original course record.

“Private” means there is no public page or sharing service. Portfolio entries follow the existing active-workspace account boundaries and sync with other study records when an account is used. The interface states this. No account identity is added to a portfolio export.

## Included evidence

The source adapter reads only these known study records, and constructs summaries field by field rather than copying whole records:

- MCAT course lessons: first and delayed application prompts, chosen answers, recorded correctness, confidence, times, later supported checks and current lesson notes. Missing older question snapshots are disclosed; current catalog wording is never substituted as the original.
- Learn to Learn and Psychology lessons: saved step prompts, first choices, written responses, recorded model openings and available comparisons. A whole lesson title or snapshot is not invented for older step-only records.
- Anatomy and Medicine foundation lessons: original response, current draft, comparison and recorded participation completion, using saved lesson wording.
- Clinical Shift reflections: saved differential rationale and assessment/plan, with draft versus locked writing distinguished. Longitudinal cases include presented checkpoint evidence, original reasoning, handoff drafts or the first handoff, and the later comparison. Unopened future model answers are excluded.
- Neuroengineering foundations: recorded recall, choices and debrief. Projects include exact checked code versions, the first example arguments and digest, recorded output text, first prediction, draft changes, assistance events and the written memo. The project player's separate Python export remains the complete runnable check artifact.

These adapters cover selected lesson and project records, not every legacy drill, simulation, exam, card, investigation or pilot-reflection store. Unsupported or malformed source entries are preserved and reported. The adapter does not infer missing work from completion flags, fetch newer teaching content, create scores or rewrite the originating records.

Every field is labeled context, original, draft, revision, assistance or result. Content review and independent review of learner work remain separate. No independent learner review is fabricated. An absence of recorded help does not establish unaided work, and a reported “no help” reflection remains self-report. Completion describes recorded participation, not accreditation, a clinical credential or professional competence.

## Export and recovery

The learner chooses visible entries, opens the complete JSON preview, explicitly marks it reviewed, then downloads those exact bytes. Cancellation, changed selection and navigation invalidate the old preview. Portfolio drafts that have not been recorded as reflections are excluded. Hidden entries, unselected entries, unknown imported keys, account tokens, owner identifiers and unrelated study records are not copied into the file. Writing can contain personal information supplied by the learner, which is visible in the full preview.

The JSON is unencrypted and downloading it does not send or publish it. It has a distinct `cortex-selected-portfolio` format and cannot be mistaken for a study-backup import. The regular study backup also retains the complete private portfolio, including hidden entries and unfinished drafts, under the existing restore preview and integrity checks.

Shared StudyStorage protects saves and retains pending drafts. Addition checks whether its source changed after inspection. Changing, preparing or downloading the portfolio checks the active account and current saved portfolio; a newer tab's record cannot be silently replaced or exported as if still current. Failed writes pause controls and remove export previews; retry restores the retained state. A malformed portfolio remains available for recovery.

All portfolio text, including Python and originally formatted prompts, is escaped and displayed literally. The backup validator treats this dedicated key as plain text while retaining protocol, identifier, record-key and prototype restrictions. Existing HTML lesson snapshots still use their separate markup validator.

## Local verification

Six core scenarios cover seven-track source selection, exact snapshots, delayed checks, append-only reflections, malformed/legacy sources, exclusion of future clinical answers and portable text backups. Seven jsdom scenarios run the actual portfolio controller, StudyStorage and account engine through addition, reload, literal HTML, explicit export, cancellation, reflection, hiding/restoring, quota recovery, stale data, account switching and navigation.

These tests do not establish browser layout, real file downloads, mobile interaction, account deployment behavior or learner usability. Actual browser walkthroughs remain pending while the Mac is locked.

Final consistency audit: the existing global “Everything” reset omits several newer Academy stores. Reconcile its scope and account-safe behavior during milestone 2.29; do not imply the current reset clears the entire Academy or quietly delete portfolio snapshots when resetting a source course.
