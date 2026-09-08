# Saved Psychology practice

The legacy practice tools now keep one current session under the existing
`cs-cogpsych.practice` record. No separate storage module or key was added.
The seven entry modes share one player and the existing account/save recovery
contract. This is optional draft practice, not a validated assessment.

A session freezes the question queue or Smart Review source pool, current
question, answer order, selected answer and feedback, retry queue, counters,
hint/tool-use flags, calculator, scratchpad, and remaining quick-recall time.
Reopening answered feedback does not call the answer recorder again. Answer,
per-question totals and achievement changes are saved together in the same root
record. Failed writes keep the newest copy in the recovery dialog; account or
newer-copy conflicts cannot overwrite the other workspace.

The 90-second quick-recall clock pauses on leaving or hiding the practice.
Ordinary reload saves remaining time; an abrupt reload uses the last stored
deadline, so a terminated page cannot silently restart its clock. This is a
pausable study activity, not official exam timing. A stale delayed advance or
interval cannot act on the replacement question. Saved practice can reopen when
the optional bank or lesson download fails because its question content is local.

Calculator and scratchpad are available in every practice question. Notes are
plain text and capped at 6,000 characters. Recorded assistance includes displayed
retry hints and calculator/scratchpad use before answering; outside help remains
unknown. Readable saved tools carried into a new question count as assistance.
Using tools after the answer does not rewrite the original answer's conditions.
Backup import keeps this subtree as escaped text, while lesson HTML keeps its
existing inert-markup validation.

The latest completed session remains available until a new session starts.
Older cumulative question totals, lesson records and achievements remain. This
change does not reconstruct historical answer choices that the legacy product
never stored, and it does not provide a complete historical attempt ledger.
The private portfolio does not treat these legacy practice totals as independent
learning evidence. Ending early does not award a course-challenge pass.

Validation: twelve actual-controller jsdom scenarios cover all seven entry
modes, frozen content and retries, saved feedback, assistance, failed answer and
completion saves, timers, detached callbacks, changed accounts, newer progress,
invalid records and portable backups. Existing Psychology lesson checks also
pass. These are not actual-browser, native-download, mobile accessibility or
human learning results. Browser acceptance and independent review remain open.
