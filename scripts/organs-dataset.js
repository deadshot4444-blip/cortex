export const meta = {
  name: 'organs-dataset',
  description: 'Enrich + verify the organ-parts dataset (heart, brain, lung, kidney, neuron, eye, ear)',
  phases: [
    { title: 'Enrich', detail: 'one anatomist per organ adds latin/blurb/pearl' },
    { title: 'Verify', detail: 'fact-check structure + function + clinical pearl' },
  ],
}

// Canonical parts — ids MUST be preserved (they map to image hotspots).
const ORGANS = [
  { organ: 'heart', view: 'heart', context: 'anterior external view of the human heart and great vessels', parts: [
    { id: 'right-atrium', name: 'Right atrium' }, { id: 'right-ventricle', name: 'Right ventricle' },
    { id: 'left-atrium', name: 'Left atrium' }, { id: 'left-ventricle', name: 'Left ventricle' },
    { id: 'aorta', name: 'Aorta (aortic arch)' }, { id: 'pulmonary-trunk', name: 'Pulmonary trunk' },
    { id: 'superior-vena-cava', name: 'Superior vena cava' }, { id: 'inferior-vena-cava', name: 'Inferior vena cava' },
    { id: 'pulmonary-arteries', name: 'Pulmonary arteries' }, { id: 'pulmonary-veins', name: 'Pulmonary veins' },
    { id: 'lad-artery', name: 'Left anterior descending artery' }, { id: 'right-coronary-artery', name: 'Right coronary artery' },
    { id: 'apex', name: 'Apex of the heart' },
  ]},
  { organ: 'brain-lateral', view: 'brain-lateral', context: 'lateral (side) view of the cerebral hemisphere and brainstem', parts: [
    { id: 'frontal-lobe', name: 'Frontal lobe' }, { id: 'parietal-lobe', name: 'Parietal lobe' },
    { id: 'temporal-lobe', name: 'Temporal lobe' }, { id: 'occipital-lobe', name: 'Occipital lobe' },
    { id: 'cerebellum', name: 'Cerebellum' }, { id: 'pons', name: 'Pons' }, { id: 'medulla', name: 'Medulla oblongata' },
    { id: 'precentral-gyrus', name: 'Precentral gyrus (primary motor cortex)' }, { id: 'postcentral-gyrus', name: 'Postcentral gyrus (primary somatosensory cortex)' },
    { id: 'central-sulcus', name: 'Central sulcus' }, { id: 'lateral-sulcus', name: 'Lateral sulcus (Sylvian fissure)' },
  ]},
  { organ: 'brain-sagittal', view: 'brain-sagittal', context: 'midsagittal section of the brain showing deep structures', parts: [
    { id: 'corpus-callosum', name: 'Corpus callosum' }, { id: 'thalamus', name: 'Thalamus' },
    { id: 'hypothalamus', name: 'Hypothalamus' }, { id: 'pituitary-gland', name: 'Pituitary gland' },
    { id: 'midbrain', name: 'Midbrain' }, { id: 'pons', name: 'Pons' }, { id: 'medulla', name: 'Medulla oblongata' },
    { id: 'cerebellum', name: 'Cerebellum' }, { id: 'fornix', name: 'Fornix' }, { id: 'pineal-gland', name: 'Pineal gland' },
    { id: 'cingulate-gyrus', name: 'Cingulate gyrus' }, { id: 'corpora-quadrigemina', name: 'Corpora quadrigemina (tectum)' },
  ]},
  { organ: 'respiratory', view: 'respiratory', context: 'the lower respiratory tract: trachea, bronchi, and lung lobes', parts: [
    { id: 'larynx', name: 'Larynx' }, { id: 'trachea', name: 'Trachea' },
    { id: 'right-main-bronchus', name: 'Right main bronchus' }, { id: 'left-main-bronchus', name: 'Left main bronchus' },
    { id: 'right-upper-lobe', name: 'Right superior lobe' }, { id: 'right-middle-lobe', name: 'Right middle lobe' }, { id: 'right-lower-lobe', name: 'Right inferior lobe' },
    { id: 'left-upper-lobe', name: 'Left superior lobe' }, { id: 'left-lower-lobe', name: 'Left inferior lobe' },
    { id: 'bronchioles', name: 'Bronchioles' }, { id: 'diaphragm', name: 'Diaphragm' },
  ]},
  { organ: 'kidney', view: 'kidney', context: 'coronal (frontal) section of the kidney', parts: [
    { id: 'renal-cortex', name: 'Renal cortex' }, { id: 'renal-medulla', name: 'Renal medulla' },
    { id: 'renal-pyramid', name: 'Renal pyramid' }, { id: 'renal-column', name: 'Renal column' },
    { id: 'renal-pelvis', name: 'Renal pelvis' }, { id: 'major-calyx', name: 'Major calyx' }, { id: 'minor-calyx', name: 'Minor calyx' },
    { id: 'ureter', name: 'Ureter' }, { id: 'renal-artery', name: 'Renal artery' }, { id: 'renal-vein', name: 'Renal vein' },
    { id: 'renal-capsule', name: 'Renal capsule' }, { id: 'renal-hilum', name: 'Renal hilum' },
  ]},
  { organ: 'neuron', view: 'neuron', context: 'a typical multipolar neuron', parts: [
    { id: 'dendrites', name: 'Dendrites' }, { id: 'soma', name: 'Soma (cell body)' }, { id: 'nucleus', name: 'Nucleus' },
    { id: 'axon-hillock', name: 'Axon hillock' }, { id: 'axon', name: 'Axon' }, { id: 'myelin-sheath', name: 'Myelin sheath' },
    { id: 'node-of-ranvier', name: 'Node of Ranvier' }, { id: 'axon-terminal', name: 'Axon terminals' }, { id: 'schwann-cell', name: 'Schwann cell' },
  ]},
  { organ: 'eye', view: 'eye', context: 'horizontal section of the human eye', parts: [
    { id: 'cornea', name: 'Cornea' }, { id: 'iris', name: 'Iris' }, { id: 'pupil', name: 'Pupil' }, { id: 'lens', name: 'Lens' },
    { id: 'retina', name: 'Retina' }, { id: 'optic-nerve', name: 'Optic nerve' }, { id: 'sclera', name: 'Sclera' },
    { id: 'choroid', name: 'Choroid' }, { id: 'vitreous-body', name: 'Vitreous body' }, { id: 'ciliary-body', name: 'Ciliary body' },
    { id: 'fovea', name: 'Fovea centralis' }, { id: 'anterior-chamber', name: 'Anterior chamber' },
  ]},
  { organ: 'ear', view: 'ear', context: 'a coronal section of the ear: outer, middle, and inner ear', parts: [
    { id: 'auricle', name: 'Auricle (pinna)' }, { id: 'external-acoustic-meatus', name: 'External acoustic meatus' },
    { id: 'tympanic-membrane', name: 'Tympanic membrane' }, { id: 'malleus', name: 'Malleus' }, { id: 'incus', name: 'Incus' }, { id: 'stapes', name: 'Stapes' },
    { id: 'cochlea', name: 'Cochlea' }, { id: 'semicircular-canals', name: 'Semicircular canals' }, { id: 'vestibule', name: 'Vestibule' },
    { id: 'eustachian-tube', name: 'Eustachian (auditory) tube' }, { id: 'vestibulocochlear-nerve', name: 'Vestibulocochlear nerve (CN VIII)' },
  ]},
]

const SCHEMA = {
  type: 'object', required: ['parts'],
  properties: {
    parts: {
      type: 'array',
      items: {
        type: 'object', required: ['id', 'name', 'latin', 'blurb', 'pearl'],
        properties: {
          id: { type: 'string' }, name: { type: 'string' },
          latin: { type: 'string', description: 'Latin / Terminologia Anatomica term' },
          blurb: { type: 'string', description: 'one plain sentence: what it is / where it sits / its function. <=150 chars' },
          pearl: { type: 'string', description: 'one high-yield or clinical fact (board factoid, what it does, what fails). <=160 chars' },
        },
      },
    },
  },
}

function enrichPrompt(o) {
  return `You are a professor of human anatomy & physiology. For each labeled structure below (from ${o.context}), return an enriched record. Do NOT change the id or name; do NOT add/remove entries.

Organ/diagram: ${o.organ}
Structures:
${JSON.stringify(o.parts, null, 2)}

For EACH provide:
- latin: the Latin / Terminologia Anatomica term (e.g. "Atrium dextrum", "Lobus frontalis").
- blurb: ONE plain sentence — what the structure is, where it sits, and its main function. <=150 chars.
- pearl: ONE high-yield or clinical fact a med/MCAT student should know (e.g. LAD = "widow-maker"; precentral gyrus = primary motor / contralateral control; fovea = highest acuity, all cones). <=160 chars.

Accurate and board-relevant. Return all ${o.parts.length}.`
}
function verifyPrompt(organ, parts) {
  return `You are a meticulous anatomy fact-checker. Review this ${organ} dataset and return the CORRECTED full list (same ids, same count). Fix any errors in Latin, anatomical description, function, or clinical pearl. Tighten blurb>150 or pearl>160 chars. Keep ids and names unchanged.

${JSON.stringify(parts)}`
}

const merged = await pipeline(
  ORGANS,
  (o) => agent(enrichPrompt(o), { label: `enrich:${o.organ}`, phase: 'Enrich', schema: SCHEMA })
    .then(r => ({ organ: o.organ, view: o.view, parts: (r?.parts || []) })),
  (r, o) => {
    if (!r || !r.parts.length) { log(`enrich FAILED ${o.organ}`); return null }
    return agent(verifyPrompt(o.organ, r.parts), { label: `verify:${o.organ}`, phase: 'Verify', schema: SCHEMA })
      .then(v => {
        const parts = (v?.parts && v.parts.length === r.parts.length) ? v.parts : r.parts
        log(`${o.organ}: ${parts.length} parts`)
        return parts.map(p => ({ ...p, organ: o.organ, view: o.view }))
      })
  }
)
const all = merged.filter(Boolean).flat()
log(`TOTAL organ parts: ${all.length}`)
return all
