# Longitudinal Clinical Shift, local milestone 2.22

Three original fictional cases connect initial reasoning, evolving findings and a later handoff. The collection has 15 checkpoints, 18 explicit branches and 12 complete paths. Independent clinician review and actual browser acceptance remain pending. These cases are a separate collection; the 18 selected single-encounter shifts and the broader classic case-bank counts have not been relabeled or increased.

## Learning contract

The learner records a working explanation, a competing explanation or uncertainty, the evidence and a chosen next step. Saving locks that first reasoning before exposing an authored comparison. The next checkpoint supplies either later clinical evidence or an explicitly labeled teaching pause. Teaching pauses do not imply that a patient was discharged, that care was delayed or that a particular adverse outcome occurred.

Each case ends with later follow-up and a written handoff: situation, assessment, uncertainty, next steps with ownership, and how reasoning changed. The first handoff is locked before the model opens. A final comparison or unresolved question is required to finish. Presence checks do not evaluate the medical quality of prose. The model is an authored example, not a competence grade, professional signoff or complete management protocol.

## Content and sources

- `timeline-chest`: early observations, dynamic ECG/biomarker changes and an inpatient handoff. Values belong to an invented assay context. They do not form a validated discharge algorithm. The official ACC August 2026 summary of the Fifth Universal Definition of MI was checked; its linked full JACC paper returned 403 and was not treated as read. No mechanism subtype is assigned.
- `timeline-potassium`: an urgent hemolyzed-result callback, prompt untreated paired repeat samples and next-day reconciliation. The source is UK guidance; the case does not claim to be a local US treatment protocol. Verification is not permission to dismiss a concerning result.
- `timeline-syncope`: an incomplete situational account, collateral recurrence/conduction concerns and subsequent symptom-rhythm correlation. The later rhythm report is synthetic. It does not prove every earlier episode had the same mechanism or supply a device decision.

Each source link, its scope, the content revision, author-check date and pending independent review are stored in `data/clinical-longitudinal.json`. Every checkpoint carries review questions. Reviewer identity and review date are null. Clinical reviewers must inspect each reachable branch, alternatives, escalation language, sampling/timing assumptions, handoff omissions and the limits of the supplied reports.

The August 2026 MI-definition update also belongs on the final Academy consistency audit. Older material must be checked before making current-classification claims; a source check on these three new cases does not update or validate every older reference.

## Persistence and integration

`clinical-longitudinal-engine.js` implements immutable transitions and validates case graphs and saved branch sequences. `clinical-longitudinal.js` uses StudyStorage with `cs-clinical-longitudinal-v1`. Each run holds its complete original case snapshot, first reasoning, handoff and comparison. Catalog changes do not rewrite existing runs. Completed records are retained without an automatic count-based eviction.

Draft inputs save before further evidence. Failed writes retain a recovery copy in the open tab and keep the next screen closed until recovery succeeds. Completion archives the full run and clears the active run in one write. Account or newer-tab conflicts pause saving. A new case cannot replace an unfinished encounter without an explicit discard action. Malformed saved sequences are retained with recovery, not guessed into a new stage.

The entry route is `/practice?view=longitudinal`; selected-case discovery adds `case=timeline-chest`, and saved work uses `run=…`. Direct resume needs no catalog download. The existing Clinical Shift route hands off before its specialty-manifest fetch, and its recovery event does not take over a timeline. Academy Today points to the more recently started unfinished clinical workspace and counts distinct completed cases. These are completion records, not performance or competence scores.

The collection appears in curriculum discovery without future findings or model answers. It is included in the Clinical offline pack, the portable study-backup allowlist and Clinical progress reset. All records remain scoped to the active account/workspace through the existing progress ownership mechanism.

## Verification and review queue

Run from the repository root:

```sh
node scripts/check-clinical-longitudinal.cjs --json
node --test scripts/test-clinical-longitudinal.cjs
node --test scripts/test-clinical-longitudinal-ui.cjs
```

The UI test requires jsdom from a development installation or NODE_PATH. It uses the actual controllers and StudyStorage, including the legacy route handoff, all 12 paths, frozen snapshots, direct reload, failed draft/decision/advance/handoff/archive writes, account and tab conflicts, backup, reset, unavailable downloads and malformed saved work. This is DOM verification, not a real browser walkthrough.

The checker derives every branch and full path from playable content, includes checkpoint review questions and records a SHA-256 digest of each exact case revision. A reviewed disposition must match that revision and digest; structural success cannot fill the reviewer fields.

Actual browser acceptance must exercise all three cases and every teaching branch, first-use and saved routes, keyboard controls, narrow layout, scroll/focus behavior, reload with drafts, the final first-handoff comparison, unavailable download recovery, a failed write, the study-backup dialog and offline resume. Record evidence separately from code checks. The Mac was locked when browser access was retried during implementation; no browser acceptance is claimed.
