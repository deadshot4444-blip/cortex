export const meta = {
  name: 'bones-dataset',
  description: 'Enrich + adversarially verify the comprehensive human-skeleton bone dataset',
  phases: [
    { title: 'Enrich', detail: 'one anatomist agent per region adds latin/blurb/pearl' },
    { title: 'Verify', detail: 'second agent fact-checks laterality, latin, clinical pearls' },
  ],
}

// Canonical bones — ids MUST be preserved exactly (they map to SVG geometry).
const REGIONS = [
  { region: 'cranial', view: 'skull', bones: [
    { id: 'frontal', name: 'Frontal bone', paired: false },
    { id: 'parietal', name: 'Parietal bone', paired: true },
    { id: 'temporal', name: 'Temporal bone', paired: true },
    { id: 'occipital', name: 'Occipital bone', paired: false },
    { id: 'sphenoid', name: 'Sphenoid bone', paired: false },
    { id: 'ethmoid', name: 'Ethmoid bone', paired: false },
  ]},
  { region: 'facial', view: 'skull', bones: [
    { id: 'maxilla', name: 'Maxilla', paired: true },
    { id: 'zygomatic', name: 'Zygomatic bone', paired: true },
    { id: 'nasal', name: 'Nasal bone', paired: true },
    { id: 'lacrimal', name: 'Lacrimal bone', paired: true },
    { id: 'palatine', name: 'Palatine bone', paired: true },
    { id: 'inferior-nasal-concha', name: 'Inferior nasal concha', paired: true },
    { id: 'vomer', name: 'Vomer', paired: false },
    { id: 'mandible', name: 'Mandible', paired: false },
  ]},
  { region: 'ossicles-hyoid', view: 'skull', bones: [
    { id: 'malleus', name: 'Malleus', paired: true },
    { id: 'incus', name: 'Incus', paired: true },
    { id: 'stapes', name: 'Stapes', paired: true },
    { id: 'hyoid', name: 'Hyoid bone', paired: false },
  ]},
  { region: 'vertebral', view: 'spine', bones: [
    { id: 'atlas', name: 'Atlas (C1)', paired: false },
    { id: 'axis', name: 'Axis (C2)', paired: false },
    { id: 'cervical-vertebrae', name: 'Cervical vertebrae (C3–C7)', paired: false },
    { id: 'thoracic-vertebrae', name: 'Thoracic vertebrae (T1–T12)', paired: false },
    { id: 'lumbar-vertebrae', name: 'Lumbar vertebrae (L1–L5)', paired: false },
    { id: 'sacrum', name: 'Sacrum', paired: false },
    { id: 'coccyx', name: 'Coccyx', paired: false },
  ]},
  { region: 'thorax', view: 'thorax', bones: [
    { id: 'manubrium', name: 'Manubrium', paired: false },
    { id: 'sternum-body', name: 'Body of sternum', paired: false },
    { id: 'xiphoid-process', name: 'Xiphoid process', paired: false },
    { id: 'true-ribs', name: 'True ribs (1–7)', paired: true },
    { id: 'false-ribs', name: 'False ribs (8–10)', paired: true },
    { id: 'floating-ribs', name: 'Floating ribs (11–12)', paired: true },
  ]},
  { region: 'upper-limb', view: 'mixed', bones: [
    { id: 'clavicle', name: 'Clavicle', paired: true },
    { id: 'scapula', name: 'Scapula', paired: true },
    { id: 'humerus', name: 'Humerus', paired: true },
    { id: 'radius', name: 'Radius', paired: true },
    { id: 'ulna', name: 'Ulna', paired: true },
    { id: 'scaphoid', name: 'Scaphoid', paired: true },
    { id: 'lunate', name: 'Lunate', paired: true },
    { id: 'triquetrum', name: 'Triquetrum', paired: true },
    { id: 'pisiform', name: 'Pisiform', paired: true },
    { id: 'trapezium', name: 'Trapezium', paired: true },
    { id: 'trapezoid', name: 'Trapezoid', paired: true },
    { id: 'capitate', name: 'Capitate', paired: true },
    { id: 'hamate', name: 'Hamate', paired: true },
    { id: 'metacarpals', name: 'Metacarpals (I–V)', paired: true },
    { id: 'hand-proximal-phalanges', name: 'Proximal phalanges (hand)', paired: true },
    { id: 'hand-middle-phalanges', name: 'Middle phalanges (hand)', paired: true },
    { id: 'hand-distal-phalanges', name: 'Distal phalanges (hand)', paired: true },
  ]},
  { region: 'lower-limb', view: 'mixed', bones: [
    { id: 'ilium', name: 'Ilium', paired: true },
    { id: 'ischium', name: 'Ischium', paired: true },
    { id: 'pubis', name: 'Pubis', paired: true },
    { id: 'femur', name: 'Femur', paired: true },
    { id: 'patella', name: 'Patella', paired: true },
    { id: 'tibia', name: 'Tibia', paired: true },
    { id: 'fibula', name: 'Fibula', paired: true },
    { id: 'calcaneus', name: 'Calcaneus', paired: true },
    { id: 'talus', name: 'Talus', paired: true },
    { id: 'navicular', name: 'Navicular', paired: true },
    { id: 'cuboid', name: 'Cuboid', paired: true },
    { id: 'medial-cuneiform', name: 'Medial cuneiform', paired: true },
    { id: 'intermediate-cuneiform', name: 'Intermediate cuneiform', paired: true },
    { id: 'lateral-cuneiform', name: 'Lateral cuneiform', paired: true },
    { id: 'metatarsals', name: 'Metatarsals (I–V)', paired: true },
    { id: 'foot-proximal-phalanges', name: 'Proximal phalanges (foot)', paired: true },
    { id: 'foot-middle-phalanges', name: 'Middle phalanges (foot)', paired: true },
    { id: 'foot-distal-phalanges', name: 'Distal phalanges (foot)', paired: true },
  ]},
]

const SCHEMA = {
  type: 'object',
  required: ['bones'],
  properties: {
    bones: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'latin', 'paired', 'blurb', 'pearl'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          latin: { type: 'string', description: 'Latin/Terminologia Anatomica name' },
          paired: { type: 'boolean' },
          blurb: { type: 'string', description: 'one plain sentence: what it is / where it sits / what it articulates with, <= 140 chars' },
          pearl: { type: 'string', description: 'one high-yield or clinical fact (fracture pattern, landmark, board factoid), <= 160 chars' },
        },
      },
    },
  },
}

function enrichPrompt(r) {
  return `You are a professor of human gross anatomy. For each bone below, return an enriched record. Do NOT change the id or the English name. Do NOT add or remove bones.

Region: ${r.region}
Bones:
${JSON.stringify(r.bones, null, 2)}

For EACH bone provide:
- latin: the Latin / Terminologia Anatomica term (e.g. "Os frontale", "Mandibula", "Os coxae" parts as appropriate). For grouped entries (e.g. "Cervical vertebrae (C3–C7)") give the group Latin (e.g. "Vertebrae cervicales").
- blurb: ONE plain-English sentence — what the bone is, where it sits, and a key articulation or feature. <= 140 chars.
- pearl: ONE high-yield or clinical fact a med/anatomy student should know — a classic fracture, surgical landmark, foramen/structure that passes through, mnemonic anchor, or board factoid. <= 160 chars.
- keep paired exactly as given.

Be accurate and specific. Return all ${r.bones.length} bones.`
}

function verifyPrompt(region, bones) {
  return `You are a meticulous anatomy fact-checker. Review this enriched ${region} bone dataset and return the CORRECTED full list (same ids, same count). Fix any errors in: Latin terminology, laterality (paired vs single — e.g. frontal/occipital/sphenoid/ethmoid/vomer/mandible/hyoid/sacrum/coccyx are single; parietal/temporal/maxilla/zygomatic/nasal/lacrimal/palatine and all limb bones are paired), anatomical blurb accuracy, and clinical-pearl correctness. Tighten any blurb >140 chars or pearl >160 chars. Keep every id and English name unchanged.

Dataset:
${JSON.stringify(bones, null, 2)}`
}

const merged = await pipeline(
  REGIONS,
  (r) => agent(enrichPrompt(r), { label: `enrich:${r.region}`, phase: 'Enrich', schema: SCHEMA })
            .then(res => ({ region: r.region, bones: (res?.bones || []).map(b => ({ ...b })) })),
  (res, r) => {
    if (!res || !res.bones.length) { log(`enrich FAILED ${r.region}`); return null }
    return agent(verifyPrompt(r.region, res.bones), { label: `verify:${r.region}`, phase: 'Verify', schema: SCHEMA })
      .then(v => {
        const bones = (v?.bones && v.bones.length === res.bones.length) ? v.bones : res.bones
        log(`${r.region}: ${bones.length} bones verified`)
        return bones.map(b => ({ ...b, region: r.region, view: r.view }))
      })
  }
)

const all = merged.filter(Boolean).flat()
log(`TOTAL enriched bones: ${all.length}`)
return all
