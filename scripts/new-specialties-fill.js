export const meta = {
  name: 'new-specialties-fill',
  description: 'Generate only the MISSING clinical-case batches (idempotent gap-fill)',
  phases: [
    { title: 'Topics', detail: 'one curator per specialty → fresh topics avoiding existing diagnoses' },
    { title: 'Generate', detail: 'one writer per missing batch → data/raw JSON' },
  ],
}

const RAW = '/Users/kevinvigil/Documents/clinical-scenarios/data/raw'
const EMBEDDED_PLAN = [{"key": "endocrinology", "name": "Endocrinology", "missingBatches": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "existingDx": []}, {"key": "hematology-oncology", "name": "Hematology & Oncology", "missingBatches": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "existingDx": []}, {"key": "ophthalmology", "name": "Ophthalmology", "missingBatches": [2], "existingDx": ["Acute bacterial conjunctivitis", "Adenoviral (viral) conjunctivitis", "Allergic conjunctivitis (seasonal)", "External hordeolum (stye)", "Chalazion", "Blepharitis (with ocular rosacea/meibomian gland dysfun", "Dry eye disease (keratoconjunctivitis sicca), Sjogren-a", "Subconjunctival hemorrhage", "Corneal abrasion", "Pterygium", "Herpes zoster ophthalmicus (V1) with associated keratit", "Acute anterior uveitis (iritis), HLA-B27-associated wit", "Orbital (postseptal) cellulitis with subperiosteal absc", "Preseptal (periorbital) cellulitis following an insect ", "Optic neuritis (retrobulbar) as a clinically isolated s", "Giant cell (temporal) arteritis with arteritic anterior", "Idiopathic intracranial hypertension (pseudotumor cereb", "Age-related nuclear sclerotic cataract", "Open globe rupture with intraocular metallic foreign bo", "Ocular alkali (chemical) burn with limbal ischemia", "Acute postoperative bacterial endophthalmitis (coagulas", "Pupil-involving third (oculomotor) nerve palsy from a p", "Sixth (abducens) nerve palsy as a false-localizing sign", "Decompensated congenital right fourth (trochlear) nerve", "Right Horner syndrome (preganglionic) from a Pancoast (", "Adie (tonic) pupil with hyporeflexia (Holmes-Adie syndr", "Retinopathy of prematurity, zone II stage 3 with plus d", "Retinoblastoma (unilateral, intraocular) with possible ", "Congenital nasolacrimal duct obstruction", "Acute dacryocystitis from underlying nasolacrimal duct ", "Anisometropic amblyopia of the right eye due to uncorre", "Infantile (congenital) esotropia with cross-fixation", "Accommodative esotropia with a high AC/A ratio", "Thyroid eye disease (Graves orbitopathy) with compressi", "Keratoconus (progressive, bilateral)", "Episcleritis (sectoral, self-limited)", "Anterior scleritis associated with rheumatoid arthritis", "Branch retinal vein occlusion with macular edema", "Branch retinal artery occlusion from carotid embolus (H", "Malignant (severe) hypertensive retinopathy in a hypert", "Center-involving diabetic macular edema secondary to no", "Vitreous hemorrhage from proliferative diabetic retinop", "Acute posterior vitreous detachment (with Weiss ring), ", "Full-thickness macular hole (right eye)", "Epiretinal membrane (macular pucker), left eye", "Central serous chorioretinopathy (right eye)", "Retinitis pigmentosa (X-linked recessive pattern)", "Optic disc drusen causing pseudopapilledema", "Nonarteritic anterior ischemic optic neuropathy (right ", "Nonfunctioning pituitary macroadenoma compressing the o", "Congruous right homonymous hemianopia with macular spar", "Floppy eyelid syndrome with chronic mechanical papillar", "Involutional lower-eyelid entropion with mechanical (la", "Involutional lower-eyelid ectropion with epiphora and e", "Aponeurotic (involutional) ptosis from levator aponeuro", "Nodular basal cell carcinoma of the lower eyelid", "Sebaceous gland carcinoma of the eyelid (chalazion masq", "Ocular surface squamous neoplasia (conjunctival/corneal", "Choroidal (uveal) melanoma, medium-sized, with exudativ", "Corneal and retained subtarsal metallic foreign body wi", "Recurrent corneal erosion secondary to epithelial basem", "Filamentous fungal keratitis (Fusarium/Aspergillus) fol", "Acanthamoeba keratitis in a contact-lens wearer with wa", "Cytomegalovirus (CMV) retinitis in advanced HIV/AIDS", "Reactivated toxoplasma chorioretinitis", "Endogenous Candida endophthalmitis", "Sarcoid (granulomatous) panuveitis", "Sympathetic ophthalmia", "Posterior subcapsular cataract (steroid-induced)", "Congenital cataract (unilateral) with risk of deprivati", "Ectopia lentis (superotemporal lens subluxation) due to", "Phacomorphic glaucoma (acute secondary angle closure fr", "Neovascular glaucoma secondary to ischemic central reti", "Pigmentary glaucoma (from pigment dispersion syndrome)", "Pseudoexfoliation glaucoma", "Primary congenital glaucoma (buphthalmos with Haab stri", "Normal-tension glaucoma", "Internuclear ophthalmoplegia due to an MLF lesion in mu", "Ocular myasthenia gravis", "Septic cavernous sinus thrombosis"]}, {"key": "otolaryngology", "name": "Otolaryngology (ENT)", "missingBatches": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "existingDx": []}, {"key": "pediatric-neurology", "name": "Pediatric Neurology", "missingBatches": [2, 3, 6, 10], "existingDx": ["Simple febrile seizure secondary to acute otitis media", "Complex febrile seizure (focal, prolonged) with Todd pa", "Cyanotic breath-holding spells associated with iron-def", "Pallid breath-holding spells (reflex vagal asystole) wi", "Childhood absence epilepsy", "Juvenile myoclonic epilepsy", "Benign epilepsy with centrotemporal spikes (rolandic ep", "Infantile spasms (West syndrome), likely due to tuberou", "Lennox-Gastaut syndrome", "Dravet syndrome (SCN1A-related developmental and epilep", "Febrile (influenza A-associated) convulsive status epil", "Streptococcus pneumoniae bacterial meningitis", "Late-onset group B Streptococcus neonatal meningitis wi", "Enteroviral (aseptic/viral) meningitis", "Herpes simplex virus (HSV) encephalitis with temporal l", "Becker muscular dystrophy", "Spinal muscular atrophy type 1", "Juvenile myasthenia gravis", "Infant botulism", "Tick paralysis", "Sturge-Weber syndrome (encephalotrigeminal angiomatosis", "Ataxia-telangiectasia (Louis-Bar syndrome) due to biall", "Migraine without aura (pediatric)", "Migraine with aura (pediatric)", "Abdominal migraine", "Tension-type headache (episodic, with contributing anal", "Idiopathic intracranial hypertension (pseudotumor cereb", "Medulloblastoma (posterior fossa) with obstructive hydr", "Pilocytic astrocytoma (juvenile cerebellar, WHO grade 1", "Craniopharyngioma (suprasellar, adamantinomatous type)", "Diffuse intrinsic pontine glioma (diffuse midline gliom", "Optic pathway glioma in neurofibromatosis type 1", "Concussion (mild traumatic brain injury)", "Epidural hematoma", "Abusive head trauma (inflicted subdural hematoma)", "Post-varicella acute cerebellar ataxia", "Opsoclonus-myoclonus syndrome secondary to neuroblastom", "Sydenham chorea (post-streptococcal, a major criterion ", "Tourette syndrome (with comorbid OCD and ADHD)", "Provisional (transient) tic disorder", "Restless legs syndrome with periodic limb movement diso", "Sleep terrors (non-REM parasomnia)", "Narcolepsy type 1 (narcolepsy with cataplexy, hypocreti", "Friedreich ataxia (homozygous FXN GAA repeat expansion)", "Charcot-Marie-Tooth disease type 1A (PMP22 duplication,", "Childhood cerebral X-linked adrenoleukodystrophy (ABCD1", "Late-infantile metachromatic leukodystrophy (arylsulfat", "Infantile Tay-Sachs disease (GM2 gangliosidosis, hexosa", "Wilson disease (ATP7B mutation) with neurologic and hep", "GLUT1 deficiency syndrome (SLC2A1 mutation)", "Pyridoxine-dependent epilepsy (antiquitin/ALDH7A1 defic", "Congenital obstructive hydrocephalus due to aqueductal ", "Ventriculoperitoneal shunt malfunction (catheter fractu", "Open lumbosacral myelomeningocele with Chiari II malfor", "Symptomatic Chiari I malformation with syringomyelia", "Tethered cord syndrome (symptomatic, with low-lying con", "Sagittal (nonsyndromic) craniosynostosis with scaphocep", "Pediatric arterial ischemic stroke due to post-varicell", "Overt arterial ischemic stroke in homozygous sickle cel", "Moyamoya disease with recurrent transient ischemic atta", "Cerebral venous sinus thrombosis (superior sagittal and", "Ruptured cerebral arteriovenous malformation with intra", "Vein of Galen malformation presenting with neonatal hig", "Neonatal seizures due to hypoglycemia in an infant of a", "Late-onset neonatal seizures due to hypocalcemia (hyper", "Benign neonatal sleep myoclonus", "Benign paroxysmal vertigo of childhood", "Cyclic vomiting syndrome", "Psychogenic non-epileptic seizures (PNES)", "Vasovagal (reflex) syncope", "Global developmental delay", "Autism spectrum disorder", "Attention-deficit/hyperactivity disorder (ADHD)", "Benign familial macrocephaly", "Congenital Zika syndrome with microcephaly"]}];
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
  - "answer" = 0-BASED index; VARY which position is correct across questions/cases
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
