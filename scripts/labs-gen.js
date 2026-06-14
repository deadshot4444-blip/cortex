export const meta = {
  name: 'labs-gen',
  description: 'Generate + verify a lab-values reference + interpretation dataset',
  phases: [{ title: 'Generate', detail: 'one writer per panel' }, { title: 'Verify', detail: 'fact-check ranges' }],
}
const PANELS = [
  { key: 'cbc', name: 'Complete Blood Count (CBC) + differential + RBC indices' },
  { key: 'bmp', name: 'Basic Metabolic Panel (electrolytes, glucose, BUN, creatinine, Ca)' },
  { key: 'lft', name: 'Liver function tests & pancreatic enzymes (AST, ALT, ALP, bilirubin, albumin, lipase)' },
  { key: 'lipids-cardiac', name: 'Lipid panel & cardiac markers (troponin, BNP, CK-MB, cholesterol)' },
  { key: 'coags', name: 'Coagulation studies (PT/INR, aPTT, D-dimer, fibrinogen, platelets, bleeding time)' },
  { key: 'abg', name: 'Arterial blood gas & acid-base (pH, PaCO2, PaO2, HCO3, anion gap, lactate)' },
  { key: 'endocrine', name: 'Endocrine labs (TSH, free T4, HbA1c, cortisol, PTH, insulin)' },
  { key: 'urinalysis', name: 'Urinalysis (specific gravity, protein, glucose, ketones, blood, leukocyte esterase, nitrites, casts)' },
  { key: 'csf', name: 'CSF analysis (opening pressure, cells, protein, glucose) across meningitis types' },
  { key: 'iron-misc', name: 'Iron studies & misc (ferritin, TIBC, transferrin, B12/folate, CRP/ESR, uric acid)' },
]
const SCHEMA = {
  type: 'object', required: ['labs'],
  properties: { labs: { type: 'array', items: {
    type: 'object', required: ['test', 'range', 'units', 'high_means', 'low_means', 'pearl'],
    properties: {
      test: { type: 'string' },
      range: { type: 'string', description: 'normal reference range' },
      units: { type: 'string' },
      high_means: { type: 'string', description: 'what an elevated value suggests, <=120 chars' },
      low_means: { type: 'string', description: 'what a low value suggests (or "—" if not applicable), <=120 chars' },
      pearl: { type: 'string', description: 'a high-yield interpretation pearl, <=140 chars' },
    } } } },
}
function gp(p) { return `You are a clinical pathologist. Generate the lab tests in this panel with reference ranges and interpretation.

Panel: ${p.name}

For each: test, range (standard adult reference range), units, high_means, low_means, pearl. Use conventional US units. Accurate, concise. Include all the high-yield tests in this panel.` }
function vp(name, labs) { return `Meticulous lab-medicine fact-checker. Return CORRECTED full list (same count) for ${name}: verify reference ranges & units, fix interpretations. ${JSON.stringify(labs)}` }
const merged = await pipeline(PANELS,
  p => agent(gp(p), { label: `gen:${p.key}`, phase: 'Generate', schema: SCHEMA }).then(r => ({ p, labs: r?.labs || [] })),
  (r, p) => { if (!r.labs.length) { log(`FAIL ${p.key}`); return null }
    return agent(vp(p.name, r.labs), { label: `verify:${p.key}`, phase: 'Verify', schema: SCHEMA }).then(v => {
      const labs = (v?.labs?.length) ? v.labs : r.labs; log(`${p.key}: ${labs.length}`)
      return labs.map((l, i) => ({ ...l, id: `${p.key}-${i + 1}`, panel: p.key, panelName: p.name })) }) })
const all = merged.filter(Boolean).flat(); log(`TOTAL labs: ${all.length}`); return all
