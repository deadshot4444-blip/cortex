// Procedural schematic brain for the tissue clip (three.js r186, ES module).
// Original by construction: two icosphere hemispheres whose vertices are displaced radially by
// seeded simplex noise so thin grooves (sulci) separate wide ridges (gyri), a smaller
// noise-folded cerebellum under the occipital region and a tapered brainstem. Nothing here is
// atlas data: no named gyrus or sulcus is modeled and no dimension is a measurement. The cortex
// "patch" is a stand-in region (the shell's caption says so); the section cut is a translucent
// plane sweeping through it and a thin slab that lifts out for the slide scene.
// THREE is injected (clip.js passes the import-map build) so this module has no import of its own.

const BASE_COLOR = 0xdcc4bd; // pale pinkish grey
const SULCUS_COLOR = 0x9a7772; // darker groove tone
const ACCENT = 0xd27a24; // patch highlight (the lab page's bronze accent, as bench.js's hover glow)
// three's IcosahedronGeometry splits each of the 20 faces into (detail + 1)^2 triangles.
const HEMI_DETAIL = 24; // 12500 triangles per hemisphere: grooves a few edges wide stay continuous
const CEREBELLUM_DETAIL = 12; // 3380 triangles
const HEMI_GAP = 0.44; // hemisphere centre offset from the midline (the longitudinal fissure)
const PATCH_ANGLE = 0.46; // half-angle of the patch on the unit sphere (radians)
const SLAB_SIZE = 0.5;
const SLAB_THICKNESS = 0.05;
const SLAB_LIFT = 0.5;
const PLANE_SIZE = 1.5;
const PLANE_TRAVEL = 0.95;
const CUT_DEPTH = 0.06;

const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

/** mulberry32: a small seeded PRNG so the brain is identical on every mount. */
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

/** 3D simplex noise (Gustavson's public-domain formulation) with a seeded permutation table. */
function makeSimplex(random) {
  const grad = [
    [1, 1, 0],
    [-1, 1, 0],
    [1, -1, 0],
    [-1, -1, 0],
    [1, 0, 1],
    [-1, 0, 1],
    [1, 0, -1],
    [-1, 0, -1],
    [0, 1, 1],
    [0, -1, 1],
    [0, 1, -1],
    [0, -1, -1],
  ];
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  const perm = new Uint8Array(512);
  const mod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    mod12[i] = perm[i] % 12;
  }
  const F3 = 1 / 3;
  const G3 = 1 / 6;
  const corner = (x, y, z, gi) => {
    let t = 0.6 - x * x - y * y - z * z;
    if (t < 0) return 0;
    t *= t;
    const g = grad[gi];
    return t * t * (g[0] * x + g[1] * y + g[2] * z);
  };
  return (xin, yin, zin) => {
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 1, 0];
      else if (x0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 0, 1];
      else [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 1, 0, 1];
    } else if (y0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 0, 1, 1];
    else if (x0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 0, 1, 1];
    else [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 1, 1, 0];
    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    const n0 = corner(x0, y0, z0, mod12[ii + perm[jj + perm[kk]]]);
    const n1 = corner(x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3, mod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]);
    const n2 = corner(
      x0 - i2 + 2 * G3,
      y0 - j2 + 2 * G3,
      z0 - k2 + 2 * G3,
      mod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]
    );
    const n3 = corner(x0 - 1 + 3 * G3, y0 - 1 + 3 * G3, z0 - 1 + 3 * G3, mod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]);
    return 32 * (n0 + n1 + n2 + n3);
  };
}

/**
 * IcosahedronGeometry is non-indexed (every face owns its vertices), which would give flat
 * shading after displacement. Weld coincident vertices into an indexed geometry first so
 * computeVertexNormals() smooths across faces.
 */
function weldedIcosphere(THREE, radius, detail) {
  const raw = new THREE.IcosahedronGeometry(radius, detail);
  const src = raw.getAttribute('position');
  const map = new Map();
  const unique = [];
  const index = [];
  for (let i = 0; i < src.count; i++) {
    const x = src.getX(i);
    const y = src.getY(i);
    const z = src.getZ(i);
    const key = `${Math.round(x * 1e5)}|${Math.round(y * 1e5)}|${Math.round(z * 1e5)}`;
    let id = map.get(key);
    if (id === undefined) {
      id = unique.length / 3;
      map.set(key, id);
      unique.push(x, y, z);
    }
    index.push(id);
  }
  raw.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(unique, 3));
  geometry.setIndex(index);
  return geometry;
}

/** Fill a 'color' attribute with one colour (so every brain part shares the vertex-colour material). */
function fillColor(THREE, geometry, hex) {
  const c = new THREE.Color(hex);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/**
 * Build the schematic brain.
 * @param {object} THREE the three.js namespace
 * @param {{ seed?: number }} opts
 * @returns {{ group, hemispheres, solids, patch, slab, plane, bounds, setPatchHighlight, cutProgress, slabLift, dispose }}
 */
export function buildBrain(THREE, opts = {}) {
  const random = prng(opts.seed || 7);
  const noise = makeSimplex(random);
  const group = new THREE.Group();
  group.name = 'Brain';
  const geometries = [];
  const materials = [];

  const matter = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
  materials.push(matter);
  const base = new THREE.Color(BASE_COLOR);
  const sulcus = new THREE.Color(SULCUS_COLOR);
  const accent = new THREE.Color(ACCENT);
  const _c = new THREE.Color();
  const _d = new THREE.Vector3();
  const _p = new THREE.Vector3();

  // ---------- hemispheres ----------
  // `side` is -1 (left, x < 0) or +1. The unit direction `d` of each icosphere vertex is mapped
  // to an ellipsoid with a narrower frontal pole, a flatter underside, a temporal bulge low on
  // the lateral face and a shallow groove above it; the noise then carves the sulci.
  const shape = (side, d, out) => {
    const front = smooth(0.1, 1, d.z);
    const back = smooth(0.2, 1, -d.z);
    let x = d.x * 0.46 * (1 - 0.2 * front) * (1 - 0.06 * back);
    let y = d.y * 0.62 * (1 - 0.14 * front) * (1 - 0.08 * back);
    const z = d.z * 1.02;
    if (y < 0) y *= 0.8;
    const lateral = side * d.x;
    // temporal lobe: a bulge around the lateral-inferior-anterior direction
    const tw = lateral * 0.78 - d.y * 0.5 + d.z * 0.26;
    const bump = 0.2 * Math.pow(smooth(0.5, 1.05, tw), 1.4);
    x += d.x * bump;
    y += d.y * bump;
    // the groove above it (lateral face only, fading toward the occipital pole)
    const band = y - (-0.02 + 0.1 * z);
    const groove = Math.exp(-(band * band) / 0.011) * smooth(0.45, 0.85, lateral) * smooth(-0.85, -0.2, d.z);
    x -= d.x * 0.075 * groove;
    out.set(x, y, z + d.z * bump * 0.4);
  };

  const hemispheres = [];
  const patchVertices = []; // { index, weight } on the left hemisphere
  const patchDir = new THREE.Vector3(-0.92, 0.36, 0.12).normalize();
  let patchGeometry = null;
  const patchCenter = new THREE.Vector3();
  const patchNormal = new THREE.Vector3();

  for (const side of [-1, 1]) {
    const geometry = weldedIcosphere(THREE, 1, HEMI_DETAIL);
    const pos = geometry.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      _d.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      shape(side, _d, _p);
      // Gyri: thin bands where a two-octave noise field crosses zero are carved in (sulci), the
      // wide areas between them stay out. Sampling z at a lower frequency elongates the pattern
      // front-to-back. Each hemisphere samples a mirrored field so the pair is symmetric-ish.
      const sx = _p.x * side;
      // Grooves sit where the field crosses zero: a band about two mesh edges wide so it stays
      // continuous at this resolution; y is sampled at a lower frequency so the grooves run
      // up-and-over the hemisphere like a cartoon brain's rather than forming round pits.
      const n1 = noise(sx * 2.3 + 3.1, _p.y * 1.3 + 1.7, _p.z * 2.1 + 5.3);
      const n2 = noise(sx * 5.8 + 9.2, _p.y * 4.2 + 2.4, _p.z * 5.2 + 7.7) * 0.16;
      const n = n1 + n2;
      const carve = 1 - smooth(0, 0.2, Math.abs(n));
      const ridge = smooth(0.2, 0.6, Math.abs(n)); // gyral crowns bulge between the grooves
      const lift = -0.085 * carve + 0.035 * ridge + 0.012 * n1;
      _p.addScaledVector(_d, lift);
      pos.setXYZ(i, _p.x + side * HEMI_GAP, _p.y, _p.z);
      _c.copy(base).lerp(sulcus, Math.max(carve * 0.95, (1 - ridge) * 0.4));
      _c.offsetHSL(0, 0, n1 * 0.015);
      colors[i * 3] = _c.r;
      colors[i * 3 + 1] = _c.g;
      colors[i * 3 + 2] = _c.b;
      if (side === -1) {
        const angle = Math.acos(Math.max(-1, Math.min(1, _d.dot(patchDir))));
        if (angle < PATCH_ANGLE) patchVertices.push({ index: i, weight: 1 - smooth(0.6, 1, angle / PATCH_ANGLE) });
      }
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, matter);
    mesh.name = side < 0 ? 'hemisphere-left' : 'hemisphere-right';
    group.add(mesh);
    hemispheres.push(mesh);
    if (side === -1) patchGeometry = geometry;
  }

  // Patch centre and normal from the (displaced) vertices it covers.
  {
    const pos = patchGeometry.getAttribute('position');
    const nor = patchGeometry.getAttribute('normal');
    let w = 0;
    for (const v of patchVertices) {
      patchCenter.x += pos.getX(v.index) * v.weight;
      patchCenter.y += pos.getY(v.index) * v.weight;
      patchCenter.z += pos.getZ(v.index) * v.weight;
      patchNormal.x += nor.getX(v.index) * v.weight;
      patchNormal.y += nor.getY(v.index) * v.weight;
      patchNormal.z += nor.getZ(v.index) * v.weight;
      w += v.weight;
    }
    patchCenter.divideScalar(w || 1);
    patchNormal.normalize();
  }
  const patchBaseColors = patchGeometry.getAttribute('color').array.slice();

  // ---------- cerebellum ----------
  {
    const geometry = weldedIcosphere(THREE, 1, CEREBELLUM_DETAIL);
    const pos = geometry.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      _d.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      _p.set(_d.x * 0.52, _d.y * 0.3, _d.z * 0.4);
      if (_p.y > 0) _p.y *= 0.85;
      // folia: horizontal grooves wobbled by noise, plus a shallow midline notch
      const wob = noise(_p.x * 4 + 2, _p.y * 4, _p.z * 4 + 11) * 0.35;
      const folia = 1 - smooth(0, 0.3, Math.abs(Math.sin(_p.y * 44 + wob * 1.6 + _p.z * 2)));
      const notch = Math.exp(-(_p.x * _p.x) / 0.006) * smooth(0.2, 1, _d.y);
      _p.addScaledVector(_d, -0.028 * folia - 0.05 * notch);
      pos.setXYZ(i, _p.x, _p.y - 0.66, _p.z - 0.72);
      _c.copy(base).lerp(sulcus, folia * 0.8 + notch * 0.3);
      colors[i * 3] = _c.r;
      colors[i * 3 + 1] = _c.g;
      colors[i * 3 + 2] = _c.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, matter);
    mesh.name = 'cerebellum';
    group.add(mesh);
  }

  // ---------- brainstem and pons ----------
  {
    const stem = new THREE.CylinderGeometry(0.16, 0.12, 0.7, 28, 1);
    fillColor(THREE, stem, BASE_COLOR);
    geometries.push(stem);
    const mesh = new THREE.Mesh(stem, matter);
    mesh.position.set(0, -0.78, -0.28);
    mesh.rotation.x = 0.36;
    mesh.name = 'brainstem';
    group.add(mesh);
    const pons = new THREE.SphereGeometry(0.22, 24, 16);
    fillColor(THREE, pons, BASE_COLOR);
    geometries.push(pons);
    const bulge = new THREE.Mesh(pons, matter);
    bulge.position.set(0, -0.66, -0.2);
    bulge.scale.set(1, 0.8, 0.8);
    bulge.name = 'pons';
    group.add(bulge);
  }

  // ---------- patch outline (a screen-clean overlay: no depth test) ----------
  const ringGeometry = new THREE.TorusGeometry(0.36, 0.011, 8, 72);
  geometries.push(ringGeometry);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  materials.push(ringMaterial);
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  const faceToNormal = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), patchNormal);
  ring.quaternion.copy(faceToNormal);
  ring.position.copy(patchCenter).addScaledVector(patchNormal, 0.06);
  ring.renderOrder = 10;
  ring.visible = false;
  group.add(ring);

  // ---------- section plane ----------
  const planeGeometry = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE);
  const planeEdges = new THREE.EdgesGeometry(planeGeometry);
  geometries.push(planeGeometry, planeEdges);
  const planeMaterial = new THREE.MeshBasicMaterial({
    color: 0x8fb8ea,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0 });
  materials.push(planeMaterial, edgeMaterial);
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.add(new THREE.LineSegments(planeEdges, edgeMaterial));
  plane.quaternion.copy(faceToNormal);
  plane.visible = false;
  plane.renderOrder = 5;
  group.add(plane);

  // ---------- slab ----------
  const slabGeometry = new THREE.BoxGeometry(SLAB_SIZE, SLAB_SIZE, SLAB_THICKNESS);
  geometries.push(slabGeometry);
  const slabMaterial = new THREE.MeshStandardMaterial({ color: 0xe6d2cc, roughness: 0.7, metalness: 0 });
  materials.push(slabMaterial);
  const slab = new THREE.Mesh(slabGeometry, slabMaterial);
  slab.name = 'slab';
  slab.quaternion.copy(faceToNormal);
  slab.visible = false;
  group.add(slab);
  // The slab rests just under the surface (fully inside the curved patch) and lifts out along
  // the normal with a slight tilt so its thickness reads.
  const slabRest = patchCenter.clone().addScaledVector(patchNormal, -0.13);
  const slabTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.22);
  const slabLiftedQuat = faceToNormal.clone().premultiply(slabTilt);
  const _q = new THREE.Quaternion();

  // Bounds of the solid parts (hemispheres, cerebellum, stem, pons): what the camera frames and
  // what a hotspot lights up.
  group.updateMatrixWorld(true);
  const overlays = new Set([ring, plane, slab]);
  const solids = group.children.filter(child => child.isMesh && !overlays.has(child));
  const bounds = new THREE.Box3();
  for (const mesh of solids) bounds.expandByObject(mesh);

  // The colour attribute is re-uploaded only when the highlight actually changes: the intro calls
  // this every frame, and a constant beat (0 on the overview, 1 through the cut) uploads nothing.
  let patchHighlight = 0;
  function setPatchHighlight(t) {
    const k = clamp01(t);
    if (k === patchHighlight) return;
    patchHighlight = k;
    const attr = patchGeometry.getAttribute('color');
    const arr = attr.array;
    for (const v of patchVertices) {
      const i = v.index * 3;
      const a = k * v.weight * 0.7;
      arr[i] = lerp(patchBaseColors[i], accent.r, a);
      arr[i + 1] = lerp(patchBaseColors[i + 1], accent.g, a);
      arr[i + 2] = lerp(patchBaseColors[i + 2], accent.b, a);
    }
    attr.needsUpdate = true;
    ringMaterial.opacity = 0.9 * k;
    ring.visible = k > 0.001;
  }

  /** t 0..1: the plane sweeps in along the patch normal and fades at both ends. */
  function cutProgress(t) {
    const k = clamp01(t);
    const travel = lerp(PLANE_TRAVEL, -CUT_DEPTH, smooth(0, 1, k));
    plane.position.copy(patchCenter).addScaledVector(patchNormal, travel);
    const fade = Math.sin(Math.PI * k);
    planeMaterial.opacity = 0.36 * fade;
    edgeMaterial.opacity = 0.85 * fade;
    plane.visible = k > 0.001 && k < 0.999;
  }

  /** t 0..1: the slab lifts out of the patch along the normal; returns its lifted pose at t. */
  function slabLift(t) {
    const k = smooth(0, 1, clamp01(t));
    slab.visible = t > 0.001;
    slab.position.copy(slabRest).addScaledVector(patchNormal, (0.13 + SLAB_LIFT) * k);
    _q.copy(faceToNormal).slerp(slabLiftedQuat, k);
    slab.quaternion.copy(_q);
    return slab;
  }

  function dispose() {
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    group.clear();
  }

  return {
    group,
    hemispheres,
    solids,
    patch: { center: patchCenter, normal: patchNormal, radius: 0.36, ring },
    slab,
    plane,
    bounds,
    setPatchHighlight,
    cutProgress,
    slabLift,
    dispose,
  };
}
