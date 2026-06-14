export const meta = {
  name: 'ma-anatomy-triage',
  description: 'Visually classify Medical Assistant textbook figures for usefulness to the Cortex anatomy app',
  phases: [
    { title: 'Classify', detail: 'vision agents read image batches' },
    { title: 'Synthesize', detail: 'map findings to the app gaps' },
  ],
}

const FILES = [
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f01-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f02-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f03-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f04-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f05-t3.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f06-t3.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f07-t3.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f08-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f09-t3.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f10-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f11a-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f11b-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f12-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f13-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f14-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f15-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f16-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f17-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f18-t3.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f19-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f20-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f21-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f22-t2.jpg",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f23-t3.jpg",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f24-t2.jpg",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f25-t2.jpg",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f26-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch03_f27-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f01-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f02-t3-1.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f02-t3.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f03-t3-1.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f03-t3.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f04-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f05-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f06-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f07-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f09-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f10-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f11-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f12-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f13-t3.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f14-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f16-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f17-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f18-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f20-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f22-t3.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f23-t3.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f24-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch05_f26-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f01-t3.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f02-t3.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f03-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f04-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f05-t3.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f06-t3.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f07-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f08-t3.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f09-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f10-t3.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f11-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f12-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f13-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f15-t3.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f18-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f19-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f20-t2.png",
  "/Users/kevinvigil/Desktop/Medical Assistant Class Pictures /9780357512630_ch08_f22-t2.png"
]

const APP = `Cortex is an interactive anatomy learning app. Its anatomy section currently has:
- Skeletal: full skeleton + skull, spine, thorax, hand, foot (clickable bone hotspots).
- Muscular: anterior + posterior whole-body muscle maps.
- Organs: brain (lateral view) and a neuron are fully built; heart, brain (sagittal), respiratory/lungs, kidney, eye, and ear have data ready but are NOT yet shipped (heart is deferred because the diagram did not match the dataset; the other five just need clean labeled images to map).
All shipped images are public-domain or Creative-Commons (clean labeled illustrations, color-coded, with structures as clickable regions).
HIGHEST-VALUE GAPS to fill: heart, brain (sagittal/midsagittal), respiratory/lungs, kidney + nephron, eye, ear. Also of interest: entirely NEW systems not yet in the app at all (digestive/GI, endocrine, lymphatic/immune, integumentary/skin, reproductive, urinary tract, cell biology / cell structure).`

const PER = {
  type: 'object', required: ['images'],
  properties: { images: { type: 'array', items: {
    type: 'object',
    required: ['file', 'isAnatomy', 'category', 'system', 'labeledStructures', 'imageStyle', 'appGap', 'recommendation', 'note'],
    properties: {
      file: { type: 'string', description: 'the basename of the file (e.g. 9780357512630_ch03_f01-t2.png)' },
      isAnatomy: { type: 'boolean', description: 'true if it depicts body anatomy/physiology structure; false for clinical-procedure photos, equipment, admin forms, pathogens, charts, etc.' },
      category: { type: 'string', description: 'one of: anatomy-illustration, anatomy-photo, histology-micrograph, clinical-procedure, equipment, microbiology, administrative, chart-table, other' },
      system: { type: 'string', description: 'body system shown: skeletal, muscular, cardiovascular, respiratory, nervous-brain, nervous-other, urinary, eye, ear, digestive, endocrine, integumentary-skin, reproductive, lymphatic-immune, cell, mixed-fullbody, none' },
      labeledStructures: { type: 'array', items: { type: 'string' }, description: 'the named/labeled structures visible in the figure (empty if unlabeled)' },
      imageStyle: { type: 'string', description: 'short: clean-vector-illustration / shaded-illustration / photograph / micrograph; and whether it has text labels + leader lines' },
      appGap: { type: 'string', description: 'which Cortex need it maps to: heart, brain-sagittal, respiratory, kidney, eye, ear, new-system:<name>, already-covered, or not-anatomy' },
      recommendation: { type: 'string', description: 'one of: reference-blueprint, maybe, skip' },
      note: { type: 'string', description: '1-2 sentences: what it actually shows and how (if at all) it helps build/label an anatomy module' },
    },
  } } },
}

function cp(batch) {
  return `You are an anatomy curator reviewing scanned figures from a Medical Assisting textbook (ISBN 9780357512630) to decide what is useful as a BLUEPRINT for an interactive anatomy learning app. Copyright is not your concern here — judge content usefulness only.

${APP}

Use the Read tool to actually LOOK AT each of these ${batch.length} image files, then classify each one precisely. Describe what the figure genuinely depicts (don't guess from the filename). NOTE: many figures are blank "label-it" worksheet versions — leader lines point to EMPTY boxes. If so, still identify the structure/system depicted and set labeledStructures to [] (note 'blank-label worksheet' in imageStyle). For labeled anatomy diagrams, list the structures that are labeled — that tells us what an interactive version could make clickable.

Image files:
${batch.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Return exactly one entry per image, using the file BASENAME for 'file'.`
}

const B = 5
const batches = []
for (let i = 0; i < FILES.length; i += B) batches.push(FILES.slice(i, i + B))

phase('Classify')
const results = await parallel(batches.map((b, bi) => () =>
  agent(cp(b), { label: `batch ${bi + 1} (${b.length})`, phase: 'Classify', schema: PER }).then(r => r?.images || [])
))
const all = results.filter(Boolean).flat()
log(`classified ${all.length} images`)

phase('Synthesize')
const SYN = {
  type: 'object',
  required: ['summary', 'anatomyCount', 'byGap', 'topPicks', 'newSystemsPossible', 'notUsefulCount'],
  properties: {
    summary: { type: 'string', description: 'overall read on what this folder contains and how useful it is for the anatomy app' },
    anatomyCount: { type: 'integer' },
    byGap: { type: 'array', items: { type: 'object', required: ['gap', 'files', 'assessment'], properties: {
      gap: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, assessment: { type: 'string' } } } },
    topPicks: { type: 'array', items: { type: 'object', required: ['file', 'shows', 'why'], properties: {
      file: { type: 'string' }, shows: { type: 'string' }, why: { type: 'string' } } } },
    newSystemsPossible: { type: 'array', items: { type: 'string' }, description: 'new anatomy systems these figures could justify adding, with the supporting files' },
    notUsefulCount: { type: 'integer' },
  },
}
const syn = await agent(`You advise on an interactive anatomy app (Cortex). Below is a per-image classification of ${all.length} Medical Assisting textbook figures. ${APP}

Synthesize a decision-ready report: which images are genuinely useful as blueprints, grouped by the gap they fill (heart / brain-sagittal / respiratory / kidney / eye / ear) and by any NEW system they could justify. Name the strongest individual picks (filename + what it shows + why it helps). Count how many are anatomy vs not useful. Be concrete and cite filenames.

CLASSIFICATION DATA:
${JSON.stringify(all)}`, { label: 'synthesis', phase: 'Synthesize', schema: SYN })

return { perImage: all, synthesis: syn }
