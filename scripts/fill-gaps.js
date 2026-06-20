export const meta = {
  name: 'fill-clinical-case-gaps',
  description: 'Generate only the MISSING clinical-case batches (idempotent gap-fill)',
  phases: [
    { title: 'Topics', detail: 'one curator per specialty → fresh topics avoiding existing diagnoses' },
    { title: 'Generate', detail: 'one writer per missing batch → data/raw JSON' },
  ],
}

const RAW = '/Users/kevinvigil/Documents/clinical-scenarios/data/raw'
const EMBEDDED_PLAN = [{"key": "emergency-medicine", "name": "Emergency Medicine", "missingBatches": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "existingDx": []}, {"key": "internal-medicine", "name": "Internal Medicine", "missingBatches": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "existingDx": []}, {"key": "cardiology", "name": "Cardiology", "missingBatches": [7, 8, 9, 10], "existingDx": ["Chronic stable angina due to obstructive coronary artery dis", "Primary (essential) hypertension, confirmed by ambulatory bl", "Primary hyperlipidemia warranting moderate-intensity statin ", "Vasovagal (reflex) syncope triggered by venipuncture", "Medication-induced orthostatic hypotension (polypharmacy: tr", "New-onset atrial fibrillation with rapid ventricular respons", "Chronic (likely persistent) atrial fibrillation with CHA2DS2", "AV nodal reentrant tachycardia (AVNRT)", "Benign premature ventricular complexes (RVOT morphology) in ", "Acute viral (idiopathic) pericarditis", "Mitral valve prolapse with trace mitral regurgitation", "Chronic severe primary (degenerative) mitral regurgitation f", "Severe symptomatic calcific aortic stenosis", "Acute decompensated heart failure (HFrEF) precipitated by di", "Peripheral arterial disease with intermittent claudication", "Asymptomatic infrarenal abdominal aortic aneurysm (4.4 cm) d", "Small restrictive muscular ventricular septal defect", "Hemodynamically significant patent ductus arteriosus in a pr", "Innocent (Still's) murmur", "White coat hypertension", "Holiday heart syndrome \u2014 alcohol-triggered paroxysmal atrial", "Acute anterior ST-elevation myocardial infarction (proximal ", "Mobitz type I (Wenckebach) second-degree AV block due to hig", "Situational (micturition) reflex syncope, with tamsulosin an", "Prosthetic (mechanical) aortic valve requiring infective end", "Asymptomatic severe hypertension (hypertensive urgency) due ", "Gastroesophageal reflux disease presenting as noncardiac che", "Ruptured infrarenal abdominal aortic aneurysm (8.2 cm) \u2014 eme", "Typical (cavotricuspid isthmus-dependent) atrial flutter wit", "Statin-associated muscle symptoms (myalgia with normal CK), ", "Non-ST-elevation myocardial infarction (NSTEMI)", "Inferior STEMI with right ventricular infarction", "Acute myocardial infarction (NSTEMI) with atypical presentat", "Unstable angina", "Cocaine-associated chest pain with myocardial infarction (co", "Vasospastic (Prinzmetal) angina", "Dressler syndrome (post-myocardial infarction immune-mediate", "Left ventricular aneurysm following anterior myocardial infa", "Left ventricular mural thrombus after anterior myocardial in", "New-onset heart failure with reduced ejection fraction (noni", "Heart failure with preserved ejection fraction (HFpEF)", "Peripartum cardiomyopathy", "Alcohol-induced (alcoholic) dilated cardiomyopathy", "Takotsubo (stress) cardiomyopathy", "Hypertrophic obstructive cardiomyopathy", "Anthracycline-induced cardiomyopathy (cancer therapy-related", "Tachycardia-induced cardiomyopathy due to atrial fibrillatio", "Severe rheumatic mitral stenosis unmasked by pregnancy", "Chronic severe aortic regurgitation meeting LV-dimension cri", "Bicuspid aortic valve with associated ascending aortic dilat", "Right-sided (tricuspid valve) infective endocarditis due to ", "Subacute bacterial endocarditis of the mitral valve due to v", "Acute rheumatic fever with carditis, migratory polyarthritis", "Marfan syndrome (FBN1 mutation) with aortic root dilation at", "Complete (third-degree) atrioventricular block presenting wi", "Mobitz type II second-degree atrioventricular block (infrano", "Sick sinus syndrome (tachy-brady syndrome) with paroxysmal a", "Multifocal atrial tachycardia in the setting of a COPD exace", "Asymptomatic Wolff-Parkinson-White pattern (ventricular pre-", "Stable monomorphic ventricular tachycardia in a patient with", "Bilateral atherosclerotic renal artery stenosis with recurre", "Hypertensive emergency with hypertensive encephalopathy (pos", "Acute viral (influenza-associated) myocarditis with mild lef", "Heterozygous familial hypercholesterolemia (pathogenic LDLR ", "Athlete's heart \u2014 physiologic left ventricular hypertrophy a"]}, {"key": "pulmonology", "name": "Pulmonology", "missingBatches": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "existingDx": []}, {"key": "gastroenterology", "name": "Gastroenterology", "missingBatches": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "existingDx": []}, {"key": "psychiatry", "name": "Psychiatry", "missingBatches": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "existingDx": []}, {"key": "obgyn", "name": "Obstetrics & Gynecology", "missingBatches": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "existingDx": []}, {"key": "pediatrics", "name": "Pediatrics", "missingBatches": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "existingDx": []}, {"key": "family-medicine", "name": "Family Medicine", "missingBatches": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "existingDx": []}, {"key": "neurosurgery", "name": "Neurosurgery", "missingBatches": [6], "existingDx": ["Acute epidural hematoma from middle meningeal artery lacerat", "Acute-on-chronic subdural hematoma in an anticoagulated pati", "Acute subdural hematoma in a patient anticoagulated with api", "Concussion (sport-related mild traumatic brain injury)", "L5-S1 lumbar disc herniation with right S1 radiculopathy", "Cauda equina syndrome from a large central L4-L5 disc hernia", "Lumbar spinal stenosis with neurogenic claudication", "Cervical spondylotic myelopathy", "C7 cervical radiculopathy", "Hypertensive intracerebral hemorrhage of the left basal gang", "Hypertensive cerebellar hemorrhage (>3 cm) with fourth-ventr", "Aneurysmal subarachnoid hemorrhage from a ruptured anterior ", "Cerebral vasospasm with delayed cerebral ischemia following ", "Glioblastoma (IDH-wildtype, WHO grade 4 astrocytoma) present", "Multiple brain metastases from lung adenocarcinoma.", "Incidental convexity meningioma (presumed WHO grade 1).", "Sporadic vestibular schwannoma (acoustic neuroma) of the rig", "Nonfunctioning pituitary macroadenoma with chiasmal compress", "Prolactinoma (prolactin-secreting pituitary microadenoma).", "Ventriculoperitoneal shunt malfunction from catheter disconn", "Ventriculoperitoneal shunt infection (coagulase-negative sta", "Normal pressure hydrocephalus (idiopathic)", "Pyogenic brain abscess from septic embolization in Staphyloc", "Spinal epidural abscess (T8\u2013T11) with cord compression, MRSA", "Carpal tunnel syndrome (median neuropathy at the wrist)", "Ulnar neuropathy at the elbow (cubital tunnel syndrome)", "Trigeminal neuralgia (V2-V3 distribution), likely neurovascu", "Chiari I malformation with cervical syringomyelia", "Idiopathic intracranial hypertension (pseudotumor cerebri)", "Symptomatic high-grade (80%) right internal carotid artery s", "Acute traumatic central cord syndrome", "Complete (ASIA A) cervical spinal cord injury with neurogeni", "Type II (Anderson-D'Alonzo) odontoid fracture", "Diffuse axonal injury (severe traumatic brain injury)", "Basilar skull fracture (temporal bone) with CSF otorrhea", "Open (compound) depressed skull fracture over the motor cort", "Severe traumatic brain injury with refractory intracranial h", "Post-traumatic cerebrospinal fluid rhinorrhea from an anteri", "Abusive head trauma (inflicted traumatic brain injury)", "Sagittal (single-suture) craniosynostosis", "Medulloblastoma (WHO grade 4 embryonal tumor) of the cerebel", "Pilocytic astrocytoma (WHO grade 1) of the right cerebellar ", "Adamantinomatous craniopharyngioma of the suprasellar region", "Fourth ventricular ependymoma arising from the floor of the ", "Diffuse intrinsic pontine glioma (diffuse midline glioma, H3", "Pineal germinoma causing Parinaud syndrome and obstructive h", "Colloid cyst of the third ventricle causing intermittent obs", "Cerebellar hemangioblastoma with secondary polycythemia, in ", "Primary CNS lymphoma (diffuse large B-cell type)", "CNS toxoplasmosis in advanced AIDS (CD4 40 cells/\u00b5L), with p", "Malignant right middle cerebral artery (MCA) infarction with", "Moyamoya disease (progressive bilateral distal ICA/circle-of", "Left vertebral artery dissection causing lateral medullary (", "Spinal epidural hematoma after epidural catheter removal on ", "Metastatic epidural spinal cord compression from prostate ca", "Brown-Sequard syndrome (right cord hemisection at T10) from ", "Anterior spinal cord syndrome from anterior spinal artery (a", "Syringomyelia associated with a Chiari I malformation", "Tethered cord syndrome (low-lying conus with a thickened, fa", "Myelomeningocele (open neural tube defect) with Chiari II ma", "Symptomatic Chiari II malformation with brainstem (lower cra", "Jefferson burst fracture of C1 with transverse atlantal liga", "Hangman's fracture \u2014 traumatic spondylolisthesis of C2, Levi", "Bilateral C5-C6 facet dislocation with incomplete spinal cor", "L1 burst fracture, neurologically intact, TLICS 2 with intac", "Asymptomatic atlantoaxial instability in Down syndrome (flex", "Rheumatoid atlantoaxial subluxation with periodontoid pannus", "SCIWORA \u2014 spinal cord injury without radiographic abnormalit", "Acute osteoporotic L1 vertebral compression fracture \u2014 conse", "Pott disease \u2014 tuberculous spondylitis of T9-T10 with parasp", "Pyogenic vertebral osteomyelitis with discitis (T9-T10) from", "Left frontal subdural empyema complicating frontal sinusitis", "Neurocysticercosis (solitary parenchymal cyst, vesicular sta", "Right mesial temporal sclerosis causing drug-resistant tempo", "Idiopathic Parkinson disease with motor fluctuations and dys", "Essential tremor, refractory to first-line pharmacotherapy", "Left hemifacial spasm due to AICA neurovascular compression ", "Neonatal upper-trunk (C5-C6) brachial plexus palsy, an Erb-D", "Traumatic preganglionic brachial plexus injury with multilev", "Common peroneal (fibular) neuropathy at the fibular head ('s", "Glioblastoma (IDH-wildtype high-grade glioma) abutting Broca", "Cerebral radiation necrosis at the prior glioma treatment si", "Diffuse low-grade (IDH-mutant) glioma of the left insula pre", "Neurofibromatosis type 2 with bilateral vestibular schwannom", "Olfactory groove meningioma producing Foster Kennedy syndrom", "Posterior fossa syndrome (cerebellar mutism) following medul", "Tension pneumocephalus after chronic subdural hematoma evacu", "Brain death (death by neurologic criteria) following severe ", "Growing skull fracture (post-traumatic leptomeningeal cyst) ", "Vein of Galen aneurysmal malformation presenting with neonat"]}];
const PLAN = EMBEDDED_PLAN.filter(p => p.missingBatches.length > 0)

const TOPIC_SCHEMA = {
  type: 'object',
  required: ['topics'],
  properties: {
    topics: {
      type: 'array',
      items: {
        type: 'object',
        required: ['dx', 'patient', 'setting', 'difficulty', 'angle'],
        properties: {
          dx: { type: 'string' },
          patient: { type: 'string' },
          setting: { type: 'string' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          angle: { type: 'string' },
        },
      },
    },
  },
}

const SUMMARY_SCHEMA = {
  type: 'object',
  required: ['files', 'caseCount'],
  properties: {
    files: { type: 'array', items: { type: 'string' } },
    caseCount: { type: 'number' },
    notes: { type: 'string' },
  },
}

function topicPrompt(sp, need) {
  const avoid = sp.existingDx && sp.existingDx.length
    ? `\n\nThese diagnoses ALREADY EXIST in the bank — do NOT repeat them (a different complication/population/decision-point angle is only allowed if the diagnosis itself differs):\n${sp.existingDx.map(d => '- ' + d).join('\n')}`
    : ''
  return `You are a senior ${sp.name} attending physician and medical educator. Produce EXACTLY ${need} DISTINCT clinical case topics for ${sp.name}. Do not read or write files — just think and return the structured list.

Coverage: span the breadth of ${sp.name} — ~40% bread-and-butter presentations, ~40% classic board-relevant (USMLE Step 2 CK / shelf) diagnoses, ~20% high-yield less-common conditions. Difficulty mix roughly 30% easy / 45% medium / 25% hard. Vary patient age, sex, and setting (ED, clinic, ward, ICU as appropriate). No two topics share a primary diagnosis unless the clinical angle clearly differs.${avoid}

For each topic return: dx (primary diagnosis), patient (age + sex, e.g. '58-year-old man'), setting, difficulty, angle (one-line hook — atypical presentation, key complication, classic finding, or management dilemma).`
}

function genPrompt(sp, batch, batchIdx) {
  const fileA = `${RAW}/${sp.key}-b${batchIdx}-a.json`
  const fileB = `${RAW}/${sp.key}-b${batchIdx}-b.json`
  return `You are a board-certified ${sp.name} attending writing detailed interactive clinical cases for a medical-student case simulator (step-through format like Neural Consult). Write EXACTLY 10 cases — one per assigned topic below, in order — then save them to disk.

ASSIGNED TOPICS:
${JSON.stringify(batch, null, 2)}

CASE FORMAT — each case is one JSON object with EXACTLY these fields:
{
  "title": "...",            // short, symptom-based, MUST NOT reveal the diagnosis
  "difficulty": "easy|medium|hard",
  "setting": "...",
  "patient": "...",
  "chiefComplaint": "...",   // one sentence
  "history": "...",          // 130-220 words: detailed HPI, PMH, meds w/ doses where relevant, allergies, social, family hx
  "vitals": {"BP": "132/84 mmHg", "HR": "96 bpm", "RR": "18 /min", "Temp": "37.2 °C", "SpO2": "98% RA"},
  "exam": "...",             // 60-130 words: focused exam with pertinent positives AND negatives
  "stages": [...],
  "diagnosis": "...",
  "pearls": ["...", "...", "..."]   // 3-4 high-yield one-liners
}

STAGES — ordered array:
- 4 question stages (5 for hard cases). Each: {"type":"question","label":"INITIAL APPROACH","question":"...","options":["...","...","...","..."],"answer":2,"explanation":"..."}
  - label = short uppercase step (INITIAL APPROACH, DIAGNOSIS, MANAGEMENT, DISPOSITION, COMPLICATION, NEXT STEP...)
  - 4-5 options, exactly one best answer; distractors plausible/commonly-confused
  - ALL options parallel in length and detail (~25-55 chars each) — never make the correct answer the longest/most detailed choice
  - "answer" = 0-BASED index; UNIFORMLY vary correct position (roughly equal A/B/C/D across the case bank)
  - explanation = 90-160 words: why the right answer is right AND a brief line on why each other is wrong
- 1-2 result stages interleaved where new data returns: {"type":"result","label":"LABS & IMAGING","content":"WBC 14.2 ×10³/µL\\nNa 128 mEq/L\\nCT head: ..."}  (realistic values WITH units, one finding per line via \\n)
- Typical flow: question -> result -> question -> question -> question

QUALITY: USMLE Step 2 CK / shelf level, clinically accurate, current guidelines. Internally consistent (vitals/exam/labs fit the dx). Each question answerable from info revealed before it. Do NOT add fields beyond the schema (no id, no specialty).

SAVE TO DISK (use the Write tool yourself):
1. Write cases 1-5 as a JSON array to: ${fileA}
2. Write cases 6-10 as a JSON array to: ${fileB}
3. Validate BOTH: run  python3 -m json.tool "<file>" > /dev/null  — if either fails, fix and re-validate until both parse.

Return via structured output: files written and total case count (10).`
}

const results = await pipeline(
  PLAN,
  (sp) => agent(topicPrompt(sp, sp.missingBatches.length * 10), { label: `topics:${sp.key}`, phase: 'Topics', schema: TOPIC_SCHEMA }),
  (topicsResult, sp) => {
    if (!topicsResult) { log(`topics FAILED for ${sp.key}`); return null }
    const topics = topicsResult.topics
    const jobs = sp.missingBatches.map((batchIdx, i) => ({ batchIdx, batch: topics.slice(i * 10, i * 10 + 10) }))
      .filter(j => j.batch.length === 10)
    return parallel(jobs.map((j) => () =>
      agent(genPrompt(sp, j.batch, j.batchIdx), { label: `gen:${sp.key}:b${j.batchIdx}`, phase: 'Generate', schema: SUMMARY_SCHEMA })
    )).then((sums) => {
      const ok = sums.filter(Boolean)
      const total = ok.reduce((a, s) => a + (s.caseCount || 0), 0)
      log(`${sp.key}: filled ${ok.length}/${jobs.length} missing batches (${total} cases)`)
      return { key: sp.key, total, batchesOk: ok.length }
    })
  }
)

return results.filter(Boolean)
