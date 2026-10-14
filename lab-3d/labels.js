// Text sprites for the 3D bench. The only text allowed inside the canvas is a station title
// (or a step title); callers are responsible for passing nothing else. Each label owns one
// CanvasTexture and one SpriteMaterial; dispose both through disposeLabel().
import * as THREE from 'three';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", sans-serif';

// A sign's text never shrinks below the size a short title gets: a long title wraps to two lines on a
// taller plate, and a line still too long widens the plate up to SIGN_MAX_WIDEN (H11, FIX4).
const TEXT_SIZE = 0.46; // of the 4:1 plate's height
const LINE_HEIGHT = 1.12; // of the text size
const SIGN_MAX_WIDEN = 1.5;

/**
 * Build a sprite showing `text` as a paper-white plate with a warm hairline border and near-black text
 * (the lab page's card look). The plate is 4:1; `px` is its texture width. A label shrinks its text until
 * it fits. `sign: true` (the bench's station and specimen signs) keeps the text at the size a short
 * title gets instead: a title too long for one line wraps to two at a space (the plate grows taller)
 * and a line still too long widens the plate; the sprite's scale follows the plate's shape.
 * `userData.label.fontWorld` is the text size in world units (bench.js keeps a sign readable with it).
 * Returns null when a 2D canvas context is not available (the scene then has no label).
 */
export function makeLabelSprite(text, { widthWorld = 0.84, px = 1280, sign = false } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const label = String(text || '');
  const h0 = px / 4;
  const pad = h0 * 0.16;
  let size = h0 * TEXT_SIZE;
  const font = s => `600 ${s}px ${FONT_STACK}`;
  ctx.font = font(size);
  const width = t => ctx.measureText(t).width;
  let lines = [label];
  let w = px;
  if (sign && width(label) > px - pad * 2) {
    lines = splitTwo(label, width, px * SIGN_MAX_WIDEN - pad * 2) || lines;
    const widest = Math.max(...lines.map(width));
    w = Math.min(Math.round(px * SIGN_MAX_WIDEN), Math.max(px, Math.ceil(widest + pad * 2)));
  }
  while (size > 18 && Math.max(...lines.map(width)) > w - pad * 2) {
    size -= 4;
    ctx.font = font(size);
  }
  const h = lines.length > 1 ? Math.ceil(pad * 2 + size * LINE_HEIGHT * lines.length) : h0;
  canvas.width = w;
  canvas.height = h;
  const border = Math.max(2, Math.round(h0 / 90));
  const radius = h0 * 0.07;

  ctx.clearRect(0, 0, w, h);
  // The lab page's card: paper white, its warm hairline (lab.css --line-bright), near-black text that
  // leans brown rather than blue (--text there).
  ctx.fillStyle = '#fffdf9';
  ctx.strokeStyle = '#cdbfa6';
  ctx.lineWidth = border;
  roundRect(ctx, border / 2, border / 2, w - border, h - border, radius);
  ctx.fill();
  ctx.stroke();

  ctx.font = font(size); // resizing the canvas reset the context
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#17150f';
  const step = size * LINE_HEIGHT;
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * step + size * 0.04));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  // Not tone mapped: the plate is paper white and the text near-black, like the page.
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  const unit = widthWorld / px; // world units per texture px
  sprite.scale.set(w * unit, h * unit, 1);
  sprite.userData.label = { texture, material, baseColor: material.color.getHex(), fontWorld: size * unit, lines };
  return sprite;
}

// Two lines split at a space; null when there is none. A split that keeps both lines within `room` and
// puts a joining word at the start of the second line ("Ammoniacal silver / and develop") or a slash at
// the end of the first ("Notebook /" over "whiteboard") wins; among equals, the one whose wider line is narrowest.
const JOINS = new Set(['and', '+', '&', 'or']);
function splitTwo(text, width, room) {
  let best = null;
  let bestScore = Infinity;
  for (let i = text.indexOf(' '); i > 0; i = text.indexOf(' ', i + 1)) {
    const pair = [text.slice(0, i).trim(), text.slice(i + 1).trim()];
    if (!pair[0] || !pair[1]) continue;
    const widest = Math.max(width(pair[0]), width(pair[1]));
    const joined = JOINS.has(pair[1].split(' ')[0].toLowerCase()) || pair[0].endsWith('/');
    const score = widest + (widest <= room && joined ? 0 : 1e6);
    if (score < bestScore) {
      bestScore = score;
      best = pair;
    }
  }
  return best;
}

export function disposeLabel(sprite) {
  const info = sprite && sprite.userData && sprite.userData.label;
  if (!info) return;
  info.texture.dispose();
  info.material.dispose();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
