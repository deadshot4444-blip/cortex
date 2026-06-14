export const meta = {
  name: 'mcat-cards-gen',
  description: 'Generate + fact-check high-yield MCAT active-recall flashcards',
  phases: [
    { title: 'Generate', detail: 'one writer per high-yield cluster' },
    { title: 'Verify', detail: 'fact-check + tighten' },
  ],
}

const CLUSTERS = [
  { key: 'aa', name: 'Amino acids & protein structure', section: 'bioBiochem', cats: '1A, 5D', focus: 'the 20 standard amino acids (full + 3-letter + 1-letter names, side-chain class: nonpolar/polar/acidic/basic/aromatic, which are essential), key pKa values, isoelectric point, peptide bonds, the four levels of protein structure, denaturation' },
  { key: 'enz', name: 'Enzymes & bioenergetics', section: 'bioBiochem', cats: '1A, 1D', focus: 'enzyme classes, Michaelis-Menten (Km, Vmax), Lineweaver-Burk, competitive/noncompetitive/uncompetitive/mixed inhibition, allosteric regulation, cofactors/coenzymes, Gibbs free energy, glycolysis, pyruvate→acetyl-CoA, TCA cycle, electron transport chain, ATP yields, metabolic regulation' },
  { key: 'molbio', name: 'Molecular biology & genetics', section: 'bioBiochem', cats: '1B, 1C, 2C', focus: 'DNA/RNA structure, replication (enzymes, leading/lagging), transcription, translation, the genetic code, mutation types, Mendelian genetics, meiosis vs mitosis, recombination, Hardy-Weinberg, cell cycle checkpoints, oncogenes/tumor suppressors' },
  { key: 'cell', name: 'Cell biology & microbiology', section: 'bioBiochem', cats: '2A, 2B', focus: 'organelles and functions, membrane structure + transport (passive/active, osmosis), cytoskeleton, cell junctions, prokaryote vs eukaryote, viruses (lytic/lysogenic, retroviruses), bacterial growth and genetics' },
  { key: 'physio', name: 'Human physiology', section: 'bioBiochem', cats: '3A, 3B', focus: 'neuron resting/action potential, synapses, neurotransmitters, CNS/PNS, endocrine hormones (source + action + feedback), muscle types + contraction, immune system (innate/adaptive), digestion, nephron/kidney, respiration/gas exchange, cardiac cycle, reproduction' },
  { key: 'genchem', name: 'General chemistry', section: 'chemPhys', cats: '4E, 5A, 5E', focus: 'periodic trends, quantum numbers, bonding, acids/bases (strong/weak, conjugate pairs), pH/pOH/Ka/pKa, buffers + Henderson-Hasselbalch, titrations, thermodynamics (enthalpy/entropy/Gibbs), kinetics (rate laws, Arrhenius), equilibrium + Le Chatelier, electrochemistry (galvanic/electrolytic, Nernst)' },
  { key: 'physics', name: 'Physics', section: 'chemPhys', cats: '4A, 4B, 4C, 4D', focus: 'kinematics equations, Newtons laws, work-energy theorem, conservation of energy/momentum, fluids (density, pressure, buoyancy, continuity, Bernoulli, Poiseuille), circuits (Ohm law, series/parallel, power), waves, sound (Doppler, intensity/dB), geometric optics (lenses/mirrors, Snell). Include the key EQUATIONS on the back.' },
  { key: 'orgo', name: 'Organic chemistry', section: 'chemPhys', cats: '5B, 5C, 5D', focus: 'functional groups + priority, IUPAC basics, stereochemistry (chirality, R/S, enantiomers/diastereomers, meso), key reactions (SN1/SN2/E1/E2, nucleophilic addition to carbonyls, oxidation/reduction, esterification), separations (extraction, distillation, chromatography), spectroscopy (IR key peaks, 1H NMR, mass spec)' },
  { key: 'sens', name: 'Sensation, perception & consciousness', section: 'psychSoc', cats: '6A, 6B, 6C', focus: 'absolute/difference threshold, Weber law, signal detection theory, transduction, vision (rods/cones, pathways, theories of color), hearing (place/frequency theory), bottom-up vs top-down processing, gestalt principles, attention, states of consciousness, sleep stages, circadian rhythm' },
  { key: 'learnmem', name: 'Learning, memory & social behavior', section: 'psychSoc', cats: '7A, 7B, 7C', focus: 'classical conditioning terms, operant conditioning, reinforcement schedules, observational learning, memory stages + types, encoding/retrieval, forgetting curve, attitudes, cognitive dissonance, elaboration likelihood model, conformity (Asch), obedience (Milgram), groupthink, social facilitation, bystander effect' },
  { key: 'soc', name: 'Sociology', section: 'psychSoc', cats: '9A, 9B, 9C, 10A, 10B', focus: 'theoretical paradigms (functionalism, conflict theory, symbolic interactionism, social constructionism), social institutions, socialization, demographic transition, stratification, social mobility, types of capital, social class/power/prestige, health disparities and social determinants of health' },
  { key: 'devdis', name: 'Development, emotion & psychological disorders', section: 'psychSoc', cats: '6C, 7A, 8A', focus: 'developmental theories (Piaget stages, Erikson stages, Kohlberg, Vygotsky), attachment, theories of motivation (drive, Maslow, self-determination), theories of emotion (James-Lange, Cannon-Bard, Schachter-Singer, Lazarus), stress + GAS, personality theories, and the major DSM categories (depressive, anxiety, bipolar, schizophrenia, personality disorders)' },
]

const SCHEMA = {
  type: 'object',
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        required: ['front', 'back', 'section', 'category', 'tag'],
        properties: {
          front: { type: 'string', description: 'a prompt/question that forces active recall' },
          back: { type: 'string', description: 'concise, accurate answer (<= 240 chars)' },
          section: { type: 'string', enum: ['chemPhys', 'bioBiochem', 'psychSoc'] },
          category: { type: 'string', description: 'AAMC content category id (e.g. 1A)' },
          tag: { type: 'string', description: 'short topic label (e.g. "Amino acids")' },
        },
      },
    },
  },
}

function genPrompt(c) {
  return `You are an MCAT content expert writing high-yield ACTIVE-RECALL flashcards. Generate 20 flashcards for this cluster.

Cluster: ${c.name}
MCAT section: ${c.section}
Allowed AAMC content-category ids: ${c.cats}
Cover specifically: ${c.focus}

Rules:
- front = a focused question or cue that forces retrieval (not "Tell me about X" — ask something specific and answerable).
- back = the correct, concise answer. <= 240 characters. Include numbers/values where high-yield (pKa, equations, ATP counts).
- Each card tests ONE fact (atomic). Prefer the highest-yield, most-tested facts.
- section = ${c.section}. category = the best-fitting id from: ${c.cats}. tag = a short topic label.
- Accurate to current MCAT standards. No duplicates within your 20.

Return exactly 20 cards.`
}

function verifyPrompt(name, cards) {
  return `You are a meticulous MCAT fact-checker. Review these ${name} flashcards and return the CORRECTED full list (same count). Fix any factual errors (values, mechanisms, classifications), tighten any back over 240 chars, and remove ambiguity. Keep section/category/tag. Do not change the count.

${JSON.stringify(cards)}`
}

const merged = await pipeline(
  CLUSTERS,
  (c) => agent(genPrompt(c), { label: `gen:${c.key}`, phase: 'Generate', schema: SCHEMA })
    .then(r => ({ key: c.key, cards: (r?.cards || []) })),
  (r, c) => {
    if (!r || !r.cards.length) { log(`gen FAILED ${c.key}`); return null }
    return agent(verifyPrompt(c.name, r.cards), { label: `verify:${c.key}`, phase: 'Verify', schema: SCHEMA })
      .then(v => {
        const cards = (v?.cards && v.cards.length) ? v.cards : r.cards
        log(`${c.key}: ${cards.length} cards`)
        return cards.map((x, i) => ({ ...x, id: `${c.key}-${i + 1}` }))
      })
  }
)

const all = merged.filter(Boolean).flat()
log(`TOTAL cards: ${all.length}`)
return all
