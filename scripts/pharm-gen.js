export const meta = {
  name: 'pharm-gen',
  description: 'Generate + verify a pharmacology drug-card dataset',
  phases: [{ title: 'Generate', detail: 'one writer per drug class' }, { title: 'Verify', detail: 'fact-check MOA/SE' }],
}
const CLASSES = [
  { key: 'cholinergics', name: 'Cholinergic agonists & anticholinesterases' },
  { key: 'anticholinergics', name: 'Anticholinergics (muscarinic antagonists)' },
  { key: 'adrenergic-agonists', name: 'Adrenergic agonists (sympathomimetics)' },
  { key: 'adrenergic-antagonists', name: 'Adrenergic antagonists (alpha & non-cardio beta)' },
  { key: 'diuretics', name: 'Diuretics' },
  { key: 'ace-arb', name: 'ACE inhibitors & ARBs (+ renin/aldosterone agents)' },
  { key: 'beta-blockers', name: 'Beta blockers' },
  { key: 'ccb', name: 'Calcium channel blockers & other antihypertensives' },
  { key: 'antiarrhythmics', name: 'Antiarrhythmics (all classes)' },
  { key: 'antianginal', name: 'Nitrates & antianginal / heart-failure drugs (digoxin, etc.)' },
  { key: 'lipid', name: 'Lipid-lowering drugs' },
  { key: 'anticoagulants', name: 'Anticoagulants, antiplatelets & thrombolytics' },
  { key: 'penicillins', name: 'Penicillins & beta-lactam combinations' },
  { key: 'cephalosporins', name: 'Cephalosporins & other cell-wall agents (vancomycin, carbapenems)' },
  { key: 'protein-synth', name: 'Protein-synthesis inhibitors (macrolides, tetracyclines, aminoglycosides, clindamycin, linezolid)' },
  { key: 'quinolones-sulfa', name: 'Fluoroquinolones, sulfonamides, metronidazole, nitrofurantoin' },
  { key: 'antifungal-antiviral', name: 'Antifungals & antivirals (incl. anti-HIV basics)' },
  { key: 'antitubercular', name: 'Antimycobacterial (TB) drugs' },
  { key: 'antidepressants', name: 'Antidepressants (SSRIs, SNRIs, TCAs, MAOIs, atypicals)' },
  { key: 'antipsychotics', name: 'Antipsychotics & mood stabilizers (lithium)' },
  { key: 'sedatives', name: 'Anxiolytics, sedative-hypnotics (benzodiazepines, barbiturates, z-drugs)' },
  { key: 'antiepileptics', name: 'Antiepileptics' },
  { key: 'opioids', name: 'Opioids & analgesics (incl. acetaminophen)' },
  { key: 'nsaids', name: 'NSAIDs, gout drugs & DMARDs' },
  { key: 'diabetes', name: 'Diabetes drugs (insulin & non-insulin)' },
  { key: 'endocrine', name: 'Thyroid, corticosteroids & other endocrine drugs' },
  { key: 'gi', name: 'GI drugs (PPIs, H2 blockers, antiemetics, laxatives, antidiarrheals)' },
  { key: 'respiratory', name: 'Respiratory drugs (bronchodilators, inhaled steroids, leukotriene modifiers, antihistamines)' },
]
const SCHEMA = {
  type: 'object', required: ['drugs'],
  properties: { drugs: { type: 'array', items: {
    type: 'object', required: ['name', 'drug_class', 'moa', 'indications', 'side_effects', 'pearl'],
    properties: {
      name: { type: 'string', description: 'generic drug name (a prototype/high-yield drug)' },
      drug_class: { type: 'string' },
      moa: { type: 'string', description: 'mechanism of action, <=160 chars' },
      indications: { type: 'string', description: 'main clinical uses, <=120 chars' },
      side_effects: { type: 'string', description: 'key/board-tested adverse effects, <=140 chars' },
      pearl: { type: 'string', description: 'one high-yield/board fact, <=150 chars' },
    } } } },
}
function gp(c) { return `You are a pharmacology professor. Generate ~14 HIGH-YIELD drug cards for this class. Prefer prototype + commonly-tested drugs.

Class: ${c.name}

For each: name (generic), drug_class (specific subclass), moa, indications, side_effects (board-relevant), pearl (a classic association, toxicity, antidote, or distinguishing fact). Accurate, current, concise. No duplicates.` }
function vp(name, drugs) { return `Meticulous pharmacology fact-checker. Return the CORRECTED full list (same count) for ${name}: fix MOA, indications, side effects, pearls; keep concise. ${JSON.stringify(drugs)}` }
const merged = await pipeline(CLASSES,
  c => agent(gp(c), { label: `gen:${c.key}`, phase: 'Generate', schema: SCHEMA }).then(r => ({ c, drugs: r?.drugs || [] })),
  (r, c) => { if (!r.drugs.length) { log(`FAIL ${c.key}`); return null }
    return agent(vp(c.name, r.drugs), { label: `verify:${c.key}`, phase: 'Verify', schema: SCHEMA }).then(v => {
      const drugs = (v?.drugs?.length) ? v.drugs : r.drugs; log(`${c.key}: ${drugs.length}`)
      return drugs.map((d, i) => ({ ...d, id: `${c.key}-${i + 1}`, cat: c.key })) }) })
const all = merged.filter(Boolean).flat(); log(`TOTAL drugs: ${all.length}`); return all
