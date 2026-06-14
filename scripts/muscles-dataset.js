export const meta = {
  name: 'muscles-dataset',
  description: 'Enrich + adversarially verify the superficial-muscle dataset (origin/insertion/action/innervation)',
  phases: [
    { title: 'Enrich', detail: 'one anatomist agent per region group' },
    { title: 'Verify', detail: 'second agent fact-checks innervation, action, attachments' },
  ],
}

// Canonical muscles — ids MUST be preserved exactly (they map to image hotspots).
const GROUPS = [
  { group: 'head-neck', muscles: [
    { id: 'temporalis', name: 'Temporalis', paired: true },
    { id: 'masseter', name: 'Masseter', paired: true },
    { id: 'sternocleidomastoid', name: 'Sternocleidomastoid', paired: true },
  ]},
  { group: 'shoulder-chest-upperback', muscles: [
    { id: 'trapezius', name: 'Trapezius', paired: true },
    { id: 'deltoid', name: 'Deltoid', paired: true },
    { id: 'pectoralis-major', name: 'Pectoralis major', paired: true },
    { id: 'serratus-anterior', name: 'Serratus anterior', paired: true },
    { id: 'latissimus-dorsi', name: 'Latissimus dorsi', paired: true },
    { id: 'infraspinatus', name: 'Infraspinatus', paired: true },
    { id: 'teres-major', name: 'Teres major', paired: true },
  ]},
  { group: 'arm-forearm', muscles: [
    { id: 'biceps-brachii', name: 'Biceps brachii', paired: true },
    { id: 'brachioradialis', name: 'Brachioradialis', paired: true },
    { id: 'triceps-brachii', name: 'Triceps brachii', paired: true },
    { id: 'forearm-flexors', name: 'Forearm flexors (anterior compartment)', paired: true },
    { id: 'forearm-extensors', name: 'Forearm extensors (posterior compartment)', paired: true },
  ]},
  { group: 'trunk', muscles: [
    { id: 'rectus-abdominis', name: 'Rectus abdominis', paired: true },
    { id: 'external-oblique', name: 'External oblique', paired: true },
    { id: 'erector-spinae', name: 'Erector spinae', paired: true },
  ]},
  { group: 'hip-thigh', muscles: [
    { id: 'iliopsoas', name: 'Iliopsoas', paired: true },
    { id: 'tensor-fasciae-latae', name: 'Tensor fasciae latae', paired: true },
    { id: 'sartorius', name: 'Sartorius', paired: true },
    { id: 'rectus-femoris', name: 'Rectus femoris', paired: true },
    { id: 'vastus-lateralis', name: 'Vastus lateralis', paired: true },
    { id: 'vastus-medialis', name: 'Vastus medialis', paired: true },
    { id: 'adductor-longus', name: 'Adductor longus', paired: true },
    { id: 'adductor-magnus', name: 'Adductor magnus', paired: true },
    { id: 'gracilis', name: 'Gracilis', paired: true },
    { id: 'gluteus-maximus', name: 'Gluteus maximus', paired: true },
    { id: 'gluteus-medius', name: 'Gluteus medius', paired: true },
    { id: 'iliotibial-tract', name: 'Iliotibial tract (IT band)', paired: true },
    { id: 'biceps-femoris', name: 'Biceps femoris', paired: true },
    { id: 'semitendinosus', name: 'Semitendinosus', paired: true },
    { id: 'semimembranosus', name: 'Semimembranosus', paired: true },
  ]},
  { group: 'leg', muscles: [
    { id: 'tibialis-anterior', name: 'Tibialis anterior', paired: true },
    { id: 'gastrocnemius', name: 'Gastrocnemius', paired: true },
    { id: 'soleus', name: 'Soleus', paired: true },
    { id: 'fibularis-longus', name: 'Fibularis longus (peroneus longus)', paired: true },
    { id: 'calcaneal-tendon', name: 'Calcaneal (Achilles) tendon', paired: true },
  ]},
]

const SCHEMA = {
  type: 'object',
  required: ['muscles'],
  properties: {
    muscles: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'latin', 'paired', 'blurb', 'pearl'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          latin: { type: 'string' },
          paired: { type: 'boolean' },
          blurb: { type: 'string', description: 'one sentence: rough origin -> insertion and the MAIN action(s). <=150 chars' },
          pearl: { type: 'string', description: 'innervation (named nerve + root if classic) plus one high-yield/clinical fact. <=170 chars' },
        },
      },
    },
  },
}

function enrichPrompt(grp) {
  return `You are a professor of human gross anatomy. For each structure below return an enriched record. Do NOT change the id or name; do NOT add/remove entries.

Group: ${grp.group}
Structures:
${JSON.stringify(grp.muscles, null, 2)}

For EACH provide:
- latin: Latin / Terminologia Anatomica name (e.g. "Musculus biceps brachii"). For non-muscle structures (iliotibial tract, calcaneal tendon) give the proper Latin (Tractus iliotibialis, Tendo calcaneus).
- blurb: ONE sentence — rough origin -> insertion and the MAIN action. <=150 chars. (For IT band: what it is + function; for Achilles: which muscles form it + action.)
- pearl: the innervation (named nerve, + nerve root if classically tested, e.g. "Axillary nerve C5-C6") PLUS one high-yield or clinical fact (injury, sign, landmark, common tear). <=170 chars.
- keep paired as given.

Be accurate and board-relevant. Return all ${grp.muscles.length}.`
}

function verifyPrompt(group, muscles) {
  return `You are a meticulous anatomy fact-checker. Review this ${group} muscle dataset and return the CORRECTED full list (same ids, same count). Fix any errors in: Latin, innervation (nerve + roots), origin/insertion, primary action, and clinical pearls. Tighten blurb >150 chars or pearl >170 chars. Keep every id and name unchanged.

Dataset:
${JSON.stringify(muscles, null, 2)}`
}

const merged = await pipeline(
  GROUPS,
  (grp) => agent(enrichPrompt(grp), { label: `enrich:${grp.group}`, phase: 'Enrich', schema: SCHEMA })
    .then(res => ({ group: grp.group, muscles: (res?.muscles || []).map(m => ({ ...m })) })),
  (res, grp) => {
    if (!res || !res.muscles.length) { log(`enrich FAILED ${grp.group}`); return null }
    return agent(verifyPrompt(grp.group, res.muscles), { label: `verify:${grp.group}`, phase: 'Verify', schema: SCHEMA })
      .then(v => {
        const muscles = (v?.muscles && v.muscles.length === res.muscles.length) ? v.muscles : res.muscles
        log(`${grp.group}: ${muscles.length} muscles verified`)
        return muscles.map(m => ({ ...m, group: grp.group }))
      })
  }
)

const all = merged.filter(Boolean).flat()
log(`TOTAL muscles: ${all.length}`)
return all
