// Tissue-clip director for the 3D bench (three.js r186, ES module). Contract §7 / §7.1.
// Imported by bench.js: `createDirector(ctx)` drives two timelines inside the bench's own
// renderer, canvas and camera. The intro (brain-overview → region → section-cut → slide) plays
// in the bench scene around the specimen tray and ends with the slab on the rack's first slide.
// The dive (dive → structures → impregnation → development → record-only → end) flies the
// camera into the S6 eyepiece, dips to a pale frame and swaps the renderer to a second scene,
// the neuropil volume from tissue.js. Every darkness value comes from the run's replay frames;
// the director invents nothing. Captions live in data/lab/clip.json (api.clip) and reach the DOM
// through api.onScene; a built-in "(no caption yet)" stands in for a missing one. A screen-space
// label plate in the shell's student words (contract §8.1) is drawn into the canvas during both
// timelines so a bare screenshot carries the label: "A drawing (not real anatomy)" over the intro,
// "Simulated · not a measurement" over the dive, "Not modeled" for an UncertaintyCard, whose stain
// scenes also lay a grey hatched "no picture" wash over the tissue (as the microscope does).
import * as THREE from 'three';
import { buildTissue, SITES, SITE_NAMES, DEFAULT_TINTS } from './tissue.js?v=1';
import { makeLabelSprite, disposeLabel } from './labels.js?v=2';

export const INTRO_SCENES = ['brain-overview', 'region', 'section-cut', 'slide'];
export const DIVE_SCENES = ['dive', 'structures', 'impregnation', 'development', 'record-only', 'end'];
export const SCENES = [...INTRO_SCENES, ...DIVE_SCENES];
const TITLES = {
  'brain-overview': 'Brain overview',
  region: 'Cortex region',
  'section-cut': 'Section cut',
  slide: 'On the slide',
  dive: 'Into the section',
  structures: 'Structures',
  impregnation: 'Impregnation',
  development: 'Development',
  'record-only': 'Toning and thiosulfate',
  end: 'What you saw',
};
const STRUCTURES_INTRO_MS = 2500;
const STRUCTURE_MS = 3800;
const DURATION = {
  'brain-overview': 4500,
  region: 4500,
  'section-cut': 6000,
  slide: 5200,
  dive: 5500,
  structures: STRUCTURES_INTRO_MS + SITES.length * STRUCTURE_MS,
  impregnation: 5000,
  development: 7000,
  'record-only': 3500,
  end: 4500,
};
const EYEPIECE_MS = 2400;
const DIP_MS = 320;
const EXPLORE_MS = 900;
const NO_CAPTION = '(no caption yet)';
const IMPREGNATION_NO_SILVER =
  "The ammoniacal silver bath was performed, but with this run's settings the model bound no silver, so the field stays unstained.";
const DEVELOPMENT_NO_SILVER =
  'Development was performed, but the model found no bound silver to reduce, so no visible silver was made: no reaction.';
const INTRO_PLATE = 'A drawing (not real anatomy)';
const DIVE_PLATE = 'Simulated · not a measurement'; // CortexLab.words.simulated
const NOT_MODELED_PLATE = 'Not modeled'; // CortexLab.words.notModeled
const NO_BASIS_CAPTION = 'Not modeled: {explanation}.'; // only when clip.json has no noBasisCaption
const HATCH_OPACITY = 0.82; // the drawn structures stay faintly visible under the wash
const HATCH_PX = 14; // hatch line spacing in CSS pixels (the microscope's placeholder)
const DIP_COLOR = 0xf4f1ea;
const TISSUE_BACKGROUND = 0xf3efe8;
const SECTION_SCALE = [0.076, 0.1, 0.03]; // slab box (0.5 x 0.5 x 0.05) -> a section on the slide

const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = k => 1 - Math.pow(1 - k, 3);
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const span = (u, a, b) => clamp01((u - a) / (b - a));
const call = (fn, ...args) => {
  if (typeof fn === 'function') {
    try {
      fn(...args);
    } catch {
      /* a listener error must not break the render loop */
    }
  }
};
const text = v =>
  typeof v === 'string'
    ? v
    : v && typeof v === 'object' && typeof v.caption === 'string'
      ? v.caption
      : v && typeof v.text === 'string'
        ? v.text
        : Array.isArray(v)
          ? v.filter(s => typeof s === 'string').join(' ')
          : '';

/**
 * Tolerant reader for data/lab/clip.json (written in parallel; any part may be missing). The
 * shipped shape: { items: [{ id, title, caption, durationMs, sub: [{ site, title, caption }] }],
 * noBasisCaption ("{explanation}" placeholder), impregnationNotDone, developmentNotDone,
 * impregnationNoSilver, developmentNoSilver (MODE-micro: a free run's no-reaction states) }.
 */
function readClip(clip) {
  const scenes = new Map();
  const list = clip && (clip.items || clip.scenes);
  if (Array.isArray(list)) {
    for (const s of list) if (s && typeof s.id === 'string') scenes.set(s.id, s);
  } else if (list && typeof list === 'object') {
    for (const [id, s] of Object.entries(list)) scenes.set(id, { id, ...(typeof s === 'string' ? { caption: s } : s) });
  }
  const top = key => (clip && typeof clip === 'object' ? text(clip[key]) : '');
  const sceneText = (id, key = 'caption') => {
    const s = scenes.get(id);
    return s ? text(s[key]) || (key === 'caption' ? text(s) : '') : '';
  };
  const structure = site => {
    const s = scenes.get('structures');
    const from = source => {
      if (!source) return '';
      if (Array.isArray(source)) {
        const hit = source.find(x => x && (x.site === site || x.id === site));
        return hit ? text(hit) || text(hit.caption) : '';
      }
      return typeof source === 'object' ? text(source[site]) : '';
    };
    return from(s && (s.sub || s.structures || s.items)) || from(clip && (clip.structures || clip.sites));
  };
  const duration = id => {
    const s = scenes.get(id);
    const ms = s && typeof s.durationMs === 'number' ? s.durationMs : 0;
    // the structures scene keeps its fixed per-structure timing
    return id !== 'structures' && ms >= 1500 && ms <= 30000 ? ms : DURATION[id];
  };
  const noBasis = top('noBasisCaption') || top('noBasis') || NO_BASIS_CAPTION;
  return {
    title: id => sceneText(id, 'title') || TITLES[id],
    caption: id => sceneText(id) || NO_CAPTION,
    structure: site => structure(site) || `${SITE_NAMES[site] || site}: ${NO_CAPTION}`,
    duration,
    impregnationNotDone: top('impregnationNotDone') || sceneText('impregnation', 'notDone') || NO_CAPTION,
    developmentNotDone: top('developmentNotDone') || sceneText('development', 'notDone') || NO_CAPTION,
    // MODE-micro (contract §11.3 / §11.6): a step performed on a free run that changed nothing is a
    // real state of the slide; these captions say so (built-in words when clip.json has none).
    impregnationNoSilver: top('impregnationNoSilver') || IMPREGNATION_NO_SILVER,
    developmentNoSilver: top('developmentNoSilver') || DEVELOPMENT_NO_SILVER,
    noBasis: explanation => {
      const gap = (explanation || 'not stated').replace(/[.\s]+$/, '');
      return noBasis.includes('{explanation}') ? noBasis.replace('{explanation}', gap) : `${noBasis} ${gap}`;
    },
  };
}

/**
 * What the dive paints, read from the run's actual frames (contract §7.1). A 'step-skipped'
 * card is a run still in progress (resolve() of any unfinished run): its performed steps paint
 * and the unperformed stain steps get the not-done captions. Every other UncertaintyCard code
 * (param-uncovered, hypothesis-unencoded, method-unknown, specimen-unknown) paints no stain: the
 * stain scenes show the hatched "no picture" wash with the no-basis caption and the Not modeled plate.
 */
function readStaining(outcome, frames) {
  const list = Array.isArray(frames) ? frames : [];
  const after = step => {
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      if (f && f.event && f.event.type === 'step' && f.event.step === step && f.state) return f.state;
    }
    return null;
  };
  const card = !!(outcome && outcome.label === 'no-basis' && outcome.code !== 'step-skipped');
  const impregnated = after('ammoniacal-silver');
  const developed = after('development');
  const zero = {};
  for (const site of SITES) zero[site] = 0;
  const read = (state, key) => {
    const out = {};
    for (const site of SITES) {
      const v = state && state[site] ? state[site][key] : 0;
      out[site] = typeof v === 'number' ? v : 0;
    }
    return out;
  };
  const ionic = card || !impregnated ? zero : read(impregnated, 'ionicBound');
  const deposit = card || !developed ? zero : read(developed, 'deposit');
  const background =
    card || !developed || !developed.background || typeof developed.background.deposit !== 'number'
      ? 0
      : developed.background.deposit;
  const max = table => Math.max(0, ...SITES.map(site => table[site] || 0));
  return {
    card,
    explanation: card && typeof outcome.explanation === 'string' ? outcome.explanation : '',
    impregnated: !card && !!impregnated,
    developed: !card && !!developed,
    // MODE-micro: a performed step that bound / reduced nothing (a free run's no reaction) is told
    // apart from a step not performed; an all-zero state plays like any other.
    bound: !card && !!impregnated && max(ionic) > 0,
    deposited: !card && !!developed && (max(deposit) > 0 || background > 0),
    ionic,
    nuclei: card || !developed ? zero : read(developed, 'nuclei'),
    deposit,
    background,
  };
}

/**
 * @param {object} ctx { renderer, scene, camera, controls, canvas, built, api, requestRender,
 *   isReducedMotion, applyPreset(id), markStation(id), rackStation() }
 */
export function createDirector(ctx) {
  const { renderer, scene, camera, controls, built, api, requestRender } = ctx;
  const brain = built.brain;
  const rack = built.rack;
  const slab = brain.slab;
  // The run's specimen through the engine, else the shell's active specimen, else null.
  const specimenFor = run => {
    try {
      if (run && api.lab && typeof api.lab.getSpecimen === 'function') {
        const specimen = api.lab.getSpecimen(run.specimenId);
        if (specimen) return specimen;
      }
      if (typeof api.getSpecimen === 'function') return api.getSpecimen() || null;
    } catch {
      /* fall through */
    }
    return null;
  };
  const tintsFor = () => {
    const micro = globalThis.CortexLabMicroscope;
    const list = micro && Array.isArray(micro.TINTS) && micro.TINTS.length === 5 ? micro.TINTS : null;
    return list ? list.map(t => (typeof t === 'string' ? t : t.color)) : DEFAULT_TINTS;
  };
  let clip = readClip(api.clip);

  // ---------- tissue scene (second scene, same renderer and camera) ----------
  const tissueScene = new THREE.Scene();
  tissueScene.background = new THREE.Color(TISSUE_BACKGROUND);
  tissueScene.fog = new THREE.Fog(TISSUE_BACKGROUND, 1.5, 9);
  const tissueLights = [
    new THREE.HemisphereLight(0xffffff, 0xd9d0c4, 1.5),
    new THREE.AmbientLight(0xffffff, 0.45),
    new THREE.DirectionalLight(0xffffff, 1.7),
  ];
  tissueLights[2].position.set(3, 6, 4);
  for (const l of tissueLights) tissueScene.add(l);
  let tissue = null;
  let tissueKey = null; // "<specimen id>|<seed>" the volume was built from
  let tissueBuilds = 0;
  const labels = new Map(); // site -> label sprite (shown during its structures sub-scene)
  // The volume is built once per specimen (id and seed) and kept across dives. An unresolved
  // specimen (null) keeps whatever volume stands rather than rebuilding a generic one; only the
  // very first build without a specimen falls back to the generic counts.
  function ensureTissue(specimen) {
    if (tissue && !specimen) return tissue;
    const key = specimen ? `${specimen.id || ''}|${typeof specimen.seed === 'number' ? specimen.seed : ''}` : null;
    if (tissue && tissueKey === key) return tissue;
    disposeTissue();
    tissue = buildTissue(THREE, { specimen, tints: tintsFor() });
    tissueKey = key;
    tissueBuilds++;
    tissueScene.add(tissue.group);
    for (const site of SITES) {
      const f = tissue.focus[site];
      if (!f) continue;
      const sprite = makeLabelSprite(SITE_NAMES[site], { widthWorld: 0.42, px: 1024 });
      if (!sprite) continue;
      sprite.position.copy(f).add(new THREE.Vector3(0, 0.3, 0));
      sprite.visible = false;
      sprite.renderOrder = 20;
      tissueScene.add(sprite);
      labels.set(site, sprite);
    }
    return tissue;
  }
  function disposeTissue() {
    if (!tissue) return;
    tissueScene.remove(tissue.group);
    tissue.dispose();
    tissue = null;
    for (const sprite of labels.values()) {
      tissueScene.remove(sprite);
      disposeLabel(sprite);
    }
    labels.clear();
  }
  const tissueCenter = new THREE.Vector3(0, 0, 0);
  const tissueRadius = 4.1;

  // ---------- HUD: label plate + dip quad + no-picture hatch (orthographic, pixel units) ----------
  const hud = new THREE.Scene();
  const hudCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  hudCamera.position.z = 5;
  // A run the model has no rule for has no picture (contract §7, KB-11): where the stain would
  // appear, a grey wash with diagonal lines (the microscope's hatched placeholder) covers the tissue
  // instead of leaving it clean and unstained. One repeating tile; drawn under the dip and the plate.
  const hatchTexture = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    if (g) {
      g.fillStyle = '#eeeef1';
      g.fillRect(0, 0, 32, 32);
      g.strokeStyle = '#b4b8c0';
      g.lineWidth = 2.5;
      for (const o of [-32, 0, 32]) {
        g.beginPath();
        g.moveTo(o, 0);
        g.lineTo(o + 32, 32);
        g.stroke();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  const hatchMaterial = new THREE.MeshBasicMaterial({
    map: hatchTexture,
    transparent: true,
    opacity: 0,
    depthTest: false,
    toneMapped: false,
  });
  const dipMaterial = new THREE.MeshBasicMaterial({
    color: DIP_COLOR,
    transparent: true,
    opacity: 0,
    depthTest: false,
  });
  const dipGeometry = new THREE.PlaneGeometry(1, 1);
  const dip = new THREE.Mesh(dipGeometry, dipMaterial);
  dip.visible = false;
  dip.renderOrder = 1;
  hud.add(dip);
  const hatch = new THREE.Mesh(dipGeometry, hatchMaterial);
  hatch.visible = false;
  hatch.renderOrder = 0;
  hud.add(hatch);
  let plate = null;
  let plateText = '';
  let plateVisible = false;
  let hudSize = { w: 1, h: 1 };
  function setPlate(label) {
    if (plate && plateText === label) return;
    if (plate) {
      hud.remove(plate);
      disposeLabel(plate);
      plate = null;
    }
    plateText = label;
    plate = makeLabelSprite(label, { px: 1024 });
    if (!plate) return;
    plate.renderOrder = 2;
    hud.add(plate);
    layoutHud();
  }
  // The dive's plate: the run's simulated stain, or no picture for an UncertaintyCard.
  const divePlate = () => (staining.card ? NOT_MODELED_PLATE : DIVE_PLATE);
  function layoutHud() {
    const { w, h } = hudSize;
    hudCamera.left = -w / 2;
    hudCamera.right = w / 2;
    hudCamera.top = h / 2;
    hudCamera.bottom = -h / 2;
    hudCamera.updateProjectionMatrix();
    dip.scale.set(w, h, 1);
    hatch.scale.set(w, h, 1);
    hatchTexture.repeat.set(w / HATCH_PX, h / HATCH_PX);
    if (plate) {
      const pw = Math.min(236, Math.max(150, w * 0.42));
      const ph = pw / 4;
      const margin = Math.round(Math.min(14, w * 0.03));
      plate.scale.set(pw, ph, 1);
      plate.position.set(-w / 2 + margin + pw / 2, -h / 2 + margin + ph / 2, 0);
    }
  }
  function resize(w, h) {
    hudSize = { w, h };
    layoutHud();
  }
  const overlayVisible = () =>
    (plateVisible && !!plate) || dipMaterial.opacity > 0.001 || hatchMaterial.opacity > 0.001;
  function renderOverlay() {
    if (!overlayVisible()) return;
    dip.visible = dipMaterial.opacity > 0.001;
    hatch.visible = hatchMaterial.opacity > 0.001;
    if (plate) plate.visible = plateVisible;
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(hud, hudCamera);
    renderer.autoClear = auto;
  }

  // ---------- state ----------
  let phase = 'bench'; // 'bench' | 'intro' | 'dive' | 'explore'
  let timeline = null; // { kind: 'intro'|'dive', scenes, index, time, playing, ended, sub, prevPose, startPose }
  let transition = null; // { kind, t0, ms, from, to, onDone }
  let speed = 1;
  let loaded = false; // the section sits on the rack's first slide
  let lastScene = null; // { id, index } of the last emitted scene (for clipState after a timeline ends)
  let staining = readStaining(null, []);
  let savedLimits = null;
  let inTissue = false;
  let hovered = null;

  const _v = new THREE.Vector3();
  const _w = new THREE.Vector3();
  const _n = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const ray = new THREE.Raycaster();

  const pose = (position, target) => ({ position: position.clone(), target: target.clone() });
  const currentPose = () => pose(camera.position, controls.target);
  const lerpPose = (a, b, k, out) => {
    out.position.lerpVectors(a.position, b.position, k);
    out.target.lerpVectors(a.target, b.target, k);
    return out;
  };
  const scratchPose = pose(new THREE.Vector3(), new THREE.Vector3());
  function setPose(p) {
    camera.position.copy(p.position);
    controls.target.copy(p.target);
    camera.lookAt(controls.target);
  }
  const reduced = () => !!ctx.isReducedMotion();
  // Taking the camera from the bench drops a station flight or replay still running (bench.js
  // resolves their promises false); a frozen flight must never resume inside the clip.
  const cancelFlight = () => call(ctx.cancelFlight);

  // Distance at which a sphere of `radius` fills the frame less `margin` (uses the narrower fov).
  function fitDistance(radius, margin = 1.1) {
    const v = (camera.fov * Math.PI) / 360;
    const h = Math.atan(Math.tan(v) * camera.aspect);
    return (radius / Math.sin(Math.min(v, h))) * margin;
  }
  function viewFrom(target, azimuth, elevation, distance, out) {
    const flat = Math.cos(elevation);
    out.position.set(
      target.x + Math.sin(azimuth) * flat * distance,
      target.y + Math.sin(elevation) * distance,
      target.z + Math.cos(azimuth) * flat * distance
    );
    out.target.copy(target);
    return out;
  }

  // ---------- brain anchors (world space) ----------
  const brainCenter = new THREE.Vector3();
  const patchCenter = new THREE.Vector3();
  const patchNormal = new THREE.Vector3();
  let brainRadius = 0.1;
  function readBrainAnchors() {
    brain.group.updateWorldMatrix(true, false);
    const mw = brain.group.matrixWorld;
    brain.bounds.getCenter(brainCenter).applyMatrix4(mw);
    brain.bounds.getSize(_v);
    _s.setFromMatrixScale(mw);
    brainRadius = (_v.length() / 2) * _s.x;
    patchCenter.copy(brain.patch.center).applyMatrix4(mw);
    patchNormal.copy(brain.patch.normal).transformDirection(mw);
  }
  readBrainAnchors();
  // A view of the patch: azimuth around the patch normal, elevation toward world up.
  function patchView(azimuth, elevation, distance, out) {
    _n.copy(patchNormal);
    _up.set(0, 1, 0).addScaledVector(_n, -_n.y).normalize();
    _right.crossVectors(_up, _n).normalize();
    const flat = Math.cos(elevation);
    _w.copy(_n)
      .multiplyScalar(flat * Math.cos(azimuth))
      .addScaledVector(_right, flat * Math.sin(azimuth))
      .addScaledVector(_up, Math.sin(elevation));
    out.position.copy(patchCenter).addScaledVector(_w, distance);
    out.target.copy(patchCenter).addScaledVector(_n, -0.015);
    return out;
  }
  const brainView = (azimuth, elevation, out) =>
    viewFrom(brainCenter, azimuth, elevation, fitDistance(brainRadius, 1.0), out);

  // ---------- slab flight (section-cut -> rack's first slide) ----------
  const slide = built.slides && built.slides[0];
  const flight = {
    from: { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() },
    to: { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3().fromArray(SECTION_SCALE) },
  };
  // The lifted slab's world pose is read once per intro (the brain never moves); the slide's is
  // re-read on every frame of the slide scene (one decompose), because setRun() or a replay can
  // move the rack while the intro plays and the section must land on the slide wherever it is.
  function readSlabFlight() {
    brain.slabLift(1);
    brain.group.updateWorldMatrix(true, true);
    slab.matrixWorld.decompose(flight.from.p, flight.from.q, flight.from.s);
    readSlideTarget();
  }
  function readSlideTarget() {
    const { from, to } = flight;
    if (!slide) {
      to.p.copy(from.p);
      to.q.copy(from.q);
      to.s.copy(from.s);
      return;
    }
    slide.updateWorldMatrix(true, false);
    slide.matrixWorld.decompose(to.p, to.q, _s);
    _n.set(0, 0, 1).applyQuaternion(to.q);
    _up.set(0, 1, 0).applyQuaternion(to.q);
    to.p.addScaledVector(_n, 0.0019).addScaledVector(_up, 0.012);
  }
  function placeSlab(k) {
    // k 0..1 along an arc from the lifted pose to the slide; reparented to the scene root first
    const { from, to } = flight;
    const e = ease(k);
    slab.position.lerpVectors(from.p, to.p, e);
    slab.position.y += Math.sin(Math.PI * e) * 0.3;
    slab.quaternion.copy(from.q).slerp(to.q, e);
    slab.scale.lerpVectors(from.s, to.s, e);
  }
  function resetSlab() {
    if (slab.parent !== brain.group) {
      brain.group.attach(slab);
      slab.scale.set(1, 1, 1);
    }
    brain.slabLift(0);
    loaded = false;
  }
  function landSlab() {
    if (slab.parent !== rack) {
      if (slab.parent !== built.root) built.root.attach(slab);
      readSlideTarget(); // land on the slide where it is now, then ride with the rack
      placeSlab(1);
      slab.visible = true;
      rack.attach(slab);
    }
    loaded = true;
  }

  // ---------- scene poses ----------
  const tissueFocus = site => (tissue && tissue.focus[site]) || tissueCenter;
  const subDirs = [
    new THREE.Vector3(0.55, 0.42, 0.72),
    new THREE.Vector3(-0.6, 0.4, 0.7),
    new THREE.Vector3(0.7, 0.35, -0.6),
    new THREE.Vector3(0.5, 0.5, 0.7),
    new THREE.Vector3(-0.55, 0.45, -0.7),
  ].map(v => v.normalize());
  const subDistance = { axon: 1.5, 'plaque-core': 1.8, 'plaque-neurite': 1.8, tangle: 0.95, 'neuropil-thread': 1.0 };
  function subPose(k, drift, out) {
    const site = SITES[k];
    const f = tissueFocus(site);
    _q.setFromAxisAngle(_up.set(0, 1, 0), drift * 0.18);
    _w.copy(subDirs[k]).applyQuaternion(_q);
    out.position.copy(f).addScaledVector(_w, subDistance[site]);
    out.target.copy(f);
    return out;
  }
  const P = {
    diveStart: pose(new THREE.Vector3(0, 3.6, 0.001), new THREE.Vector3(0, 0.5, 0)),
    diveEnd: pose(new THREE.Vector3(0.9, 2.0, 2.7), new THREE.Vector3(0, 0.05, 0)),
    structures: pose(new THREE.Vector3(2.9, 1.9, 3.3), new THREE.Vector3(0, 0, 0)),
    impregnationA: pose(new THREE.Vector3(2.7, 1.6, 3.0), new THREE.Vector3(0.2, 0, 0)),
    impregnationB: pose(new THREE.Vector3(2.3, 1.4, 2.6), new THREE.Vector3(0.2, 0, 0)),
    explore: pose(new THREE.Vector3(2.6, 1.7, 3.1), new THREE.Vector3(0, 0, 0)),
  };
  const tmpA = pose(new THREE.Vector3(), new THREE.Vector3());
  const tmpB = pose(new THREE.Vector3(), new THREE.Vector3());
  function developmentPose(drift, out) {
    const f = tissueFocus('plaque-core') === tissueCenter ? tissueFocus('tangle') : tissueFocus('plaque-core');
    _w.set(1.6 - 0.25 * drift, 0.6 - 0.1 * drift, 1.9 - 0.3 * drift);
    out.position.copy(f).add(_w);
    out.target.copy(f);
    return out;
  }
  function endPose(drift, out) {
    // the volume is a 6 x 4 x 4 box: fit its width, not the bounding sphere, so it fills the frame
    return viewFrom(tissueCenter, -0.55 + 0.08 * drift, 0.3, fitDistance(2.4, 1.0), out);
  }

  // The destination pose of a scene at progress u (the "still" at u = 1).
  function scenePose(id, u, out) {
    switch (id) {
      case 'brain-overview':
        return brainView(-0.95 + 0.4 * ease(u), 0.36, out);
      case 'region':
        return patchView(-0.28, 0.3, 0.3, out);
      case 'section-cut':
        return patchView(-0.8, 0.28, 0.32, out);
      case 'slide': {
        // follow the slab in flight, then rest on the rack's first slide
        if (slab.parent === built.root && !reduced()) slab.getWorldPosition(out.target);
        else out.target.copy(flight.to.p);
        _w.set(0.13, 0.21, 0.33);
        out.position.copy(out.target).add(_w);
        return out;
      }
      case 'dive':
        return lerpPose(P.diveStart, P.diveEnd, easeOut(u), out);
      case 'structures':
        return structuresPose(u, out);
      case 'impregnation':
        return lerpPose(P.impregnationA, P.impregnationB, u, out);
      case 'development':
        return developmentPose(u, out);
      case 'record-only':
        return developmentPose(1 + 0.3 * u, out);
      case 'end':
        return endPose(u, out);
      default:
        return out;
    }
  }
  const structuresIntroFraction = STRUCTURES_INTRO_MS / DURATION.structures;
  const structureFraction = STRUCTURE_MS / DURATION.structures;
  function subIndexAt(u) {
    if (u < structuresIntroFraction) return -1;
    return Math.min(SITES.length - 1, Math.floor((u - structuresIntroFraction) / structureFraction));
  }
  function structuresPose(u, out) {
    const k = subIndexAt(u);
    if (k < 0) return out.position.copy(P.structures.position) && out.target.copy(P.structures.target) && out;
    const local = (u - structuresIntroFraction - k * structureFraction) / structureFraction;
    const from = k === 0 ? P.structures : subPose(k - 1, 1, tmpB);
    subPose(k, local, tmpA);
    if (reduced()) return out.position.copy(tmpA.position) && out.target.copy(tmpA.target) && out;
    return lerpPose(from, tmpA, ease(span(local, 0, 0.42)), out);
  }
  // Scenes whose destination is static blend in from the previous scene's end over this fraction.
  const BLEND = {
    'brain-overview': 0.45,
    region: 0.5,
    'section-cut': 0.35,
    slide: 0.55,
    impregnation: 0.4,
    development: 0.45,
    'record-only': 0.3,
    end: 0.5,
  };

  function cameraFor(tl, out) {
    const id = tl.scenes[tl.index];
    const u = tl.u;
    scenePose(id, u, out);
    if (reduced()) return out;
    const blend = BLEND[id];
    if (!blend) return out;
    const from = tl.index === 0 ? tl.startPose : scenePose(tl.scenes[tl.index - 1], 1, tmpB);
    return lerpPose(from, out, ease(span(u, 0, blend)), out);
  }

  // ---------- visual state per (scene, u): a pure function of the timeline position ----------
  function applyIntro(id, u) {
    const i = INTRO_SCENES.indexOf(id);
    const highlight = i === 0 ? 0 : i === 1 ? smooth(0, 0.55, u) : i === 2 ? 1 : 1 - smooth(0, 0.3, u);
    brain.setPatchHighlight(highlight);
    const cut = i < 2 ? 0 : i === 2 ? span(u, 0.02, 0.5) : 1;
    brain.cutProgress(cut);
    if (i < 3) {
      if (slab.parent !== brain.group) resetSlab();
      brain.slabLift(i === 2 ? span(u, 0.42, 0.95) : 0);
      loaded = false;
    } else {
      readSlideTarget(); // the rack may be moving under the flight
      const k = span(u, 0.12, 0.88);
      if (k >= 1) landSlab();
      else {
        if (slab.parent === rack) resetSlab();
        if (slab.parent !== built.root) {
          brain.slabLift(1);
          built.root.attach(slab);
        }
        slab.visible = true;
        placeSlab(k);
      }
    }
  }
  const phaseScratch = { ionic: {}, nuclei: {}, deposit: {}, background: 0 }; // reused every frame
  function applyDive(id, u) {
    if (!tissue) return;
    const i = DIVE_SCENES.indexOf(id);
    const fog = tissueScene.fog;
    if (i === 0) {
      fog.near = 0.3 + 1.5 * easeOut(u);
      fog.far = 2.2 + 7.3 * easeOut(u);
      dipMaterial.opacity = 1 - span(u, 0, 0.3);
    } else if (i === 5) {
      fog.near = 3;
      fog.far = 14;
    } else {
      fog.near = 1.5;
      fog.far = 9;
    }
    const s = staining;
    const ph = phaseScratch;
    const ionicK = i < 2 ? 0 : i === 2 ? smooth(0.12, 0.75, u) : 1;
    const nucleiK = i < 3 ? 0 : i === 3 ? smooth(0, 0.35, u) : 1;
    const depositK = i < 3 ? 0 : i === 3 ? smooth(0.3, 0.92, u) : 1;
    for (const site of SITES) {
      ph.ionic[site] = s.ionic[site] * ionicK;
      ph.nuclei[site] = s.nuclei[site] * nucleiK;
      ph.deposit[site] = s.deposit[site] * depositK;
    }
    ph.background = s.background * depositK;
    tissue.applyPhase(ph);
    // An UncertaintyCard paints no stain: the no-picture hatch comes in where the stain would.
    hatchMaterial.opacity = s.card ? HATCH_OPACITY * (i < 2 ? 0 : i === 2 ? smooth(0, 0.5, u) : 1) : 0;
    tissueScene.fog.color.copy(tissue.fogColor);
    tissueScene.background.copy(tissue.fogColor);
    const sub = i === 1 ? subIndexAt(u) : -1;
    const site = sub >= 0 ? SITES[sub] : null;
    if (phase !== 'explore') tissue.highlight(site);
    for (const [key, sprite] of labels) sprite.visible = key === site;
  }

  // ---------- captions ----------
  const STAIN_SCENES = ['impregnation', 'development', 'record-only'];
  function captionFor(id, site) {
    if (site) return clip.structure(site);
    if (STAIN_SCENES.includes(id)) {
      if (staining.card) return clip.noBasis(staining.explanation);
      if (id === 'impregnation' && !staining.impregnated) return clip.impregnationNotDone;
      if (id === 'impregnation' && !staining.bound) return clip.impregnationNoSilver;
      // Without bound silver the development scene cannot say "silver is bound but not developed".
      if (id === 'development' && !staining.developed)
        return staining.impregnated ? clip.developmentNotDone : clip.impregnationNotDone;
      if (id === 'development' && !staining.deposited) return clip.developmentNoSilver;
    }
    return clip.caption(id);
  }
  // A stain scene whose caption would repeat the one just emitted (an UncertaintyCard's no-basis
  // sentence, or the impregnation-not-done sentence on an unimpregnated run) stays silent: the
  // sentence is said once and keeps standing in the shell's caption line.
  let lastCaption = null;
  function emitScene(id, site) {
    const index = SCENES.indexOf(id);
    lastScene = { id, index };
    const caption = captionFor(id, site);
    if (!site && STAIN_SCENES.includes(id) && caption === lastCaption) return;
    lastCaption = caption;
    if (site) call(api.onScene, id, caption, index, site);
    else call(api.onScene, id, caption, index);
  }

  // ---------- timelines ----------
  function startTimeline(kind, startIndex = 0) {
    const scenes = kind === 'intro' ? INTRO_SCENES : DIVE_SCENES;
    timeline = {
      kind,
      scenes,
      index: Math.max(0, Math.min(scenes.length - 1, startIndex)),
      time: 0,
      u: 0,
      playing: true,
      ended: false,
      sub: -1,
      startPose: currentPose(),
    };
    if (kind === 'intro') {
      resetSlab();
      readBrainAnchors();
      readSlabFlight();
    }
    enterScene();
  }
  // Reduced motion shows each scene as a still (u = 1); the structures sub-scenes still step on
  // their timer so every structure caption is reached while playing.
  const uFor = tl => {
    const id = tl.scenes[tl.index];
    return reduced() && id !== 'structures' ? 1 : clamp01(tl.time / clip.duration(id));
  };
  function enterScene(time = 0) {
    const tl = timeline;
    const id = tl.scenes[tl.index];
    tl.time = time;
    tl.u = uFor(tl);
    tl.sub = -1;
    emitScene(id);
    applyTimeline();
    if (id === 'structures') checkSub();
    requestRender();
  }
  function checkSub() {
    const tl = timeline;
    if (tl.scenes[tl.index] !== 'structures') return;
    const sub = subIndexAt(tl.u);
    if (sub !== tl.sub) {
      tl.sub = sub;
      if (sub >= 0) emitScene('structures', SITES[sub]);
    }
  }
  function applyTimeline() {
    const tl = timeline;
    if (!tl) return;
    const id = tl.scenes[tl.index];
    if (tl.kind === 'intro') applyIntro(id, tl.u);
    else applyDive(id, tl.u);
    if (phase !== 'explore' && !transition) setPose(cameraFor(tl, scratchPose));
  }
  function finishTimeline() {
    const tl = timeline;
    tl.playing = false;
    tl.ended = true;
    tl.u = 1;
    applyTimeline();
    if (tl.kind === 'intro') {
      landSlab();
      leaveIntro();
      call(api.onEnd, 'intro');
    } else call(api.onEnd, 'dive');
    requestRender();
  }
  function leaveIntro() {
    phase = 'bench';
    plateVisible = false;
    controls.enabled = true;
    controls.update();
    ctx.markStation(ctx.rackStation() || 'S1');
  }
  function advance(dtMs) {
    const tl = timeline;
    if (!tl || !tl.playing) return false;
    tl.time += dtMs * speed;
    for (;;) {
      const ms = clip.duration(tl.scenes[tl.index]);
      if (tl.time < ms) {
        tl.u = uFor(tl);
        break;
      }
      if (tl.index >= tl.scenes.length - 1) {
        finishTimeline();
        return true;
      }
      const carry = tl.time - ms;
      tl.index++;
      enterScene(carry);
      if (carry < clip.duration(tl.scenes[tl.index])) break;
    }
    checkSub();
    applyTimeline();
    return true;
  }

  // ---------- transitions (camera flights with the dip overlay) ----------
  function startTransition(kind, from, to, ms, onDone) {
    transition = { kind, t0: performance.now(), ms, from, to, onDone, k: 0 };
    if (ms <= 0) stepTransition(performance.now());
    requestRender();
  }
  function stepTransition(now) {
    const tr = transition;
    if (!tr) return false;
    tr.k = tr.ms > 0 ? Math.min(1, (now - tr.t0) / (tr.ms / speed)) : 1;
    const k = tr.k;
    if (tr.kind === 'eyepiece') {
      if (tr.from && tr.to) setPose(lerpPose(tr.from, tr.to, ease(k), scratchPose));
      dipMaterial.opacity = span(k, 0.62, 1);
    } else if (tr.kind === 'dip-in') dipMaterial.opacity = k;
    else if (tr.kind === 'dip-out') dipMaterial.opacity = 1 - k;
    else if (tr.kind === 'fly') {
      if (tr.from && tr.to) setPose(lerpPose(tr.from, tr.to, ease(k), scratchPose));
    }
    if (k >= 1) {
      transition = null;
      const done = tr.onDone;
      if (done) done();
    }
    return true;
  }

  function eyepiecePose(out, inside) {
    const e = built.eyepiece;
    if (!e) return viewFrom(new THREE.Vector3(0, 1.2, 0), 0, 0.3, 0.5, out);
    _n.copy(e.axis);
    out.position.copy(e.top).addScaledVector(_n, inside ? -0.012 : 0.32);
    out.target.copy(e.top).addScaledVector(_n, -0.08);
    return out;
  }
  function enterTissue() {
    inTissue = true;
    if (!savedLimits) {
      savedLimits = {
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
        minPolarAngle: controls.minPolarAngle,
        maxPolarAngle: controls.maxPolarAngle,
        minAzimuthAngle: controls.minAzimuthAngle,
        maxAzimuthAngle: controls.maxAzimuthAngle,
      };
    }
    controls.minDistance = 0.5;
    controls.maxDistance = fitDistance(tissueRadius, 1.6);
    controls.minPolarAngle = 0.05;
    controls.maxPolarAngle = Math.PI - 0.05;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.enabled = false;
    plateVisible = true;
    setPlate(divePlate());
  }
  function leaveTissue() {
    inTissue = false;
    hatchMaterial.opacity = 0;
    if (tissue) tissue.highlight(null);
    for (const sprite of labels.values()) sprite.visible = false;
    if (savedLimits) {
      Object.assign(controls, savedLimits);
      savedLimits = null;
    }
    hovered = null;
    plateVisible = false;
  }
  function prepareDive(run, outcome, frames) {
    let r = run;
    let o = outcome;
    let f = frames;
    try {
      if (r === undefined && typeof api.getRun === 'function') r = api.getRun();
      if (o === undefined && typeof api.getOutcome === 'function') o = api.getOutcome();
      if (f === undefined && typeof api.getFrames === 'function') f = api.getFrames();
    } catch {
      /* the shell's getters are optional */
    }
    staining = readStaining(o || null, f || []);
    ensureTissue(specimenFor(r || null));
  }
  // Fly into the eyepiece, dip, swap scenes, then run `then()` inside the tissue.
  function descend(then) {
    phase = 'dive';
    controls.enabled = false;
    plateVisible = true;
    setPlate(divePlate());
    const from = currentPose();
    const to = eyepiecePose(pose(new THREE.Vector3(), new THREE.Vector3()), true);
    const swap = () => {
      enterTissue();
      then();
    };
    if (reduced()) startTransition('dip-in', null, null, DIP_MS, swap);
    else {
      const approach = eyepiecePose(pose(new THREE.Vector3(), new THREE.Vector3()), false);
      startTransition('fly', from, approach, EYEPIECE_MS * 0.55, () =>
        startTransition('eyepiece', approach, to, EYEPIECE_MS * 0.45, swap)
      );
    }
  }

  // Back on the bench at the S6 preset. markStation() first: the preset then counts as the landed
  // view, so a later resize re-fits it exactly.
  function landAtS6() {
    phase = 'bench';
    timeline = null;
    plateVisible = false;
    ctx.markStation('S6');
    ctx.applyPreset('S6');
    controls.enabled = true;
    controls.update();
  }
  // (Re)start the dive timeline inside the tissue from the shell's current run: the frames may
  // have changed since the dive first played.
  function restartDive(index) {
    prepareDive();
    setPlate(divePlate());
    startTimeline('dive', index);
  }

  // ---------- public controls ----------
  function intro() {
    if (inTissue) abort();
    cancelFlight();
    phase = 'intro';
    controls.enabled = false;
    plateVisible = true;
    setPlate(INTRO_PLATE);
    timeline = null;
    transition = null;
    dipMaterial.opacity = 0; // an interrupted dip-in or eyepiece flight must not stay pale
    startTimeline('intro');
    return true;
  }
  function dive(run, outcome, frames) {
    if (phase === 'intro') abort();
    cancelFlight();
    prepareDive(run, outcome, frames);
    if (inTissue) {
      phase = 'dive';
      timeline = null;
      transition = null;
      controls.enabled = false;
      setPlate(divePlate());
      startTimeline('dive');
      return true;
    }
    timeline = null;
    descend(() => {
      startTimeline('dive');
      if (reduced()) startTransition('dip-out', null, null, DIP_MS, null);
    });
    return true;
  }
  function beginExplore() {
    phase = 'explore';
    if (timeline) timeline.playing = false;
    // The tissue shows the fully painted end state while exploring.
    applyDive('end', 1);
    controls.target.copy(tissueCenter);
    controls.enabled = true;
    controls.update();
    requestRender();
  }
  function explore() {
    if (phase === 'explore') return true;
    if (!inTissue) {
      if (phase === 'intro') abort();
      cancelFlight();
      prepareDive();
      transition = null;
      timeline = null;
      descend(() => {
        setPose(P.explore);
        startTransition('dip-out', null, null, DIP_MS, null);
        beginExplore();
      });
      return true;
    }
    if (transition) return false;
    const from = currentPose();
    if (reduced()) {
      setPose(P.explore);
      beginExplore();
    } else {
      phase = 'explore';
      if (timeline) timeline.playing = false;
      startTransition('fly', from, P.explore, EXPLORE_MS, beginExplore);
    }
    return true;
  }
  function leaveExplore() {
    if (phase !== 'explore') return false;
    controls.enabled = false;
    hovered = null;
    if (tissue) tissue.highlight(null);
    const from = currentPose(); // before the timeline cuts the camera to the end shot
    phase = 'dive';
    if (!timeline || timeline.kind !== 'dive') startTimeline('dive', DIVE_SCENES.length - 1);
    const tl = timeline;
    tl.index = DIVE_SCENES.length - 1;
    tl.playing = false;
    tl.ended = true;
    tl.u = 1;
    tl.time = DURATION.end;
    const to = endPose(1, pose(new THREE.Vector3(), new THREE.Vector3()));
    if (reduced()) {
      setPose(to);
      applyDive('end', 1);
    } else {
      setPose(from);
      startTransition('fly', from, to, EXPLORE_MS, () => applyDive('end', 1));
    }
    lastScene = { id: 'end', index: SCENES.indexOf('end') };
    requestRender();
    return true;
  }
  function surface() {
    if (!inTissue) {
      // During the descend (the eyepiece flight or the reduced-motion dip-in) there is no tissue
      // to fade out of yet: drop the transition and land on the S6 preset at once.
      if (phase !== 'dive' || !transition) return false;
      transition = null;
      dipMaterial.opacity = 0;
      landAtS6();
      requestRender();
      return true;
    }
    const finish = () => {
      leaveTissue();
      landAtS6();
      startTransition('dip-out', null, null, DIP_MS, null);
    };
    if (tissue) tissue.highlight(null);
    controls.enabled = false;
    if (timeline) timeline.playing = false;
    phase = 'dive';
    startTransition('dip-in', null, null, DIP_MS, finish);
    return true;
  }
  function seek(target) {
    const id = typeof target === 'number' ? SCENES[target] : String(target);
    if (!SCENES.includes(id)) return false;
    const kind = INTRO_SCENES.includes(id) ? 'intro' : 'dive';
    const index = (kind === 'intro' ? INTRO_SCENES : DIVE_SCENES).indexOf(id);
    if (kind === 'intro') {
      if (inTissue) abort();
      if (!timeline || timeline.kind !== 'intro' || phase !== 'intro') {
        const wasPlaying = timeline && timeline.kind === 'intro' && timeline.playing && !timeline.ended;
        intro();
        timeline.playing = !!wasPlaying;
      }
      timeline.index = index;
      timeline.ended = false;
      enterScene();
      return true;
    }
    if (!inTissue) {
      if (phase === 'intro') abort();
      cancelFlight();
      prepareDive();
      timeline = null;
      descend(() => {
        startTimeline('dive', index);
        timeline.playing = !reduced();
        if (reduced()) startTransition('dip-out', null, null, DIP_MS, null);
      });
      return true;
    }
    if (phase === 'explore') leaveExplore();
    transition = null;
    if (id !== 'dive') dipMaterial.opacity = 0; // only the dive scene drives the dip
    const wasPlaying = !!(timeline && timeline.kind === 'dive' && timeline.playing && !timeline.ended);
    if (!timeline || timeline.kind !== 'dive' || timeline.ended) {
      restartDive(index); // enters the scene itself
      timeline.playing = wasPlaying;
      return true;
    }
    timeline.index = index;
    timeline.ended = false;
    timeline.playing = wasPlaying;
    enterScene();
    return true;
  }
  function skip() {
    if (!timeline || timeline.ended) return false;
    if (phase === 'explore') return false;
    transition = null;
    dipMaterial.opacity = 0;
    const tl = timeline;
    tl.index = tl.scenes.length - 1;
    tl.time = clip.duration(tl.scenes[tl.index]);
    tl.sub = -1;
    emitScene(tl.scenes[tl.index]);
    finishTimeline();
    return true;
  }
  function play() {
    if (phase === 'explore' || phase === 'bench') {
      if (phase === 'bench' && timeline && timeline.kind === 'intro' && timeline.ended) return intro();
      return false;
    }
    if (!timeline) return false;
    if (timeline.ended) {
      if (timeline.kind === 'dive') restartDive(0);
      else startTimeline(timeline.kind);
      return true;
    }
    timeline.playing = true;
    requestRender();
    return true;
  }
  function pause() {
    if (!timeline) return false;
    timeline.playing = false;
    return true;
  }
  // A station flight or replay() ends the clip. The timeline is dropped (clipState() reports the
  // bench at rest, not an ended timeline whose Play / Skip would do nothing) and an interrupted
  // intro leaves nothing behind: no patch ring, no cut plane, no half-lifted slab; a section that
  // had already landed on the slide stays there.
  function abort() {
    transition = null;
    dipMaterial.opacity = 0;
    if (timeline && timeline.kind === 'intro') {
      brain.setPatchHighlight(0);
      brain.cutProgress(0);
      if (slab.parent !== rack) resetSlab();
    }
    timeline = null;
    if (inTissue) {
      leaveTissue(); // the camera held tissue-space coordinates: land on the S6 preset
      landAtS6();
    } else {
      phase = 'bench';
      plateVisible = false;
      controls.enabled = true;
      controls.update();
    }
    requestRender();
  }
  function state() {
    const tl = timeline;
    const scene = tl ? tl.scenes[tl.index] : lastScene ? lastScene.id : null;
    return {
      phase,
      scene,
      index: scene ? SCENES.indexOf(scene) : -1,
      playing: !!(tl && tl.playing),
      ended: !!(tl && tl.ended),
      loaded,
      sub: tl && tl.sub >= 0 ? SITES[tl.sub] : null,
    };
  }
  function setClip(nextClip) {
    clip = readClip(nextClip);
    return true;
  }

  // ---------- per-frame ----------
  function tick(now, dt) {
    let animating = false;
    if (transition && stepTransition(now)) animating = true;
    if (timeline && timeline.playing && !transition && advance(dt * 1000)) animating = true;
    return animating;
  }

  // ---------- picking inside the tissue ----------
  function pickAt(ndc) {
    if (!inTissue || !tissue) return null;
    ray.setFromCamera(ndc, camera);
    return tissue.pick(ray);
  }
  function hoverAt(ndc) {
    if (phase !== 'explore' || !tissue) return false;
    const site = ndc ? pickAt(ndc) : null;
    if (site === hovered) return false;
    hovered = site;
    tissue.highlight(site);
    return true;
  }
  const hoverTitle = () => (hovered ? SITE_NAMES[hovered] || hovered : '');

  function dispose() {
    transition = null;
    timeline = null;
    disposeTissue();
    for (const l of tissueLights) tissueScene.remove(l);
    if (plate) {
      hud.remove(plate);
      disposeLabel(plate);
      plate = null;
    }
    dipGeometry.dispose();
    dipMaterial.dispose();
    hatchMaterial.dispose();
    hatchTexture.dispose();
    hud.clear();
    tissueScene.clear();
  }

  const debug = {
    setSpeed: n => {
      speed = n > 0 ? n : 1;
      return speed;
    },
    speed: () => speed,
    phase: () => phase,
    timeline: () =>
      timeline
        ? {
            kind: timeline.kind,
            index: timeline.index,
            u: timeline.u,
            playing: timeline.playing,
            ended: timeline.ended,
            sub: timeline.sub,
          }
        : null,
    setProgress(u) {
      if (!timeline) return false;
      const id = timeline.scenes[timeline.index];
      timeline.time = clamp01(u) * clip.duration(id);
      timeline.u = uFor(timeline);
      checkSub();
      applyTimeline();
      requestRender();
      return true;
    },
    staining: () => staining,
    tissue: () => tissue,
    tissueBuilds: () => tissueBuilds,
    tissueScene: () => tissueScene,
    // uploads of the patch colour attribute so far (the left hemisphere's; version bumps per upload)
    patchUploads: () => brain.hemispheres[0].geometry.getAttribute('color').version,
    focus: site => {
      const f = tissue && tissue.focus[site];
      return f ? f.toArray() : null;
    },
    plateText: () => (plateVisible && plate ? plateText : null),
    dip: () => dipMaterial.opacity,
    hatch: () => hatchMaterial.opacity,
    inTissue: () => inTissue,
    brainAnchors: () => ({
      center: brainCenter.toArray(),
      radius: brainRadius,
      patch: patchCenter.toArray(),
      normal: patchNormal.toArray(),
    }),
    slabParent: () => (slab.parent === rack ? 'rack' : slab.parent === brain.group ? 'brain' : 'root'),
    captionFor,
    readClip: () => clip,
  };

  return {
    tick,
    activeScene: () => (inTissue ? tissueScene : scene),
    driving: () => phase !== 'bench' && phase !== 'explore',
    active: () => phase !== 'bench',
    inTissue: () => inTissue,
    renderOverlay,
    overlayVisible,
    resize,
    intro,
    dive,
    explore,
    leaveExplore,
    surface,
    seek,
    skip,
    play,
    pause,
    abort,
    state,
    setClip,
    pickAt,
    hoverAt,
    hoverTitle,
    scenes: () => SCENES.map(id => ({ id, title: clip.title(id) })),
    dispose,
    debug,
  };
}
