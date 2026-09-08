# ECG and laboratory interpretation: local authoring contract

This milestone is implemented locally. It has not been independently clinically reviewed, tested through the actual browser, or approved for publication. The displayed application version remains the last browser checkpoint.

## Learner experience

Medicine contains eight additional interpretation lessons, bringing its guided path to 22 lessons and 60 checks. The new lessons cover ECG measurement, AV timing, laboratory intervals, potassium/sample quality, acid–base compensation, ST/troponin, D-dimer and hemoglobin/oxygen delivery. Each new lesson requires a written explanation before showing its model, then a written comparison. Writing is not automatically graded. Existing lesson records retain their original content and optional-reflection rules.

Sixteen links connect these lessons with anatomy, physiology, the ECG/reference libraries and explicit Clinical Shift teaching objectives. The case objective register links back to the related lessons for em-015, em-016, em-033 and cd-019. Opening a case objective discloses its teaching focus but neither starts a patient encounter nor awards credit.

The ECG library retains all twenty stable pattern IDs and existing reviewed marks. Interpretation replaces abbreviated management recipes. Labels distinguish ST elevation from STEMI, pointed T waves from a measured potassium disorder, and a pre-excitation pattern from a symptomatic syndrome. Emergency context in the torsades/VF/asystole entries is linked to AHA guidance, not presented as a complete resuscitation algorithm.

## Trace model

`ecg-engine.js` uses seconds and millivolts, a six-second window and 250 samples/second. The original schematic signals use fixed event schedules and explicit P/QRS/T components. Atrial schedules remain regular in AV block models; Mobitz I varies conducted PR and omits a ventricular event, Mobitz II retains conducted PR, and complete block assigns independent atrial/ventricular schedules. Pre-excitation includes an actual initial slur. The polymorphic example changes polarity and includes a stated preceding-long-QT context. These are simplified teaching signals, not a physiological simulator, twelve-lead recording, rhythm detector or diagnostic instrument.

The small grid represents 0.04 s × 0.1 mV; large squares represent 0.20 s × 0.5 mV. SVG aspect ratio is preserved. The separate 1 mV/0.20 s calibration pulse is outside the signal region. A bounded horizontal region retains readable squares on small screens. Every plot has text and event measurements, without using the correct pattern name as its accessible label. Physical screen millimeters vary with zoom and hardware.

Source conventions: [University of Waterloo](https://uwaterloo.ca/systems-design-engineering/electrocardiography-cardiac-function), [MSD ECG reference](https://www.msdmanuals.com/professional/cardiovascular-disorders/cardiovascular-tests-and-procedures/electrocardiography), [AHA adult advanced life support](https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/adult-advanced-life-support). Source checks do not imply endorsement or independent review.

## Saved work

`cs-ekg` preserves legacy drill/by-category aggregates and reviewed IDs. New records store the actual samples, event times, description, content revision, sources, shuffled options, first choice, first explanation, comparison and timestamps. Reload uses that snapshot rather than regenerating from a later catalog. New exercise creation cannot discard an unfinished active exercise. A failed first-answer save cannot count the answer twice; the shared StudyStorage recovery retains the in-tab version. A failed new exercise save leaves the route identifying that pending record. Corrupt sessions pause rather than replacing the browser copy.

Routes use `/medicine?tool=ecg&mode=drill&record=…` and preserve gate/offline parameters. Same-route Medicine view generations reject late downloads. The lab browse route is `/medicine?tool=labs&mode=browse`. Other legacy reference drills retain their separate draft scope; this change does not claim that every older reference exercise is now a resumable interpretation assessment.

## Laboratory scope

All 84 existing lab IDs remain. Every row states interval/decision-limit context and pending clinical/laboratory review. Forty-nine rows have scoped content corrections recorded in `data/lab-context-revisions.json`. General editorial corrections are distinguished from targeted source checks. This is not validation of every legacy numeric interval or listed association. Both platelet references use the same illustrative interval and units. D-dimer identifies the cited assay and FEU convention; A1C categories and cortisol dynamic-test limits are separated from ordinary reference intervals. Source links accompany expanded reference and recall feedback.

Targeted sources include [MedlinePlus lab interpretation](https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/), [UK Kidney Association July 2026 update](https://www.ukkidney.org/health-professionals/guidelines/treatment-acute-hyperkalaemia-adults-0), [ACC troponin](https://www.acc.org/Latest-in-Cardiology/ten-points-to-remember/2022/07/14/18/12/High-Sensitivity-CTn-and-2021-Chest-Pain), [Mayo D-dimer](https://prd1.mayocliniclabs.com/test-catalog/overview/40936), [NICE CSF interpretation](https://www.nice.org.uk/guidance/ng240/chapter/recommendations), [NIDDK A1C](https://www.niddk.nih.gov/health-information/diagnostic-tests/a1c-test), [ATA thyroid testing](https://www.thyroid.org/thyroid-function-tests/), and [Mayo serum folate](https://www.mayocliniclabs.com/test-catalog/overview/800039). Row-level links document additional sources. Numerical examples in the lessons are original and explicitly illustrative.

## Verification boundaries

Passing local checks: thirteen ECG engine/handler scenarios; the full 22-lesson Medicine and 12-lesson Anatomy handlers; legacy Medicine storage/retry checks; Clinical Shift and rotation checks; authoring consistency for the eight lessons, four frozen traces, sixteen links, 84 rows and 49 scoped corrections; portable-backup and offline protocol checks. These are code/DOM-stub tests, not a browser walkthrough. The QRS-to-ST boundary test found a floating-point gap; quantized time subtraction corrected it and the four authored trace snapshots were regenerated before this checkpoint.

Browser verification still required after Mac unlock:

- Open every pattern at desktop, 390 px and 320 px; inspect grid, pulse, waveform shape, polarity and event measurements. Confirm page-level overflow stays absent while the plot/table scroll internally.
- Use keyboard navigation and accessible descriptions. Inspect text-only pattern identification, collapsed panels, focus behavior and return links.
- Complete all eight new lessons and several ECG exercises with wrong/correct first choices. Reload before answering, after feedback and after completing the comparison. Confirm first writing and times remain fixed.
- Exercise quota failure, recovery and another-tab conflict for `cs-ekg` and `cs-academy-reference-v1`. Confirm pending new-exercise routing and no duplicate count.
- Block the ECG catalog/Medicine lessons/Lab file separately, navigate away during loading and retry. Inspect historical records against changed authored content.
- Export/import representative ECG and lesson snapshots through the actual file chooser. Download and open the updated Medicine pack offline, complete an exercise and reconnect without mixing content versions.
- Follow every case/objective/lesson connection and verify the actual return experience. Offline cross-course destinations require the relevant downloaded course; no unsupported course is promised available.

Professional review must still approve actual waveform morphology, clinical wording, intervals/limits, distractors and educational reasoning. Agent checks cannot be recorded as that review.
