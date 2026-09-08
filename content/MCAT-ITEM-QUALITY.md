# MCAT item quality: descriptive local review

`/mcat?view=quality` reads supported saved records directly, without downloading current question banks or substituting current wording for an older response. It does not upload analytics, contact a reviewer or publish a concern. Private concerns follow ordinary account-workspace synchronization. Appropriate real-learner research data, independent measurement review and actual browser acceptance remain pending.

## Dataset and grain

Supported inputs are `cs-mcat-course-v1` lesson applications, completed `cs-mcat-v2` passage workshops and math tasks, and the capped `cs-mcat-log` practice history. The grain is a retained response event. A source/run/question identity is used when available. Course events use the unit/question identity because the player permits one original response per question.

Item groups keep delivery family, question ID, exact saved wording fingerprint, activity condition, exposure condition and support condition separate. The SHA-256 fingerprint covers the saved stem, canonical options, answer key, explanation and available passage/table or math context. Canonical choice indices are used rather than shuffled display letters. A missing or malformed context does not receive a known complete version. No current catalog join supplies missing historical content.

One workspace is not a verified sample of one person: it can be shared, migrated or contain repeated work. The unique learner count and consented research sample are explicitly unknown. Counts describe retained response records, including recorded omissions, and are not calibrated item difficulty, population reliability, transfer-effect estimates or MCAT score predictions.

## Quality checks and interpretation

- Exact duplicate stable event IDs are counted once. Conflicting records for one stable ID are all excluded; the code does not choose a favorable copy. Records without stable IDs remain counted with this limitation, because deduplication cannot safely be inferred.
- Missing original wording, choice, timestamp, exposure and support are reported. Known unanswered records remain distinct from missing choices. The practice log's 1,000-row retention limit is disclosed; its earliest retained row does not establish first exposure.
- Impossible choice indices, future timestamps and correctness inconsistent with a saved answer key are excluded from item rates. Unreadable source files are listed, and their unknown row counts are not reported as zero observed records. Profile counts can overlap; each group displays its own response denominator and missingness.
- Course first answers mean first retained within that lesson. Earlier exposure or outside help is unknown. A later supported check stays separate from the support conditions of the original answer.
- Completed passage workshops retain recorded repetition and assistance conditions. Active and parked workshops are excluded so this view cannot reveal answers withheld during blind review.
- Math includes earlier exposure recorded in its history, exposure ledger and diagnostic responses. Combined success requires both setup and calculation; their counts are also displayed separately. Routine setup feedback is labeled even when no additional help was recorded. New-context task results are descriptive and do not establish a causal transfer gain.
- Correctness is reported as correct retained records divided by all retained records in that exact group. Distractor counts share the group's denominator, with missing choices shown alongside them. No statistical significance threshold or automatic defect label is inferred from a small personal record.

The [2014 AERA/APA/NCME Testing Standards](https://www.testingstandards.net/uploads/7/6/6/4/76643089/standards_2014edition.pdf), especially Standards 1.0–1.1, 1.7–1.8 and 4.7–4.10, ground the distinction between an intended interpretation and the evidence needed to support it, including sampling, coaching and documented item-review methods. The local implementation is a descriptive review tool; this reference does not certify it or supply missing validation evidence.

## Concerns and exact exports

A learner can save an ambiguity/error concern only for an available saved item version. The report freezes its wording, context, conditions, fingerprint and note as an unreviewed concern. It does not mark the item defective, alter scores, retire an item or assign a reviewer. Saved report fingerprints are verified before opening. Changed or malformed reports stay available for recovery.

The `cs-mcat-item-reports-v1` record preserves unfinished drafts and saved reports through StudyStorage. Failed writes pause controls and exports; recovery retains the newest draft. Account, source and report-state checks prevent stale actions, including after asynchronous hashing. Navigation and canceled previews invalidate old download controls.

The review file contains the exact displayed descriptive summary and saved concerns. The full JSON is shown before an explicit reviewed-content checkbox and download. Account identifiers, raw workspace records, unknown imported fields and unfinished concern drafts are excluded. No submission occurs. Learner notes may themselves contain personal information, visible in the preview. The separate regular study backup includes the private report workspace and its drafts for restoration.

## Version history and editorial action

`scripts/check-mcat-item-history.cjs --json` derives an inspectable before/after history from the recorded baseline commit `9bbd1dd6149ce0a7f9b89b95dee96a107031ef02` and the current local files. It covers six sources: discrete questions, science passages, CARS passages, course questions, the added CARS pathway and math transfers. It keeps saved question/context snapshots and fingerprints, flags additions/revisions/removals, rejects duplicate source identities and records review status separately.

The current comparison contains 939 source item records: 96 added, 207 revised, 636 unchanged and none removed. These are source entries, not 939 independent validated questions or learner observations. The revisions came from the local author checks in earlier milestones; no change informed by actual learner research is claimed. The derived `mcat-item-version-history.json` accompanies the local handoff and is not uploaded by the product.

Editorial review must connect a concern to its exact fingerprint, check reasoning and distractors against sources, document the disposition, and revise or withdraw defective current material while preserving its earlier wording and learner records. A revision affecting a rehearsal must regenerate its form hash and revision and rerun the existing rehearsal gates; a withdrawal must leave incomplete forms unavailable rather than silently shortening them. No automatic retirement, automatic rescore, or retrospective rewrite is performed by the personal quality screen. No item has been withdrawn in this local comparison.

Stronger product claims require an appropriate prospective study: define the intended population and outcome, obtain suitable participation/data permissions, record exposure and support, keep stable item revisions and event identities, plan sample size and missing-data handling, and obtain measurement review. Those dependencies are pending and are not replaced by synthetic fixtures or this single-workspace tool.

## Verification

Ten core scenarios exercise missingness, exact/conflicting duplicates, wording/context versions, conditions, delayed checks, outcome consistency, future dates, math exposure, distractors, private concerns and backup preservation. Seven jsdom scenarios use the actual controller, StudyStorage and account engine for direct routing, drafts, save failures, asynchronous stale data, reviewed downloads, account changes, corrupted fingerprints and empty data. Existing MCAT loader checks remain applicable.

The source and test scripts are the inspectable analytical implementation. All test data is explicitly synthetic. These checks do not establish real browser behavior, learner usability, scientific validation or a sufficient research sample.
