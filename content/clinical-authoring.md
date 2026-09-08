# Authoring a Clinical Shift encounter

Start from `clinical-case-template.json`. It is an authoring envelope, not a playable patient. Write one fictional presentation around one reasoning objective; keep findings unavailable until their intended stage. A changed scenario in a contrast question must be explicitly separate from the actual patient.

Check the source's current primary guidance, units, regional context, assumptions and relevant alternatives. Give each wrong option a plausible reason a learner might choose it, then explain why it is less appropriate here. Keep uncertainty in the working diagnosis and final note. Do not turn a normal test into an unsupported exclusion claim.

Add the case to its existing specialty dataset with an unused stable ID. Add its index entry and update that specialty's count in `data/manifest.json`. Register the ID in `data/clinical-shift-pilot.json`, putting the envelope's investigations, model note and review record in the matching maps. Increment the manifest version and its browser fetch version. Preserve previous IDs and records; new encounters save a full copy of their content.

Run `node scripts/check-clinical-rotations.cjs` and the focused Clinical Shift regression checks. Use `node scripts/check-clinical-rotations.cjs --json` to produce the current review queue. The queue is derived from the registered content, so it cannot silently omit a new encounter. Automated validation checks structure and consistency; it cannot approve clinical reasoning.

Complete each encounter with real browser controls, including an incorrect choice, a saved differential, note comparison, reload and failed-save recovery. Record that evidence separately from independent clinician review. Do not fill a reviewer identity or change the review status without an actual review. Before publication, reconcile the clinician's comments against the exact content revision and recheck changed encounters.
