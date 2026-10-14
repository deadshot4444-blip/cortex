// Schematic neuropil volume for the tissue clip (three.js r186, ES module).
// A ~6 x 4 x 4 box filled with somata (instanced spheres with short processes), axons (tube
// splines), plaque cores (clustered spheres with a soft halo sprite), plaque neurites (short
// radiating tubes with swollen tips), tangles (teardrop lathe shapes inside some somata) and
// neuropil threads (short thin tubes). Structure counts follow specimen.sites[site].presence
// (0 = none). The look is unstained and pale until applyPhase() paints the engine's state:
// ionicBound -> glint density, nuclei -> dark dot density, deposit -> material darkness through
// the microscope's five fixed tints, background deposit -> fog / matrix tint. No new science:
// every darkness value is an ordinal the engine produced. Everything is instanced or merged
// (one draw call per structure class); textures are generated here. THREE is injected.

export const SITES = ['axon', 'plaque-core', 'plaque-neurite', 'tangle', 'neuropil-thread'];
export const DEFAULT_TINTS = ['#e4d8c4', '#c9a978', '#8f6a45', '#4e3826', '#16110d'];
export const SITE_NAMES = {
  axon: 'Axon',
  'plaque-core': 'Plaque core',
  'plaque-neurite': 'Plaque neurite',
  tangle: 'Tangle',
  'neuropil-thread': 'Neuropil thread',
  background: 'Background',
  soma: 'Neuron cell body',
};

const HALF = { x: 3, y: 2, z: 2 }; // volume half extents
const INNER = { x: 2.6, y: 1.6, z: 1.6 }; // structures stay inside this box
const SOMA_COUNT = 40;
const COUNTS = {
  axon: [0, 15, 30, 45, 60],
  'plaque-core': [0, 1, 2, 3, 5], // clusters
  'plaque-neurite': [0, 1, 2, 3, 5], // clusters (9 tubes each)
  tangle: [0, 4, 8, 12, 16],
  'neuropil-thread': [0, 16, 32, 48, 64],
};
const NEURITES_PER_CLUSTER = 9;
const GLINT_FRACTION = [0, 0.14, 0.34, 0.64, 1];
const NUCLEI_FRACTION = [0, 0.12, 0.3, 0.6, 1];
const OPACITY_BY_DEPOSIT = [null, 0.86, 0.93, 0.98, 1]; // index 0 keeps the unstained opacity
const FOG_BASE = 0xf3efe8;
const FOG_STAINED = 0xcdbb9c;
const HOVER_EMISSIVE = 0x1769d2;

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Concatenate indexed geometries carrying position + normal into one (disposes the inputs). */
function mergeGeometries(THREE, list) {
  let vertices = 0;
  let indices = 0;
  for (const g of list) {
    vertices += g.getAttribute('position').count;
    indices += g.index ? g.index.count : g.getAttribute('position').count;
  }
  const position = new Float32Array(vertices * 3);
  const normal = new Float32Array(vertices * 3);
  const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
  let vo = 0;
  let io = 0;
  for (const g of list) {
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    position.set(p.array.subarray(0, p.count * 3), vo * 3);
    normal.set(n.array.subarray(0, n.count * 3), vo * 3);
    if (g.index) {
      const src = g.index.array;
      for (let i = 0; i < g.index.count; i++) index[io + i] = src[i] + vo;
      io += g.index.count;
    } else {
      for (let i = 0; i < p.count; i++) index[io + i] = vo + i;
      io += p.count;
    }
    vo += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

/** A soft round dot texture: centre colour to transparent edge (glints get a bright core). */
function dotTexture(THREE, { core, mid, px = 64 }) {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
  g.addColorStop(0, core);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, px, px);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Build the neuropil volume.
 * @param {object} THREE
 * @param {{ specimen?: object, tints?: string[], seed?: number }} opts
 */
export function buildTissue(THREE, opts = {}) {
  const specimen = opts.specimen || null;
  const tints = (Array.isArray(opts.tints) && opts.tints.length === 5 ? opts.tints : DEFAULT_TINTS).map(
    t => new THREE.Color(typeof t === 'string' ? t : t && t.color ? t.color : '#000000')
  );
  const random = prng(opts.seed || (specimen && specimen.seed) || 101);
  const presence = site => {
    const entry = specimen && specimen.sites ? specimen.sites[site] : null;
    const p = entry && typeof entry.presence === 'number' ? entry.presence : 2;
    return clamp(Math.round(p), 0, 4);
  };
  const countOf = site => COUNTS[site][presence(site)];

  const group = new THREE.Group();
  group.name = 'Tissue';
  const geometries = [];
  const materials = [];
  const textures = [];
  const structures = {};
  const focus = {};
  const pickables = [];
  const _m = new THREE.Matrix4();
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _e = new THREE.Euler();
  const _v = new THREE.Vector3();

  const rnd = (a, b) => a + (b - a) * random();
  // The camera's representative of a structure class: the instance nearest the volume centre.
  const nearestCentre = points => points.reduce((best, p) => (p.lengthSq() < best.lengthSq() ? p : best), points[0]);
  const randomDir = out => {
    const z = rnd(-1, 1);
    const t = rnd(0, Math.PI * 2);
    const r = Math.sqrt(1 - z * z);
    return out.set(r * Math.cos(t), r * Math.sin(t), z);
  };
  const randomPoint = (out, shrink = 1) =>
    out.set(rnd(-INNER.x, INNER.x) * shrink, rnd(-INNER.y, INNER.y) * shrink, rnd(-INNER.z, INNER.z) * shrink);

  const std = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, transparent: true, ...extra });
  // Unstained bases: pale, close to the fog colour, low contrast.
  const M = {
    soma: std(0xeae2d7, { opacity: 0.5, depthWrite: false }),
    process: std(0xe4dbcf, { opacity: 0.82 }),
    axon: std(0xe3d9cc, { opacity: 0.8 }),
    core: std(0xe6d9c7, { opacity: 0.78 }),
    neurite: std(0xe3d6c5, { opacity: 0.82 }),
    tangle: std(0xe4d9cb, { opacity: 1, transparent: false }),
    thread: std(0xe3dacd, { opacity: 0.82 }),
  };
  for (const m of Object.values(M)) materials.push(m);
  const baseColor = {};
  const baseOpacity = {};
  for (const [k, m] of Object.entries(M)) {
    baseColor[k] = m.color.clone();
    baseOpacity[k] = m.opacity;
  }
  const siteMaterial = {
    axon: 'axon',
    'plaque-core': 'core',
    'plaque-neurite': 'neurite',
    tangle: 'tangle',
    'neuropil-thread': 'thread',
  };

  // ---------- placement ----------
  const somata = []; // { p: Vector3, r: number, tangle: boolean }
  for (let tries = 0; somata.length < SOMA_COUNT && tries < 4000; tries++) {
    randomPoint(_p, 0.96);
    const r = 0.23 * rnd(0.78, 1.22);
    if (somata.every(s => s.p.distanceTo(_p) > r + s.r + 0.28)) somata.push({ p: _p.clone(), r, tangle: false });
  }
  const clusterCount = Math.max(countOf('plaque-core'), countOf('plaque-neurite'));
  const clusters = [];
  for (let tries = 0; clusters.length < clusterCount && tries < 4000; tries++) {
    randomPoint(_p, 0.8);
    if (clusters.every(c => c.distanceTo(_p) > 1.5) && somata.every(s => s.p.distanceTo(_p) > s.r + 0.62))
      clusters.push(_p.clone());
  }
  const tangleCount = Math.min(countOf('tangle'), somata.length);
  const order = somata.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (let i = 0; i < tangleCount; i++) somata[order[i]].tangle = true;

  // ---------- somata (instanced icospheres) + processes (merged tubes) ----------
  const somaGeometry = new THREE.IcosahedronGeometry(1, 3);
  geometries.push(somaGeometry);
  const somaMesh = new THREE.InstancedMesh(somaGeometry, M.soma, Math.max(1, somata.length));
  somaMesh.count = somata.length;
  somaMesh.renderOrder = 2;
  const processGeometries = [];
  somata.forEach((s, i) => {
    _q.setFromEuler(_e.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)));
    _s.set(s.r * rnd(0.92, 1.08), s.r * rnd(0.9, 1.1), s.r * rnd(0.92, 1.08));
    somaMesh.setMatrixAt(i, _m.compose(s.p, _q, _s));
    const n = 2 + Math.floor(random() * 2);
    for (let k = 0; k < n; k++) {
      const dir = randomDir(new THREE.Vector3());
      const a = s.p.clone().addScaledVector(dir, s.r * 0.85);
      const b = s.p
        .clone()
        .addScaledVector(dir, s.r + 0.22)
        .add(randomDir(_v).multiplyScalar(0.1));
      const c = s.p
        .clone()
        .addScaledVector(dir, s.r + rnd(0.42, 0.6))
        .add(randomDir(_v).multiplyScalar(0.18));
      const curve = new THREE.CatmullRomCurve3([a, b, c]);
      processGeometries.push(new THREE.TubeGeometry(curve, 7, 0.018, 5, false));
    }
  });
  somaMesh.instanceMatrix.needsUpdate = true;
  somaMesh.computeBoundingSphere();
  somaMesh.userData.site = 'soma';
  group.add(somaMesh);
  structures.soma = somaMesh;
  pickables.push(somaMesh);
  if (processGeometries.length) {
    const g = mergeGeometries(THREE, processGeometries);
    geometries.push(g);
    const mesh = new THREE.Mesh(g, M.process);
    mesh.renderOrder = 1;
    group.add(mesh);
    structures.process = mesh;
  }
  if (somata.length) focus.soma = nearestCentre(somata.map(s => s.p)).clone();

  // ---------- axons: long tube splines across the volume ----------
  const sampleSets = {}; // site -> [{ geometry|instanced, ... }] for glint / nuclei sampling
  const axonGeometries = [];
  const axonMids = [];
  const axonCount = countOf('axon');
  for (let i = 0; i < axonCount; i++) {
    const dir = new THREE.Vector3(rnd(-1, 1) * 1.6, rnd(-1, 1), rnd(-1, 1)).normalize();
    const start = randomPoint(new THREE.Vector3(), 0.7);
    const points = [];
    const length = rnd(3.2, 4.6);
    for (let k = 0; k < 6; k++) {
      const t = k / 5 - 0.5;
      const p = start.clone().addScaledVector(dir, t * length);
      p.add(randomDir(_v).multiplyScalar(0.22 + 0.25 * Math.abs(t)));
      p.x = clamp(p.x, -INNER.x, INNER.x);
      p.y = clamp(p.y, -INNER.y, INNER.y);
      p.z = clamp(p.z, -INNER.z, INNER.z);
      points.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(points);
    axonGeometries.push(new THREE.TubeGeometry(curve, 30, rnd(0.018, 0.03), 5, false));
    axonMids.push(curve.getPoint(0.5));
  }
  if (axonGeometries.length) {
    const g = mergeGeometries(THREE, axonGeometries);
    geometries.push(g);
    const mesh = new THREE.Mesh(g, M.axon);
    mesh.userData.site = 'axon';
    group.add(mesh);
    structures.axon = mesh;
    pickables.push(mesh);
    sampleSets.axon = [{ geometry: g }];
    focus.axon = nearestCentre(axonMids).clone();
  }

  // ---------- plaque cores: clustered instanced spheres + halo sprites ----------
  const coreGeometry = new THREE.IcosahedronGeometry(1, 2);
  geometries.push(coreGeometry);
  const coreClusters = clusters.slice(0, countOf('plaque-core'));
  const coreMatrices = [];
  const halos = [];
  const haloTexture = dotTexture(THREE, { core: 'rgba(120, 95, 60, 0.55)', mid: 'rgba(140, 115, 80, 0.22)', px: 128 });
  if (haloTexture) textures.push(haloTexture);
  const haloMaterial = new THREE.SpriteMaterial({
    map: haloTexture,
    color: 0xd8c6a6,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  materials.push(haloMaterial);
  for (const c of coreClusters) {
    _q.setFromEuler(_e.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)));
    _s.setScalar(0.17 * rnd(0.9, 1.1));
    coreMatrices.push(_m.compose(c, _q, _s).clone());
    const satellites = 6 + Math.floor(random() * 4);
    for (let k = 0; k < satellites; k++) {
      const p = c.clone().add(randomDir(_v).multiplyScalar(rnd(0.14, 0.27)));
      _s.setScalar(rnd(0.05, 0.1));
      coreMatrices.push(_m.compose(p, _q, _s).clone());
    }
    const halo = new THREE.Sprite(haloMaterial);
    halo.position.copy(c);
    halo.scale.set(1.15, 1.15, 1);
    halo.renderOrder = 0;
    group.add(halo);
    halos.push(halo);
  }
  const coreMesh = new THREE.InstancedMesh(coreGeometry, M.core, Math.max(1, coreMatrices.length));
  coreMesh.count = coreMatrices.length;
  coreMatrices.forEach((m, i) => coreMesh.setMatrixAt(i, m));
  coreMesh.instanceMatrix.needsUpdate = true;
  coreMesh.computeBoundingSphere();
  coreMesh.userData.site = 'plaque-core';
  coreMesh.visible = coreMatrices.length > 0;
  group.add(coreMesh);
  structures['plaque-core'] = coreMesh;
  if (coreMatrices.length) {
    pickables.push(coreMesh);
    focus['plaque-core'] = nearestCentre(coreClusters).clone();
    sampleSets['plaque-core'] = [{ geometry: coreGeometry, matrices: coreMatrices }];
  }

  // ---------- plaque neurites: short radiating tubes with swollen tips ----------
  const neuriteClusters = clusters.slice(0, countOf('plaque-neurite'));
  const neuriteGeometries = [];
  const tipGeometry = new THREE.IcosahedronGeometry(1, 1);
  geometries.push(tipGeometry);
  const tipMatrices = [];
  for (const c of neuriteClusters) {
    for (let k = 0; k < NEURITES_PER_CLUSTER; k++) {
      const dir = randomDir(new THREE.Vector3());
      const a = c.clone().addScaledVector(dir, rnd(0.2, 0.26));
      const b = c.clone().addScaledVector(dir, 0.4).add(randomDir(_v).multiplyScalar(0.07));
      const d = c.clone().addScaledVector(dir, rnd(0.55, 0.68)).add(randomDir(_v).multiplyScalar(0.12));
      const curve = new THREE.CatmullRomCurve3([a, b, d]);
      neuriteGeometries.push(new THREE.TubeGeometry(curve, 7, 0.024, 5, false));
      _q.identity();
      _s.setScalar(rnd(0.036, 0.05));
      tipMatrices.push(_m.compose(d, _q, _s).clone());
    }
  }
  if (neuriteGeometries.length) {
    const g = mergeGeometries(THREE, neuriteGeometries);
    geometries.push(g);
    const mesh = new THREE.Mesh(g, M.neurite);
    mesh.userData.site = 'plaque-neurite';
    group.add(mesh);
    structures['plaque-neurite'] = mesh;
    pickables.push(mesh);
    const tips = new THREE.InstancedMesh(tipGeometry, M.neurite, tipMatrices.length);
    tipMatrices.forEach((m, i) => tips.setMatrixAt(i, m));
    tips.instanceMatrix.needsUpdate = true;
    tips.computeBoundingSphere();
    tips.userData.site = 'plaque-neurite';
    group.add(tips);
    pickables.push(tips);
    structures.neuriteTips = tips;
    focus['plaque-neurite'] = nearestCentre(neuriteClusters)
      .clone()
      .add(new THREE.Vector3(0.3, 0.12, 0.2));
    sampleSets['plaque-neurite'] = [{ geometry: g }];
  }

  // ---------- tangles: teardrop lathe inside tangle-bearing somata ----------
  const profile = [];
  const STEPS = 11;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const r = i === 0 || i === STEPS ? 0 : 0.5 * Math.sin(Math.PI * Math.pow(t, 0.68));
    profile.push(new THREE.Vector2(r, t * 1.5 - 0.75));
  }
  const tangleGeometry = new THREE.LatheGeometry(profile, 12);
  geometries.push(tangleGeometry);
  const tangleSomata = somata.filter(s => s.tangle);
  const tangleMesh = new THREE.InstancedMesh(tangleGeometry, M.tangle, Math.max(1, tangleSomata.length));
  tangleMesh.count = tangleSomata.length;
  const tangleMatrices = [];
  tangleSomata.forEach((s, i) => {
    _q.setFromEuler(_e.set(rnd(-0.5, 0.5), rnd(0, 6.28), rnd(-0.5, 0.5)));
    _s.set(s.r * 1.05, s.r * 1.05, s.r * 1.05);
    tangleMesh.setMatrixAt(i, _m.compose(s.p, _q, _s));
    tangleMatrices.push(_m.clone());
  });
  tangleMesh.instanceMatrix.needsUpdate = true;
  tangleMesh.computeBoundingSphere();
  tangleMesh.userData.site = 'tangle';
  tangleMesh.visible = tangleSomata.length > 0;
  group.add(tangleMesh);
  structures.tangle = tangleMesh;
  if (tangleSomata.length) {
    pickables.push(tangleMesh);
    focus.tangle = nearestCentre(tangleSomata.map(s => s.p)).clone();
    sampleSets.tangle = [{ geometry: tangleGeometry, matrices: tangleMatrices }];
  }

  // ---------- neuropil threads: short thin curved tubes ----------
  const threadGeometries = [];
  const threadMids = [];
  const threadCount = countOf('neuropil-thread');
  for (let i = 0; i < threadCount; i++) {
    const a = randomPoint(new THREE.Vector3(), 0.95);
    const dir = randomDir(new THREE.Vector3());
    const length = rnd(0.3, 0.55);
    const b = a
      .clone()
      .addScaledVector(dir, length / 2)
      .add(randomDir(_v).multiplyScalar(0.06));
    const c = a.clone().addScaledVector(dir, length);
    const curve = new THREE.CatmullRomCurve3([a, b, c]);
    threadGeometries.push(new THREE.TubeGeometry(curve, 6, rnd(0.011, 0.016), 4, false));
    threadMids.push(b.clone());
  }
  if (threadGeometries.length) {
    const g = mergeGeometries(THREE, threadGeometries);
    geometries.push(g);
    const mesh = new THREE.Mesh(g, M.thread);
    mesh.userData.site = 'neuropil-thread';
    group.add(mesh);
    structures['neuropil-thread'] = mesh;
    pickables.push(mesh);
    sampleSets['neuropil-thread'] = [{ geometry: g }];
    focus['neuropil-thread'] = nearestCentre(threadMids).clone();
  }

  // ---------- neuropil matrix: a faint point haze that tints with the background ----------
  const MATRIX_COUNT = 1600;
  const matrixPositions = new Float32Array(MATRIX_COUNT * 3);
  for (let i = 0; i < MATRIX_COUNT; i++) {
    randomPoint(_p, 1);
    matrixPositions[i * 3] = _p.x;
    matrixPositions[i * 3 + 1] = _p.y;
    matrixPositions[i * 3 + 2] = _p.z;
  }
  const matrixGeometry = new THREE.BufferGeometry();
  matrixGeometry.setAttribute('position', new THREE.BufferAttribute(matrixPositions, 3));
  geometries.push(matrixGeometry);
  const softTexture = dotTexture(THREE, { core: 'rgba(255,255,255,1)', mid: 'rgba(255,255,255,0.5)' });
  if (softTexture) textures.push(softTexture);
  const matrixMaterial = new THREE.PointsMaterial({
    color: 0xd9d0c3,
    size: 0.07,
    map: softTexture,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    sizeAttenuation: true,
  });
  materials.push(matrixMaterial);
  const matrix = new THREE.Points(matrixGeometry, matrixMaterial);
  matrix.renderOrder = -1;
  group.add(matrix);

  // ---------- glints and nuclei: points sampled on structure surfaces ----------
  const SAMPLE_TOTAL = { axon: 520, 'plaque-core': 220, 'plaque-neurite': 240, tangle: 260, 'neuropil-thread': 240 };
  const glintTexture = dotTexture(THREE, { core: 'rgba(255,255,255,1)', mid: 'rgba(96,120,150,0.9)' });
  const nucleusTexture = dotTexture(THREE, { core: 'rgba(40,28,18,1)', mid: 'rgba(60,44,30,0.85)' });
  if (glintTexture) textures.push(glintTexture);
  if (nucleusTexture) textures.push(nucleusTexture);
  const glintMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.06,
    map: glintTexture,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    alphaTest: 0.02,
    sizeAttenuation: true,
  });
  const nucleusMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.045,
    map: nucleusTexture,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    alphaTest: 0.02,
    sizeAttenuation: true,
  });
  materials.push(glintMaterial, nucleusMaterial);
  const samplePoints = (sets, total) => {
    // Surface samples spread over the set's geometries (and instances), stored in random order
    // so that setDrawRange(0, n) is a uniform density control.
    const out = [];
    const pool = [];
    for (const set of sets) {
      const pos = set.geometry.getAttribute('position');
      if (set.matrices) for (const m of set.matrices) pool.push({ pos, m });
      else pool.push({ pos, m: null });
    }
    if (!pool.length) return new Float32Array(0);
    for (let i = 0; i < total; i++) {
      const entry = pool[Math.floor(random() * pool.length)];
      const vi = Math.floor(random() * entry.pos.count);
      _p.set(entry.pos.getX(vi), entry.pos.getY(vi), entry.pos.getZ(vi));
      if (entry.m) _p.applyMatrix4(entry.m);
      out.push(_p.x, _p.y, _p.z);
    }
    return new Float32Array(out);
  };
  const glints = {};
  const nuclei = {};
  for (const site of SITES) {
    const sets = sampleSets[site];
    if (!sets) continue;
    const scale = COUNTS[site][presence(site)] / COUNTS[site][4];
    const total = Math.max(8, Math.round(SAMPLE_TOTAL[site] * Math.max(0.35, scale)));
    for (const [store, material] of [
      [glints, glintMaterial],
      [nuclei, nucleusMaterial],
    ]) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(samplePoints(sets, total), 3));
      g.setDrawRange(0, 0);
      geometries.push(g);
      const points = new THREE.Points(g, material);
      points.visible = false;
      points.renderOrder = 3;
      group.add(points);
      store[site] = { points, total };
    }
  }

  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3(
    new THREE.Vector3(-HALF.x, -HALF.y, -HALF.z),
    new THREE.Vector3(HALF.x, HALF.y, HALF.z)
  );
  const fogColor = new THREE.Color(FOG_BASE);
  const fogBase = new THREE.Color(FOG_BASE);
  const fogStained = new THREE.Color(FOG_STAINED);
  const matrixBase = new THREE.Color(0xd9d0c3);
  const matrixStained = new THREE.Color(0xa88c66);
  const haloBase = haloMaterial.color.clone();
  const _c = new THREE.Color();
  const current = { ionic: {}, nuclei: {}, deposit: {}, background: 0 };
  for (const site of SITES) {
    current.ionic[site] = 0;
    current.nuclei[site] = 0;
    current.deposit[site] = 0;
  }

  const level = (value, site) => {
    if (value && typeof value === 'object') value = value[site];
    return clamp(typeof value === 'number' && Number.isFinite(value) ? value : 0, 0, 4);
  };
  const stepLerp = (table, x) => {
    const i = Math.floor(x);
    const j = Math.min(4, i + 1);
    return table[i] + (table[j] - table[i]) * (x - i);
  };
  // Material darkness: level 0 is the unstained base, 1..4 the fixed tints; fractional levels
  // lerp between neighbours so an animated phase darkens smoothly.
  const paint = (key, x) => {
    const m = M[key];
    const i = Math.floor(x);
    const j = Math.min(4, i + 1);
    const f = x - i;
    const from = i === 0 ? baseColor[key] : tints[i];
    const to = j === 0 ? baseColor[key] : tints[j];
    m.color.copy(from).lerp(to, f);
    const o0 = i === 0 ? baseOpacity[key] : OPACITY_BY_DEPOSIT[i];
    const o1 = j === 0 ? baseOpacity[key] : OPACITY_BY_DEPOSIT[j];
    if (m.transparent) m.opacity = o0 + (o1 - o0) * f;
  };
  const range = (store, site, fraction) => {
    const entry = store[site];
    if (!entry) return;
    const n = Math.round(entry.total * clamp(fraction, 0, 1));
    entry.points.geometry.setDrawRange(0, n);
    entry.points.visible = n > 0;
  };

  function applyPhase(phase = {}) {
    for (const site of SITES) {
      const ionic = level(phase.ionic, site);
      const nuc = level(phase.nuclei, site);
      const dep = level(phase.deposit, site);
      current.ionic[site] = ionic;
      current.nuclei[site] = nuc;
      current.deposit[site] = dep;
      range(glints, site, stepLerp(GLINT_FRACTION, ionic));
      range(nuclei, site, stepLerp(NUCLEI_FRACTION, nuc));
      paint(siteMaterial[site], dep);
    }
    const bg = level(typeof phase.background === 'number' ? phase.background : 0, 'background');
    current.background = bg;
    fogColor.copy(fogBase).lerp(fogStained, (bg / 4) * 0.8);
    matrixMaterial.color.copy(matrixBase).lerp(matrixStained, bg / 4);
    matrixMaterial.opacity = 0.4 + 0.25 * (bg / 4);
    // the halo darkens with the plaque core deposit
    const coreDep = current.deposit['plaque-core'];
    haloMaterial.color.copy(haloBase).lerp(_c.set(0x4a3523), coreDep / 4);
    haloMaterial.opacity = 0.5 + 0.3 * (coreDep / 4);
  }

  /** state = { [site]: { ionicBound, nuclei, deposit } } (a Run / frame / Outcome state). */
  function applyState(state) {
    const phase = { ionic: {}, nuclei: {}, deposit: {}, background: 0 };
    for (const site of SITES) {
      const s = state && state[site];
      phase.ionic[site] = s && typeof s.ionicBound === 'number' ? s.ionicBound : 0;
      phase.nuclei[site] = s && typeof s.nuclei === 'number' ? s.nuclei : 0;
      phase.deposit[site] = s && typeof s.deposit === 'number' ? s.deposit : 0;
    }
    const bg = state && state.background;
    phase.background = bg && typeof bg.deposit === 'number' ? bg.deposit : 0;
    applyPhase(phase);
  }

  let highlighted = null;
  const emissiveFor = site => {
    const key = site === 'soma' ? 'soma' : siteMaterial[site];
    return key ? M[key] : null;
  };
  function highlight(site) {
    if (site === highlighted) return false;
    const prev = emissiveFor(highlighted);
    if (prev) {
      prev.emissive.setHex(0x000000);
      prev.emissiveIntensity = 1;
    }
    highlighted = site && emissiveFor(site) ? site : null;
    const next = emissiveFor(highlighted);
    if (next) {
      next.emissive.setHex(HOVER_EMISSIVE);
      next.emissiveIntensity = 0.28;
    }
    return true;
  }

  const hits = [];
  function pick(raycaster) {
    hits.length = 0;
    raycaster.intersectObjects(pickables, false, hits);
    if (!hits.length) return null;
    const hit = hits[0];
    hits.length = 0;
    const site = hit.object.userData.site;
    if (site === 'soma' && typeof hit.instanceId === 'number') {
      const s = somata[hit.instanceId];
      return s && s.tangle ? 'tangle' : 'soma';
    }
    return site || null;
  }

  function dispose() {
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    for (const t of textures) t.dispose();
    for (const obj of [somaMesh, coreMesh, tangleMesh]) obj.dispose();
    if (structures.neuriteTips) structures.neuriteTips.dispose();
    group.clear();
  }

  applyPhase({});

  return {
    group,
    structures,
    focus,
    bounds,
    fogColor,
    halos,
    current,
    counts: Object.fromEntries(SITES.map(site => [site, countOf(site)])),
    applyState,
    applyPhase,
    highlight,
    pick,
    dispose,
  };
}
