// Procedural bench scene for the Alzheimer's histology lab (three.js r186, ES module).
// Everything is built from three shared unit primitives (box, cylinder, plane) scaled per part.
// Parts that never move and never light up are instanced per (geometry, material) pair, so the
// whole bench costs a few dozen draw calls; hotspot visuals, done markers and the carried rack
// stay plain meshes. Original assets by construction: nothing is downloaded, and the only
// textures are generated here (floor tiles, bench-top grain, backsplash tiles) and in labels.js (station titles).
// In-scene text shows station titles and the specimen plate only; hotspot titles (DOM tooltips)
// may add step titles and plain object names. No reagent names, quantities, temperatures or
// times anywhere. The specimen tray at the head of the bench carries the schematic brain of
// brain.js (contract §7.1); the tissue volume lives in the director's second scene (clip.js).
import * as THREE from 'three';
import { makeLabelSprite, disposeLabel } from './labels.js?v=2';
import { buildBrain } from './brain.js?v=2';

export const BENCH_TOP_Y = 0.9;
export const STATION_SPACING = 2.1;
export const STATION_COUNT = 8;
export const BENCH_LENGTH = STATION_COUNT * STATION_SPACING + 0.4;
export const BENCH_DEPTH = 0.9;
export const WALL_Z = -0.62;
export const RACK_Z = 0.3;
// The signs hang just over the tallest equipment (S3's hood ends 0.64 over the bench; a two-line plate reaches
// 0.085 under LABEL_Y) so a station's framed box stays short and its equipment fills the frame; the plate is
// sized to read beside a jar, not to span a station (bench.js grows a sign that would draw too small).
export const LABEL_Y = BENCH_TOP_Y + 0.76;

const LABEL_WIDTH = 0.52; // world units; a one-line plate is 4:1 (labels.js `sign`: a long title is taller or wider)
const SPECIMEN_X = -BENCH_LENGTH / 2 + 0.36; // specimen tray centre: the head of the bench, left of S1
const SPECIMEN_Z = -0.06;
const BRAIN_SCALE = 0.085; // brain.js units -> bench metres (a hand-sized schematic brain)
const SHELF_Y = BENCH_TOP_Y + 1.42;
const ROOM_WIDTH = 90;
const ROOM_DEPTH = 60;
const WALL_HEIGHT = 12;
const TILE = 0.9; // floor tile edge, world units
const DOOR = 1.05; // cabinet door pitch, world units
// The room on the lab's own palette (lab.css "Lab identity": paper, warm lines, bronze). A tiled backsplash
// runs along the wall from the bench top to just under the signs (its top is flush with the whiteboard's), so
// a station view is never a bare plane: three rows of SPLASH_TILE tiles, a whole number of them along the band.
export const ROOM_COLOR = 0xe6e1d8; // the background and the fog: the wall's tone, a shade deeper
const SPLASH_TILE = 0.22;
const SPLASH_TOP = BENCH_TOP_Y + 3 * SPLASH_TILE;
const SPLASH_LENGTH = Math.round((BENCH_LENGTH + 1.2) / SPLASH_TILE) * SPLASH_TILE;
// §13.4 (open free bench): the "Your jars" tray, station S9, on the free stretch of bench between "Dehydrate and
// mount" (S5's equipment ends at x 1.73) and the microscope (S6's starts at 3.0), its sign over it. It holds up to
// JARS_MAX of the student's own jars (the procedure jars' size), packed in a row on a tray their size; layoutJars()
// shows the ones the shell lists (none: no tray, no jars, no sign).
export const JARS_STATION = 'S9';
export const JARS_MAX = 4;
const JARS_X = (stationX(4) + stationX(5)) / 2 + 0.15;
const JARS_SIGN_DX = -0.15; // the sign sits midway between S5's and S6's signs, a little left of the tray's centre
const JARS_Z = -0.08;
const JAR_PITCH = 0.2;
const JAR = [0.11, 0.15, 0.075]; // a jar's glass (w, h, d): jar()'s default
const JARS_TRAY_D = 0.22;
const JARS_RIM = 0.012;

// Fallback when api.lab.listStations() is unavailable (ids and titles from PLAN §4 / contract §3,
// `studentTitle` as data/lab/methods.json carries it); bench.js shows `studentTitle || title`.
export const DEFAULT_STATIONS = [
  { id: 'S1', title: 'Deparaffinize / rehydrate', studentTitle: 'Remove the wax', steps: ['deparaffinize-rehydrate'] },
  {
    id: 'S2',
    title: 'Silver impregnation',
    studentTitle: 'First silver bath',
    steps: ['silver-impregnation', 'water-wash'],
  },
  {
    id: 'S3',
    title: 'Ammoniacal silver + developer',
    studentTitle: 'Ammoniacal silver and develop',
    steps: ['ammoniacal-silver', 'ammonium-hydroxide-wash', 'development'],
  },
  {
    id: 'S4',
    title: 'Toning + thiosulfate',
    studentTitle: 'Gold and thiosulfate',
    steps: ['gold-toning', 'sodium-thiosulfate'],
  },
  {
    id: 'S5',
    title: 'Dehydrate / clear / mount',
    studentTitle: 'Dehydrate and mount',
    steps: ['final-wash-dehydrate-clear-mount'],
  },
  { id: 'S6', title: 'Microscope', steps: [] },
  { id: 'S7', title: 'Waste + safety', steps: [] },
  { id: 'S8', title: 'Notebook / whiteboard', steps: [] },
  { id: 'S9', title: 'Your jars', studentTitle: 'Your jars', steps: [] },
];

export function stationX(index) {
  return (index - (STATION_COUNT - 1) / 2) * STATION_SPACING;
}

const std = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...extra });
// Clear glass: no transmission (budget), a light tint at low opacity with a sharp specular.
const glass = (color, opacity) =>
  new THREE.MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 0.06,
    metalness: 0,
    specularIntensity: 0.8,
    transmission: 0,
    depthWrite: false,
  });

function canvasTexture(canvas, repeatX, repeatY) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8; // the renderer clamps to what the device supports
  return texture;
}

// A small seeded generator for the textures' speckle (mulberry32), so every mount draws the same room.
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

// Floor: a 2x2 block of warm stone tiles with a soft grout line and a faint terrazzo speckle, repeated
// across the room. The speckle is a few hundred low-contrast dots, gone in the mip chain at a distance.
function makeTileTexture() {
  const px = 512;
  const n = 2;
  const cell = px / n;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#7f7a70';
  ctx.fillRect(0, 0, px, px);
  const tones = ['#a39d92', '#9e988d', '#a6a095', '#a19b90'];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = tones[i + j * n];
      ctx.fillRect(i * cell + 2, j * cell + 2, cell - 4, cell - 4);
    }
  }
  const rnd = prng(11);
  for (let k = 0; k < 900; k++) {
    const x = rnd() * px;
    const y = rnd() * px;
    const r = 0.6 + rnd() * 1.6;
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255, 250, 240, 0.22)' : 'rgba(70, 60, 48, 0.16)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvasTexture(canvas, ROOM_WIDTH / (n * TILE), ROOM_DEPTH / (n * TILE));
}

// Bench top: a warm pale-wood tone with faint streaks along the bench. The streaks are periodic
// in x so the repeat is seamless; the mip chain fades them out at the overview distance.
function makeGrainTexture() {
  const w = 1024;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#cdc2ab';
  ctx.fillRect(0, 0, w, h);
  for (let k = 0; k < 64; k++) {
    const y0 = (k * 41) % h;
    const amp = 1 + (k % 4);
    const cycles = 1 + (k % 3);
    ctx.strokeStyle = k % 2 ? 'rgba(96, 74, 44, 0.045)' : 'rgba(255, 247, 230, 0.05)';
    ctx.lineWidth = 1 + (k % 3) * 0.7;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 16) {
      const y = y0 + amp * Math.sin((x / w) * Math.PI * 2 * cycles + k);
      if (x) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  return canvasTexture(canvas, BENCH_LENGTH / 3.2, 1);
}

// Backsplash: pale warm tiles with a hairline grout, one tile per texture repeat, slightly glossy in the
// material so the environment gives them a sheen. Repeated along the band by its length over SPLASH_TILE.
function makeSplashTexture() {
  const px = 256;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#bfb8ab';
  ctx.fillRect(0, 0, px, px);
  const grad = ctx.createLinearGradient(0, 0, px, px);
  grad.addColorStop(0, '#e7e3db');
  grad.addColorStop(1, '#dcd7ce');
  ctx.fillStyle = grad;
  ctx.fillRect(3, 3, px - 6, px - 6);
  ctx.strokeStyle = 'rgba(255, 253, 248, 0.5)'; // a bevel highlight on the tile's top and left edges
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, px - 4);
  ctx.lineTo(4, 4);
  ctx.lineTo(px - 4, 4);
  ctx.stroke();
  return canvasTexture(canvas, 1, 1);
}

/**
 * Build the scene graph.
 * @param {{ stations: Array<{id, title, steps}>, stepTitle: (step) => string, shadows: boolean, touch: boolean }} opts
 * @returns {{ root, hotspots, proxies, stepStation, markers, slideMaterial, materials, rack, slides, brain, specimen, eyepiece, labels, bounds, stationBounds, stationXs, jarTray, dispose }}
 * `stationXs`: each station's world x. `jarTray` (null without an S9 station): { slots, tray, layout(list) }, see layoutJars.
 */
export function buildScene(opts) {
  const { stations, stepTitle, shadows, touch } = opts;
  const root = new THREE.Group();
  root.name = 'LabRoot';

  const G = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
    plane: new THREE.PlaneGeometry(1, 1),
  };
  const textures = { tile: makeTileTexture(), grain: makeGrainTexture(), splash: makeSplashTexture() };
  // The lab's palette: warm off-whites and stone greys for the room and the furniture, near-black that leans
  // brown rather than blue, metal and glass that take the environment's sheen (bench.js sets scene.environment).
  const M = {
    floor: std(textures.tile ? 0xffffff : 0xa19b90, { map: textures.tile, roughness: 0.9 }),
    wall: std(0xf4f0e8, { roughness: 1 }),
    splash: std(textures.splash ? 0xffffff : 0xe2ded6, { map: textures.splash, roughness: 0.3 }),
    trim: std(0xc9b89c, { roughness: 0.6 }),
    shelf: std(0xece8e0, { roughness: 0.8 }),
    hairline: std(0x4a443c, { roughness: 0.8 }),
    benchTop: std(textures.grain ? 0xffffff : 0xcdc2ab, { map: textures.grain, roughness: 0.5 }),
    benchEdge: std(0x33302b, { roughness: 0.55 }),
    benchBody: std(0xe4e0d9, { roughness: 0.8 }),
    seam: std(0xb5ada1, { roughness: 0.8 }),
    kick: std(0x57524a, { roughness: 0.9 }),
    tray: std(0xe8e4dd, { roughness: 0.6 }),
    glass: glass(0xf1f3f1, 0.26),
    // The liquids: water-clear by default (washes, the alcohol and clearing rows), a faint straw for the two
    // silver baths, a warm grey for the developer, a pale gold for the toning bath. Illustrative tints that let
    // the eye tell the baths apart along the bench; the bench still never says what is in a jar.
    liquid: std(0xc9d1d2, { roughness: 0.22 }),
    liquidSilver: std(0xd8d0b4, { roughness: 0.22 }),
    liquidDeveloper: std(0xc4bdb2, { roughness: 0.22 }),
    liquidGold: std(0xd9c58e, { roughness: 0.22 }),
    lid: std(0x312f2b, { roughness: 0.45 }),
    metal: std(0xb6b4af, { metalness: 0.6, roughness: 0.32 }),
    dark: std(0x2f2d29, { roughness: 0.65 }),
    shield: std(0x57524a, { roughness: 0.9 }),
    body: std(0xf5f3ef, { roughness: 0.5 }),
    paper: std(0xfbf9f5, { roughness: 1 }),
    board: std(0xffffff, { roughness: 0.25 }),
    frame: std(0xb3afa8, { roughness: 0.5 }),
    cover: std(0x3a3630, { roughness: 0.7 }),
    binder: std(0x44403a, { roughness: 0.75 }),
    wasteA: std(0xe9e3d8, { roughness: 0.8 }),
    wasteB: std(0x86847f, { roughness: 0.7 }),
    stripeA: std(0xa63a3a, { roughness: 0.7 }),
    stripeB: std(0x8a6100, { roughness: 0.7 }),
    hood: std(0xb3aea6, { roughness: 0.4, metalness: 0.3 }),
    hoodInner: std(0xf4f1ec, { roughness: 0.8 }),
    baffle: std(0x6f6a62, { roughness: 0.8 }),
    lamp: std(0xffffff, { emissive: 0xfff6e6, emissiveIntensity: 1.2, roughness: 1 }),
    sash: glass(0xc4d1d6, 0.36),
    coat: std(0xf1efea, { roughness: 1 }),
    markerIdle: std(0xc6c1b9, { roughness: 0.6 }),
    markerDone: std(0x0f6232, { emissive: 0x147a3d, emissiveIntensity: 0.12, roughness: 0.5 }),
    slide: std(0xeef2f6, { transparent: true, opacity: 0.55, roughness: 0.15, depthWrite: false }),
    proxy: new THREE.MeshBasicMaterial({ visible: false }),
  };
  if (textures.splash)
    textures.splash.repeat.set(SPLASH_LENGTH / SPLASH_TILE, (SPLASH_TOP - BENCH_TOP_Y) / SPLASH_TILE);

  const hotspots = [];
  const markers = new Map();
  const stepStation = new Map();
  const labels = [];
  const proxies = [];
  const clones = [];
  const instanced = [];
  const batches = new Map();
  // World-space boxes of what the camera frames: the whole bench (furniture, equipment, labels;
  // never the room shell) and each station's equipment plus its label.
  const bounds = new THREE.Box3();
  const stationBounds = new Map();
  const stationXs = new Map();
  let jarTray = null; // the S9 builder's parts (layoutJars)

  const _m = new THREE.Matrix4();
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _e = new THREE.Euler();
  const _b = new THREE.Box3();
  const UNIT = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));

  const track = (parent, matrixWorld) => {
    _b.copy(UNIT).applyMatrix4(matrixWorld);
    bounds.union(_b);
    const station = parent.userData.station;
    if (station) stationBounds.get(station).union(_b);
  };

  // A plain mesh: hotspot visuals, done markers, rack parts and anything that receives shadows.
  // `framed` (default true) adds it to the camera-framing bounds; the room shell and the moving
  // rack stay out of them.
  const add = (parent, geometry, material, x, y, z, sx, sy, sz, cast, framed = true) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    if (cast && shadows) mesh.castShadow = true;
    parent.add(mesh);
    if (framed) {
      mesh.updateWorldMatrix(true, false);
      track(parent, mesh.matrixWorld);
    }
    return mesh;
  };
  // A static part: recorded now, drawn later as one instance of its (geometry, material) batch.
  const part = (parent, gKey, mKey, x, y, z, sx, sy, sz, o = {}) => {
    _p.set(x, y, z);
    _s.set(sx, sy, sz);
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    _q.setFromEuler(_e);
    parent.updateWorldMatrix(true, false);
    _m.compose(_p, _q, _s).premultiply(parent.matrixWorld);
    const key = `${gKey}|${mKey}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { geometry: G[gKey], material: M[mKey], matrices: [] };
      batches.set(key, batch);
    }
    batch.matrices.push(_m.clone());
    if (o.framed !== false) track(parent, _m);
  };
  // A part that comes and goes (the S9 tray's jars): up to `count` instances in the parent's space, none drawn
  // until layoutJars sets them.
  const dynamic = (parent, gKey, mKey, count) => {
    const mesh = new THREE.InstancedMesh(G[gKey], M[mKey], count);
    mesh.count = 0;
    mesh.visible = false;
    mesh.castShadow = shadows && !M[mKey].transparent;
    mesh.receiveShadow = shadows;
    parent.add(mesh);
    instanced.push(mesh);
    return mesh;
  };

  // Hotspot = invisible pick proxy sized to the visuals (slightly larger on touch) + the meshes
  // that light up on hover. Visual materials are cloned so the tint stays local. `fit` (objects or
  // world-space Box3s) sizes the proxy when it should cover less than every visual (the specimen
  // tray: its label lights up but takes no clicks). G2: the hotspot keeps what it really is on screen
  // (`solids`: the fit objects, plus a jar's lid; `solidBoxes`: the fit's world boxes), so bench.js can
  // tell a ray that meets the object itself from one that only meets the proxy's padding.
  const box3 = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  const addHotspot = (parent, spec, visuals, padding = 1.1, fit = visuals) => {
    root.updateMatrixWorld(true);
    box3.makeEmpty();
    const solids = [];
    const solidBoxes = [];
    for (const v of fit) {
      if (v.isBox3) {
        box3.union(v);
        solidBoxes.push(v);
      } else {
        box3.expandByObject(v);
        solids.push(v);
        if (v.userData.lidBox) {
          box3.union(v.userData.lidBox);
          solidBoxes.push(v.userData.lidBox);
        }
      }
    }
    box3.getSize(size);
    box3.getCenter(center);
    const grow = touch ? padding * 1.3 : padding;
    const proxy = new THREE.Mesh(G.box, M.proxy);
    proxy.visible = false;
    parent.worldToLocal(center);
    proxy.position.copy(center);
    proxy.scale.set(Math.max(size.x * grow, 0.08), Math.max(size.y * grow, 0.08), Math.max(size.z * grow, 0.08));
    parent.add(proxy);
    proxies.push(proxy);
    for (const v of visuals) {
      if (v.material && !v.userData.label) {
        v.material = v.material.clone();
        clones.push(v.material);
      }
    }
    const hotspot = { ...spec, proxy, visuals, solids, solidBoxes };
    proxy.userData.hotspot = hotspot;
    hotspots.push(hotspot);
    return hotspot;
  };

  // ---------- room shell (outside the framed bounds) ----------
  const floor = add(root, G.plane, M.floor, 0, 0, 6, ROOM_WIDTH, ROOM_DEPTH, 1, false, false);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = shadows;
  const wall = add(root, G.plane, M.wall, 0, WALL_HEIGHT / 2, WALL_Z, ROOM_WIDTH, WALL_HEIGHT, 1, false, false);
  wall.receiveShadow = shadows;
  // The backsplash: a tiled band standing just off the wall (its back face never meets the wall's plane), the
  // whiteboard frame and the coat hook (S7, S8) mounted on it, a warm-stone trim along its top.
  part(
    root,
    'box',
    'splash',
    0,
    (BENCH_TOP_Y + SPLASH_TOP) / 2,
    WALL_Z + 0.008,
    SPLASH_LENGTH,
    SPLASH_TOP - BENCH_TOP_Y,
    0.012,
    {
      framed: false,
    }
  );
  part(root, 'box', 'trim', 0, SPLASH_TOP + 0.01, WALL_Z + 0.015, SPLASH_LENGTH, 0.02, 0.026, { framed: false });
  // A shallow shelf along the wall with a hairline front edge
  part(root, 'box', 'shelf', 0, SHELF_Y, WALL_Z + 0.08, BENCH_LENGTH + 1.2, 0.022, 0.16, { framed: false });
  part(root, 'box', 'hairline', 0, SHELF_Y - 0.014, WALL_Z + 0.16, BENCH_LENGTH + 1.2, 0.006, 0.006, { framed: false });

  // ---------- bench ----------
  const top = add(root, G.box, M.benchTop, 0, BENCH_TOP_Y - 0.02, 0, BENCH_LENGTH, 0.04, BENCH_DEPTH);
  top.receiveShadow = shadows;
  part(root, 'box', 'benchEdge', 0, BENCH_TOP_Y - 0.048, 0, BENCH_LENGTH + 0.006, 0.016, BENCH_DEPTH + 0.006);
  const bodyTop = BENCH_TOP_Y - 0.064;
  const kick = 0.1;
  part(root, 'box', 'benchBody', 0, (bodyTop + kick) / 2, -0.04, BENCH_LENGTH - 0.1, bodyTop - kick, BENCH_DEPTH - 0.1);
  part(root, 'box', 'kick', 0, kick / 2, -0.1, BENCH_LENGTH - 0.1, kick, BENCH_DEPTH - 0.22);
  part(root, 'box', 'benchBody', 0, BENCH_TOP_Y + 0.04, -0.435, BENCH_LENGTH, 0.08, 0.03); // splash back
  const frontZ = -0.04 + (BENCH_DEPTH - 0.1) / 2;
  for (let k = 1; k < Math.round((BENCH_LENGTH - 0.1) / DOOR); k++) {
    const x = -(BENCH_LENGTH - 0.1) / 2 + k * DOOR;
    part(root, 'box', 'seam', x, (bodyTop + kick) / 2, frontZ + 0.001, 0.004, bodyTop - kick - 0.04, 0.004);
    part(root, 'box', 'dark', x - 0.07, bodyTop - 0.08, frontZ + 0.008, 0.08, 0.012, 0.014); // door pulls
    part(root, 'box', 'dark', x + 0.07, bodyTop - 0.08, frontZ + 0.008, 0.08, 0.012, 0.014);
  }

  // ---------- helpers ----------
  // A staining jar: tinted liquid and a dark lid are static; the glass body is a plain mesh only
  // when it is a hotspot visual (hover tint), otherwise it is instanced too.
  // A picked jar's glass carries its lid's world box (userData.lidBox): the lid is part of the jar
  // a pointer sees, so the jar's hit proxy covers it too (the lid's top strip used to pick nothing).
  const jar = (g, x, z, w = 0.11, h = 0.15, d = 0.075, pick = true, fill = 'liquid') => {
    part(g, 'box', fill, x, h * 0.34, z, w * 0.84, h * 0.64, d * 0.78);
    part(g, 'box', 'lid', x, h + 0.012, z, w * 1.08, 0.024, d * 1.12);
    if (!pick) {
      part(g, 'box', 'glass', x, h / 2, z, w, h, d);
      return null;
    }
    const glass = add(g, G.box, M.glass, x, h / 2, z, w, h, d);
    glass.userData.lidBox = new THREE.Box3()
      .setFromCenterAndSize(_p.set(x, h + 0.012, z), _s.set(w * 1.08, 0.024, d * 1.12))
      .applyMatrix4(g.matrixWorld);
    return glass;
  };
  // Done marker: a flat disc on the bench in front of the step's vessel (material swapped by bench.js).
  // p5-7 (FIX5): the disc belongs to its step's hotspot: a second hit proxy over it points at the same hotspot,
  // and the disc's box counts as that hotspot's own surface, so a hover or a tap on it names the jar (with the
  // step's " · done ✓"). It takes no dropped slide (bench.js aims a drag at `hotspot.proxy` only) and does not
  // light up (its material is the shared idle / done one). Called right after the step's addHotspot.
  const marker = (g, step, x, z) => {
    const mesh = add(g, G.cyl, M.markerIdle, x, 0.003, z, 0.06, 0.006, 0.06);
    markers.set(step, mesh);
    const hotspot = hotspots.find(h => h.kind === 'step' && h.step === step);
    if (!hotspot) return;
    root.updateMatrixWorld(true);
    const disc = new THREE.Box3().setFromObject(mesh);
    disc.getSize(size);
    disc.getCenter(center);
    const grow = touch ? 1.3 : 1.1;
    const proxy = new THREE.Mesh(G.box, M.proxy);
    proxy.visible = false;
    g.worldToLocal(center);
    proxy.position.copy(center);
    proxy.scale.set(Math.max(size.x * grow, 0.08), Math.max(size.y * grow, 0.03), Math.max(size.z * grow, 0.08));
    g.add(proxy);
    proxies.push(proxy);
    proxy.userData.hotspot = hotspot;
    hotspot.solidBoxes.push(disc);
  };
  const tray = (g, x, z, w, d) => part(g, 'box', 'tray', x, 0.004, z, w, 0.008, d);
  // A sign (H11): a long title wraps to two lines on a taller plate rather than shrinking its text, so
  // the plate's own scale (not always LABEL_WIDTH x LABEL_WIDTH / 4) goes into the framed boxes.
  const label = (g, title, dx = 0) => {
    const sprite = makeLabelSprite(title, { widthWorld: LABEL_WIDTH, sign: true });
    if (!sprite) return null;
    sprite.position.set(dx, LABEL_Y - BENCH_TOP_Y, -0.25);
    g.add(sprite);
    labels.push(sprite);
    sprite.getWorldPosition(_p);
    _s.set(sprite.scale.x, sprite.scale.y, 0.01);
    _b.setFromCenterAndSize(_p, _s);
    if (g.userData.station !== JARS_STATION) bounds.union(_b); // the S9 sign comes and goes (and stands inside them)
    stationBounds.get(g.userData.station).union(_b);
    return sprite;
  };
  const stepSpec = (step, station) => ({ id: step, kind: 'step', step, station, title: stepTitle(step) });
  const objSpec = (id, station, title) => ({ id, kind: 'object', step: null, station, title });

  // ---------- stations ----------
  let eyepiece = null;
  const builders = {
    S1(g, st) {
      tray(g, 0, -0.08, 1.18, 0.2);
      const row = [-0.5, -0.25, 0, 0.25, 0.5].map(x => jar(g, x, -0.08));
      const step = st.steps[0];
      if (step) {
        addHotspot(g, stepSpec(step, st.id), row);
        marker(g, step, 0, 0.16);
      }
    },
    S2(g, st) {
      const [impregnate, wash] = st.steps;
      const main = jar(g, -0.5, -0.1, 0.12, 0.16, 0.08, true, 'liquidSilver');
      part(g, 'box', 'shield', -0.5, 0.11, -0.19, 0.24, 0.22, 0.02); // light shield
      part(g, 'box', 'shield', -0.61, 0.11, -0.1, 0.02, 0.22, 0.2);
      part(g, 'box', 'shield', -0.39, 0.11, -0.1, 0.02, 0.22, 0.2);
      part(g, 'box', 'shield', -0.5, 0.23, -0.1, 0.24, 0.02, 0.2);
      part(g, 'box', 'metal', 0.12, 0.06, -0.08, 0.5, 0.12, 0.3); // water bath
      part(g, 'box', 'liquid', 0.12, 0.121, -0.08, 0.42, 0.004, 0.22);
      part(g, 'box', 'body', 0.56, 0.03, 0.14, 0.09, 0.06, 0.03); // timer
      part(g, 'box', 'dark', 0.56, 0.035, 0.157, 0.07, 0.03, 0.003);
      const washJar = jar(g, 0.6, -0.14);
      if (impregnate) {
        addHotspot(g, stepSpec(impregnate, st.id), [main]);
        marker(g, impregnate, -0.5, 0.16);
      }
      if (wash) {
        addHotspot(g, stepSpec(wash, st.id), [washJar]);
        marker(g, wash, 0.6, 0.16);
      }
    },
    S3(g, st) {
      const [ammoniacal, wash, develop] = st.steps;
      const hz = -0.12; // hood centre
      const H = 0.64; // hood height above the bench
      part(g, 'box', 'hood', -0.86, H / 2, hz, 0.04, H, 0.6); // side posts
      part(g, 'box', 'hood', 0.86, H / 2, hz, 0.04, H, 0.6);
      part(g, 'box', 'hood', 0, H - 0.03, hz, 1.76, 0.06, 0.6); // top cabinet
      part(g, 'box', 'hoodInner', 0, (H - 0.04) / 2, -0.41, 1.72, H - 0.04, 0.02); // inner back panel
      part(g, 'box', 'baffle', 0, H * 0.74, -0.395, 1.6, 0.05, 0.01); // exhaust slots
      part(g, 'box', 'baffle', 0, 0.08, -0.395, 1.6, 0.05, 0.01);
      part(g, 'box', 'hoodInner', 0, 0.006, hz, 1.68, 0.012, 0.58); // work surface liner
      part(g, 'box', 'lamp', 0, H - 0.065, hz - 0.05, 1.5, 0.01, 0.08); // light strip under the top
      part(g, 'box', 'sash', 0, H * 0.68, 0.17, 1.68, H * 0.52, 0.008); // sash, raised
      part(g, 'box', 'frame', 0, H * 0.42, 0.17, 1.72, 0.024, 0.016); // sash rails
      part(g, 'box', 'frame', 0, H - 0.062, 0.17, 1.72, 0.024, 0.016);
      const aJar = jar(g, -0.52, -0.16, 0.12, 0.16, 0.08, true, 'liquidSilver');
      const w1 = jar(g, -0.17, -0.2);
      const w2 = jar(g, 0.08, -0.2);
      const dev = add(g, G.cyl, M.glass, 0.5, 0.075, -0.12, 0.2, 0.15, 0.2);
      part(g, 'cyl', 'liquidDeveloper', 0.5, 0.045, -0.12, 0.17, 0.09, 0.17);
      part(g, 'cyl', 'lid', 0.5, 0.16, -0.12, 0.21, 0.02, 0.21);
      if (ammoniacal) {
        addHotspot(g, stepSpec(ammoniacal, st.id), [aJar]);
        marker(g, ammoniacal, -0.52, 0.1);
      }
      if (wash) {
        addHotspot(g, stepSpec(wash, st.id), [w1, w2]);
        marker(g, wash, -0.05, 0.1);
      }
      if (develop) {
        addHotspot(g, stepSpec(develop, st.id), [dev]);
        marker(g, develop, 0.5, 0.1);
      }
    },
    S4(g, st) {
      const [toning, thio] = st.steps;
      tray(g, 0.02, -0.12, 1.32, 0.22);
      const t = jar(g, -0.52, -0.1, 0.12, 0.16, 0.08, true, 'liquidGold');
      const s = jar(g, -0.17, -0.1, 0.12, 0.16, 0.08);
      jar(g, 0.3, -0.14, 0.11, 0.15, 0.075, false);
      jar(g, 0.55, -0.14, 0.11, 0.15, 0.075, false);
      if (toning) {
        addHotspot(g, stepSpec(toning, st.id), [t]);
        marker(g, toning, -0.52, 0.16);
      }
      if (thio) {
        addHotspot(g, stepSpec(thio, st.id), [s]);
        marker(g, thio, -0.17, 0.16);
      }
    },
    S5(g, st) {
      const step = st.steps[0];
      tray(g, -0.245, -0.1, 0.96, 0.2);
      const row = [-0.62, -0.37, -0.12, 0.13].map(x => jar(g, x, -0.1));
      const slab = add(g, G.box, M.dark, 0.52, 0.01, 0.02, 0.32, 0.02, 0.22);
      part(g, 'box', 'glass', 0.46, 0.022, 0.0, 0.05, 0.002, 0.05); // coverslip
      part(g, 'box', 'body', 0.6, 0.03, -0.05, 0.07, 0.02, 0.07); // coverslip box
      if (step) {
        addHotspot(g, stepSpec(step, st.id), [...row, slab]);
        marker(g, step, -0.25, 0.16);
      }
    },
    S6(g, st) {
      // Microscope: dark base and stage, white arm / tube / head, metal knobs, dark optics.
      const base = add(g, G.box, M.dark, 0, 0.02, 0.02, 0.3, 0.04, 0.22, true);
      const arm = add(g, G.box, M.body, 0, 0.26, -0.1, 0.075, 0.44, 0.09, true);
      part(g, 'box', 'body', 0, 0.46, -0.03, 0.075, 0.06, 0.22); // arm bridge
      const stage = add(g, G.box, M.dark, 0, 0.19, 0, 0.2, 0.012, 0.16);
      part(g, 'box', 'metal', 0, 0.197, 0, 0.09, 0.003, 0.07); // stage clip
      part(g, 'cyl', 'metal', 0.115, 0.17, -0.1, 0.036, 0.04, 0.036, { rz: Math.PI / 2 }); // focus knobs
      part(g, 'cyl', 'metal', -0.115, 0.17, -0.1, 0.036, 0.04, 0.036, { rz: Math.PI / 2 });
      const tube = add(g, G.cyl, M.body, 0, 0.35, 0, 0.06, 0.2, 0.06);
      part(g, 'cyl', 'dark', 0, 0.245, 0, 0.05, 0.03, 0.05); // nosepiece
      part(g, 'cyl', 'dark', 0, 0.215, 0, 0.022, 0.04, 0.022); // objective
      part(g, 'cyl', 'lamp', 0, 0.045, 0.02, 0.05, 0.01, 0.05); // illuminator
      const head = add(g, G.box, M.body, 0, 0.49, 0.06, 0.1, 0.06, 0.12);
      part(g, 'cyl', 'dark', 0, 0.555, 0.125, 0.036, 0.13, 0.036, { rx: Math.PI / 5 }); // eyepiece
      // The eyepiece opening (world) and its axis: the dive flies the camera in along it.
      const axis = new THREE.Vector3(0, Math.cos(Math.PI / 5), Math.sin(Math.PI / 5));
      eyepiece = { top: g.localToWorld(new THREE.Vector3(0, 0.555, 0.125).addScaledVector(axis, 0.065)), axis };
      addHotspot(g, objSpec('microscope', st.id, st.title || 'Microscope'), [base, arm, stage, tube, head]);
    },
    S7(g, st) {
      const bin = (x, body, stripe) => {
        const mesh = add(g, G.cyl, body, x, 0.15, -0.06, 0.24, 0.3, 0.24, true);
        part(g, 'cyl', 'lid', x, 0.315, -0.06, 0.25, 0.03, 0.25);
        part(g, 'box', 'paper', x, 0.15, 0.062, 0.12, 0.08, 0.004);
        part(g, 'box', stripe, x, 0.18, 0.064, 0.12, 0.016, 0.004);
        return mesh;
      };
      const a = bin(-0.5, M.wasteA, 'stripeA');
      const b = bin(-0.14, M.wasteB, 'stripeB');
      // PPE hook silhouette on the wall
      const wallZ = WALL_Z + 0.03;
      part(g, 'box', 'metal', 0.38, 0.64, wallZ, 0.3, 0.02, 0.03);
      const coat = add(g, G.box, M.coat, 0.33, 0.38, wallZ + 0.012, 0.24, 0.46, 0.012);
      part(g, 'box', 'coat', 0.33, 0.6, wallZ + 0.012, 0.34, 0.07, 0.012); // shoulders
      part(g, 'box', 'dark', 0.5, 0.53, wallZ + 0.012, 0.11, 0.04, 0.012); // goggles
      const binder = add(g, G.box, M.binder, 0.72, 0.15, -0.14, 0.07, 0.3, 0.24, true);
      part(g, 'box', 'paper', 0.72, 0.15, -0.14, 0.072, 0.26, 0.21);
      addHotspot(g, objSpec('waste-silver', st.id, 'Silver waste container'), [a]);
      addHotspot(g, objSpec('waste-solvent', st.id, 'Solvent waste container'), [b]);
      addHotspot(g, objSpec('ppe', st.id, 'Personal protective equipment'), [coat]);
      addHotspot(g, objSpec('safety-binder', st.id, 'Safety data binder'), [binder]);
    },
    S8(g, st) {
      const wallZ = WALL_Z + 0.03;
      part(g, 'box', 'frame', 0, 0.38, wallZ, 1.26, 0.56, 0.02);
      const board = add(g, G.box, M.board, 0, 0.38, wallZ + 0.012, 1.2, 0.5, 0.01);
      part(g, 'box', 'frame', 0, 0.085, wallZ + 0.03, 0.5, 0.012, 0.05); // marker tray
      const book = add(g, G.box, M.cover, 0.12, 0.0125, 0.03, 0.24, 0.025, 0.3, true);
      part(g, 'box', 'paper', 0.12, 0.0126, 0.03, 0.225, 0.022, 0.285);
      part(g, 'cyl', 'dark', -0.14, 0.006, 0.08, 0.012, 0.15, 0.012, { rx: Math.PI / 2, rz: 0.25 }); // pen
      addHotspot(g, objSpec('whiteboard', st.id, 'Whiteboard'), [board]);
      addHotspot(g, objSpec('notebook', st.id, 'Notebook'), [book]);
    },
    // §13.4: the "Your jars" tray. Every part is a plain mesh or a dynamic instanced one, so layoutJars can show the
    // jars the shell lists; none of it is in the framed boxes (layoutJars sets the station's own box). Each jar slot
    // is a hotspot of kind 'jar' (id 'jar:<jar id>' while it holds a jar).
    S9(g, st) {
      const signBox = stationBounds.get(st.id).clone(); // label() ran first: the sign alone
      const tray = add(g, G.box, M.tray, 0, 0.006, JARS_Z, 1, 0.012, JARS_TRAY_D, false, false);
      tray.receiveShadow = shadows;
      const rim = dynamic(g, 'box', 'tray', 4);
      const liquid = dynamic(g, 'box', 'liquid', JARS_MAX);
      const lid = dynamic(g, 'box', 'lid', JARS_MAX);
      const slots = [];
      for (let k = 0; k < JARS_MAX; k++) {
        const glass = add(g, G.box, M.glass, 0, JAR[1] / 2, JARS_Z, JAR[0], JAR[1], JAR[2], false, false);
        glass.userData.lidBox = lidBox(g, 0, new THREE.Box3());
        const spec = { id: `jar-slot-${k + 1}`, kind: 'jar', step: null, jar: null, station: st.id, title: '' };
        slots.push(addHotspot(g, spec, [glass]));
      }
      jarTray = { g, signBox, tray, rim, liquid, lid, slots, sign: null };
    },
  };
  // A tray jar's lid as a world box (the jar's hit proxy and surface cover it, as jar() does for the others).
  function lidBox(g, x, out) {
    return out
      .setFromCenterAndSize(_p.set(x, JAR[1] + 0.012, JARS_Z), _s.set(JAR[0] * 1.08, 0.024, JAR[2] * 1.12))
      .applyMatrix4(g.matrixWorld);
  }
  const placeProxy = (proxy, on) => {
    const i = proxies.indexOf(proxy);
    if (on && i < 0) proxies.push(proxy);
    else if (!on && i >= 0) proxies.splice(i, 1);
  };
  const setInstance = (mesh, i, x, y, z, sx, sy, sz) => {
    _q.identity();
    mesh.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)));
  };
  /**
   * §13.4: lay the S9 tray out for `list` ([{ id, label }], at most JARS_MAX, in tray order): that many jars in a
   * row centred on the station, a tray their size under them; slot k becomes hotspot 'jar:<id>' titled with the
   * label. An empty list hides the tray, the jars and the sign's click box. Hidden slots leave the pick list
   * (`proxies`) and are marked `off`. Sets the station's framed box (sign, tray, jars). Returns the ids drawn.
   */
  function layoutJars(list) {
    const t = jarTray;
    if (!t) return [];
    const items = (Array.isArray(list) ? list : []).slice(0, JARS_MAX);
    const n = items.length;
    const width = (n - 1) * JAR_PITCH + JAR[0] + 0.14;
    const at = k => (k - (n - 1) / 2) * JAR_PITCH;
    t.tray.visible = n > 0;
    t.tray.scale.x = n ? width : 1;
    const rimY = 0.012 + 0.008;
    setInstance(t.rim, 0, 0, rimY, JARS_Z - JARS_TRAY_D / 2 + JARS_RIM / 2, width, 0.016, JARS_RIM);
    setInstance(t.rim, 1, 0, rimY, JARS_Z + JARS_TRAY_D / 2 - JARS_RIM / 2, width, 0.016, JARS_RIM);
    setInstance(t.rim, 2, -width / 2 + JARS_RIM / 2, rimY, JARS_Z, JARS_RIM, 0.016, JARS_TRAY_D);
    setInstance(t.rim, 3, width / 2 - JARS_RIM / 2, rimY, JARS_Z, JARS_RIM, 0.016, JARS_TRAY_D);
    t.slots.forEach((h, k) => {
      const on = k < n;
      const x = on ? at(k) : 0;
      const glass = h.visuals[0];
      glass.visible = on;
      glass.position.x = x;
      h.proxy.position.x = x;
      h.off = !on;
      h.jar = on ? items[k].id : null;
      h.id = on ? `jar:${items[k].id}` : `jar-slot-${k + 1}`;
      h.title = on ? items[k].label || '' : '';
      placeProxy(h.proxy, on);
      if (!on) return;
      setInstance(t.liquid, k, x, JAR[1] * 0.34, JARS_Z, JAR[0] * 0.84, JAR[1] * 0.64, JAR[2] * 0.78);
      setInstance(t.lid, k, x, JAR[1] + 0.012, JARS_Z, JAR[0] * 1.08, 0.024, JAR[2] * 1.12);
    });
    for (const mesh of [t.rim, t.liquid, t.lid]) {
      mesh.count = mesh === t.rim ? (n ? 4 : 0) : n;
      mesh.visible = n > 0;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    if (t.sign) {
      t.sign.off = n === 0;
      placeProxy(t.sign.proxy, n > 0);
    }
    t.g.updateMatrixWorld(true);
    const box = stationBounds.get(JARS_STATION).copy(t.signBox);
    if (n) {
      box.union(_b.setFromObject(t.tray));
      for (const h of t.slots) {
        if (h.off) continue;
        lidBox(t.g, h.visuals[0].position.x, h.visuals[0].userData.lidBox);
        box.union(_b.setFromObject(h.visuals[0])).union(h.visuals[0].userData.lidBox);
      }
    }
    return items.map(j => j.id);
  }

  stations.forEach((st, index) => {
    const g = new THREE.Group();
    g.name = st.id;
    g.userData.station = st.id;
    g.position.set(st.id === JARS_STATION ? JARS_X : stationX(index), BENCH_TOP_Y, 0);
    stationXs.set(st.id, g.position.x);
    root.add(g);
    g.updateWorldMatrix(true, false);
    stationBounds.set(st.id, new THREE.Box3());
    for (const step of st.steps || []) stepStation.set(step, st.id);
    const sprite = label(g, st.title || st.id, st.id === JARS_STATION ? JARS_SIGN_DX : 0);
    const build = builders[st.id];
    if (build) build(g, st);
    const sign = sprite
      ? addHotspot(
          g,
          { id: st.id, kind: 'station', step: null, station: st.id, title: st.title || st.id },
          [sprite],
          1.0
        )
      : null;
    if (st.id === JARS_STATION && jarTray) jarTray.sign = sign;
  });
  layoutJars([]); // no jars until bench.js lists the shell's

  // ---------- specimen tray: the schematic brain at the head of the bench ----------
  const specimen = new THREE.Group();
  specimen.name = 'specimen';
  specimen.position.set(SPECIMEN_X, BENCH_TOP_Y, SPECIMEN_Z);
  root.add(specimen);
  specimen.updateWorldMatrix(true, false);
  tray(specimen, 0, 0, 0.3, 0.24);
  part(specimen, 'box', 'tray', 0, 0.012, -0.114, 0.3, 0.024, 0.012); // rim
  part(specimen, 'box', 'tray', 0, 0.012, 0.114, 0.3, 0.024, 0.012);
  part(specimen, 'box', 'tray', -0.144, 0.012, 0, 0.012, 0.024, 0.24);
  part(specimen, 'box', 'tray', 0.144, 0.012, 0, 0.012, 0.024, 0.24);
  const brain = buildBrain(THREE, { seed: 7 });
  // Lying with its front toward S1 and its left lateral face (the patch) toward the viewer.
  brain.group.scale.setScalar(BRAIN_SCALE);
  brain.group.rotation.set(0, Math.PI / 2, -0.14, 'ZYX');
  brain.group.position.set(0.005, 0.1, 0);
  for (const mesh of brain.solids) mesh.receiveShadow = shadows;
  specimen.add(brain.group);
  brain.group.updateWorldMatrix(true, true);
  _b.copy(brain.bounds).applyMatrix4(brain.group.matrixWorld);
  bounds.union(_b);
  const specimenLabel = makeLabelSprite('Practice specimen (a drawing)', { widthWorld: LABEL_WIDTH, sign: true });
  if (specimenLabel) {
    specimenLabel.position.set(0, LABEL_Y - BENCH_TOP_Y, -0.25);
    specimen.add(specimenLabel);
    labels.push(specimenLabel);
    specimenLabel.getWorldPosition(_p);
    _s.set(specimenLabel.scale.x, specimenLabel.scale.y, 0.01);
    _b.setFromCenterAndSize(_p, _s);
    bounds.union(_b);
  }
  // The tray's pick proxy covers the tray and the brain only (E2). The label plate still lights up
  // with them, but it hangs high and further back: in the proxy it stretched the box over the wall and,
  // seen from S1, over the first jars, where a click or a tap opened the tray (or played the intro).
  const trayBox = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(SPECIMEN_X, BENCH_TOP_Y + 0.012, SPECIMEN_Z),
    new THREE.Vector3(0.3, 0.024, 0.24)
  );
  addHotspot(
    specimen,
    objSpec('specimen', null, 'Practice specimen tray (a drawing of a brain)'),
    specimenLabel ? [...brain.solids, specimenLabel] : brain.solids,
    1.05,
    [...brain.solids, trayBox]
  );

  // ---------- carried slide rack ----------
  // Moves between stations (bench.js tweens rack.position), so every part is a plain mesh.
  const rack = new THREE.Group();
  rack.name = 'rack';
  rack.position.set(stationX(0), BENCH_TOP_Y, RACK_Z);
  root.add(rack);
  const rackParts = [
    add(rack, G.box, M.metal, 0, 0.008, 0, 0.3, 0.016, 0.11, true, false),
    add(rack, G.box, M.metal, -0.145, 0.06, -0.015, 0.012, 0.1, 0.07, false, false),
    add(rack, G.box, M.metal, 0.145, 0.06, -0.015, 0.012, 0.1, 0.07, false, false),
    add(rack, G.box, M.metal, 0, 0.105, -0.038, 0.3, 0.01, 0.01, false, false),
  ];
  const slides = [-0.1, -0.033, 0.033, 0.1].map(x => {
    const slide = add(rack, G.box, M.slide, x, 0.062, -0.012, 0.052, 0.11, 0.002, false, false);
    slide.rotation.x = -0.3; // leaning back against the rail, face toward the viewer
    return slide;
  });
  addHotspot(rack, objSpec('rack', null, 'Slide rack'), [...rackParts, ...slides], 1.25);
  // The slides share one material so a tint change costs one assignment.
  const slideMaterial = slides[0].material;
  for (const s of slides) s.material = slideMaterial;

  // ---------- static batches ----------
  for (const batch of batches.values()) {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    batch.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = shadows && !batch.material.transparent;
    mesh.receiveShadow = shadows;
    mesh.computeBoundingSphere();
    root.add(mesh);
    instanced.push(mesh);
  }

  root.updateMatrixWorld(true);

  function dispose() {
    for (const sprite of labels) disposeLabel(sprite);
    brain.dispose();
    for (const mesh of instanced) mesh.dispose();
    for (const m of clones) m.dispose();
    for (const m of Object.values(M)) m.dispose();
    for (const g of Object.values(G)) g.dispose();
    for (const t of Object.values(textures)) if (t) t.dispose();
    root.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material && !obj.userData.label) obj.material.dispose();
    });
    root.clear();
  }

  return {
    root,
    hotspots,
    proxies,
    stepStation,
    markers,
    slideMaterial,
    materials: M,
    rack,
    slides,
    brain,
    specimen,
    eyepiece,
    labels,
    bounds,
    stationBounds,
    stationXs,
    jarTray: jarTray ? { slots: jarTray.slots, tray: jarTray.tray, layout: layoutJars } : null,
    dispose,
  };
}
