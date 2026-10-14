// 3D bench for the Alzheimer's histology lab (three.js r186, ES module via the import map).
// Contract: context/ALZ-LAB-CONTRACT.md §4 "lab-3d/bench.js". The bench never holds truth: it
// reads Run objects from lab.js, emits seq-less step events, and draws state it is given.
// Camera presets are fitted to bounding boxes (the whole bench or one station) for the live
// canvas aspect ratio and re-fitted on resize, so the subject fills the frame at any size.
// mountBench never rejects. It resolves { ok: false, reason, message } without creating any
// resource when WebGL2 is missing or the renderer cannot start, and { ok: true, ...handle }
// otherwise (see "## Deviations" in the contract).
// The tissue clip (contract §7.1) lives inside this same canvas: clip.js's director plays the
// intro around the specimen tray and the dive into the S6 eyepiece / tissue volume, driving the
// camera and swapping the rendered scene while it is active; the bench's own flights, picking
// and presets stay untouched when it is not.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  buildScene,
  DEFAULT_STATIONS,
  BENCH_TOP_Y,
  BENCH_LENGTH,
  BENCH_DEPTH,
  RACK_Z,
  stationX,
  JARS_STATION,
  JARS_MAX,
  ROOM_COLOR,
} from './scene.js?v=3';
import { createDirector } from './clip.js?v=3';
// The same module URL clip.js imports, so the structure names come from one table.
import { SITE_NAMES } from './tissue.js?v=1';

// The eight fixed stations. §13.4: S9 (scene.js JARS_STATION, "Your jars") is the free bench's tray, a station only
// while the shell lists extra jars (handle.stations() names it then).
export const STATIONS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];

// Five fixed, purely illustrative tints for deposit ordinal 0..4 (no legend inside the canvas).
const TINTS = [0xeef2f6, 0xcdd2d8, 0xa3a9b1, 0x6f757d, 0x40454c];
const TINT_OPACITY = [0.55, 0.68, 0.8, 0.9, 0.96];
// §11.4: the shell's by-eye look colour (SilverLab.LOOK_COLORS[look.key]) eases in over this long
// (a cut under reduced motion); setSlideTint(null) eases back to the deposit tint above.
const SLIDE_TINT_MS = 300;
// The hover glow and the lit sign plate follow the lab page's accent (lab.css --lab-accent, bronze), as the
// site's link blue they used to be is bronze there too.
const HOVER_EMISSIVE = 0xd27a24;
const HOVER_GLOW = 0.6; // emissiveIntensity while lit (an amber glow reads fainter than the old blue did on warm surfaces)
const HOVER_LABEL_TINT = 0xffe6c4;
// How much of the environment (makeEnvironment) lights the scene: the sheen on glass, metal and the backsplash
// comes from its light panels and window; its diffuse share is counted in the lights below.
const ENV_INTENSITY = 0.35;
const CAMERA_MS = 800;
const RACK_MS = 650;
const REPLAY_PAUSE_MS = 450;
const CLICK_PX = 6;
const TOUCH_SLOP = 10;
const CLICK_MS = 600;
const DOUBLE_MS = 420;
const IDLE_HEARTBEAT_MS = 1000;
// Preset view directions (radians) and the fraction of the frame left empty around the framed
// box. Narrow canvases turn the overview further so the bench runs diagonally, not as a strip.
const OVERVIEW_ELEVATION = 0.4;
const OVERVIEW_AZIMUTH_WIDE = -0.32;
const OVERVIEW_AZIMUTH_NARROW = -0.68;
const OVERVIEW_MARGIN = 0.05;
const STATION_ELEVATION = 0.42;
const STATION_AZIMUTH = -0.14;
const STATION_MARGIN = 0.07;
// frameStations (E1): two or more stations framed at once (the rack's and the next jar's). A narrow
// canvas turns toward the last station (where the slide goes) so the bench runs diagonally and that
// station's jars come nearer, as the overview does for the whole bench.
const PAIR_AZIMUTH_NARROW = 0.75;
const PAIR_ELEVATION = 0.65;
// The rack's footprint (rack frame + leaning slides) around its origin, added to a framed station
// pair that holds it: it sits in front of the station equipment, outside the station's own box.
const RACK_HALF = [0.17, 0.13, 0.07];
// A slide drag held within this many px of the canvas's left / right edge pans the camera along the
// bench (faster nearer the edge), so a jar at any station can be reached.
const EDGE_PX = 40;
const EDGE_SPEED = 2.2; // bench units per second at the very edge
// G3: the pan starts only once the pointer has stayed in the band this long (moving through it never
// pans), and a station or pair view keeps the rack and the jars this far inside the canvas, out of the
// band, so a normal drop never starts one.
const EDGE_DWELL_MS = 350;
const FRAME_KEEP_PX = 56;
// H1 (FIX4): a station or pair view also keeps every other jar that would take the slide out of the side
// bands: FRAME_KEEP_PX inside, or off the canvas. The view slides along the bench (smallest shift first, in
// BAND_SLIDE_STEP steps up to BAND_SLIDE_MAX) while its own box keeps BAND_SLIDE_MARGIN of the frame and its
// signs stay whole; failing that, up to BAND_PASSES times the jars left in a band come FRAME_KEEP_PX inside
// and the view is fitted again, as long as the camera backs off no more than BAND_WIDEN_MAX (else the
// station's own view stays: the edge pan never starts over a jar that takes the slide anyway).
const BAND_SLIDE_STEP = 0.02;
const BAND_SLIDE_MAX = 0.9;
const BAND_SLIDE_MARGIN = 0.02;
const BAND_PASSES = 2;
const BAND_WIDEN_MAX = 1.3;
// H6 (FIX4): two stations that are not neighbours are framed together only while the rack and the next
// jar keep a target this big on the canvas (their hit boxes' shorter side); else the rack's station alone.
const PAIR_TARGET_PX = 32;
// H11 (FIX4): a sign's text is drawn at least this big on screen (px), its plate growing up to
// SIGN_MAX_GROW times, never over a neighbouring sign (SIGN_GAP_PX apart) nor across a canvas edge; the
// specimen tray's plate steps aside for a grown station sign.
const SIGN_TEXT_PX = 11;
const SIGN_MAX_GROW = 2.4;
const SIGN_GAP_PX = 6;
const SIGN_HIDE_PX = 9; // a sign that cannot grow to SIGN_TEXT_PX fades out by this size (station views only)
// G3: a finished run (every step done or skipped) opens at the microscope, where the last step lands.
const FINISHED_STATION = 'S6';
// G1: api.onViewChange() once the view has been still this long (OrbitControls' damping keeps nudging the
// camera by ever smaller steps after an orbit; a move under VIEW_EPS_SQ per frame counts as still).
const VIEW_SETTLE_MS = 120;
const VIEW_EPS_SQ = 1e-10;
// The rack counts as on screen (a drop is possible from it) when its centre is this far inside.
const RACK_INSET_PX = 8;
// I2 (FIX5): a camera this far (world units) from the pose it last landed on has been moved by the student.
const AWAY_EPS = 1e-3;
// r4-p4-4 (FIX5): a view is framed into the part of the canvas the student sees at once above an open notes
// drawer: from the canvas's top, as tall as the window less the site's top bar and the drawer
// (api.viewportInsets()), when that cuts the canvas but leaves at least FRAME_BAND_MIN of it (less: the whole
// canvas). Resting on its view, the bench reads the insets every BAND_POLL_MS and frames again when they
// changed (the drawer opened, closed or slimmed).
const FRAME_BAND_MIN = 0.5;
const BAND_POLL_MS = 250;
// I4 (FIX5): the rack's station framed alone while the next jar stands at a station that is not its neighbour
// (the H6 view) also frames this much bench (world units) beyond the station toward that jar, so a sideways
// drag from the rack has bare bench to cross before the edge band pans it there.
const ROOM_X = 0.45;
const MIN_DISTANCE = 0.7;
const MAX_DISTANCE = 24;
// A label plate fades out over this distance (NDC units) as it nears a canvas edge and is hidden
// before it would cross one, so a wide stage never shows a neighbour's label cut in half. Smaller
// than both preset margins, so the framed station's own label always stays fully opaque.
const LABEL_EDGE_FADE = 0.04;
// RC-2: a plain wheel over the stage scrolls the page; Ctrl/Cmd + wheel (a trackpad pinch arrives
// as a ctrlKey wheel) zooms, as in the microscope. A plain wheel shows this hint through
// api.onHint(text) and clears it with api.onHint('') once the wheel has been still this long.
const WHEEL_HINT = 'Hold Ctrl (⌘ on Mac) and scroll to zoom';
const WHEEL_HINT_MS = 1500;
// Game layer (contract §10). A tag beside the pointer names a hotspot and says what a click or a
// drag does there (it replaces the canvas tooltip); touch having no hover, a tap shows it until the
// next press anywhere, Escape or a camera move (no timer, WCAG 2.2.1). The slide can be dragged from
// the rack onto a jar: the same step event as a double-click.
const TAG_GAP = 14; // px from the pointer to the tag
const TAG_EDGE = 4; // px the tag keeps from the stage edges
const TAG_MAX_WIDTH = 'min(240px, calc(100% - 8px))';
// A finger covers about this far either side of its point, and the hand everything below it: a
// finger's tag goes above both (and above a dragged slide), else beside them, at least this wide.
const FINGER_PX = 24;
const TAG_SIDE_MIN_W = 96;
// H12 (FIX4): the forms a tag tries, longest first, until it fits the visible band of the stage.
const TAG_FORMS = Object.freeze(['full', 'short', 'small', 'line']);
const TAG_STYLE = [
  'position:absolute',
  'left:0',
  'top:0',
  'z-index:3',
  'display:none',
  'box-sizing:border-box',
  'width:max-content',
  `max-width:${TAG_MAX_WIDTH}`,
  'padding:6px 10px',
  'background:#fffdf9', // the lab page's card (lab.css "Lab identity"), as the signs' plates
  'color:#17150f',
  'border:1px solid #cdbfa6',
  'border-radius:6px',
  'box-shadow:0 2px 8px rgba(31, 24, 12, 0.16)',
  'font-size:13px',
  'line-height:1.35',
  'text-align:left',
  'white-space:normal',
  'overflow-wrap:break-word',
  'pointer-events:none',
  'user-select:none',
  '-webkit-user-select:none',
].join(';');
const TAG_NOTE_COLOR = '#7a3e00'; // why a drop does nothing (8:1 on white)
const STATE_SUFFIX = new Map([
  ['next', ' · next'],
  ['done', ' · done ✓'],
  ['skipped', ' · skipped'],
]);
// §11.1: a shell that counts (api.stepCount) marks a done step " · done" and, dipped more than once,
// " · done ×N" (a free run has no "next"); without a count the tick above stays.
const doneSuffix = count => (count >= 2 ? ` · done ×${count}` : count >= 1 ? ' · done' : STATE_SUFFIX.get('done'));
const SAFETY_OBJECTS = new Set(['waste-silver', 'waste-solvent', 'ppe', 'safety-binder']);
// E2: hotspots that lose a pick to any other hotspot the same ray hits (a jar always wins over the
// tray, the wall-hung objects and the station signs behind it).
const BACKGROUND_OBJECTS = new Set(['specimen', 'ppe', 'whiteboard']);
const isBackground = h => h.kind === 'station' || BACKGROUND_OBJECTS.has(h.id);
// D2: a click shows what an object is (its sheet), a double-click does it. For these two objects the
// double-click goes to the shell's api.onAction(id): look at your slide / play the intro.
const ACTION_OBJECTS = new Set(['microscope', 'specimen']);
const NO_VERBS = Object.freeze([]);
const RACK_VERBS = Object.freeze(['Drag onto a jar: dip the slide']);
// The dragged slide: one of the rack's slides (scene.js), lifted a little above the bench top or the
// jar under it, never drawn shorter than GHOST_MIN_PX, and sent back to the rack when not dropped.
const SLIDE_W = 0.052;
const SLIDE_H = 0.11;
const SLIDE_T = 0.003;
const RACK_SLIDE_Y = 0.062; // a rack slide's centre above the rack's origin
const RACK_SLIDE_Z = -0.012;
const GHOST_LIFT = 0.03;
const GHOST_MIN_PX = 36;
const GHOST_RETURN_MS = 320;
// §13.4: an extra jar's id (the shell's 'x1'…'x4'), and a tray jar's tag title when the shell gives no label.
const JAR_ID = /^x\d+$/;
const TRAY_JAR_TITLE = 'Your jar';

const UNSUPPORTED_MESSAGE = 'This browser cannot run the 3D bench. List mode has the same steps.';
const ERROR_MESSAGE = 'The 3D bench could not start. List mode has the same steps.';
// clipState() after destroy(): the bench phase at rest, without touching the disposed director.
const CLIP_REST = Object.freeze({
  phase: 'bench',
  scene: null,
  index: -1,
  playing: false,
  ended: false,
  loaded: false,
  sub: null,
});

// Module-level scratch objects: the render loop never allocates.
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _hits = [];
const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _t = new THREE.Vector3();
const _corner = new THREE.Vector3();
const _label = new THREE.Vector3();
const _depth = new Float64Array(8);
const _lateral = new Float64Array(8);
const _g = new THREE.Vector3();
const _gd = new THREE.Vector3();
const _gt = new THREE.Vector3();
const _gc = new THREE.Vector3();
const _box = new THREE.Box3();
const _rackBox = new THREE.Box3();
const _rackHalf = new THREE.Vector3(...RACK_HALF);
const _benchPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BENCH_TOP_Y);
const _solidHits = [];
const _viewPos = new THREE.Vector3();
const _viewTarget = new THREE.Vector3();
const _keep = []; // the points a station / pair view keeps FRAME_KEEP_PX inside (Vector3s, reused)
const _banded = []; // H1: the centres of the jars clearBands found in an edge band (Vector3s)
const _sp = { x: 0, y: 0 }; // a screen point (px) in clearBands
const _pt = new THREE.Vector3(); // targetPx: a preset's look-at point, view axes and a corner
const _pd = new THREE.Vector3();
const _pr = new THREE.Vector3();
const _pu = new THREE.Vector3();
const _pc = new THREE.Vector3();
const _look = new THREE.Vector3(); // framing: the look-at point lowered for the visible band (r4-p4-4)
const _roomBox = new THREE.Box3(); // I4: the bench beyond the rack's station toward a far next jar

const easeInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const call = (fn, ...args) => {
  if (typeof fn === 'function') {
    try {
      fn(...args);
    } catch {
      /* a listener error must not break the render loop */
    }
  }
};

function webgl2Supported() {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return true;
  } catch {
    return false;
  }
}

function humanize(step) {
  const text = String(step || '').replace(/-/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// The eight fixed stations, then S9 ("Your jars", §13.4: the free bench's tray, no steps). The content lists S1-S8
// in order and, from §13.2 on, S9 after them; a list without S9 gets the fixed table's.
function readStations(lab) {
  try {
    const list = lab && typeof lab.listStations === 'function' ? lab.listStations() : null;
    if (
      Array.isArray(list) &&
      list.length >= STATIONS.length &&
      STATIONS.every((id, i) => list[i] && list[i].id === id)
    ) {
      const tray = list.find(s => s && s.id === JARS_STATION) || null;
      // The plain station name when the content carries one (like the shell's step names).
      return DEFAULT_STATIONS.map((d, i) => {
        const s = i < STATIONS.length ? list[i] : d.id === JARS_STATION ? tray : null;
        return {
          id: d.id,
          title: (s && (s.studentTitle || s.title)) || d.title,
          steps: d.id !== JARS_STATION && s && Array.isArray(s.steps) ? s.steps.slice() : d.steps.slice(),
        };
      });
    }
  } catch {
    /* fall through to the fixed table */
  }
  return DEFAULT_STATIONS.map(s => ({ id: s.id, title: s.studentTitle || s.title, steps: s.steps.slice() }));
}

// A step's plain name (methods.json `studentTitle`, as the shell's step list shows it), else the
// procedure title, else the id.
function stepTitleReader(lab) {
  let steps = null;
  try {
    const method = lab && typeof lab.getMethod === 'function' ? lab.getMethod('bielschowsky-modified') : null;
    steps = method && Array.isArray(method.steps) ? method.steps : null;
  } catch {
    steps = null;
  }
  return step => {
    const entry = steps && steps.find(s => s && s.id === step);
    if (entry && typeof entry.studentTitle === 'string' && entry.studentTitle) return entry.studentTitle;
    try {
      if (lab && typeof lab.explainStep === 'function') {
        const info = lab.explainStep(step);
        if (info && typeof info.title === 'string' && info.title) return info.title;
      }
    } catch {
      /* fall back to the id */
    }
    return humanize(step);
  };
}

function depositLevel(state) {
  if (!state || typeof state !== 'object') return 0;
  let level = 0;
  for (const site of Object.keys(state)) {
    if (site === 'background') continue;
    const d = state[site] && state[site].deposit;
    if (typeof d === 'number' && d > level) level = d;
  }
  return Math.max(0, Math.min(4, Math.round(level)));
}

/**
 * The bench scene's environment map: a plain room (a bright warm ceiling, paper walls, a stone floor) with two
 * light panels overhead and a tall window to one side, prefiltered once at mount. Nothing is downloaded and no
 * addon is needed; three's RoomEnvironment is not vendored. Returns { texture, dispose }: the texture goes on
 * scene.environment, dispose() frees its render target (destroy()). A device that cannot render the prefilter
 * (no half-float colour buffer) gets no environment rather than no bench.
 */
function makeEnvironment(renderer) {
  try {
    return prefilterRoom(renderer);
  } catch {
    return { texture: null, dispose() {} };
  }
}

function prefilterRoom(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new THREE.Scene();
  const geometries = [];
  const materials = [];
  const surface = (geometry, color, intensity = 1, side = THREE.FrontSide) => {
    const material = new THREE.MeshBasicMaterial({ side });
    material.color.setHex(color).multiplyScalar(intensity);
    geometries.push(geometry);
    materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    room.add(mesh);
    return mesh;
  };
  const shell = new THREE.BoxGeometry(14, 8, 14);
  geometries.push(shell);
  const walls = new THREE.MeshBasicMaterial({ color: 0xe8e4de, side: THREE.BackSide });
  const ceiling = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide });
  const floor = new THREE.MeshBasicMaterial({ color: 0x8c8880, side: THREE.BackSide });
  materials.push(walls, ceiling, floor);
  room.add(new THREE.Mesh(shell, [walls, walls, ceiling, floor, walls, walls]));
  for (const x of [-2.4, 2.4]) {
    const panel = surface(new THREE.PlaneGeometry(1.4, 6), 0xfff8f0, 4);
    panel.position.set(x, 3.95, 0);
    panel.rotation.x = Math.PI / 2;
  }
  // A window to one side, a touch cool like daylight: the one highlight on glass that is not the room's colour.
  const window_ = surface(new THREE.PlaneGeometry(4, 3.2), 0xf2f5fa, 2.6);
  window_.position.set(-6.95, 1.6, 0);
  window_.rotation.y = Math.PI / 2;
  const target = pmrem.fromScene(room, 0.03);
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
  pmrem.dispose();
  return { texture: target.texture, dispose: () => target.dispose() };
}

/** A reusable vector tween (camera uses two vectors, the rack one). */
class VecTween {
  constructor(targets) {
    this.targets = targets; // [{ obj: Vector3, from: Vector3, to: Vector3 }]
    this.active = false;
    this.t0 = 0;
    this.duration = 0;
    this.resolve = null;
  }
  start(now, duration) {
    this.finish(false);
    let moving = false;
    for (const t of this.targets) {
      t.from.copy(t.obj);
      if (t.from.distanceToSquared(t.to) > 1e-10) moving = true;
    }
    if (duration <= 0 || !moving) {
      for (const t of this.targets) t.obj.copy(t.to);
      return Promise.resolve(true);
    }
    this.active = true;
    this.t0 = now;
    this.duration = duration;
    return new Promise(resolve => {
      this.resolve = resolve;
    });
  }
  step(now) {
    if (!this.active) return false;
    const k = Math.min(1, (now - this.t0) / this.duration);
    const e = easeInOut(k);
    for (const t of this.targets) t.obj.lerpVectors(t.from, t.to, e);
    if (k >= 1) this.finish(true);
    return true;
  }
  finish(done) {
    if (!this.active) return;
    this.active = false;
    const resolve = this.resolve;
    this.resolve = null;
    if (resolve) resolve(done);
  }
}

export async function mountBench(container, api = {}) {
  const fail = (reason, message) => ({ ok: false, reason, message });
  if (!container || typeof container.appendChild !== 'function') return fail('error', ERROR_MESSAGE);
  if (typeof document === 'undefined' || typeof window === 'undefined') return fail('unsupported', UNSUPPORTED_MESSAGE);
  if (!webgl2Supported()) return fail('unsupported', UNSUPPORTED_MESSAGE);
  try {
    return createBench(container, api || {});
  } catch (error) {
    return fail('error', (error && error.message) || ERROR_MESSAGE);
  }
}

function createBench(container, api) {
  const touch =
    api.mode === 'touch' ||
    (api.mode !== 'desktop' && !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches));
  let reducedMotion = !!api.prefersReducedMotion;
  const shadows = !touch;
  const pixelRatioCap = touch ? 1.5 : 2;

  // Renderer first: if it throws, nothing else has been created.
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'display:block;width:100%;height:100%;outline:none;';
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !touch,
    alpha: false,
    powerPreference: 'high-performance',
  });
  try {
    return start();
  } catch (error) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw error;
  }

  function start() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping; // whites stay white; only highlights compress
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap; // r186 dropped PCFSoftShadowMap (and warned at every mount)

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(ROOM_COLOR);
    scene.fog = new THREE.Fog(ROOM_COLOR, 40, 110);
    // Image-based light for the standard and physical materials: without it glass, metal and the glossy
    // tiles have nothing to reflect but three point-like lights and look like matte plastic.
    const environment = makeEnvironment(renderer);
    scene.environment = environment.texture;
    scene.environmentIntensity = ENV_INTENSITY;

    const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 160);
    camera.position.set(stationX(0), BENCH_TOP_Y + 0.85, 1.9);

    // r186 lights are physically based: about pi of irradiance lands a white material near 1.0. The
    // environment carries a share of the diffuse light too (its irradiance counts pi, the lights' does not),
    // so the hemisphere is lower than it was without it and there is no ambient term; the sun keeps the
    // shadows and the one clear highlight. An upward face gets about 1.3 of its albedo in all.
    const hemi = new THREE.HemisphereLight(0xffffff, 0xd6d0c6, 1.0);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfffbf6, 2.0);
    sun.position.set(3, 7.5, 5.5);
    sun.target.position.set(0, BENCH_TOP_Y, 0);
    scene.add(sun);
    scene.add(sun.target);
    if (shadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 28;
      sun.shadow.camera.left = -(BENCH_LENGTH / 2 + 1);
      sun.shadow.camera.right = BENCH_LENGTH / 2 + 1;
      sun.shadow.camera.top = 5;
      sun.shadow.camera.bottom = -5;
      sun.shadow.bias = -0.0006;
      sun.shadow.normalBias = 0.02;
    }

    const stations = readStations(api.lab);
    const built = buildScene({ stations, stepTitle: stepTitleReader(api.lab), shadows, touch });
    scene.add(built.root);
    // Each station's place in bench order (by its x): §13.4 S9, the "Your jars" tray, stands between S5 and S6 and
    // counts (a view, a sign, a flight, the rack) only while the tray has jars (trayJars, syncJars).
    const stationIndex = new Map();
    let trayJars = []; // [{ id, label }]: the jars on the tray now, in tray order
    function indexStations() {
      stationIndex.clear();
      stations
        .filter(s => built.stationXs.has(s.id) && (s.id !== JARS_STATION || trayJars.length > 0))
        .sort((a, b) => built.stationXs.get(a.id) - built.stationXs.get(b.id))
        .forEach((s, i) => stationIndex.set(s.id, i));
    }
    indexStations();
    // The signs (station plates and the specimen tray's): their plate and click box at rest, and per frame
    // where they are on screen and how much they grow (H11, fadeEdgeLabels).
    const signs = built.labels.map(sprite => {
      const owner = built.hotspots.find(h => h.kind === 'station' && h.visuals[0] === sprite) || null;
      const info = sprite.userData.label || {};
      return {
        sprite,
        station: owner ? owner.station : null,
        proxy: owner ? owner.proxy : null,
        base: sprite.scale.clone(),
        proxyBase: owner ? owner.proxy.scale.clone() : null,
        font: info.fontWorld || 0,
        on: false,
        shown: false,
        f: 1,
        x: 0,
        y: 0,
        hw: 0,
        hh: 0,
        text: 0,
      };
    });

    // ---------- wheel: the page scrolls past the stage (RC-2) ----------
    // Registered before OrbitControls connects its own wheel listener, and in the capture phase, so
    // it runs first. A plain wheel stops there (OrbitControls never sees it) and is not prevented,
    // so the page scrolls; Ctrl/Cmd + wheel goes on to OrbitControls and never zooms the page. The
    // same canvas and controls serve explore mode inside the tissue, so the rule holds there too.
    let hintTimer = 0;
    function endHint() {
      hintTimer = 0;
      call(api.onHint, '');
    }
    function clearHint() {
      if (!hintTimer) return;
      clearTimeout(hintTimer);
      endHint();
    }
    function onWheel(event) {
      if (event.ctrlKey || event.metaKey) {
        if (event.cancelable) event.preventDefault();
        clearHint();
        return;
      }
      event.stopImmediatePropagation();
      // The hint only where Ctrl/Cmd + wheel would zoom (not while the clip or a flight holds the camera).
      if (!event.deltaY || !controls.enabled || !controls.enableZoom) return;
      if (hintTimer) clearTimeout(hintTimer);
      else call(api.onHint, WHEEL_HINT);
      hintTimer = setTimeout(endHint, WHEEL_HINT_MS);
    }
    canvas.addEventListener('wheel', onWheel, { capture: true, passive: false });

    // ---------- controls ----------
    // Connected to the canvas only once it is in the document (see "initial state"): OrbitControls
    // listens for the Control key on canvas.getRootNode(), which for a detached canvas is the canvas
    // itself, so the key was never seen and every Ctrl + wheel zoomed at the pinch rate (10x a step).
    const controls = new OrbitControls(camera);
    controls.enableDamping = !reducedMotion;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.7;
    controls.minDistance = MIN_DISTANCE;
    controls.maxDistance = MAX_DISTANCE; // raised in resize() when the overview needs more
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.minAzimuthAngle = -1.25;
    controls.maxAzimuthAngle = 1.25;
    controls.screenSpacePanning = true;
    controls.target.set(stationX(0), BENCH_TOP_Y + 0.12, -0.05);
    camera.lookAt(controls.target);
    // Touch (RC-2): OrbitControls sets touch-action none on connect, which traps the page; the
    // canvas gets pan-y instead (see "initial state"). A one-finger drag that starts vertically
    // scrolls the page (the browser cancels the pointer), one that starts sideways orbits for the
    // whole gesture, and a tap still picks. A lone finger's moves stop at the canvas (OrbitControls
    // listens on the document) until it has gone TOUCH_SLOP px mostly sideways, so a page scroll
    // never tilts the camera first. A second finger lets the gesture through, and its touchmove is
    // kept from scrolling so OrbitControls pinches and pans.
    const touchIds = new Set();
    let lone = null; // { id, x, y } of a single finger that has not started an orbit
    function onTouchDown(event) {
      if (event.pointerType !== 'touch') return;
      if (event.isPrimary) touchIds.clear(); // a new touch sequence: no other finger is down
      touchIds.add(event.pointerId);
      lone = touchIds.size === 1 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    }
    function onTouchUp(event) {
      if (event.pointerType === 'touch') touchIds.delete(event.pointerId);
    }
    function onTouchGate(event) {
      // A finger dragging the slide is the bench's own: its moves reach onPointerMove (OrbitControls
      // is off for the drag), so the gate leaves them alone.
      if (slideDrag.phase !== 'idle') return;
      if (event.pointerType !== 'touch' || !lone) return;
      const dx = event.clientX - lone.x;
      const dy = event.clientY - lone.y;
      if (event.pointerId === lone.id && Math.abs(dx) > Math.abs(dy) && Math.hypot(dx, dy) >= TOUCH_SLOP) {
        lone = null;
        return;
      }
      event.stopPropagation();
    }
    function onTouchMove(event) {
      if (slideDrag.phase !== 'idle') {
        if (event.cancelable) event.preventDefault(); // the page never scrolls under a slide drag
        return;
      }
      if (event.touches.length > 1 && event.cancelable && controls.enabled) event.preventDefault();
    }
    canvas.addEventListener('pointerdown', onTouchDown, { capture: true });
    canvas.addEventListener('pointerup', onTouchUp, { capture: true });
    canvas.addEventListener('pointercancel', onTouchUp, { capture: true });
    canvas.addEventListener('pointermove', onTouchGate, { capture: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });

    // ---------- tweens ----------
    const camTween = new VecTween([
      { obj: camera.position, from: new THREE.Vector3(), to: new THREE.Vector3() },
      { obj: controls.target, from: new THREE.Vector3(), to: new THREE.Vector3() },
    ]);
    const rackTween = new VecTween([{ obj: built.rack.position, from: new THREE.Vector3(), to: new THREE.Vector3() }]);

    // ---------- loop state ----------
    let rafId = 0;
    let destroyed = false;
    let dirty = true;
    let hoverDirty = false;
    let lastRender = 0;
    let lastTick = 0;
    let hovered = null;
    // hoverStale: the view moved under a still mouse (a flight landed, OrbitControls moved the camera,
    // the stage resized or the page scrolled): pick again where the mouse is and re-read the tag.
    let hoverStale = false;
    let controlsMoved = false; // OrbitControls sent 'change' since the last tick
    // G1: the view (camera, rack, canvas size) changed and has not been reported to api.onViewChange
    // yet; it is reported once everything has been still for VIEW_SETTLE_MS (a flight landed, an orbit
    // drag and its inertia ended, a resize, the rack arrived). `orbiting`: an OrbitControls gesture is
    // under way; `stillSince`: when the view last moved.
    let viewChanged = true;
    let orbiting = false;
    let stillSince = 0;
    // I2 (FIX5): isAway() as last reported through api.onViewChange.
    let awayReported = false;
    // Nothing has been drawn yet: a station flight asked for now (the shell framing the run right
    // after the mount) cuts, so the bench opens on that view (G3).
    let shown = false;
    let currentStation = null;
    // What the camera last flew to: 'overview', a station id, or several joined by '+' (frameStations);
    // currentStation is then the last of them (the one the shell's station picker shows).
    let currentView = null;
    let replayToken = 0;
    const queuedWaits = new Set();

    function requestRender() {
      dirty = true;
    }

    function tick(now) {
      if (destroyed) return;
      rafId = requestAnimationFrame(tick);
      const dt = lastTick ? Math.min(0.1, (now - lastTick) / 1000) : 0;
      lastTick = now;
      let animating = false;
      let moved = false; // the camera moved this tick other than by a flight in the air
      const flying = camTween.active;
      if (director.tick(now, dt)) animating = true;
      if (director.driving()) {
        // the clip timeline / transition positioned the camera this tick
      } else if (camTween.step(now)) {
        camera.lookAt(controls.target); // both ends are tweened; keep the orientation continuous
        animating = true;
      } else if (controls.update(dt)) {
        animating = true;
        moved = true;
      }
      if (flying && !camTween.active) moved = true; // a flight landed
      if (controlsMoved) {
        // OrbitControls moved the camera inside its own input handlers (a wheel zoom, an undamped drag)
        controlsMoved = false;
        moved = true;
      }
      if (!director.inTissue() && clampTarget()) {
        animating = true;
        moved = true;
      }
      // G3: the edge pan starts once the pointer has rested EDGE_DWELL_MS in the band. I4 (FIX5, amends H1):
      // never while the slide is over the jar the run needs next and it would take the slide (the jar aimed at
      // never slides away): the pan stops there, and the dwell starts again once the pointer leaves that jar.
      // Over any other jar (a done one, one at the rack's own station) the dwell pans as over the bench.
      let panned = false;
      if (slideDrag.phase === 'drag' && edgePan.zone) {
        if (holdsPan()) edgePan.dir = 0;
        else if (edgePan.dir || now - edgePan.since >= EDGE_DWELL_MS) {
          edgePan.dir = edgePan.zone;
          if (stepEdgePan(dt)) panned = animating = true;
        }
      }
      refitBand(now); // r4-p4-4: a notes drawer opened or closed under a resting view
      const racking = rackTween.step(now);
      if (racking) animating = true;
      if (ghostTween.step(now)) animating = true;
      if (stepSlideTint(now)) animating = true;
      // G1: report a view change once the view is still (not during a flight, an orbit or a pan).
      const posed =
        camera.position.distanceToSquared(_viewPos) > VIEW_EPS_SQ ||
        controls.target.distanceToSquared(_viewTarget) > VIEW_EPS_SQ;
      if (posed) {
        _viewPos.copy(camera.position);
        _viewTarget.copy(controls.target);
      }
      const changing = posed || panned || racking || camTween.active || director.driving();
      if (changing) viewChanged = true;
      if (changing || orbiting) stillSince = now;
      else if (viewChanged && now - stillSince >= VIEW_SETTLE_MS) {
        viewChanged = false;
        awayReported = isAway();
        call(api.onViewChange);
      }
      // I2 (FIX5): the camera has just left the shell's view, or come back to it, with nothing held (an orbit or a
      // pinch let go and gliding, a Ctrl + wheel zoom): reported at once, so "Back to my station" shows on the
      // release, not only once the glide has died down (that settled view is reported as well).
      // (not in the tick a flight lands in: its landed pose is recorded right after this tick)
      if (
        changing &&
        !flying &&
        !camTween.active &&
        !orbiting &&
        !pointer.down &&
        slideDrag.phase === 'idle' &&
        !director.active()
      ) {
        const away = isAway();
        if (away !== awayReported) {
          awayReported = away;
          call(api.onViewChange);
        }
      }
      // desktop-7: a hover tag never names what used to be under a still mouse. A flight (or the clip
      // flying the camera) hides it until it lands; an orbit drag hides it; any other camera move
      // (inertia, a zoom), a resize or a page scroll picks again where the mouse is and re-reads the tag.
      if (camTween.active || director.driving()) {
        if (hovered || tagState.mode === 'hover') dropHover();
        hoverStale = true;
      } else if (moved) {
        if (pointer.down && slideDrag.phase === 'idle') dropHover();
        hoverStale = true;
      }
      if (camTween.active || director.driving()) {
        // picked again once the camera lands
      } else if ((hoverDirty || hoverStale) && !pointer.down && slideDrag.phase === 'idle') {
        const refresh = hoverStale;
        hoverDirty = false;
        hoverStale = false;
        if (repick(refresh)) dirty = true;
      }
      // A hover tag never outlives what it names: the dive takes the bench away, and leaving explore
      // (or surfacing) drops the structure. A tap tag stays put on the screen, so it also goes while
      // the clip drives the camera.
      if (tagState.mode === 'hover' && (tagState.hotspot ? director.inTissue() : !director.hoverTitle())) {
        if (hovered) setHovered(null);
        else hideTag('hover');
      }
      if (
        tagState.mode === 'tap' &&
        (director.driving() || (tagState.hotspot ? director.inTissue() : !director.inTissue()))
      )
        hideTag('tap');
      if (dirty || animating || now - lastRender >= IDLE_HEARTBEAT_MS) {
        dirty = false;
        lastRender = now;
        renderFrame();
      }
    }

    // One frame: the active scene (bench, or the tissue volume while the dive runs) and, during
    // the clip, the screen-space overlay (label plate, dip). renderer.info covers both passes.
    renderer.info.autoReset = false;
    function renderFrame() {
      shown = true;
      renderer.info.reset();
      if (!director.inTissue()) fadeEdgeLabels();
      renderer.render(director.activeScene(), camera);
      director.renderOverlay();
    }

    // Label plates are camera-facing sprites; each frame one whose plate would cross a canvas edge
    // is hidden and one within LABEL_EDGE_FADE of an edge fades, so no label is ever drawn cut.
    // The framed station's own label sits inside its fitted box, so a landed preset shows it whole.
    // H11 (FIX4): a sign whose text would be drawn under SIGN_TEXT_PX grows (its click box with it), up to
    // SIGN_MAX_GROW, as long as it stays clear of every other sign and inside the canvas.
    function fadeEdgeLabels() {
      const tanV = Math.tan((camera.fov * Math.PI) / 360);
      const tanH = tanV * camera.aspect;
      const W = size.w || 1;
      const H = size.h || 1;
      // in a station or pair view (not the overview, not while the clip holds the camera) a sign drawn
      // smaller than SIGN_TEXT_PX fades out, down to nothing at SIGN_HIDE_PX
      if (framedKey !== currentView) {
        framedKey = currentView;
        framedIds = viewStations(currentView);
      }
      const framed = framedIds;
      const sizeFade = framed.length > 0 && !director.active();
      camera.updateMatrixWorld();
      for (const sg of signs) {
        _label.setFromMatrixPosition(sg.sprite.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
        const depth = -_label.z;
        // §13.4: a station that is not on the bench now (S9 while the tray has no jars) has no sign
        sg.on = depth > camera.near && (!sg.station || stationIndex.has(sg.station));
        sg.f = 1;
        if (!sg.on) continue;
        sg.x = _label.x / (depth * tanH);
        sg.y = _label.y / (depth * tanV);
        sg.hw = sg.base.x / 2 / (depth * tanH);
        sg.hh = sg.base.y / 2 / (depth * tanV);
        // drawn at all at its own size (not faded out past an edge): only such a sign holds another back
        sg.shown = Math.min(1 - Math.abs(sg.x) - sg.hw, 1 - Math.abs(sg.y) - sg.hh) > 0;
        sg.text = (sg.font / (2 * depth * tanV)) * H;
        if (sg.text > 0 && sg.text < SIGN_TEXT_PX) {
          const room = Math.min(
            (1 - Math.abs(sg.x) - LABEL_EDGE_FADE) / sg.hw,
            (1 - Math.abs(sg.y) - LABEL_EDGE_FADE) / sg.hh
          );
          sg.f = Math.max(1, Math.min(SIGN_TEXT_PX / sg.text, SIGN_MAX_GROW, room));
        }
      }
      // Two signs grown by at most m (each) stay SIGN_GAP_PX apart across or along the screen. The specimen
      // tray's plate never holds a station sign back: it steps aside (hides) where a grown sign needs the room.
      for (const a of signs) {
        if (!a.on || a.f <= 1) continue;
        for (const b of signs) {
          if (b === a || !b.on || !b.shown || (a.station && !b.station)) continue;
          const mx = ((Math.abs(a.x - b.x) * W) / 2 - SIGN_GAP_PX) / (((a.hw + b.hw) * W) / 2);
          const my = ((Math.abs(a.y - b.y) * H) / 2 - SIGN_GAP_PX) / (((a.hh + b.hh) * H) / 2);
          a.f = Math.max(1, Math.min(a.f, Math.max(mx, my)));
        }
      }
      for (const sg of signs) {
        const sprite = sg.sprite;
        sprite.scale.set(sg.base.x * sg.f, sg.base.y * sg.f, 1);
        // a grown plate seen at an angle can reach behind the wall: it is drawn over the scene, as a label is
        sprite.material.depthTest = sg.f <= 1;
        if (sg.proxy) sg.proxy.scale.set(sg.proxyBase.x * sg.f, sg.proxyBase.y * sg.f, sg.proxyBase.z);
        let k = 0;
        if (sg.on && !sg.station)
          for (const a of signs) if (a.station && a.on && a.f > 1 && signsMeet(a, sg, W, H)) sg.on = false;
        if (sg.on) {
          const hw = sg.hw * sg.f;
          const hh = sg.hh * sg.f;
          const inside = Math.min(1 - sg.x - hw, sg.x - hw + 1, 1 - sg.y - hh, sg.y - hh + 1);
          const f = Math.min(1, Math.max(0, inside / LABEL_EDGE_FADE));
          k = f * f * (3 - 2 * f);
          // a sign that stays too small to read fades out (a framed station's own sign never does)
          if (sizeFade && !framed.includes(sg.station)) {
            const t = Math.min(1, Math.max(0, (sg.text * sg.f - SIGN_HIDE_PX) / (SIGN_TEXT_PX - SIGN_HIDE_PX)));
            k *= t * t * (3 - 2 * t);
          }
        }
        sprite.material.opacity = k;
        sprite.visible = k > 0.001;
      }
    }

    // The stations the current view frames (cached: the render loop does not allocate).
    let framedKey;
    let framedIds = [];
    // Two signs' plates as drawn (grown) come closer than SIGN_GAP_PX on screen.
    function signsMeet(a, b, W, H) {
      const gx = (Math.abs(a.x - b.x) * W) / 2 - (((a.hw * a.f + b.hw * b.f) * W) / 2 + SIGN_GAP_PX);
      const gy = (Math.abs(a.y - b.y) * H) / 2 - (((a.hh * a.f + b.hh * b.f) * H) / 2 + SIGN_GAP_PX);
      return gx < 0 && gy < 0;
    }

    // Keep the orbit target on or above the bench surface and within the room. Presets start
    // their look-at point inside the same limits, so a preset is never nudged after landing.
    const half = BENCH_LENGTH / 2;
    const targetMin = new THREE.Vector3(-half, BENCH_TOP_Y, -0.55);
    const targetMax = new THREE.Vector3(half, BENCH_TOP_Y + 2.2, 2.5);
    function clampTarget() {
      const t = controls.target;
      let dx = 0;
      let dy = 0;
      let dz = 0;
      if (t.y < targetMin.y) dy = targetMin.y - t.y;
      if (t.y > targetMax.y) dy = targetMax.y - t.y;
      if (t.x < targetMin.x) dx = targetMin.x - t.x;
      if (t.x > targetMax.x) dx = targetMax.x - t.x;
      if (t.z < targetMin.z) dz = targetMin.z - t.z;
      if (t.z > targetMax.z) dz = targetMax.z - t.z;
      if (!dx && !dy && !dz) return false;
      t.x += dx;
      t.y += dy;
      t.z += dz;
      camera.position.x += dx;
      camera.position.y += dy;
      camera.position.z += dz;
      return true;
    }

    function startLoop() {
      if (destroyed || rafId) return;
      lastTick = 0;
      rafId = requestAnimationFrame(tick);
    }
    function stopLoop() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    }

    // ---------- sizing ----------
    const size = { w: 0, h: 0 };
    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, pixelRatioCap);
      if (ratio !== renderer.getPixelRatio()) renderer.setPixelRatio(ratio);
      const w = Math.max(1, container.clientWidth | 0);
      const h = Math.max(1, container.clientHeight | 0);
      // d5-3 (FIX5): only a new canvas size moves anything (a card laid over the stage changes nothing)
      const changed = w !== size.w || h !== size.h;
      if (changed) {
        hideTag('tap'); // the view moves under a tap tag pinned to the screen
        dropHover(); // and under a still mouse: pick again there at the next frame
        hoverStale = true;
        viewChanged = true; // G1: what is on screen may have changed
      }
      size.w = w;
      size.h = h;
      renderer.setSize(w, h, false);
      if (changed) {
        camera.aspect = w / h;
        camera.fov = camera.aspect < 1 ? Math.min(62, 50 + (1 - camera.aspect) * 28) : 50;
        camera.updateProjectionMatrix();
        director.resize(w, h);
        if (!director.active()) {
          controls.maxDistance = Math.max(MAX_DISTANCE, overviewDistance() * 1.25);
          refit();
        }
      }
      requestRender();
    }
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
    if (observer) observer.observe(container);
    else window.addEventListener('resize', resize);
    // Browser zoom resizes the container (ResizeObserver fires); moving the window to a display
    // with another DPR fires nothing, so watch the exact current DPR and re-subscribe on change.
    let dprQuery = null;
    function unwatchDpr() {
      if (dprQuery) dprQuery.removeEventListener('change', onDprChange);
      dprQuery = null;
    }
    function watchDpr() {
      unwatchDpr();
      if (typeof window.matchMedia !== 'function') return;
      try {
        dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
        dprQuery.addEventListener('change', onDprChange);
      } catch {
        dprQuery = null;
      }
    }
    function onDprChange() {
      watchDpr();
      resize();
    }
    watchDpr();

    // ---------- camera presets ----------
    // Presets are fitted, not fixed: the camera looks at a box (the whole bench for 'overview', one
    // station's equipment and label otherwise) from a preset direction and backs off exactly far
    // enough for the box to fill the frame less a margin, so the subject fills the canvas at any
    // aspect ratio. resize() recomputes them.
    function viewDirection(azimuth, elevation, out) {
      const flat = Math.cos(elevation);
      return out.set(Math.sin(azimuth) * flat, Math.sin(elevation), Math.cos(azimuth) * flat);
    }
    function overviewAzimuth() {
      const narrow = Math.min(1, Math.max(0, (1.9 - camera.aspect) / 0.9));
      return OVERVIEW_AZIMUTH_WIDE + (OVERVIEW_AZIMUTH_NARROW - OVERVIEW_AZIMUTH_WIDE) * narrow;
    }
    // Fit `box` seen from `dir`: the look-at point starts at the box centre and the camera backs off
    // along `dir` until all eight corners sit inside the frustum less `margin`. Closed form per
    // corner: moving along the view axis changes only its depth, so it needs its depth offset plus
    // its lateral extent over the frustum slope, and the box needs the largest. Perspective makes
    // the near end of an obliquely seen bench wider than the far end, so the look-at point then
    // slides along x toward the near end (a few fixed-point steps) until the projection is centred;
    // it never leaves the bench, so the orbit target clamps still hold. Leaves _t and _dir set.
    // `points` (G3): world points that must also project at least FRAME_KEEP_PX inside the canvas (the
    // rack and the jars of a station view, out of the edge-pan band); the camera backs off for them.
    // `hb` (r4-p4-4): the share of the canvas, from its top, the view is framed into (1: all of it). The band's
    // centre sits 1 - hb above the canvas's centre (NDC), so a point's height is measured from there: `lift`
    // per unit of its depth toward the camera, once framing() lowers the look-at point to match.
    function fit(box, azimuth, elevation, margin, points = null, hb = 1) {
      viewDirection(azimuth, elevation, _dir);
      const tanV = Math.tan((camera.fov * Math.PI) / 360) * (1 - margin);
      const tanH = tanV * camera.aspect;
      _right.set(_dir.z, 0, -_dir.x).normalize();
      _up.crossVectors(_right, _dir).negate();
      box.getCenter(_t).clamp(targetMin, targetMax);
      const keep = !!points && points.length > 0 && size.w > 0 && size.h > 0;
      const tan0 = Math.tan((camera.fov * Math.PI) / 360);
      const lift = (1 - hb) * tan0;
      const keepH = keep ? tan0 * camera.aspect * (1 - Math.min(0.7, (2 * FRAME_KEEP_PX) / size.w)) : 1;
      const keepV = keep ? tan0 * Math.max(0.3 * hb, hb - (2 * FRAME_KEEP_PX) / size.h) : 1;
      const keepNeed = () => {
        let need = 0;
        for (const p of points) {
          _corner.copy(p).sub(_t);
          const d = _corner.dot(_dir);
          const off = Math.max(Math.abs(_corner.dot(_right)) / keepH, Math.abs(_corner.dot(_up) + lift * d) / keepV);
          need = Math.max(need, d + off);
        }
        return need;
      };
      let dist = 0;
      for (let pass = 0; pass < 4; pass++) {
        dist = 0;
        for (let i = 0; i < 8; i++) {
          _corner
            .set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
            .sub(_t);
          _depth[i] = _corner.dot(_dir);
          _lateral[i] = _corner.dot(_right);
          const up = Math.abs(_corner.dot(_up) + lift * _depth[i]);
          const need = Math.max(Math.abs(_lateral[i]) / tanH, up / (tanV * hb));
          dist = Math.max(dist, _depth[i] + need);
        }
        dist = Math.max(MIN_DISTANCE, dist);
        if (keep) dist = Math.max(dist, keepNeed());
        let minX = Infinity;
        let maxX = -Infinity;
        for (let i = 0; i < 8; i++) {
          const x = _lateral[i] / ((dist - _depth[i]) * tanH);
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
        const centre = (minX + maxX) / 2;
        if (Math.abs(centre) < 0.004) break;
        _t.x += (centre * tanH * dist) / _right.x;
      }
      if (keep) dist = Math.max(dist, keepNeed()); // the last centring step moved the look-at point
      return dist;
    }
    // `others` (H1, FIX4): jars outside the framed stations that would take the slide. None may sit in an
    // edge-pan band: the view slides along the bench until each is FRAME_KEEP_PX inside or wholly off the
    // canvas (clearBands, strict), else until each centre is inside or off; when no slide does it, the ones in
    // a band come FRAME_KEEP_PX inside (the view widens, at most BAND_WIDEN_MAX; past that it stays as fitted).
    // `framed`: the view's stations, whose signs a slide keeps whole. `hb`: the visible band (fit(), r4-p4-4).
    function framing(box, azimuth, elevation, margin, points = null, others = null, framed = [], hb = 1) {
      let dist = fit(box, azimuth, elevation, margin, points, hb);
      const clears = (keep, strict) => clearBands(box, keep, others, dist, margin, framed, strict, hb);
      if (others && others.length && !clears(points, true) && !clears(points, false)) {
        const base = dist;
        let keep = points || [];
        let clear = false;
        for (let pass = 0; pass < BAND_PASSES && !clear; pass++) {
          keep = keep.concat(_banded.map(v => v.clone()));
          dist = fit(box, azimuth, elevation, margin, keep, hb);
          if (dist > base * BAND_WIDEN_MAX) break;
          clear = clears(keep, false);
        }
        // widening that far would shrink the station: keep its own view (a jar left in a band still holds
        // the edge pan while the slide is over it)
        if (!clear) dist = fit(box, azimuth, elevation, margin, points, hb);
      }
      // r4-p4-4: for a band the camera and its look-at point go down until the look-at point shows at the band's
      // centre; a look-at point that this takes under the bench top slides along the view line (the picture
      // stays the same) back onto it, where the orbit clamps keep it.
      _look.copy(_t);
      if (hb < 1) {
        _look.addScaledVector(_up, -(1 - hb) * Math.tan((camera.fov * Math.PI) / 360) * dist);
        if (_look.y < targetMin.y + 1e-3 && _dir.y > 1e-3) {
          const s = (targetMin.y + 1e-3 - _look.y) / _dir.y;
          _look.addScaledVector(_dir, s);
          dist -= s;
        }
      }
      return {
        target: _look.toArray(),
        position: [_look.x + _dir.x * dist, _look.y + _dir.y * dist, _look.z + _dir.z * dist],
        band: hb,
      };
    }
    // H1 (FIX4): with the camera `dist` from the look-at point _t along _dir (as fit() left them), try look-at
    // points slid along the bench by 0, ±BAND_SLIDE_STEP, ±2 steps… up to BAND_SLIDE_MAX, and keep the first
    // where the box still fits the frustum less BAND_SLIDE_MARGIN (or half `margin`), the framed stations'
    // signs stay whole, the `points` stay FRAME_KEEP_PX inside (no closer to an edge than before where they
    // already were), and no glass of a jar of `others` sits within FRAME_KEEP_PX of a side edge: `strict`, none
    // of it shows there; else its centre is not on the canvas there. Returns false (and lists the centres of
    // the glasses in a band at the start in _banded) when no slide does it; _t is then unchanged.
    function clearBands(box, points, others, dist, margin, framed, strict, hb = 1) {
      _banded.length = 0;
      const W = size.w;
      const H = size.h;
      if (!W || !H) return true;
      const tan0 = Math.tan((camera.fov * Math.PI) / 360);
      const slide = Math.max(BAND_SLIDE_MARGIN, margin / 2); // a slid view may use half its margin
      const tanV = tan0 * (1 - slide);
      const tanH = tanV * camera.aspect;
      const x0 = _t.x;
      // r4-p4-4: the visible band (fit()): heights count from its centre, and framing() lowers the look-at point
      const lift = (1 - hb) * tan0;
      const drop = lift * dist;
      // screen px (_sp) of world point p with the look-at point at x0 + dx; false behind the camera
      const toScreen = (p, dx) => {
        _corner.copy(p).sub(_t);
        _corner.x -= dx;
        const depth = dist - _corner.dot(_dir);
        if (depth <= camera.near) return false;
        _sp.x = ((_corner.dot(_right) / (depth * tan0 * camera.aspect) + 1) / 2) * W;
        _sp.y = ((1 - (_corner.dot(_up) + drop) / (depth * tan0)) / 2) * H;
        return true;
      };
      const side = () => Math.min(_sp.x, W - _sp.x, _sp.y, hb * H - _sp.y);
      // each jar's glass (a row of jars is one hotspot, several glasses): its world box corners and centre
      const glasses = [];
      for (const h of others) {
        for (const solid of h.solids && h.solids.length ? h.solids : [h.proxy]) {
          const b = new THREE.Box3().setFromObject(solid);
          const list = [];
          for (let i = 0; i < 8; i++)
            list.push(
              new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z)
            );
          glasses.push({ h, centre: b.getCenter(new THREE.Vector3()), list });
        }
      }
      const keepAt0 = (points || []).map(p => (toScreen(p, 0) ? side() : -Infinity));
      // the jars of `others` with a glass that shows on the canvas while its centre is within FRAME_KEEP_PX of
      // an edge (or past it), with the look-at point at x0 + dx
      const banded = (dx, out) => {
        let bad = false;
        for (const o of glasses) {
          const on = toScreen(o.centre, dx);
          if (on && Math.min(_sp.x, W - _sp.x) >= FRAME_KEEP_PX - 0.5) continue;
          if (!strict && on && (_sp.x < 0 || _sp.x > W || _sp.y < 0 || _sp.y > H)) continue;
          let x1 = Infinity;
          let x2 = -Infinity;
          let y1 = Infinity;
          let y2 = -Infinity;
          for (const c of o.list) {
            if (!toScreen(c, dx)) continue;
            x1 = Math.min(x1, _sp.x);
            x2 = Math.max(x2, _sp.x);
            y1 = Math.min(y1, _sp.y);
            y2 = Math.max(y2, _sp.y);
          }
          if (!(x2 > 0 && x1 < W && y2 > 0 && y1 < H)) continue;
          bad = true;
          if (!out) return true;
          out.push(o.centre);
        }
        return bad;
      };
      // how far inside the frustum less `margin` the box's nearest corner is (world units; < 0: outside)
      const boxSlack = dx => {
        let slack = Infinity;
        for (let i = 0; i < 8; i++) {
          _corner
            .set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
            .sub(_t);
          _corner.x -= dx;
          const depth = dist - _corner.dot(_dir);
          slack = Math.min(
            slack,
            depth * tanH - Math.abs(_corner.dot(_right)),
            depth * tanV * hb - Math.abs(_corner.dot(_up) + lift * _corner.dot(_dir))
          );
        }
        return slack;
      };
      const slack0 = Math.min(0, boxSlack(0)) - 1e-6;
      // how far inside the canvas (NDC) the framed stations' signs are, each less LABEL_EDGE_FADE (< 0: fading)
      const signSlack = dx => {
        let slack = Infinity;
        for (const sg of signs) {
          if (!sg.station || !framed.includes(sg.station)) continue;
          _corner.setFromMatrixPosition(sg.sprite.matrixWorld).sub(_t);
          _corner.x -= dx;
          const depth = dist - _corner.dot(_dir);
          if (depth <= camera.near) continue;
          const hx = (Math.abs(_corner.dot(_right)) + sg.base.x / 2) / (depth * tan0 * camera.aspect);
          const hy = (Math.abs(_corner.dot(_up) + lift * _corner.dot(_dir)) + sg.base.y / 2) / (depth * tan0);
          slack = Math.min(slack, 1 - LABEL_EDGE_FADE - hx, hb - LABEL_EDGE_FADE - hy);
        }
        return slack;
      };
      const signs0 = Math.min(0, signSlack(0)) - 1e-6;
      const fits = dx => {
        const x = x0 + dx;
        if (x < targetMin.x || x > targetMax.x || boxSlack(dx) < slack0 || signSlack(dx) < signs0) return false;
        if (points)
          for (let i = 0; i < points.length; i++) {
            if (!toScreen(points[i], dx) || side() < Math.min(FRAME_KEEP_PX, keepAt0[i]) - 0.5) return false;
          }
        return true;
      };
      if (!banded(0, _banded)) return true;
      for (let k = 1; k * BAND_SLIDE_STEP <= BAND_SLIDE_MAX + 1e-9; k++) {
        for (const dx of [k * BAND_SLIDE_STEP, -k * BAND_SLIDE_STEP]) {
          if (fits(dx) && !banded(dx, null)) {
            _t.x = x0 + dx;
            return true;
          }
        }
      }
      return false;
    }
    function overviewDistance() {
      return fit(built.bounds, overviewAzimuth(), OVERVIEW_ELEVATION, OVERVIEW_MARGIN);
    }
    // The stations a view key names ('S1', 'S1+S2'); [] for 'overview' or anything unknown.
    function viewStations(key) {
      const ids = String(key || '').split('+');
      return ids.every(id => stationIndex.has(id)) ? ids : [];
    }
    function presetFor(key) {
      const hb = frameBand();
      if (key === 'overview')
        return framing(built.bounds, overviewAzimuth(), OVERVIEW_ELEVATION, OVERVIEW_MARGIN, null, null, [], hb);
      const ids = viewStations(key);
      if (!ids.length) return null;
      // The stations' boxes and, when the rack stands at one of them, the rack: it sits in front of the
      // station's equipment, outside the station's own box, where the frame's lower edge cut it.
      _box.makeEmpty();
      for (const id of ids) _box.union(built.stationBounds.get(id));
      // G3: the jars of these stations and the rack (where it stands) stay FRAME_KEEP_PX inside.
      let n = 0;
      const keepPoint = () => _keep[n++] || (_keep[n - 1] = new THREE.Vector3());
      for (const h of dipSpots) if (ids.includes(h.station)) h.proxy.getWorldPosition(keepPoint());
      if (rackStation && ids.includes(rackStation)) {
        const at = rackTween.targets[0].to; // where the rack stands, or is going
        _rackBox.min.copy(at).sub(_rackHalf);
        _rackBox.max.copy(at).add(_rackHalf);
        _rackBox.min.y = BENCH_TOP_Y;
        _box.union(_rackBox);
        if (rackHotspot) keepPoint().copy(at).add(rackHotspot.proxy.position);
      }
      // I4 (FIX5): the H6 view (the rack's station alone, the next jar at a station that is not its neighbour)
      // also frames ROOM_X of bench beyond the station toward that jar, at the bench top in the rack's row.
      const far = ids.length === 1 && ids[0] === rackStation ? farSide(rackStation) : 0;
      if (far) {
        const edge = far < 0 ? _box.min.x : _box.max.x;
        _roomBox.min.set(Math.min(edge, edge + far * ROOM_X), BENCH_TOP_Y, RACK_Z - _rackHalf.z);
        _roomBox.max.set(Math.max(edge, edge + far * ROOM_X), BENCH_TOP_Y + 0.02, RACK_Z + _rackHalf.z);
        _box.union(_roomBox);
      }
      const points = _keep.slice(0, n);
      // H1 (FIX4): the other jars that would take the slide stay out of the edge-pan bands.
      const others = dipSpots.filter(h => !ids.includes(h.station) && !readDropHint(dropKey(h)));
      if (ids.length === 1)
        return framing(_box, STATION_AZIMUTH, STATION_ELEVATION, STATION_MARGIN, points, others, ids, hb);
      // Several stations (frameStations): on a narrow canvas the view turns toward the last station,
      // where the slide goes.
      const narrow = Math.min(1, Math.max(0, (1.9 - camera.aspect) / 0.9));
      const toward = stationIndex.get(ids[ids.length - 1]) >= stationIndex.get(ids[0]) ? 1 : -1;
      const azimuth = STATION_AZIMUTH + (toward * PAIR_AZIMUTH_NARROW - STATION_AZIMUTH) * narrow;
      const elevation = STATION_ELEVATION + (PAIR_ELEVATION - STATION_ELEVATION) * narrow;
      return framing(_box, azimuth, elevation, STATION_MARGIN, points, others, ids, hb);
    }
    // I4 (FIX5): -1 / +1 when the jar the run needs next (api.stepState 'next') stands at a station left / right of
    // `station` that is not its neighbour (the H6 far pair); else 0.
    function farSide(station) {
      const at = stationIndex.get(station);
      const next = stepHotspots.find(h => readStepState(h.step) === 'next');
      const to = next ? stationIndex.get(next.station) : undefined;
      if (at === undefined || to === undefined || Math.abs(to - at) <= 1) return 0;
      return to < at ? -1 : 1;
    }
    // r4-p4-4 (FIX5): the share of the canvas, from its top, the student can see at once above an open notes
    // drawer with the stage right under the site's top bar: the window less both insets (api.viewportInsets()),
    // when that cuts the canvas but leaves FRAME_BAND_MIN of it; else 1. The stage's place on the page (each
    // scroll moves it) is not an input: the view fits the stage brought up under the top bar.
    function frameBand() {
      const H = size.h;
      // the layout viewport's height: steady while a phone's address bar slides in and out on a scroll
      // (window.innerHeight follows it, which would re-frame a resting view on every scroll with the drawer open)
      const view = (document.documentElement && document.documentElement.clientHeight) || window.innerHeight || 0;
      if (!H || !view) return 1;
      const { top, bottom } = readInsets();
      const room = view - top - bottom;
      if (room >= H - 0.5 || room < H * FRAME_BAND_MIN) return 1;
      return room / H;
    }

    // The preset the camera last came to rest on. A resize re-fits a camera still sitting on it
    // (or re-targets a flight to it) and leaves a view the learner orbited to alone.
    let landed = null;
    function applyPreset(id, preset) {
      camera.position.fromArray(preset.position);
      controls.target.fromArray(preset.target);
      controls.update();
      landed = { id, position: camera.position.clone(), target: controls.target.clone(), band: preset.band };
    }
    // The camera rests where it last landed (nobody turned, zoomed or panned it since).
    function atLanded() {
      return (
        !!landed &&
        camera.position.distanceTo(landed.position) <= AWAY_EPS &&
        controls.target.distanceTo(landed.target) <= AWAY_EPS
      );
    }
    function refit() {
      if (!currentView) return;
      const preset = presetFor(currentView);
      if (!preset) return;
      if (camTween.active) {
        camTween.targets[0].to.fromArray(preset.position);
        camTween.targets[1].to.fromArray(preset.target);
        return;
      }
      if (!landed || landed.id !== currentView || !atLanded()) return;
      applyPreset(currentView, preset);
    }
    // r4-p4-4 (FIX5): the band a resting view can be seen in changed (a phone's notes drawer opened, closed or
    // slimmed): a camera still on its landed view is framed again for it, with a short flight that names no
    // station. Never while the student turns the camera or holds the slide, mid-flight or during the clip.
    let bandCheck = 0;
    function refitBand(now) {
      if (now - bandCheck < BAND_POLL_MS) return;
      bandCheck = now;
      if (!landed || landed.id !== currentView || camTween.active || director.active()) return;
      if (orbiting || pointer.down || slideDrag.phase !== 'idle') return;
      if (Math.abs(frameBand() - (landed.band || 1)) < 0.01 || !atLanded()) return;
      flyTo(currentView, { quiet: true });
    }

    // OrbitControls keeps a fling's momentum in private fields (r186: _sphericalDelta, _panOffset,
    // _scale). update() is skipped while the camera tween runs, so whatever is left would land in
    // full on arrival; drop it when the tween starts. Should a later build rename the fields, the
    // momentum is flushed through one undamped update() instead (a small jump at take-off, exact arrival).
    function discardInertia() {
      const delta = controls._sphericalDelta;
      const pan = controls._panOffset;
      const known =
        delta &&
        typeof delta.set === 'function' &&
        pan &&
        typeof pan.set === 'function' &&
        typeof controls._scale === 'number';
      if (known) {
        delta.set(0, 0, 0);
        pan.set(0, 0, 0);
        controls._scale = 1;
        return;
      }
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = damping;
    }

    // `rate` divides the tween length (replay speed); the public goToStation always flies at 1.
    // `key` is a view key: 'overview', a station id, or station ids joined by '+' (frameStations).
    // `defer` (H6): api.onStation names the station one microtask later, after the caller's own
    // bookkeeping (a shell that asked for a pair and got the rack's station alone reads it then).
    // `home` (I2, FIX5): the shell asked for this view (goToStation, frameStations) or the rack's follow: it is
    // the view "Back to my station" (recenter) returns to, and it is reported (api.onViewChange) once the view
    // settles, even when nothing moves. `quiet`: no api.onStation (the same view framed again, r4-p4-4).
    let homeView = null;
    function flyTo(key, { rate = 1, defer = false, home = false, quiet = false } = {}) {
      if (destroyed) return Promise.resolve(false);
      const preset = presetFor(key);
      if (!preset) return Promise.resolve(false);
      if (home) {
        homeView = key;
        viewChanged = true;
      }
      cancelDrag(); // the camera leaves: the slide goes back to the rack
      // A camera already resting there (a tap on the current station's sign) keeps its tags.
      const still =
        camera.position.distanceToSquared(_v.fromArray(preset.position)) < 1e-8 &&
        controls.target.distanceToSquared(_v.fromArray(preset.target)) < 1e-8;
      if (!still) {
        hideTag('tap'); // a tap tag would no longer sit by what it names
        dropHover(); // nor a hover tag: it comes back where the mouse is once the camera lands
        hoverStale = true;
      }
      if (director.active()) director.abort(); // a station flight ends the clip (surfacing first)
      camTween.targets[0].to.fromArray(preset.position);
      camTween.targets[1].to.fromArray(preset.target);
      discardInertia();
      controls.enabled = false;
      const promise = camTween.start(performance.now(), reducedMotion || !shown ? 0 : CAMERA_MS / rate);
      requestRender();
      const ids = viewStations(key);
      currentView = key;
      currentStation = ids.length ? ids[ids.length - 1] : key; // 'overview' included, so replay knows the camera left the station
      const named = currentStation;
      if (quiet || !stationIndex.has(named)) {
        // no station to name
      } else if (defer) {
        queueMicrotask(() => {
          if (!destroyed && currentStation === named) call(api.onStation, named);
        });
      } else call(api.onStation, named);
      return promise.then(done => {
        // A flight cancelled by a clip entry point settles while the director holds the camera:
        // leave the controls to it (it re-enables them when it returns to the bench).
        if (!destroyed && !camTween.active && !director.active()) {
          controls.enabled = true;
          controls.update();
          if (done)
            landed = { id: key, position: camera.position.clone(), target: controls.target.clone(), band: preset.band };
          requestRender();
        }
        return done;
      });
    }
    // `home` false: a station sign's own flight (I2: not a view the shell asked for).
    function goToStation(id, home = true) {
      return stationIndex.has(id) || id === 'overview' ? flyTo(id, { home }) : Promise.resolve(false);
    }
    // I2 (FIX5): the camera has left the view the shell last asked for (the opening view before that): the student
    // turned, zoomed or panned it, an edge pan moved it, or a sign took it to another station. Not while it flies
    // or the clip holds it.
    function isAway() {
      if (destroyed || !homeView || camTween.active || director.active()) return false;
      return !(landed && landed.id === homeView && atLanded());
    }
    // I2: "Back to my station": fly to that view again (goToStation's flight; api.onStation names its station).
    // Nothing while the clip holds the camera.
    function recenter() {
      if (destroyed || !homeView || director.active()) return Promise.resolve(false);
      return flyTo(homeView);
    }
    // E1: frame several stations at once (the rack's and the next jar's), with goToStation's flight
    // (same easing, a cut under reduced motion). The last id becomes the current station (the shell's
    // station picker and api.onStation name it). Unknown ids are dropped; one id is goToStation.
    // H6 (FIX4): two stations that are not neighbours (a far out-of-order step) are framed together only
    // while the rack and the next jar keep a PAIR_TARGET_PX target; else the camera frames the rack's station
    // alone (rack and jars big), and api.onStation names it once the caller has done its own bookkeeping.
    function frameStations(ids) {
      const list = [];
      for (const id of Array.isArray(ids) ? ids : [ids]) if (stationIndex.has(id) && !list.includes(id)) list.push(id);
      if (!list.length) return Promise.resolve(false);
      const key = pairOrRack(list);
      return flyTo(key, { defer: key !== list.join('+'), home: true });
    }
    // The view key for framing `list` (known, unique station ids): the list itself, or the rack's station
    // alone when the list holds the rack's station and one that is not its neighbour, and framing them all
    // would make the rack's or the next jar's hit box shorter than PAIR_TARGET_PX on a side. The next jar
    // is the one api.stepState calls 'next' at another of those stations; else the smallest there.
    function pairOrRack(list) {
      const key = list.join('+');
      if (list.length < 2 || !rackStation || !rackHotspot || !list.includes(rackStation)) return key;
      const at = list.map(id => stationIndex.get(id)).sort((a, b) => a - b);
      if (at.every((v, i) => i === 0 || v - at[i - 1] <= 1)) return key; // neighbours: the in-order follow view
      const preset = presetFor(key);
      if (!preset) return key;
      const away = dipSpots.filter(h => list.includes(h.station) && h.station !== rackStation);
      const next = away.find(h => h.kind === 'step' && readStepState(h.step) === 'next');
      let smallest = targetPx(rackHotspot.proxy, preset, rackTween.targets[0].to);
      for (const h of next ? [next] : away) smallest = Math.min(smallest, targetPx(h.proxy, preset, null));
      return smallest >= PAIR_TARGET_PX ? key : rackStation;
    }
    // The shorter side (px) of a hit proxy's screen box seen from `preset`. `rackAt`: the rack's proxy, its
    // rack standing (or going) there.
    function targetPx(proxy, preset, rackAt) {
      if (!size.w || !size.h) return Infinity;
      const tan0 = Math.tan((camera.fov * Math.PI) / 360);
      _pt.fromArray(preset.target);
      _pd.fromArray(preset.position).sub(_pt);
      const dist = _pd.length();
      _pd.normalize();
      _pr.set(_pd.z, 0, -_pd.x).normalize();
      _pu.crossVectors(_pd, _pr);
      if (!rackAt) proxy.updateWorldMatrix(true, false);
      let x1 = Infinity;
      let x2 = -Infinity;
      let y1 = Infinity;
      let y2 = -Infinity;
      for (let i = 0; i < 8; i++) {
        _pc.set(i & 1 ? 0.5 : -0.5, i & 2 ? 0.5 : -0.5, i & 4 ? 0.5 : -0.5);
        if (rackAt) _pc.multiply(proxy.scale).add(proxy.position).add(rackAt);
        else _pc.applyMatrix4(proxy.matrixWorld);
        _pc.sub(_pt);
        const depth = dist - _pc.dot(_pd);
        if (depth <= camera.near) return 0;
        const x = ((_pc.dot(_pr) / (depth * tan0 * camera.aspect) + 1) / 2) * size.w;
        const y = ((1 - _pc.dot(_pu) / (depth * tan0)) / 2) * size.h;
        x1 = Math.min(x1, x);
        x2 = Math.max(x2, x);
        y1 = Math.min(y1, y);
        y2 = Math.max(y2, y);
      }
      return Math.min(x2 - x1, y2 - y1);
    }
    // A clip entry point (intro, dive, explore, seek) takes the camera: a station flight still in
    // the air is dropped (its goToStation promise resolves false) and a running replay stops
    // (resolves false), exactly as destroy() cancels them. Nothing is left to resume later.
    function cancelFlight() {
      cancelDrag();
      hideTag('tap');
      replayToken++;
      camTween.finish(false);
      for (const entry of queuedWaits) {
        clearTimeout(entry.timer);
        entry.resolve();
      }
      queuedWaits.clear();
    }

    // ---------- visual state from a Run ----------
    function stationForStep(step) {
      return built.stepStation.get(step) || null;
    }
    // Where an event left the slide: a step's jar, or (§13.2, a free run) the jar a dip went into: a procedure
    // jar (its step id) or one of the tray's (S9, while that jar is on the tray). Else null.
    function eventStation(e) {
      if (!e) return null;
      if (e.type === 'step') return stationForStep(e.step);
      if (e.type !== 'dip' || typeof e.jarId !== 'string') return null;
      return stationForStep(e.jarId) || (trayJars.some(j => j.id === e.jarId) ? JARS_STATION : null);
    }
    function rackStationFromRun(run) {
      const events = run && Array.isArray(run.events) ? run.events : [];
      for (let i = events.length - 1; i >= 0; i--) {
        const st = eventStation(events[i]);
        if (st) return st;
      }
      return 'S1';
    }
    let rackStation = null;
    function moveRack(id, animate, rate = 1) {
      if (!stationIndex.has(id)) return Promise.resolve(false);
      rackStation = id;
      rackTween.targets[0].to.set(built.stationXs.get(id), BENCH_TOP_Y, RACK_Z);
      const duration = animate && !reducedMotion ? RACK_MS / rate : 0;
      const promise = rackTween.start(performance.now(), duration);
      requestRender();
      return promise;
    }
    // The rack's slides share one material (scene.js). Its colour is the deposit tint of the run's state
    // (TINTS) until the shell sets a look tint (§11.4, setSlideTint): that colour then wins, eased in over
    // SLIDE_TINT_MS, until setSlideTint(null) eases it back. The opacity always follows the deposit level.
    const slideTint = { hex: null, active: false, t0: 0, duration: 0, from: new THREE.Color(), to: new THREE.Color() };
    let slideBase = TINTS[0];
    function applyTint(state) {
      const level = state ? depositLevel(state) : 0;
      slideBase = TINTS[level];
      if (slideTint.hex === null && !slideTint.active) built.slideMaterial.color.setHex(slideBase);
      else if (slideTint.hex === null) slideTint.to.setHex(slideBase); // easing back: the new base is the end
      built.slideMaterial.opacity = TINT_OPACITY[level];
      requestRender();
    }
    // '#rrggbb' / 'rrggbb' / a number -> 0..0xffffff, else null.
    function parseHex(value) {
      if (typeof value === 'number')
        return Number.isFinite(value) ? Math.max(0, Math.min(0xffffff, Math.round(value))) : null;
      if (typeof value !== 'string') return null;
      const m = /^#?([0-9a-f]{6})$/i.exec(value.trim());
      return m ? parseInt(m[1], 16) : null;
    }
    // hex: the look colour (string or number), null (or anything unreadable) the deposit tint.
    function setSlideTint(hex) {
      if (destroyed) return false;
      const parsed = hex === null || hex === undefined ? null : parseHex(hex);
      slideTint.hex = parsed;
      slideTint.to.setHex(parsed === null ? slideBase : parsed);
      if (reducedMotion || slideTint.to.equals(built.slideMaterial.color)) {
        slideTint.active = false;
        built.slideMaterial.color.copy(slideTint.to);
      } else {
        slideTint.from.copy(built.slideMaterial.color);
        slideTint.active = true;
        slideTint.t0 = performance.now();
        slideTint.duration = SLIDE_TINT_MS;
      }
      requestRender();
      return true;
    }
    function stepSlideTint(now) {
      if (!slideTint.active) return false;
      const k = Math.min(1, (now - slideTint.t0) / slideTint.duration);
      built.slideMaterial.color.lerpColors(slideTint.from, slideTint.to, easeInOut(k));
      if (k >= 1) slideTint.active = false;
      return true;
    }
    function applyDone(stepsDone) {
      const done = Array.isArray(stepsDone) ? stepsDone : [];
      for (const [step, mesh] of built.markers) {
        mesh.material = done.includes(step) ? built.materials.markerDone : built.materials.markerIdle;
      }
      requestRender();
    }
    // A different run (a new one, or another from History) whose rack is somewhere else, or a fresh
    // run with no step yet, brings the camera to the rack: after a finished run the camera waits at
    // the microscope, and the new run's jars would be out of view. The same run redrawn, the first
    // run at mount (the camera starts at the rack), a camera already there and a clip holding the
    // camera leave it alone.
    let runKey; // the last run's id (null: a run without one), undefined while there is no run
    let lastRun = null; // the run last drawn (refreshJars places the rack from it again)
    function applyRun(run, animate, follow) {
      if (destroyed) return;
      lastRun = run || null;
      const from = rackStation;
      const target = rackStationFromRun(run);
      if (target !== rackStation) moveRack(target, animate);
      applyTint(run && run.state ? run.state : null);
      applyDone(run ? run.stepsDone : []);
      const key = run ? (run.id != null ? String(run.id) : null) : undefined;
      const other = !!run && key !== runKey;
      const fresh =
        !!run && !(Array.isArray(run.events) && run.events.some(e => e && (e.type === 'step' || e.type === 'dip')));
      runKey = key;
      // The flight (and its api.onStation) waits for a microtask: the shell calls setRun while it
      // redraws, and its station picker must already be in the page when onStation names the station.
      if (follow && other && (target !== from || fresh)) queueMicrotask(() => followRack(key, target));
      refreshTag();
    }
    function followRack(key, target) {
      if (destroyed || key !== runKey || target !== rackStation || target === currentStation) return;
      if (!director.active()) flyTo(target, { home: true });
    }
    function setRun(run, { animate = true } = {}) {
      const jars = syncJars();
      applyRun(run, animate, true);
      if (jars) afterJars();
    }

    // ---------- §13.4: the "Your jars" tray (S9) ----------
    // api.extraJars() -> [{ id: 'x1'…'x4', label }] (the shell's extra jars, in tray order); missing, throwing or not
    // a list: none. Ids that are not x<n>, repeats and any past JARS_MAX are left out; a label is plain text.
    function readExtraJars() {
      let list;
      try {
        list = typeof api.extraJars === 'function' ? api.extraJars() : null;
      } catch {
        list = null;
      }
      const out = [];
      if (!Array.isArray(list)) return out;
      for (const j of list) {
        const id = j && typeof j.id === 'string' ? j.id : '';
        if (out.length >= JARS_MAX || !JAR_ID.test(id) || out.some(o => o.id === id)) continue;
        out.push({ id, label: j && typeof j.label === 'string' ? j.label.trim() : '' });
      }
      return out;
    }
    // Re-read the shell's extra jars and lay the tray out for them: the S9 station, its sign and the jars' hotspots
    // come and go with them. True when anything changed (the ids, their order or a label).
    let trayKey = null;
    function syncJars() {
      if (destroyed || !built.jarTray) return false;
      const list = readExtraJars();
      const key = JSON.stringify(list);
      if (key === trayKey) return false;
      const moved = trayKey === null || JSON.stringify(trayJars.map(j => j.id)) !== JSON.stringify(list.map(j => j.id));
      trayKey = key;
      trayJars = list;
      if (moved) {
        cancelDrag(); // a jar under the slide may be gone or elsewhere
        // a tag or highlight on a tray jar or the S9 sign would name what is no longer there
        const onTray = h => !!h && (h.kind === 'jar' || h.station === JARS_STATION);
        if (onTray(hovered)) setHovered(null);
        if (onTray(tagState.hotspot)) hideTag();
        hoverStale = true;
      }
      built.jarTray.layout(list);
      indexStations();
      dipSpots = stepHotspots.concat(built.jarTray.slots.filter(h => !h.off));
      dropProxies = dipSpots.map(h => h.proxy);
      framedKey = undefined; // the stations a view frames are read again
      requestRender();
      return true;
    }
    // The tray changed: a view (or the view "Back to my station" returns to) that held S9 and lost it goes to the
    // rack's station; a view resting where it landed is framed again (the tray's box, H1's other jars).
    function afterJars() {
      const gone = key => !!key && key !== 'overview' && !viewStations(key).length;
      if (gone(homeView)) homeView = rackStation || 'S1';
      if (gone(currentView) && !director.active()) flyTo(rackStation || 'S1', { home: true });
      else refit();
      viewChanged = true;
    }
    function refreshJars() {
      if (destroyed) return [];
      if (syncJars()) {
        const target = rackStationFromRun(lastRun); // a dip on a jar that came or went
        if (target !== rackStation) moveRack(target, true);
        afterJars();
      }
      refreshTag(); // a showing tag re-reads its jar's label (api.jarLabel)
      return trayJars.map(j => j.id);
    }

    // ---------- replay ----------
    function sleep(ms) {
      return new Promise(resolve => {
        const entry = { resolve, timer: 0 };
        entry.timer = setTimeout(() => {
          queuedWaits.delete(entry);
          resolve();
        }, ms);
        queuedWaits.add(entry);
      });
    }
    async function replay(frames, { speed = 1 } = {}) {
      const token = ++replayToken;
      const rate = speed > 0 ? speed : 1;
      const list = Array.isArray(frames) ? frames : [];
      const alive = () => !destroyed && token === replayToken;
      if (director.active()) director.abort();
      if (list.length) {
        setSlideTint(null); // the frames' own deposit tints show; the shell sets the look again after
        applyTint(null);
        applyDone([]);
      }
      let first = true;
      for (const frame of list) {
        if (!alive()) return false;
        const station = eventStation(frame && frame.event);
        if (station) {
          const moves = [moveRack(station, true, rate)];
          // The first station always re-targets the camera (it may sit at the overview or wherever
          // the learner orbited); later frames fly only when the station changes.
          if (first || station !== currentStation) moves.push(flyTo(station, { rate }));
          first = false;
          await Promise.all(moves);
          if (!alive()) return false;
        }
        applyTint(frame && frame.state ? frame.state : null);
        applyDone(frame ? frame.stepsDone : []);
        await sleep((station ? REPLAY_PAUSE_MS : REPLAY_PAUSE_MS / 2) / rate);
      }
      return alive();
    }

    // ---------- picking ----------
    const pointer = { down: false, click: false, x: 0, y: 0, t: 0, id: -1 };
    // Only the primary button can click: a left mouse press, a touch contact or a pen tip (all
    // report button 0). Right / middle mouse and a pen barrel press (button 2) orbit or pan through
    // OrbitControls but never inspect, navigate or emit a step.
    const primaryButton = event => event.button === 0 || event.pointerType === 'touch';
    let lastClick = { id: null, t: 0 };

    function toNdc(event) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      _ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      return true;
    }
    // The nearest hotspot under _ndc; a background one (the tray, a station sign, a wall-hung object)
    // only when no other hotspot is on the same ray (E2: a jar always wins over them). G2: a proxy is
    // padded (and grown on touch) past what it stands for, so where the ray meets some hotspot's real
    // surface (its `solids` / `solidBoxes`) only such hotspots compete: padding never takes another
    // object's visible surface (the S1 jars' touch padding over the tray), and counts where nothing is.
    function pick() {
      _ray.setFromCamera(_ndc, camera);
      _hits.length = 0;
      _ray.intersectObjects(built.proxies, false, _hits);
      let any = null; // over every proxy hit
      let solid = null; // over the hotspots whose real surface the ray meets
      for (const h of _hits) {
        const hotspot = h.object.userData.hotspot;
        if (!hotspot) continue;
        // a sign faded out at the canvas edge (fadeEdgeLabels) is not there to click
        if (hotspot.kind === 'station' && hotspot.visuals[0] && !hotspot.visuals[0].visible) continue;
        if (!any || (isBackground(any) && !isBackground(hotspot))) any = hotspot;
        if ((!solid || (isBackground(solid) && !isBackground(hotspot))) && meetsSurface(hotspot)) solid = hotspot;
      }
      _hits.length = 0;
      return solid || any;
    }
    // The ray (_ray) meets the hotspot's own surface, not only its proxy's padding.
    function meetsSurface(hotspot) {
      if (hotspot.solidBoxes) for (const b of hotspot.solidBoxes) if (_ray.ray.intersectsBox(b)) return true;
      if (!hotspot.solids || !hotspot.solids.length) return false;
      _solidHits.length = 0;
      _ray.intersectObjects(hotspot.solids, false, _solidHits);
      const met = _solidHits.length > 0;
      _solidHits.length = 0;
      return met;
    }
    function highlight(hotspot, on) {
      for (const v of hotspot.visuals) {
        const m = v.material;
        if (!m) continue;
        if (m.emissive) {
          m.emissive.setHex(on ? HOVER_EMISSIVE : 0x000000);
          m.emissiveIntensity = on ? HOVER_GLOW : 1;
          if (m.isMeshPhysicalMaterial) {
            // glass is faint at rest; let the hover tint read through it
            if (on) m.userData.restOpacity = m.opacity;
            m.opacity = on ? Math.min(1, m.opacity + 0.3) : m.userData.restOpacity;
          }
        } else if (v.userData.label) {
          m.color.setHex(on ? HOVER_LABEL_TINT : v.userData.label.baseColor);
        }
      }
    }
    function setHovered(hotspot) {
      if (hotspot === hovered) return false;
      if (hovered) highlight(hovered, false);
      hovered = hotspot;
      if (hovered) {
        highlight(hovered, true);
        canvas.style.cursor = hovered.id === 'rack' ? 'grab' : 'pointer';
        showTag('hover', hotspotTag(hovered));
      } else {
        canvas.style.cursor = '';
        hideTag('hover');
      }
      return true;
    }
    function updateHover() {
      if (director.inTissue()) {
        if (hovered) setHovered(null);
        if (!director.hoverAt(_ndc)) return false;
        const title = director.hoverTitle();
        if (title) showTag('hover', structureTag(title));
        else hideTag('hover');
        canvas.style.cursor = title ? 'pointer' : '';
        return true;
      }
      return setHovered(pick());
    }
    // The last mouse position over the stage (client px), kept so the hover can be picked again there
    // when the view moves under a still mouse (desktop-7).
    const hoverPt = { x: 0, y: 0, in: false };
    // No hover: the highlight, the cursor and the hover tag go (bench hotspot or tissue structure).
    function dropHover() {
      if (director.inTissue()) {
        if (director.hoverAt(null)) requestRender();
        canvas.style.cursor = '';
        hideTag('hover');
        return;
      }
      if (setHovered(null)) requestRender();
      else hideTag('hover');
    }
    // Pick again at hoverPt. `refresh`: the view moved, so a tag still naming the same hotspot re-reads
    // its lines (its state, whether the rack is on screen, the current station's sign).
    function repick(refresh) {
      if (!hoverPt.in || touch) return false;
      const rect = canvas.getBoundingClientRect();
      const inside =
        rect.width &&
        rect.height &&
        hoverPt.x >= rect.left &&
        hoverPt.x < rect.right &&
        hoverPt.y >= rect.top &&
        hoverPt.y < rect.bottom;
      if (!inside) {
        const had = !!hovered || tagState.mode === 'hover';
        dropHover();
        return had;
      }
      _ndc.x = ((hoverPt.x - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -(((hoverPt.y - rect.top) / rect.height) * 2 - 1);
      tagState.x = hoverPt.x;
      tagState.y = hoverPt.y;
      const changed = updateHover();
      if (tagState.mode === 'hover') {
        if (refresh && !changed) refreshTag();
        placeTag();
      }
      return changed;
    }

    function onPointerDown(event) {
      if (!event.isPrimary) return;
      pointer.down = true;
      pointer.click = primaryButton(event);
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.t = performance.now();
      pointer.id = event.pointerId;
      // A press on the slide rack may become a slide drag (game layer).
      if (pointer.click && slideDrag.phase === 'idle' && canDrag() && toNdc(event)) {
        const hit = pick();
        if (hit && hit.id === 'rack') pressRack(event);
      }
    }
    function onPointerMove(event) {
      if (slideDrag.phase !== 'idle' && event.pointerId === slideDrag.id) {
        moveDrag(event);
        return;
      }
      if (event.pointerType !== 'mouse' || touch) return;
      hoverPt.x = event.clientX;
      hoverPt.y = event.clientY;
      hoverPt.in = true;
      if (pointer.down) return;
      hoverDirty = true;
    }
    function onPointerUp(event) {
      if (slideDrag.phase !== 'idle' && event.pointerId === slideDrag.id) {
        if (slideDrag.phase === 'drag') {
          pointer.down = false;
          endDrag('drop');
          if (event.pointerType === 'mouse' && !touch) {
            // hover picks up again from where the slide was let go (once a flight the drop started lands)
            hoverPt.x = event.clientX;
            hoverPt.y = event.clientY;
            hoverPt.in = true;
            hoverDirty = true;
          }
          return;
        }
        endDrag('release'); // a press that never moved: the click below inspects the rack
      }
      if (!pointer.down || event.pointerId !== pointer.id) return;
      pointer.down = false;
      if (event.pointerType === 'mouse' && !touch) hoverDirty = true; // after an orbit drag, hover again
      if (!pointer.click || !primaryButton(event)) return;
      const now = performance.now();
      const moved = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
      if (moved > CLICK_PX || now - pointer.t > CLICK_MS) return;
      if (!toNdc(event)) return;
      if (director.inTissue()) {
        // Explore mode: a tap on a structure inspects it; nothing else is clickable in the tissue.
        const site = director.pickAt(_ndc);
        if (site && director.state().phase === 'explore') {
          if (event.pointerType !== 'mouse' || touch) tapTag(structureTag(SITE_NAMES[site] || site), event);
          call(api.onInspect, site);
        }
        return;
      }
      const hotspot = pick();
      if (event.pointerType === 'mouse' && !touch) setHovered(hotspot);
      if (!hotspot) return;
      if (event.pointerType !== 'mouse' || touch) tapTag(hotspotTag(hotspot), event);
      const isDouble = lastClick.id === hotspot.id && now - lastClick.t <= DOUBLE_MS;
      lastClick.id = isDouble ? null : hotspot.id;
      lastClick.t = now;
      if (hotspot.kind === 'station') {
        // The current station's sign ("you are here") keeps the view it belongs to: in a framed pair
        // (the rack's station and the next jar's) it would otherwise fly to its station alone and leave
        // the rack behind (desktop-1). Resting there, nothing moves; orbited away, it comes back.
        if (hotspot.station === currentStation && viewStations(currentView).includes(currentStation))
          flyTo(currentView);
        else goToStation(hotspot.station, false);
        return;
      }
      if (hotspot.kind === 'step' && isDouble) {
        emitStep(hotspot.step);
        return;
      }
      // §13.4: a tray jar. A click asks for its sheet (the shell holds it back a moment, as a procedure jar's, and a
      // double click's event cancels it); a double click dips the slide there only while api.dropHint('jar:<id>') is
      // '' (D3: else no dip verb showed, and the first click's sheet says what the jar is).
      if (hotspot.kind === 'jar') {
        if (!isDouble) call(api.onInspect, { kind: 'jar', id: hotspot.jar });
        else if (!readDropHint(hotspot.id)) emitJar(hotspot.jar);
        return;
      }
      // D2: the microscope's and the tray's double-click does it (the shell holds the first click's
      // sheet back, as for a jar). A shell without onAction keeps one inspect per click.
      if (isDouble && ACTION_OBJECTS.has(hotspot.id) && typeof api.onAction === 'function') {
        call(api.onAction, hotspot.id);
        return;
      }
      call(api.onInspect, hotspot.id);
    }
    function onPointerLeave(event) {
      // pointercancel (the browser took the gesture) or a leave without pointer capture ends a drag
      if (slideDrag.phase !== 'idle' && event && event.pointerId === slideDrag.id) endDrag('cancel');
      pointer.down = false;
      if (event && event.type === 'pointerleave' && event.pointerType === 'mouse') hoverPt.in = false;
      if (director.inTissue()) {
        if (director.hoverAt(null)) {
          hideTag('hover');
          canvas.style.cursor = '';
          requestRender();
        }
        return;
      }
      if (setHovered(null)) requestRender();
    }
    function onVisibility() {
      if (document.hidden) stopLoop();
      else {
        requestRender();
        startLoop();
      }
    }
    function onContextLost(event) {
      event.preventDefault();
      stopLoop();
    }
    function onContextRestored() {
      requestRender();
      startLoop();
    }

    // ---------- game layer: hover tag and slide drag (contract §10) ----------
    // The tag replaces the canvas tooltip: the hotspot's title (with the step's state from the shell)
    // and what a click or a drag does there, beside the pointer. It is aria-hidden decoration: every
    // action it names has a keyboard path in the shell (Do this step, Explain this step, Go to station),
    // and the shell's "Show hints" switch (api.hintsOn) drops the verb lines, never the title.
    const tag = document.createElement('div');
    tag.className = 'lab3d-tag';
    tag.setAttribute('aria-hidden', 'true');
    tag.style.cssText = TAG_STYLE;
    // mode: 'hover' (mouse), 'tap' (a finger or a pen: until the next press anywhere, Escape or a
    // camera move) or 'drag'; hotspot: the bench hotspot it names; finger: the tag goes above `avoid`,
    // the client-px box a finger (and the slide it drags) covers ({ left, right, top }), else beside it.
    const tagState = {
      mode: null,
      hotspot: null,
      lines: [],
      key: '',
      visible: false,
      finger: false,
      avoid: { left: 0, right: 0, top: 0 },
      form: null, // H12: 'full' | 'short' | 'line' (placeTag)
      x: 0,
      y: 0,
    };
    const click = touch ? 'Tap' : 'Click';
    const dbl = touch ? 'Double-tap' : 'Double-click';
    const STEP_VERBS = Object.freeze([`${click}: what it does`, `${dbl} or drop the slide: dip`]);
    const STEP_CLICK = Object.freeze([STEP_VERBS[0]]);
    // The rack off screen: a drop cannot happen from here, a double-click still can (desktop-1).
    const STEP_DOUBLE = Object.freeze([STEP_VERBS[0], `${dbl}: dip`]);
    // E3: another station's sign takes the camera there; the current one only says where you are.
    const PLATE_VERBS = Object.freeze([`${click}: go here`]);
    const HERE_SUFFIX = ' · you are here';
    const SAFETY_VERBS = Object.freeze([`${click}: safety notes`]);
    const WHAT_VERBS = Object.freeze([`${click}: what it is`]);
    const SCOPE_VERBS = Object.freeze([WHAT_VERBS[0], `${dbl}: look at your slide`]);
    const TRAY_VERBS = Object.freeze([WHAT_VERBS[0], `${dbl}: play the intro`]);
    const stepHotspots = built.hotspots.filter(h => h.kind === 'step');
    // §13.4: every jar a slide can go into now, the procedure's and the tray's (syncJars); a jar's drop key is its
    // step id, or for a tray jar its hotspot id 'jar:<id>' (api.dropHint takes either).
    let dipSpots = stepHotspots;
    const dropKey = h => (h.kind === 'jar' ? h.id : h.step);
    // What a click, a double-click or a drag does there now (D3: a tag never names an action that
    // would not happen): a jar's dip only while api.dropHint(step) is '', the rack's drag only while
    // some jar would take the slide, the microscope's look only while api.canLook(), the tray's intro
    // only at the bench (not while the clip plays); both only with the shell's api.onAction.
    function verbsFor(h) {
      if (h.kind === 'step' || h.kind === 'jar')
        return readDropHint(dropKey(h)) ? STEP_CLICK : rackOnScreen() ? STEP_VERBS : STEP_DOUBLE;
      if (h.kind === 'station') return h.station === currentStation ? NO_VERBS : PLATE_VERBS;
      if (h.id === 'rack') return someJarTakes() ? RACK_VERBS : NO_VERBS;
      const acts = typeof api.onAction === 'function';
      if (h.id === 'microscope') return acts && readCanLook() ? SCOPE_VERBS : WHAT_VERBS;
      if (h.id === 'specimen') return acts && !director.active() ? TRAY_VERBS : WHAT_VERBS;
      if (SAFETY_OBJECTS.has(h.id)) return SAFETY_VERBS;
      return WHAT_VERBS; // notebook, whiteboard
    }
    const someJarTakes = () => dipSpots.some(h => !readDropHint(dropKey(h)));
    // The rack's centre is inside the canvas (in front of the camera): a slide can be dragged from it,
    // and an edge pan takes it to any jar. Off screen, no jar promises a drop (desktop-1, phone-3).
    const rackHotspot = built.hotspots.find(h => h.id === 'rack') || null;
    function rackOnScreen() {
      if (!rackHotspot || !size.w || !size.h || director.inTissue()) return false;
      rackHotspot.proxy.getWorldPosition(_gc);
      camera.updateMatrixWorld();
      _gc.project(camera);
      if (!(_gc.z > -1 && _gc.z < 1)) return false;
      const x = ((_gc.x + 1) / 2) * size.w;
      const y = ((1 - _gc.y) / 2) * size.h;
      return x >= RACK_INSET_PX && x <= size.w - RACK_INSET_PX && y >= RACK_INSET_PX && y <= size.h - RACK_INSET_PX;
    }

    // The shell's game-layer api is optional: without it every hint shows, no step has a state,
    // every drop goes through (as a double-click does) and the microscope has a picture.
    function readHintsOn() {
      try {
        return typeof api.hintsOn !== 'function' || api.hintsOn() !== false;
      } catch {
        return true;
      }
    }
    function readStepState(step) {
      try {
        return typeof api.stepState === 'function' ? api.stepState(step) : null;
      } catch {
        return null;
      }
    }
    function readDropHint(step) {
      try {
        const text = typeof api.dropHint === 'function' ? api.dropHint(step) : '';
        return typeof text === 'string' ? text.trim() : '';
      } catch {
        return '';
      }
    }
    // §11.1: how many times a step was done in this run (0: no count, or none).
    function readStepCount(step) {
      try {
        const n = typeof api.stepCount === 'function' ? Number(api.stepCount(step)) : 0;
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
      } catch {
        return 0;
      }
    }
    function readCanLook() {
      try {
        return typeof api.canLook !== 'function' || !!api.canLook();
      } catch {
        return false;
      }
    }
    // §13.4: what a jar holds, in the shell's words (api.jarLabel(stepId | jarId)); '' when it says nothing.
    function readJarLabel(id) {
      try {
        const text = typeof api.jarLabel === 'function' ? api.jarLabel(id) : null;
        return typeof text === 'string' ? text.trim() : '';
      } catch {
        return '';
      }
    }
    // Line 1 of a tag. §13.4: a procedure jar adds what it holds ("First silver bath · 10% silver nitrate, 30 min");
    // a tray jar is its label (the shell's extraJars entry, else its jarLabel).
    function hotspotTitle(h) {
      if (h.kind === 'station') return `${h.title || h.id}${h.station === currentStation ? HERE_SUFFIX : ''}`;
      if (h.kind === 'jar') return h.title || readJarLabel(h.jar) || TRAY_JAR_TITLE;
      const state = h.kind === 'step' ? readStepState(h.step) : null;
      const suffix = state === 'done' ? doneSuffix(readStepCount(h.step)) : STATE_SUFFIX.get(state) || '';
      const label = h.kind === 'step' ? readJarLabel(h.step) : '';
      return `${h.title || h.id}${label ? ` · ${label}` : ''}${suffix}`;
    }
    function hotspotTag(h) {
      return { hotspot: h, title: hotspotTitle(h), verbs: readHintsOn() ? verbsFor(h) : NO_VERBS, note: '' };
    }
    function structureTag(title) {
      return { hotspot: null, title, verbs: readHintsOn() ? WHAT_VERBS : NO_VERBS, note: '' };
    }

    function tagRow(text, css) {
      const row = document.createElement('div');
      if (css) row.style.cssText = css;
      row.textContent = text;
      return row;
    }
    // Rows: the title (bold), the verb lines ("Click:" bold, then what it does), a note (why a drop
    // does nothing). The DOM is rebuilt only when the text changes.
    function renderTag(model) {
      const lines = [];
      if (model.title) lines.push(model.title);
      for (const v of model.verbs) lines.push(v);
      if (model.note) lines.push(model.note);
      tagState.lines = lines;
      const key = lines.join('\n');
      if (key === tagState.key) return;
      tagState.key = key;
      const rows = [];
      if (model.title) rows.push(tagRow(model.title, 'font-weight:600'));
      for (const v of model.verbs) {
        const cut = v.indexOf(': ');
        const row = tagRow('', '');
        const verb = document.createElement('span');
        verb.style.fontWeight = '600';
        verb.textContent = cut > 0 ? v.slice(0, cut + 1) : v;
        row.append(verb, cut > 0 ? v.slice(cut + 1) : '');
        rows.push(row);
      }
      if (model.note) rows.push(tagRow(model.note, `color:${TAG_NOTE_COLOR}`));
      tag.replaceChildren(...rows);
      tagState.form = null; // new rows: placeTag sets their form
    }
    function showTag(mode, model, finger = false) {
      renderTag(model);
      if (!tagState.lines.length) {
        hideTag();
        return;
      }
      tagState.mode = mode;
      tagState.hotspot = model.hotspot || null;
      tagState.finger = finger;
      if (tag.parentNode !== container) container.appendChild(tag);
      if (!tagState.visible) {
        tagState.visible = true;
        tag.style.display = 'block';
      }
      placeTag();
    }
    // Hides the tag when it is in `mode` (any mode when omitted).
    function hideTag(mode) {
      if (mode && tagState.mode !== mode) return;
      tagState.mode = null;
      tagState.hotspot = null;
      tagState.lines = NO_VERBS;
      if (!tagState.visible) return;
      tagState.visible = false;
      tag.style.display = 'none';
    }
    // A fingertip at (x, y) client px covers FINGER_PX either side and the hand everything below.
    function fingerAt(x, y) {
      tagState.avoid.left = x - FINGER_PX;
      tagState.avoid.right = x + FINGER_PX;
      tagState.avoid.top = y;
    }
    function tapTag(model, event) {
      tagState.x = event.clientX;
      tagState.y = event.clientY;
      fingerAt(event.clientX, event.clientY);
      showTag('tap', model, true);
    }
    // The site's fixed top bar over the viewport's top (api.topInset(), client px; missing: 0), G8.
    function readTopInset() {
      try {
        const inset = typeof api.topInset === 'function' ? Number(api.topInset()) : 0;
        return Number.isFinite(inset) && inset > 0 ? inset : 0;
      } catch {
        return 0;
      }
    }
    // H10 / H12 (FIX4): what covers the window's bottom (a phone's open notes drawer: api.viewportInsets().bottom,
    // client px; missing, throwing or not finite: 0). A tag keeps above it, as it keeps below the top bar.
    function readBottomInset() {
      return readInsets().bottom;
    }
    // { top, bottom } (client px) from api.viewportInsets() (FIX5: else the shell's CortexLab.viewportInsets());
    // a missing top is api.topInset(); anything missing, throwing or not finite counts as no inset.
    function readInsets() {
      let insets = null;
      try {
        const lab = typeof window !== 'undefined' ? window.CortexLab : null;
        if (typeof api.viewportInsets === 'function') insets = api.viewportInsets();
        else if (lab && typeof lab.viewportInsets === 'function') insets = lab.viewportInsets();
      } catch {
        insets = null;
      }
      const px = v => {
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : 0;
      };
      if (!insets || typeof insets !== 'object') return { top: readTopInset(), bottom: 0 };
      return { top: insets.top === undefined ? readTopInset() : px(insets.top), bottom: px(insets.bottom) };
    }
    // §11 (MODE-FIX-bench3d-1): the shell's stage hint (p.lab-stage-hint, the pill it keeps over the stage's
    // lower edge, a sibling of the stage in its box) while it shows: its top edge in stage px, else Infinity.
    // A tag keeps above it, as it keeps above an open drawer, so a reaction line and the jar's card under
    // the pointer never share pixels. Read from the DOM: the shell sets the class before the bench's
    // refresh after a step (emitStep) and the pointer's next move places the tag again.
    function readStageHintTop(rect) {
      try {
        const box = container.parentElement;
        const hint = box ? box.querySelector('.lab-stage-hint.lab-stage-hint-on') : null;
        if (!hint) return Infinity;
        const hr = hint.getBoundingClientRect();
        return hr.height > 0 && hr.width > 0 ? hr.top - rect.top : Infinity;
      } catch {
        return Infinity;
      }
    }
    // Beside the pointer, clamped inside the visible part of the stage: below the site's top bar (G8)
    // and above the window's bottom (less an open notes drawer, H10) and the shell's stage hint while it shows
    // (§11, readStageHintTop). A mouse: below right, flipped at those edges. A finger: above what it covers (tagState.avoid), else beside it on the side with more room,
    // narrowed to fit (never under the finger, where the hand is). H12 (FIX4): a tag taller than that band
    // takes a shorter form, the title and one verb ('short'), the same in a smaller type ('small'), then
    // each on one line, cut with an ellipsis ('line'), so the stage never clips it.
    function placeTag() {
      if (!tagState.visible) return;
      const rect = canvas.getBoundingClientRect();
      // the visible band of the stage, in stage px (the whole stage when that band is too thin)
      let top = Math.max(0, readTopInset() - rect.top) + TAG_EDGE;
      let bottom = Math.min(rect.height, (window.innerHeight || rect.bottom) - readBottomInset() - rect.top) - TAG_EDGE;
      bottom = Math.min(bottom, readStageHintTop(rect) - TAG_EDGE); // above a showing stage hint (§11)
      if (bottom - top < 24) {
        top = TAG_EDGE;
        bottom = rect.height - TAG_EDGE;
      }
      let at = null;
      for (const form of TAG_FORMS) {
        setTagForm(form);
        at = layoutTag(rect, top, bottom);
        if (at.h <= bottom - top) break;
      }
      const x = Math.min(Math.max(TAG_EDGE, at.x), Math.max(TAG_EDGE, rect.width - at.w - TAG_EDGE));
      let y = Math.min(Math.max(top, at.y), Math.max(top, bottom - at.h));
      if (y + at.h > rect.height - TAG_EDGE) y = Math.max(TAG_EDGE, rect.height - TAG_EDGE - at.h); // never cut by the stage
      tag.style.transform = `translate(${Math.round(canvas.offsetLeft + x)}px, ${Math.round(canvas.offsetTop + y)}px)`;
    }
    // Where the tag goes in its current form (stage px), and its size there.
    function layoutTag(rect, top, bottom) {
      if (tag.style.maxWidth !== TAG_MAX_WIDTH) tag.style.maxWidth = TAG_MAX_WIDTH;
      let w = tag.offsetWidth;
      let h = tag.offsetHeight;
      const px = tagState.x - rect.left;
      const py = tagState.y - rect.top;
      let x = px + TAG_GAP;
      let y;
      if (x + w > rect.width - TAG_EDGE) x = px - TAG_GAP - w;
      if (!tagState.finger) {
        y = py + TAG_GAP + 4;
        if (y + h > bottom) y = py - TAG_GAP - h;
      } else {
        const left = tagState.avoid.left - rect.left;
        const right = tagState.avoid.right - rect.left;
        y = tagState.avoid.top - rect.top - TAG_GAP - 8 - h;
        if (y < top) {
          const roomRight = rect.width - TAG_EDGE - TAG_GAP - right;
          const roomLeft = left - TAG_GAP - TAG_EDGE;
          const room = Math.floor(Math.max(roomRight, roomLeft, TAG_SIDE_MIN_W));
          if (w > room) {
            tag.style.maxWidth = `${room}px`;
            w = tag.offsetWidth;
            h = tag.offsetHeight;
          }
          x = roomRight >= roomLeft ? right + TAG_GAP : left - TAG_GAP - w;
          y = top;
        }
      }
      return { x, y, w, h };
    }
    // 'full': every row; 'short': the title and the first verb (or the note); 'small': those two in a
    // slightly smaller type; 'line': those two, each on one line (an ellipsis cuts what does not fit).
    function setTagForm(form) {
      if (tagState.form === form) return;
      tagState.form = form;
      const line = form === 'line';
      const small = line || form === 'small';
      tag.style.fontSize = small ? '12px' : '13px';
      tag.style.lineHeight = small ? '1.3' : '1.35';
      tag.style.padding = small ? '4px 8px' : '6px 10px';
      const rows = tag.children;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        row.style.display = form !== 'full' && i > 1 ? 'none' : '';
        row.style.whiteSpace = line ? 'nowrap' : '';
        row.style.overflow = line ? 'hidden' : '';
        row.style.textOverflow = line ? 'ellipsis' : '';
      }
    }
    // A run change (a step done) re-reads the state of the hotspot the tag names.
    function refreshTag() {
      if (tagState.visible && tagState.hotspot && tagState.mode !== 'drag')
        showTag(tagState.mode, hotspotTag(tagState.hotspot), tagState.finger);
    }
    // §11: a step event went to the shell (a double-click, a drop). The tag under the pointer re-reads
    // api.stepState / stepCount / dropHint as soon as api.onEvent returns and once more a microtask later
    // (a shell that records the step and redraws after its handler returns), so no " · next" or dip verb
    // lingers on a jar that was just dipped or refused.
    function emitStep(step) {
      emit({ type: 'step', step });
    }
    // §13.4: a tray jar's double click or drop (the shell dips the slide into that jar).
    function emitJar(jarId) {
      emit({ type: 'jar', jarId });
    }
    function emit(event) {
      call(api.onEvent, event);
      refreshTag();
      queueMicrotask(() => {
        if (!destroyed) refreshTag();
      });
    }
    // D4: Escape hides a hover or tap tag and does nothing else (it is not prevented, so the shell's
    // own Escape still closes a sheet or leaves explore; during a drag the drag's Escape cancels it). A
    // hover tag comes back at the next hotspot. Any press, on the stage or elsewhere on the page, ends
    // a tap tag; a tap on a hotspot then shows that one's own.
    function onTagKey(event) {
      if (event.key === 'Escape' && (tagState.mode === 'hover' || tagState.mode === 'tap')) hideTag();
    }
    function onDocPointerDown() {
      hideTag('tap');
    }
    // The page (or a scrolling box around the stage) scrolled under a still mouse: pick again there.
    function onScroll() {
      if (hoverPt.in) hoverStale = true;
    }

    // Drag the slide: a press on the rack becomes a drag after CLICK_PX of movement (a plain click
    // still inspects the rack). OrbitControls are off from the press on, so the camera never moves;
    // a ghost slide follows the pointer over the bench top and settles above the jar under it, which
    // lights up. Dropping on a jar whose api.dropHint(step) is '' emits the same step event as a
    // double-click; anywhere else the ghost goes back to the rack and nothing is emitted (the tag said
    // why). Escape and pointercancel cancel. Never during the clip or inside the tissue.
    let dropProxies = dipSpots.map(h => h.proxy); // what a dragged slide can be dropped on (aimDrag)
    // phase: 'idle' | 'press' (down on the rack, not yet CLICK_PX away) | 'drag'
    const slideDrag = {
      phase: 'idle',
      id: -1,
      x: 0,
      y: 0,
      finger: false,
      over: null,
      hint: '',
      holds: false, // I4: over the next jar, which would take the slide (the edge pan holds)
      saved: true,
      last: null,
    };
    const ghostGeometry = new THREE.BoxGeometry(SLIDE_W, SLIDE_H, SLIDE_T);
    const ghostMaterial = built.slideMaterial.clone();
    ghostMaterial.transparent = true;
    ghostMaterial.depthWrite = false;
    ghostMaterial.depthTest = false; // drawn over the jars it passes in front of
    if (ghostMaterial.emissive) {
      ghostMaterial.emissive.setHex(HOVER_EMISSIVE);
      ghostMaterial.emissiveIntensity = HOVER_GLOW; // the hover tint: this slide is in hand
    }
    const ghost = new THREE.Mesh(ghostGeometry, ghostMaterial);
    ghost.name = 'slide-ghost';
    ghost.visible = false;
    ghost.renderOrder = 10;
    ghost.rotation.x = -0.2;
    scene.add(ghost);
    const ghostTween = new VecTween([
      { obj: ghost.position, from: new THREE.Vector3(), to: new THREE.Vector3() },
      { obj: ghost.scale, from: new THREE.Vector3(), to: new THREE.Vector3(1, 1, 1) },
    ]);

    function canDrag() {
      return !destroyed && controls.enabled && !camTween.active && !director.active() && !director.inTissue();
    }
    function pressRack(event) {
      slideDrag.phase = 'press';
      slideDrag.id = event.pointerId;
      slideDrag.x = event.clientX;
      slideDrag.y = event.clientY;
      slideDrag.finger = event.pointerType !== 'mouse';
      slideDrag.saved = controls.enabled;
      controls.enabled = false; // OrbitControls' pointerdown runs after this one and ignores the press
      try {
        canvas.setPointerCapture(event.pointerId); // moves and the release reach the canvas anywhere
      } catch {
        /* without capture a leave cancels the drag */
      }
      window.addEventListener('keydown', onDragKey);
    }
    function rackSlidePosition(out) {
      built.rack.getWorldPosition(out);
      out.y += RACK_SLIDE_Y;
      out.z += RACK_SLIDE_Z;
      return out;
    }
    function beginDrag() {
      slideDrag.phase = 'drag';
      lastClick.id = null;
      if (hovered) setHovered(null); // the rack's highlight and tag give way to the jar under the slide
      ghostTween.finish(false);
      ghostMaterial.color.copy(built.slideMaterial.color); // the slide's current grey
      ghostMaterial.opacity = Math.max(0.85, built.slideMaterial.opacity);
      rackSlidePosition(ghost.position);
      ghost.scale.set(1, 1, 1);
      ghost.visible = true;
      canvas.style.cursor = 'grabbing';
      call(api.onDragState, true); // H10 (FIX4): the shell slims a phone's Notes drawer while the slide is held
    }
    function moveDrag(event) {
      let begun = false;
      if (slideDrag.phase === 'press') {
        if (Math.hypot(event.clientX - slideDrag.x, event.clientY - slideDrag.y) <= CLICK_PX) return;
        beginDrag();
        begun = true;
      }
      tagState.x = event.clientX;
      tagState.y = event.clientY;
      edgeZone(event.clientX, event.clientY);
      if (toNdc(event)) aimDrag(begun);
      else if (begun) showDragTag();
    }
    // E1 edge pan: a drag held within EDGE_PX of the canvas's left or right edge (or past it, inside the
    // canvas's height) pans the camera along the bench each frame (tick), faster nearer the edge, and
    // stops on a drop, a cancel or a move back inside. The jar under the held pointer follows. G3: the
    // pan starts only after the pointer has stayed EDGE_DWELL_MS in that band (`zone`, entered at
    // `since`); moving through the band, or dropping on a jar in it, never pans.
    const edgePan = { dir: 0, zone: 0, since: 0, k: 0, moved: false };
    function edgeZone(x, y) {
      let zone = 0;
      let k = 0;
      const rect = canvas.getBoundingClientRect();
      if (rect.width >= EDGE_PX * 4 && y >= rect.top && y <= rect.bottom) {
        const fromLeft = x - rect.left;
        const fromRight = rect.right - x;
        if (fromLeft < EDGE_PX) {
          zone = -1;
          k = Math.min(1, (EDGE_PX - fromLeft) / EDGE_PX);
        } else if (fromRight < EDGE_PX) {
          zone = 1;
          k = Math.min(1, (EDGE_PX - fromRight) / EDGE_PX);
        }
      }
      if (zone !== edgePan.zone) {
        edgePan.zone = zone;
        edgePan.since = performance.now();
        edgePan.dir = 0;
      }
      edgePan.k = k;
    }
    function stepEdgePan(dt) {
      const t = controls.target;
      const x = Math.min(
        targetMax.x,
        Math.max(targetMin.x, t.x + edgePan.dir * EDGE_SPEED * (0.4 + 0.6 * edgePan.k) * dt)
      );
      const dx = x - t.x;
      if (Math.abs(dx) < 1e-6) return false;
      t.x += dx;
      camera.position.x += dx;
      camera.updateMatrixWorld();
      edgePan.moved = true;
      landed = null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height) {
        _ndc.x = ((tagState.x - rect.left) / rect.width) * 2 - 1;
        _ndc.y = -(((tagState.y - rect.top) / rect.height) * 2 - 1);
        aimDrag(false);
      }
      requestRender();
      return true;
    }
    // After an edge pan the station nearest the orbit target is the current one (its sign says
    // "you are here", the shell's picker names it); reported once, when the drag ends.
    function endEdgePan() {
      edgePan.dir = 0;
      edgePan.zone = 0;
      if (!edgePan.moved) return;
      edgePan.moved = false;
      let nearest = currentStation;
      let best = Infinity;
      for (const id of stationIndex.keys()) {
        const d = Math.abs(built.stationXs.get(id) - controls.target.x);
        if (d < best) {
          best = d;
          nearest = id;
        }
      }
      if (nearest === currentStation) return;
      currentStation = nearest;
      currentView = nearest;
      call(api.onStation, nearest);
    }
    // I4 (FIX5): the slide is over the jar the run needs next, and a drop there would do that step now: the edge
    // pan holds still. With no jar called next (an older shell, a run with no next step), any jar that would take
    // the slide holds it (H1).
    function holdsPan() {
      return slideDrag.phase === 'drag' && slideDrag.holds;
    }
    function nextOrAny(h) {
      let named = false;
      for (const x of stepHotspots) {
        if (readStepState(x.step) !== 'next') continue;
        if (x === h) return true;
        named = true;
      }
      return !named;
    }
    function showDragTag() {
      const over = slideDrag.over;
      if (over && slideDrag.hint)
        showTag(
          'drag',
          { hotspot: null, title: hotspotTitle(over), verbs: NO_VERBS, note: slideDrag.hint },
          slideDrag.finger
        );
      else if (over)
        showTag(
          'drag',
          {
            hotspot: null,
            title: '',
            verbs: [`Drop here: ${over.title || over.step || hotspotTitle(over)}`],
            note: '',
          },
          slideDrag.finger
        );
      else if (readHintsOn() && someJarTakes())
        showTag('drag', { hotspot: null, title: '', verbs: RACK_VERBS, note: '' }, slideDrag.finger);
      else hideTag('drag');
    }
    // _ndc holds the pointer: light the jar under it (step proxies only), move the ghost there and say
    // what a drop does. A finger's tag goes above the fingertip and the ghost slide (D4).
    function aimDrag(begun) {
      _ray.setFromCamera(_ndc, camera);
      _hits.length = 0;
      _ray.intersectObjects(dropProxies, false, _hits);
      const over = _hits.length ? _hits[0].object.userData.hotspot : null;
      _hits.length = 0;
      const changed = over !== slideDrag.over;
      if (changed) {
        const held = holdsPan();
        if (slideDrag.over) highlight(slideDrag.over, false);
        slideDrag.over = over;
        slideDrag.hint = over ? readDropHint(dropKey(over)) : '';
        slideDrag.holds = !!over && !slideDrag.hint && nextOrAny(over);
        if (over) highlight(over, true);
        if (held && !holdsPan()) edgePan.since = performance.now(); // H1: off the jar, the dwell starts again
      }
      if (moveGhost(over)) requestRender();
      if (slideDrag.finger) avoidGhost();
      if (changed || begun) showDragTag();
      else placeTag();
    }
    // Above the jar under the pointer, else on the bench top under it; false (the ghost stays where it
    // was) when the pointer is above the horizon.
    function moveGhost(over) {
      if (over) {
        over.proxy.getWorldPosition(_g);
        _g.y += over.proxy.scale.y / 2 + GHOST_LIFT;
      } else if (_ray.ray.intersectPlane(_benchPlane, _g)) {
        _g.x = Math.min(Math.max(_g.x, -half + 0.05), half - 0.05);
        _g.z = Math.min(Math.max(_g.z, -BENCH_DEPTH / 2 + 0.05), BENCH_DEPTH / 2 - 0.03);
        _g.y = BENCH_TOP_Y + GHOST_LIFT;
      } else {
        return false;
      }
      camera.getWorldDirection(_gd);
      const depth = Math.max(camera.near, _gt.copy(_g).sub(camera.position).dot(_gd));
      const worldPerPx = (2 * depth * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, canvas.clientHeight);
      const s = Math.max(1, (GHOST_MIN_PX * worldPerPx) / SLIDE_H);
      ghost.scale.set(s, s, s);
      ghost.position.set(_g.x, _g.y + (SLIDE_H * s) / 2, _g.z);
      return true;
    }
    // What a dragging finger covers (tagState.avoid, client px): its tip and the ghost slide's screen box.
    function avoidGhost() {
      fingerAt(tagState.x, tagState.y);
      if (!ghost.visible) return;
      const rect = canvas.getBoundingClientRect();
      const a = tagState.avoid;
      ghost.updateMatrixWorld();
      camera.updateMatrixWorld();
      for (let i = 0; i < 8; i++) {
        _gc.set(
          i & 1 ? SLIDE_W / 2 : -SLIDE_W / 2,
          i & 2 ? SLIDE_H / 2 : -SLIDE_H / 2,
          i & 4 ? SLIDE_T / 2 : -SLIDE_T / 2
        );
        _gc.applyMatrix4(ghost.matrixWorld).project(camera);
        const sx = rect.left + ((_gc.x + 1) / 2) * rect.width;
        const sy = rect.top + ((1 - _gc.y) / 2) * rect.height;
        if (sx < a.left) a.left = sx;
        if (sx > a.right) a.right = sx;
        if (sy < a.top) a.top = sy;
      }
    }
    function returnGhost() {
      if (!ghost.visible) return;
      rackSlidePosition(ghostTween.targets[0].to);
      const duration = reducedMotion || destroyed ? 0 : GHOST_RETURN_MS;
      ghostTween.start(performance.now(), duration).then(done => {
        if (done && !destroyed) {
          ghost.visible = false;
          requestRender();
        }
      });
    }
    // how: 'drop' (released while dragging), 'release' (released before it became a drag), 'cancel'
    function endDrag(how) {
      const dragged = slideDrag.phase === 'drag';
      const over = slideDrag.over;
      const hint = slideDrag.hint;
      if (over) highlight(over, false);
      slideDrag.phase = 'idle';
      slideDrag.over = null;
      slideDrag.hint = '';
      slideDrag.holds = false;
      if (!destroyed) endEdgePan();
      else edgePan.dir = edgePan.zone = 0;
      window.removeEventListener('keydown', onDragKey);
      try {
        if (canvas.hasPointerCapture(slideDrag.id)) canvas.releasePointerCapture(slideDrag.id);
      } catch {
        /* the pointer is already gone */
      }
      controls.enabled = slideDrag.saved;
      hideTag('drag');
      if (dragged) {
        canvas.style.cursor = '';
        call(api.onDragState, false); // before the step event: the drawer is back when the shell records it
      }
      const target = dragged && how === 'drop' && over && !hint ? over : null; // a procedure jar or a tray jar
      if (target)
        ghost.visible = false; // the rack itself travels when the shell records the step
      else if (dragged) returnGhost();
      if (!dragged) slideDrag.last = how === 'cancel' ? 'cancelled' : 'click';
      else if (target) slideDrag.last = target.kind === 'jar' ? target.id : `step:${target.step}`;
      else slideDrag.last = how === 'cancel' ? 'cancelled' : over ? 'refused' : 'nothing';
      requestRender();
      if (target && target.kind === 'jar') emitJar(target.jar);
      else if (target) emitStep(target.step);
    }
    // The camera is taken (a flight, a clip entry point): the drag ends, and an edge pan reports no
    // station, since the camera is going somewhere else.
    function cancelDrag() {
      if (slideDrag.phase === 'idle') return;
      edgePan.moved = false;
      endDrag('cancel');
    }
    function onDragKey(event) {
      if (event.key !== 'Escape' || slideDrag.phase === 'idle') return;
      endDrag('cancel');
      pointer.click = false; // the release that follows is not a click either
    }
    // A finger that lands on the rack drags the slide: the page does not scroll or zoom under it.
    function onTouchStart(event) {
      if (slideDrag.phase !== 'idle' && event.cancelable) event.preventDefault();
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerLeave);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('keydown', onTagKey, { capture: true });
    document.addEventListener('pointerdown', onDocPointerDown, { capture: true });
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    function onControlsChange() {
      controlsMoved = true;
      requestRender();
    }
    controls.addEventListener('change', onControlsChange);
    function onControlsStart() {
      orbiting = true;
    }
    function onControlsEnd() {
      orbiting = false;
    }
    controls.addEventListener('start', onControlsStart);
    controls.addEventListener('end', onControlsEnd);

    // ---------- lifecycle ----------
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      cancelFlight();
      rackTween.finish(false);
      slideTint.active = false;
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerLeave);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel, { capture: true });
      canvas.removeEventListener('pointerdown', onTouchDown, { capture: true });
      canvas.removeEventListener('pointerup', onTouchUp, { capture: true });
      canvas.removeEventListener('pointercancel', onTouchUp, { capture: true });
      canvas.removeEventListener('pointermove', onTouchGate, { capture: true });
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('keydown', onDragKey);
      window.removeEventListener('keydown', onTagKey, { capture: true });
      document.removeEventListener('pointerdown', onDocPointerDown, { capture: true });
      window.removeEventListener('scroll', onScroll, { capture: true });
      clearHint();
      tag.remove();
      ghostTween.finish(false);
      ghost.visible = false;
      scene.remove(ghost);
      ghostGeometry.dispose();
      ghostMaterial.dispose();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      document.removeEventListener('visibilitychange', onVisibility);
      controls.removeEventListener('change', onControlsChange);
      controls.removeEventListener('start', onControlsStart);
      controls.removeEventListener('end', onControlsEnd);
      if (observer) observer.disconnect();
      else window.removeEventListener('resize', resize);
      unwatchDpr();
      controls.dispose();
      // dispose() takes OrbitControls' Control-key listeners off canvas.getRootNode(), which is no
      // longer the document they were added to when the shell detached the stage before destroying.
      for (const [type, fn] of [
        ['keydown', controls._interceptControlDown],
        ['keyup', controls._interceptControlUp],
      ]) {
        if (typeof fn === 'function') document.removeEventListener(type, fn, { capture: true });
      }
      releaseSharedLut(); // before built.dispose(): it reads the material's renderer properties
      director.dispose();
      scene.remove(built.root);
      built.dispose();
      if (sun.shadow) sun.shadow.dispose();
      scene.environment = null;
      environment.dispose();
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (canvas.parentNode === container) container.removeChild(canvas);
      container.replaceChildren();
    }

    // three r186 samples one module-level DFG lookup texture from every MeshStandardMaterial and
    // renderer.dispose() leaves it uploaded. Releasing it here keeps renderer.info.memory at zero;
    // any later renderer simply uploads the 16x16 table again.
    function releaseSharedLut() {
      try {
        const props = renderer.properties.get(built.materials.benchTop);
        const lut = props && props.uniforms && props.uniforms.dfgLUT ? props.uniforms.dfgLUT.value : null;
        if (lut && lut.isTexture) lut.dispose();
      } catch {
        /* accounting only; the context is lost right after */
      }
    }

    function setReducedMotion(flag) {
      reducedMotion = !!flag;
      controls.enableDamping = !reducedMotion;
      if (reducedMotion) {
        if (camTween.active) {
          for (const t of camTween.targets) t.obj.copy(t.to);
          camTween.finish(true);
          controls.enabled = true;
          controls.update();
        }
        if (rackTween.active) {
          rackTween.targets[0].obj.copy(rackTween.targets[0].to);
          rackTween.finish(true);
        }
        if (slideTint.active) {
          slideTint.active = false;
          built.slideMaterial.color.copy(slideTint.to);
        }
      }
      requestRender();
    }

    function hotspots() {
      // §13.4: the tray's jars (kind 'jar', with their jar id) and the S9 sign only while the tray has jars
      return built.hotspots
        .filter(h => !h.off)
        .map(h => ({
          id: h.id,
          kind: h.kind,
          step: h.step,
          station: h.station,
          title: h.title,
          ...(h.kind === 'jar' ? { jar: h.jar } : null),
        }));
    }
    // The station signs on the canvas for the camera as it is now (the edge fade worked out afresh, so a
    // cut that has not been drawn yet counts). None inside the tissue or while the clip holds the camera.
    function visibleSigns() {
      if (director.active()) return [];
      fadeEdgeLabels();
      return signs
        .filter(sg => sg.station && sg.sprite.visible)
        .map(sg => sg.station)
        .sort((a, b) => stationIndex.get(a) - stationIndex.get(b)); // bench order (S9 stands between S5 and S6)
    }

    // Debug hooks for the dev harness and smoke tests (not part of the lab.js contract).
    const debug = {
      cameraPosition: () => camera.position.toArray(),
      target: () => controls.target.toArray(),
      pixelRatio: () => renderer.getPixelRatio(),
      dpr: () => ({
        device: window.devicePixelRatio || 1,
        applied: renderer.getPixelRatio(),
        query: dprQuery ? dprQuery.media : null,
      }),
      dprQuery: () => dprQuery,
      preset: id => presetFor(id),
      currentStation: () => currentStation,
      currentView: () => currentView,
      homeView: () => homeView, // I2: the view recenter() returns to
      band: () => frameBand(), // r4-p4-4: the share of the canvas a view is framed into now
      landedBand: () => (landed ? landed.band : null),
      rackStation: () => rackStation,
      rackOnScreen: () => !destroyed && rackOnScreen(),
      // dir: the pan under way (0 while the pointer is still dwelling); zone: the band the pointer is in.
      edgePan: () => ({
        dir: edgePan.dir,
        zone: edgePan.zone,
        dwell: edgePan.zone ? Math.round(performance.now() - edgePan.since) : 0,
        k: edgePan.k,
        moved: edgePan.moved,
        held: holdsPan(), // I4: over the next jar, which takes the slide, so no pan
      }),
      hoverPoint: () => ({ ...hoverPt }),
      // H6: what framing `list` would give: the rack's and the other stations' jars' target size (px, the
      // shorter side of each hit box) in that view, and the view key frameStations(list) flies to.
      pairTargets: list => {
        const preset = presetFor(list.join('+'));
        if (!preset || destroyed) return null;
        const away = dipSpots.filter(h => list.includes(h.station) && h.station !== rackStation);
        return {
          rack: Math.round(targetPx(rackHotspot.proxy, preset, rackTween.targets[0].to)),
          jars: Object.fromEntries(away.map(h => [dropKey(h), Math.round(targetPx(h.proxy, preset, null))])),
          key: pairOrRack(list),
        };
      },
      // H11: every sign as drawn now: station (null: the specimen tray's), text size on screen (px), growth,
      // shown, lines, and its screen box (client px).
      signs: () => {
        if (destroyed) return [];
        fadeEdgeLabels();
        const rect = canvas.getBoundingClientRect();
        return signs.map(sg => ({
          station: sg.station,
          text: Math.round(sg.text * sg.f * 10) / 10,
          grow: Math.round(sg.f * 100) / 100,
          shown: sg.sprite.visible,
          opacity: Math.round(sg.sprite.material.opacity * 100) / 100,
          lines: (sg.sprite.userData.label && sg.sprite.userData.label.lines) || [],
          box: sg.on
            ? [
                rect.left + ((sg.x - sg.hw * sg.f + 1) / 2) * rect.width,
                rect.top + ((1 - sg.y - sg.hh * sg.f) / 2) * rect.height,
                rect.left + ((sg.x + sg.hw * sg.f + 1) / 2) * rect.width,
                rect.top + ((1 - sg.y + sg.hh * sg.f) / 2) * rect.height,
              ]
            : null,
        }));
      },
      // The hotspot a click at client (x, y) would pick, and every proxy that ray crosses, nearest first.
      pickAt: (x, y) => {
        const rect = canvas.getBoundingClientRect();
        if (destroyed || !rect.width || !rect.height) return null;
        _ndc.set(((x - rect.left) / rect.width) * 2 - 1, -(((y - rect.top) / rect.height) * 2 - 1));
        const hit = pick();
        return hit ? hit.id : null;
      },
      hitsAt: (x, y) => {
        const rect = canvas.getBoundingClientRect();
        if (destroyed || !rect.width || !rect.height) return [];
        _ndc.set(((x - rect.left) / rect.width) * 2 - 1, -(((y - rect.top) / rect.height) * 2 - 1));
        _ray.setFromCamera(_ndc, camera);
        return _ray.intersectObjects(built.proxies, false).map(h => h.object.userData.hotspot.id);
      },
      // G2: the hotspots at client (x, y) whose own surface (not the proxy's padding) the ray meets.
      surfaceAt: (x, y) => {
        const rect = canvas.getBoundingClientRect();
        if (destroyed || !rect.width || !rect.height) return [];
        _ndc.set(((x - rect.left) / rect.width) * 2 - 1, -(((y - rect.top) / rect.height) * 2 - 1));
        _ray.setFromCamera(_ndc, camera);
        return built.hotspots.filter(h => !h.off && meetsSurface(h)).map(h => h.id);
      },
      info: () => {
        if (!destroyed) renderFrame();
        const r = renderer.info.render;
        const m = renderer.info.memory;
        return {
          calls: r.calls,
          triangles: r.triangles,
          points: r.points,
          geometries: m.geometries,
          textures: m.textures,
        };
      },
      memory: () => ({ geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
      // §13.4: the "Your jars" tray as drawn: its jars (id, label) in tray order, whether the tray and how many jar
      // glasses show, whether S9 is a station now, and each station's x along the bench.
      tray: () => {
        const t = built.jarTray;
        if (!t || destroyed) return null;
        return {
          jars: trayJars.map(j => ({ ...j })),
          tray: t.tray.visible,
          glasses: t.slots.filter(h => h.visuals[0].visible).length,
          station: stationIndex.has(JARS_STATION),
          order: [...stationIndex.keys()].sort((a, b) => stationIndex.get(a) - stationIndex.get(b)),
          xs: Object.fromEntries(built.stationXs),
        };
      },
      // Game layer: the hover tag ({ text, lines, visible, mode }) and the slide drag.
      tag: () => ({
        text: tagState.lines.join('\n'),
        lines: tagState.lines.slice(),
        visible: tagState.visible && !destroyed,
        mode: tagState.mode,
        form: tagState.form,
      }),
      // The lines a tag would show for hotspot `id` now (its title, then the verbs that apply).
      tagFor: id => {
        const h = built.hotspots.find(x => x.id === id && !x.off);
        if (!h || destroyed) return null;
        const model = hotspotTag(h);
        return [model.title, ...model.verbs];
      },
      // §11.4: the slides' material colour now ('#rrggbb'), the look tint set (null: the deposit tint), the
      // colour the ease is heading for, whether it is easing, and the material's opacity.
      slideTint: () => ({
        color: `#${built.slideMaterial.color.getHexString()}`,
        hex: slideTint.hex === null ? null : `#${slideTint.hex.toString(16).padStart(6, '0')}`,
        to: `#${(slideTint.hex === null ? slideBase : slideTint.hex).toString(16).padStart(6, '0')}`,
        easing: slideTint.active,
        opacity: built.slideMaterial.opacity,
        transparent: built.slideMaterial.transparent,
      }),
      dragState: () => ({
        phase: slideDrag.phase,
        pointerId: slideDrag.phase === 'idle' ? null : slideDrag.id,
        over: slideDrag.over ? dropKey(slideDrag.over) : null,
        hint: slideDrag.hint,
        ghost: ghost.visible,
        ghostPosition: ghost.position.toArray(),
        returning: ghostTween.active,
        controls: controls.enabled,
        allowed: canDrag(),
        last: slideDrag.last,
      }),
      raw: () => ({ renderer, scene, camera, controls, sun, built, director }),
      clip: null, // filled below: the director's debug hooks
      projectHotspot(id) {
        const hotspot = built.hotspots.find(h => h.id === id && !h.off);
        if (!hotspot || destroyed) return null;
        built.root.updateMatrixWorld(true);
        camera.updateMatrixWorld(true);
        hotspot.proxy.getWorldPosition(_v).project(camera);
        const rect = canvas.getBoundingClientRect();
        return {
          x: rect.left + ((_v.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - _v.y) / 2) * rect.height,
          depth: _v.z,
        };
      },
    };

    // ---------- tissue clip director (contract §7.1) ----------
    const director = createDirector({
      renderer,
      scene,
      camera,
      controls,
      canvas,
      built,
      api,
      requestRender,
      isReducedMotion: () => reducedMotion,
      touch,
      applyPreset: id => {
        const preset = presetFor(id);
        if (preset) applyPreset(id, preset);
      },
      markStation: id => {
        currentStation = id;
        currentView = id;
        // I2 (FIX5): the clip hands the camera back where it ended (the shell frames its view again, I3): that pose
        // counts as resting on the shell's view, so isAway() stays false until the student moves the camera
        landed = homeView
          ? { id: homeView, position: camera.position.clone(), target: controls.target.clone(), band: 1 }
          : null;
        if (stationIndex.has(id)) call(api.onStation, id);
      },
      rackStation: () => rackStation,
      cancelFlight,
    });
    debug.clip = director.debug;
    function projectPoint(x, y, z) {
      camera.updateMatrixWorld(true);
      _v.set(x, y, z).project(camera);
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + ((_v.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - _v.y) / 2) * rect.height,
        depth: _v.z,
      };
    }
    debug.projectPoint = projectPoint;
    debug.projectStructure = site => {
      const f = director.debug.focus(site);
      return f && director.inTissue() ? projectPoint(f[0], f[1], f[2]) : null;
    };

    // ---------- initial state ----------
    // G3: the bench opens on the view a step would have left it on: mid-run the rack's station and the
    // next jar's (frameStations' pair) when they differ, else the rack's station; a finished run (every
    // step done or skipped, as api.stepState says) at the microscope. Without api.stepState, the rack.
    // H6 (FIX4): a pair too far apart for PAIR_TARGET_PX targets opens on the rack's station alone.
    function openingView() {
      const rack = rackStation || 'S1';
      if (typeof api.stepState !== 'function') return rack;
      let next = null;
      let open = false;
      let done = false;
      for (const h of stepHotspots) {
        const state = readStepState(h.step);
        if (state === 'next' && !next) next = h;
        if (state === 'next' || state === 'todo') open = true;
        else if (state === 'done') done = true;
      }
      if (done && !open && stationIndex.has(FINISHED_STATION)) return FINISHED_STATION;
      if (next && stationIndex.has(next.station) && next.station !== rack) return pairOrRack([rack, next.station]);
      return rack;
    }
    container.replaceChildren(canvas, tag);
    controls.connect(canvas);
    canvas.style.touchAction = 'pan-y';
    syncJars(); // §13.4: the tray as the shell lists it, before the run places the rack
    resize();
    let initialRun;
    try {
      initialRun = typeof api.getRun === 'function' ? api.getRun() : null;
    } catch {
      initialRun = null;
    }
    applyRun(initialRun, false, false);
    const startView = openingView();
    applyPreset(startView, presetFor(startView));
    currentView = startView;
    currentStation = viewStations(startView).pop();
    homeView = startView; // I2: until the shell asks for a view, recenter() comes back here
    if (!document.hidden) startLoop();

    return {
      ok: true,
      element: canvas,
      destroy,
      goToStation: id => goToStation(id, true),
      frameStations,
      // I2 (FIX5): the camera has left the view the shell last asked for (the student turned, zoomed or panned
      // it, or a sign took it elsewhere); recenter() flies back there. The shell re-reads isAway() on
      // api.onViewChange(): at once when the camera leaves that view or comes back with nothing held, when the
      // view settles, and after each framing the shell asks for.
      isAway: () => isAway(),
      recenter: () => recenter(),
      // G1: the rack's centre is inside the canvas now (a drag can start from it). The shell's HUD asks
      // it whenever api.onViewChange() says the view settled.
      rackOnScreen: () => !destroyed && rackOnScreen(),
      // r3-left-shell-8 (FIX4): the stations whose sign is on the canvas now (drawn, not faded out at an
      // edge), in bench order: what "Click a sign" can reach. The shell re-reads it on api.onViewChange().
      visibleSigns: () => (destroyed ? [] : visibleSigns()),
      replay,
      setReducedMotion,
      setRun,
      // §11.4: tint the rack's slides with the look colour (SilverLab.LOOK_COLORS[look.key]) over SLIDE_TINT_MS
      // (a cut under reduced motion); null brings the deposit tint back the same way.
      setSlideTint,
      hotspots,
      // the stations on the bench now (S9, "Your jars", only while the tray has jars)
      stations: () =>
        stations.filter(s => stationIndex.has(s.id)).map(s => ({ id: s.id, title: s.title, steps: s.steps.slice() })),
      // §13.4: re-read api.extraJars() after any change to the shell's extra jars or a jar's contents: the "Your jars"
      // tray at S9 draws the listed jars (none: no tray, no sign, no S9), the rack follows a dip into a jar that came
      // or went, and a showing tag re-reads api.jarLabel. Returns the ids drawn ([] after destroy()).
      refreshJars,
      // Tissue clip (contract §7.1): intro around the specimen tray, dive into the S6 eyepiece.
      intro: () => !destroyed && director.intro(),
      dive: (run, outcome, frames) => !destroyed && director.dive(run, outcome, frames),
      explore: () => !destroyed && director.explore(),
      leaveExplore: () => !destroyed && director.leaveExplore(),
      surface: () => !destroyed && director.surface(),
      seek: sceneId => !destroyed && director.seek(sceneId),
      skip: () => !destroyed && director.skip(),
      play: () => !destroyed && director.play(),
      pause: () => !destroyed && director.pause(),
      clipState: () => (destroyed ? { ...CLIP_REST } : director.state()),
      scenes: () => (destroyed ? [] : director.scenes()),
      setClip: clip => !destroyed && director.setClip(clip),
      debug,
    };
  }
}
