export const meta = {
  name: 'micro-gen',
  description: 'Generate + verify a microbiology bug-card dataset',
  phases: [{ title: 'Generate', detail: 'one writer per category' }, { title: 'Verify', detail: 'fact-check' }],
}
const CATS = [
  { key: 'gram-pos-cocci', name: 'Gram-positive cocci (Staph, Strep, Enterococcus)' },
  { key: 'gram-pos-rods', name: 'Gram-positive rods (Clostridium, Bacillus, Listeria, Corynebacterium)' },
  { key: 'gram-neg-cocci', name: 'Gram-negative cocci & coccobacilli (Neisseria, Haemophilus, Bordetella, Moraxella)' },
  { key: 'enterics', name: 'Gram-negative enteric rods (E. coli, Salmonella, Shigella, Klebsiella, Proteus, Pseudomonas, etc.)' },
  { key: 'curved-gn', name: 'Curved / other gram-negative rods (Vibrio, Campylobacter, Helicobacter, Bacteroides)' },
  { key: 'zoonotic-gn', name: 'Zoonotic & special gram-negatives (Brucella, Francisella, Yersinia, Bartonella, Pasteurella)' },
  { key: 'atypicals', name: 'Atypicals & intracellular (Mycoplasma, Chlamydia, Rickettsia, Coxiella, Legionella)' },
  { key: 'mycobacteria-spiro', name: 'Mycobacteria & spirochetes (TB, leprae, Treponema, Borrelia, Leptospira)' },
  { key: 'dna-viruses', name: 'DNA viruses (Herpesviruses, HPV, HBV, adenovirus, parvovirus, poxvirus)' },
  { key: 'rna-viruses', name: 'RNA viruses (influenza, picornaviruses, paramyxo, flavi, retro/HIV, rota, corona)' },
  { key: 'fungi', name: 'Fungi (Candida, Aspergillus, Cryptococcus, dimorphics, dermatophytes, Pneumocystis)' },
  { key: 'parasites', name: 'Parasites (protozoa: Plasmodium, Entamoeba, Giardia, Toxoplasma; helminths: pinworm, hookworm, tapeworms, Schistosoma)' },
]
const SCHEMA = {
  type: 'object', required: ['bugs'],
  properties: { bugs: { type: 'array', items: {
    type: 'object', required: ['name', 'type', 'morphology', 'diseases', 'treatment', 'pearl'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string', description: 'gram +/- & shape, or virus/fungus/parasite class' },
      morphology: { type: 'string', description: 'key lab/morphology features (gram stain, catalase/coagulase, culture, etc.), <=140 chars' },
      diseases: { type: 'string', description: 'main diseases caused, <=140 chars' },
      treatment: { type: 'string', description: 'first-line treatment, <=100 chars' },
      pearl: { type: 'string', description: 'a classic association / buzzword / distinguishing fact, <=150 chars' },
    } } } },
}
function gp(c) { return `You are a microbiology professor. Generate the HIGH-YIELD organisms for this category (~10-14).

Category: ${c.name}

For each: name, type, morphology (lab ID features), diseases, treatment, pearl (classic buzzword/association). Board-relevant, accurate, concise. No duplicates.` }
function vp(name, bugs) { return `Meticulous microbiology fact-checker. Return CORRECTED full list (same count) for ${name}: fix lab features, diseases, treatment, pearls. ${JSON.stringify(bugs)}` }
const merged = await pipeline(CATS,
  c => agent(gp(c), { label: `gen:${c.key}`, phase: 'Generate', schema: SCHEMA }).then(r => ({ c, bugs: r?.bugs || [] })),
  (r, c) => { if (!r.bugs.length) { log(`FAIL ${c.key}`); return null }
    return agent(vp(c.name, r.bugs), { label: `verify:${c.key}`, phase: 'Verify', schema: SCHEMA }).then(v => {
      const bugs = (v?.bugs?.length) ? v.bugs : r.bugs; log(`${c.key}: ${bugs.length}`)
      return bugs.map((b, i) => ({ ...b, id: `${c.key}-${i + 1}`, cat: c.key })) }) })
const all = merged.filter(Boolean).flat(); log(`TOTAL bugs: ${all.length}`); return all
