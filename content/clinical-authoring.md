# Authoring a Clinical Shift encounter

Start from `clinical-case-template.json`. It is an authoring envelope, not a playable patient. Write one fictional presentation around one reasoning objective; keep findings unavailable until their intended stage. A changed scenario in a contrast question must be explicitly separate from the actual patient.

Check the source's current primary guidance, units, regional context, assumptions and relevant alternatives. Give each wrong option a plausible reason a learner might choose it, then explain why it is less appropriate here. Keep uncertainty in the working diagnosis and final note. Do not turn a normal test into an unsupported exclusion claim.

Add the case to its existing specialty dataset with an unused stable ID. Add its index entry and update that specialty's count in `data/manifest.json`. Register the ID in `data/clinical-shift-pilot.json`, putting the envelope's investigations, model note and review record in the matching maps. Increment the manifest version and its browser fetch version. Preserve previous IDs and records; new encounters save a full copy of their content.

Run `node scripts/check-clinical-rotations.cjs` and the focused Clinical Shift regression checks. Use `node scripts/check-clinical-rotations.cjs --json` to produce the current review queue. The queue is derived from the registered content, so it cannot silently omit a new encounter. Automated validation checks structure and consistency; it cannot approve clinical reasoning.

Complete each encounter with real browser controls, including an incorrect choice, a saved differential, note comparison, reload and failed-save recovery. Record that evidence separately from independent clinician review. Do not fill a reviewer identity or change the review status without an actual review. Before publication, reconcile the clinician's comments against the exact content revision and recheck changed encounters.

## Writing a reacting patient

A reacting patient is a second layer over one registered encounter, stored under `reactions` in `data/clinical-shift-pilot.json` and keyed by the case ID. The case itself is not edited: its options, answer key, explanations and model note stay as they were reviewed. The layer gives the same encounter to a reader with no clinical training, and gives every option a consequence.

Write it for a pre-medical student. Use plain words first and name the clinical term once, in "words to know", where it helps. The learner is the student on the team; a resident asks what they would do and makes the safe call when theirs is not. Avoid gendered or cultural assumptions the case does not state.

For each decision stage, in the case's own option order, write one plain option and one outcome:

- `safe` belongs to the case's keyed answer and to nothing else. It costs the minutes the action really takes.
- `near-miss` is an order that would have harmed the patient and is stopped by someone on the team before it reaches them. It changes no vital sign and no status.
- `delay` plays out. The patient is left visibly worse: a status of `unstable`, `worse` or `critical`, an alarm line, and usually changed readings with a direction.

A learner can reach any decision by any mix of earlier calls, and each outcome carries fixed readings. A reading marked as rising must therefore be higher than any value an earlier stage could have left, and one marked as falling lower. Keep late signs for late delays; do not show a full picture of deterioration after the first slow call if the sources describe it as late.

Also write the plain handoff, the plain investigation items (one for one with the authored list), a plain version of every result, the plain diagnosis question with a reveal, an ending for a stable, a worse and a critical patient, and one to four science links. A science link names an MCAT lesson by its unit ID and current title; the idea it states must be true of this patient, not only of the topic.

Check every consequence against a current primary source and list the sources in the layer with the date you checked them. The layer carries its own `independentReview`, which stays `pending` until a clinician has reviewed the reactions themselves. A review of the underlying case does not cover them.

Run `node scripts/check-clinical-rotations.cjs`, `node --test scripts/test-clinical-reactions.cjs` and `node scripts/run-browser-tests.mjs smoke-clinical-reacting`. The first holds the layer to its case option for option; the second plays every reacting patient on its safest and its most harmful path; the third plays one through a real browser at desktop and phone widths. A layer that no longer lines up with its case is ignored at run time and the encounter falls back to the classic format, so a consequence is never shown for the wrong option.
