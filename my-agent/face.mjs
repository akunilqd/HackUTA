// The picture your caller sees: one RGBA frame per call to drawFace. Replace this file to show anything you like.
// Odyssey's dog as a cartoon: a scruffy cream terrier with huge orange ears, in a Greek seaside scene whose sky follows
// the patient's time of day. react() switches its mood when something happens in the call. Plain JavaScript, no dependencies.
import { GLYPHS as CAPTION_GLYPHS } from './lib/caption-font.mjs';

export const WIDTH = 540;
export const HEIGHT = 960;
export const FPS = 15;

const W = WIDTH, H = HEIGHT;

// ---------------------------------------------------------------------------------------------------------------------
// A tiny anti-aliased vector rasteriser: filled polygons (non-zero winding, 4 sub-scanlines, exact horizontal coverage).

const canvas = new Uint8ClampedArray(W * H * 4);
let target = canvas; // where fill() draws; swapped briefly to render the caption mask
const COV = new Float32Array(W + 2);
const SS = 4;
const MAX_EDGES = 8192;
const EX0 = new Float64Array(MAX_EDGES), EY0 = new Float64Array(MAX_EDGES), EX1 = new Float64Array(MAX_EDGES), EY1 = new Float64Array(MAX_EDGES);
const ED = new Int8Array(MAX_EDGES), XS = new Float64Array(MAX_EDGES), XD = new Int8Array(MAX_EDGES);

/** Fills one polygon (flat [x0, y0, x1, y1, ...]) or several (array of those, unioned) in screen pixels. */
function fill(poly, color, alpha = 1) {
  if (!(alpha > 0.003)) return;
  const contours = typeof poly[0] === 'number' ? [poly] : poly;
  let ne = 0, minY = Infinity, maxY = -Infinity;
  for (const p of contours) {
    const n = p.length >> 1;
    for (let i = 0; i < n && ne < MAX_EDGES; i++) {
      const j = i + 1 === n ? 0 : i + 1;
      const ax = p[2 * i], ay = p[2 * i + 1], bx = p[2 * j], by = p[2 * j + 1];
      if (ay < minY) minY = ay;
      if (ay > maxY) maxY = ay;
      if (ay === by) continue;
      if (ay < by) { EX0[ne] = ax; EY0[ne] = ay; EX1[ne] = bx; EY1[ne] = by; ED[ne] = 1; }
      else { EX0[ne] = bx; EY0[ne] = by; EX1[ne] = ax; EY1[ne] = ay; ED[ne] = -1; }
      ne++;
    }
  }
  const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(H - 1, Math.floor(maxY));
  const r = color[0], g = color[1], b = color[2];
  for (let y = y0; y <= y1; y++) {
    let lo = W, hi = -1;
    for (let s = 0; s < SS; s++) {
      const sy = y + (s + 0.5) / SS;
      let nx = 0;
      for (let e = 0; e < ne; e++) {
        if (sy < EY0[e] || sy >= EY1[e]) continue;
        const x = EX0[e] + (sy - EY0[e]) * (EX1[e] - EX0[e]) / (EY1[e] - EY0[e]);
        let k = nx++;
        while (k > 0 && XS[k - 1] > x) { XS[k] = XS[k - 1]; XD[k] = XD[k - 1]; k--; }
        XS[k] = x; XD[k] = ED[e];
      }
      let wind = 0;
      for (let k = 0; k < nx - 1; k++) {
        wind += XD[k];
        if (wind === 0) continue;
        let xa = XS[k], xb = XS[k + 1];
        if (xb <= 0 || xa >= W) continue;
        if (xa < 0) xa = 0;
        if (xb > W - 1e-6) xb = W - 1e-6;
        if (xb <= xa) continue;
        const ia = xa | 0, ib = xb | 0;
        if (ia === ib) COV[ia] += (xb - xa) / SS;
        else {
          COV[ia] += (ia + 1 - xa) / SS;
          for (let m = ia + 1; m < ib; m++) COV[m] += 1 / SS;
          COV[ib] += (xb - ib) / SS;
        }
        if (ia < lo) lo = ia;
        if (ib > hi) hi = ib;
      }
    }
    for (let x = lo; x <= hi; x++) {
      const c = COV[x];
      if (c <= 0) continue;
      COV[x] = 0;
      const a = (c > 1 ? 1 : c) * alpha;
      const i = (y * W + x) * 4;
      target[i] += (r - target[i]) * a;
      target[i + 1] += (g - target[i + 1]) * a;
      target[i + 2] += (b - target[i + 2]) * a;
    }
  }
}

/** Solid horizontal rows, for the sky and sea gradients. */
function fillRow(y, color) {
  for (let x = 0, i = y * W * 4; x < W; x++, i += 4) { canvas[i] = color[0]; canvas[i + 1] = color[1]; canvas[i + 2] = color[2]; canvas[i + 3] = 255; }
}

// 2D affine transforms [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f.
const T = (x, y) => [1, 0, 0, 1, x, y];
const R = deg => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
const S = (sx, sy = sx) => [sx, 0, 0, sy, 0, 0];
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
/** chain(A, B, C) applies C first, then B, then A. */
const chain = (...ms) => ms.reduce(mul);
const xf = (m, p) => {
  const o = new Array(p.length);
  for (let i = 0; i < p.length; i += 2) { o[i] = m[0] * p[i] + m[2] * p[i + 1] + m[4]; o[i + 1] = m[1] * p[i] + m[3] * p[i + 1] + m[5]; }
  return o;
};

const ellipse = (cx, cy, rx, ry, n = 28) => {
  const o = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; o.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a)); }
  return o;
};

/** Smooth closed curve through [x, y, sharp?] points (Catmull-Rom); a truthy third value makes that point a corner. */
function curve(pts, seg = 7) {
  const n = pts.length, out = [];
  const tangent = i => {
    const p = pts[(i + n) % n];
    if (p[2]) return [0, 0];
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    return [(b[0] - a[0]) * 0.5, (b[1] - a[1]) * 0.5];
  };
  for (let i = 0; i < n; i++) {
    const p0 = pts[i], p1 = pts[(i + 1) % n], m0 = tangent(i), m1 = tangent(i + 1);
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      out.push(h00 * p0[0] + h10 * m0[0] + h01 * p1[0] + h11 * m1[0], h00 * p0[1] + h10 * m0[1] + h01 * p1[1] + h11 * m1[1]);
    }
  }
  return out;
}

/** A round-capped line through screen points [x0, y0, x1, y1, ...], as contours for fill(). */
function strokeShape(p, width) {
  const hw = width / 2, out = [], n = p.length >> 1, caps = hw > 6 ? 18 : 10;
  for (let i = 0; i < n - 1; i++) {
    const ax = p[2 * i], ay = p[2 * i + 1], bx = p[2 * i + 2], by = p[2 * i + 3];
    const l = Math.hypot(bx - ax, by - ay);
    if (l < 1e-6) continue;
    const nx = -(by - ay) / l * hw, ny = (bx - ax) / l * hw;
    out.push([ax - nx, ay - ny, bx - nx, by - ny, bx + nx, by + ny, ax + nx, ay + ny]);
  }
  for (let i = 0; i < n; i++) out.push(ellipse(p[2 * i], p[2 * i + 1], hw, hw, caps));
  return out;
}

const scaleOf = m => Math.hypot(m[0], m[1]);
const stroke = (m, pts, width, color, alpha = 1) => fill(strokeShape(xf(m, pts.flat()), width * scaleOf(m)), color, alpha);

const clamp01 = t => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ---------------------------------------------------------------------------------------------------------------------
// Time of day: the sky, sea, land and the light falling on the dog, interpolated between key hours.

const HOURS = [
  { h: 0, top: [8, 12, 38], hor: [28, 36, 78], sea: [18, 28, 60], hill: [22, 28, 54], ground: [52, 48, 66], light: [0.8, 0.82, 0.96], night: 1 },
  { h: 5.2, top: [14, 20, 52], hor: [60, 60, 110], sea: [30, 40, 80], hill: [34, 38, 70], ground: [70, 62, 82], light: [0.84, 0.85, 0.96], night: 1 },
  { h: 6.4, top: [74, 92, 156], hor: [255, 172, 132], sea: [112, 122, 162], hill: [86, 84, 122], ground: [150, 122, 116], light: [0.94, 0.86, 0.86], night: 0.25 },
  { h: 8, top: [100, 172, 236], hor: [255, 230, 196], sea: [78, 160, 204], hill: [96, 142, 118], ground: [218, 198, 164], light: [1, 0.97, 0.93], night: 0 },
  { h: 12, top: [62, 152, 236], hor: [188, 226, 252], sea: [28, 132, 192], hill: [86, 140, 100], ground: [228, 210, 174], light: [1, 1, 1], night: 0 },
  { h: 16.5, top: [88, 160, 228], hor: [255, 238, 196], sea: [48, 140, 192], hill: [104, 140, 100], ground: [224, 200, 156], light: [1, 0.97, 0.9], night: 0 },
  { h: 18.6, top: [74, 68, 138], hor: [255, 140, 80], sea: [150, 94, 110], hill: [90, 60, 90], ground: [182, 128, 104], light: [1, 0.88, 0.8], night: 0.15 },
  { h: 20.2, top: [28, 28, 76], hor: [126, 72, 112], sea: [52, 50, 92], hill: [40, 36, 72], ground: [90, 72, 90], light: [0.88, 0.84, 0.94], night: 0.7 },
  { h: 22, top: [10, 14, 40], hor: [30, 38, 80], sea: [20, 30, 62], hill: [24, 30, 56], ground: [54, 50, 68], light: [0.8, 0.82, 0.96], night: 1 },
];
HOURS.push({ ...HOURS[0], h: 24 });

function sceneAt(hour) {
  hour = Number.isFinite(hour) ? ((hour % 24) + 24) % 24 : 12; // 24:00 is midnight; anything unreadable is noon
  let i = 0;
  while (HOURS[i + 1].h <= hour) i++;
  const a = HOURS[i], b = HOURS[i + 1], t = smooth((hour - a.h) / (b.h - a.h));
  const out = { hour };
  for (const k of Object.keys(a)) if (k !== 'h') out[k] = typeof a[k] === 'number' ? lerp(a[k], b[k], t) : mix(a[k], b[k], t);
  return out;
}

let timezone, hourOverride = Number.isFinite(Number.parseFloat(process.env.FACE_HOUR)) ? Number.parseFloat(process.env.FACE_HOUR) : null;
let hourCache = { at: -1, hour: 12 };

function currentHour() {
  if (hourOverride !== null) return hourOverride;
  const now = Date.now();
  if (now - hourCache.at < 1000) return hourCache.hour;
  let hour;
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(now));
    hour = Number(parts.find(p => p.type === 'hour').value) + Number(parts.find(p => p.type === 'minute').value) / 60;
  } catch {
    const d = new Date(now);
    hour = d.getHours() + d.getMinutes() / 60;
  }
  hourCache = { at: now, hour };
  return hour;
}

// Portrait layout (FaceTime on a phone is upright): tall sky on top, sea across the middle, a stone terrace below.
const HORIZON = 520, GROUND = 700;
const STARS = Array.from({ length: 60 }, (_, i) => {
  const r = n => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  return { x: r(1) * W, y: r(2) * HORIZON * 0.62, size: 0.8 + r(3) * 1.5, phase: r(4) * 6.28 };
});
const CLOUDS = [
  { x: 20, y: 130, s: 1.3, speed: 0.22 }, { x: 300, y: 64, s: 1, speed: 0.15 }, { x: 470, y: 230, s: 1.15, speed: 0.28 }, { x: 700, y: 330, s: 0.8, speed: 0.12 },
];
const CLOUD_PUFFS = [[0, 0, 34, 18], [-30, 6, 24, 13], [30, 5, 26, 14], [10, -12, 22, 15], [-12, -8, 18, 12]];
const HILL_LEFT = curve([[-20, HORIZON + 2, 1], [24, HORIZON - 34], [100, HORIZON - 46], [180, HORIZON - 22], [236, HORIZON + 2, 1]], 8);
const HILL_RIGHT = curve([[318, HORIZON + 2, 1], [384, HORIZON - 22], [464, HORIZON - 36], [560, HORIZON - 26, 1], [560, HORIZON + 2, 1]], 8);
// The temple and the olive tree are drawn in the old landscape coordinates and placed with these transforms.
const TEMPLE_M = chain(T(404, HORIZON - 18), S(0.82), T(-456, -200));
// An old olive tree, like the one Odysseus built his bed around: a gnarled, twisting trunk that splits into
// branches, silver-green leaves in clusters that sway, and dark olives. Drawn in screen pixels at the left edge.
const OLIVE_TRUNK = curve([[2, GROUND + 2, 1], [16, GROUND - 26], [8, GROUND - 62], [24, GROUND - 104], [14, GROUND - 140], [30, GROUND - 168],
  [44, GROUND - 186], [58, GROUND - 168], [50, GROUND - 132], [64, GROUND - 96], [52, GROUND - 58], [70, GROUND - 22], [84, GROUND + 2, 1]], 6);
const OLIVE_BRANCHES = [ // [points, width]
  [[44, GROUND - 176, 70, GROUND - 204, 96, GROUND - 222, 118, GROUND - 228], 9],
  [[30, GROUND - 160, 14, GROUND - 196, 2, GROUND - 222], 7],
  [[52, GROUND - 184, 50, GROUND - 216, 58, GROUND - 244], 6],
];
const OLIVE_BARK = [ // lighter streaks that follow the twist of the trunk
  [20, GROUND - 4, 26, GROUND - 40, 18, GROUND - 80, 30, GROUND - 120], [56, GROUND - 6, 46, GROUND - 50, 54, GROUND - 100, 40, GROUND - 150],
  [38, GROUND - 20, 36, GROUND - 70, 44, GROUND - 110],
];
const OLIVE_CLUSTERS = [[-6, GROUND - 214, 24], [26, GROUND - 238, 26], [62, GROUND - 258, 24], [100, GROUND - 238, 26], [124, GROUND - 216, 20], [10, GROUND - 268, 20], [84, GROUND - 278, 18]];
const OLIVE_LEAVES = OLIVE_CLUSTERS.flatMap(([cx, cy, r], c) => Array.from({ length: 13 }, (_, i) => {
  const rnd = n => { const v = Math.sin((c * 13 + i) * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
  const a = rnd(1) * Math.PI * 2, d = Math.sqrt(rnd(2)) * r;
  return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.7, angle: rnd(3) * 180 - 90, silver: rnd(4) < 0.35, cluster: c };
}));
const OLIVES = OLIVE_CLUSTERS.flatMap(([cx, cy, r], c) => [[cx - r * 0.3, cy + r * 0.35], [cx + r * 0.4, cy + r * 0.2]]);

// Drawn 1.3x larger around its foot and nudged left, so the crown rises into the open sky left of the dog's ear.
const OLIVE_M = chain(T(-16, GROUND), S(1.3), T(0, -GROUND));

function drawOliveTree(tick, lit) {
  const M = OLIVE_M, k = scaleOf(M);
  const sway = c => 1.6 * Math.sin(tick * 0.07 + c * 0.9);
  fill(xf(M, OLIVE_TRUNK), lit([96, 80, 66]));
  for (const [points, width] of OLIVE_BRANCHES) fill(strokeShape(xf(M, points), width * k), lit([96, 80, 66]));
  for (const streak of OLIVE_BARK) fill(strokeShape(xf(M, streak), 2.4 * k), lit([138, 118, 96]), 0.55);
  fill(xf(M, ellipse(42, GROUND + 2, 46, 6, 18)), [0, 0, 0], 0.15);           // shade at the foot of the trunk
  // Each cluster: a dark mass for depth, then single leaves that flutter, some showing their silver undersides.
  fill(OLIVE_CLUSTERS.map(([cx, cy, r], c) => xf(M, ellipse(cx + sway(c), cy, r * 1.05, r * 0.72, 20))), lit([84, 104, 72]));
  const leaf = (l, rx, ry) => xf(chain(M, T(l.x + sway(l.cluster), l.y), R(l.angle + 7 * Math.sin(tick * 0.11 + l.x))), ellipse(0, 0, rx, ry, 10));
  fill(OLIVE_LEAVES.filter(l => !l.silver).map(l => leaf(l, 8, 2.8)), lit([128, 150, 104]));
  fill(OLIVE_LEAVES.filter(l => l.silver).map(l => leaf(l, 8, 2.6)), lit([186, 198, 164]));
  fill(OLIVES.map(([x, y], i) => xf(M, ellipse(x + sway(Math.floor(i / 2)), y, 2.6, 3.3, 10))), lit([64, 44, 66]));
}
const TEMPLE = [
  [462, 140, 530, 120, 600, 140], [462, 140, 600, 140, 600, 149, 462, 149], [456, 192, 606, 192, 606, 200, 456, 200],
  ...[0, 1, 2, 3, 4, 5].map(i => { const x = 474 + i * 22; return [x, 149, x + 8, 149, x + 8, 192, x, 192]; }),
];

// ---- Odyssey details: Odysseus's ship, dolphins, gulls, wave crests, a Greek-key border and amphorae.
// Local shapes face right, with y = 0 at the waterline (ship, dolphin) or the foot (amphora).
const SHIP_HULL = curve([[-62, -24, 1], [-48, -2], [-20, 10], [20, 10], [48, 0], [70, -20, 1], [56, -8], [0, -4], [-46, -8]], 6);
const SHIP_SAIL = curve([[-26, -66, 1], [26, -66, 1], [28, -46], [24, -30, 1], [-24, -30, 1], [-28, -46]], 4);
const SHIP_STRIPES = [-18, -6, 6, 18].map(x => [x - 4, -65, x + 4, -65, x + 4, -31, x - 4, -31]);
const DOLPHIN = [
  // A round melon head and a short beak, so it reads as a friendly dolphin rather than a shark.
  curve([[-26, 0], [-12, -7], [4, -10], [14, -9], [20, -6], [24, -3], [31, -2, 1], [24, 0], [16, 3], [0, 6], [-18, 4]], 5),
  curve([[-6, -8], [-4, -13], [1, -15, 1], [0, -11], [5, -8]], 3),   // small dorsal fin curving back
  [-24, 0, -33, -7, -29, 0, -33, 7],                                  // tail fluke
];
const AMPHORA = curve([[-14, -100, 1], [14, -100, 1], [9, -88], [30, -70], [34, -45], [16, -12], [12, 0, 1], [-12, 0, 1], [-16, -12], [-34, -45], [-30, -70], [-9, -88]], 6);
const AMPHORA_BAND = curve([[-31, -63, 1], [31, -63, 1], [34, -48], [32, -36, 1], [-32, -36, 1], [-34, -48]], 4);
const AMPHORA_SHADE = curve([[4, -98, 1], [14, -100, 1], [9, -88], [30, -70], [34, -45], [16, -12], [12, 0, 1], [6, 0, 1], [18, -40], [16, -72]], 6);
// A Greek key (meander) running along the front edge of the terrace: a baseline with a square spiral every 20 px.
const KEY_Y = GROUND + 12, KEY_H = 16;
const MEANDER = (() => {
  const contours = [...strokeShape([-4, KEY_Y + KEY_H, W + 4, KEY_Y + KEY_H], 2.6), ...strokeShape([-4, KEY_Y - 4, W + 4, KEY_Y - 4], 2.6)];
  for (let x = 0; x < W; x += 20) {
    contours.push(...strokeShape([x, KEY_Y + KEY_H, x, KEY_Y, x + 16, KEY_Y, x + 16, KEY_Y + 11, x + 6, KEY_Y + 11, x + 6, KEY_Y + 5, x + 11, KEY_Y + 5], 2.6));
  }
  return contours;
})();
const WAVE_CRESTS = Array.from({ length: 16 }, (_, i) => ({ x: (i * 97) % W, y: HORIZON + 22 + ((i * 53) % 150), w: 8 + (i % 4) * 3, speed: 0.08 + (i % 3) * 0.04, phase: i * 1.7 }));
const GULLS = [{ x: 60, y: 300, speed: 0.55 }, { x: 260, y: 360, speed: 0.4 }, { x: 420, y: 250, speed: 0.48 }];

// The Trojan Horse, Odysseus's own idea, on a little beach on the right shore. Local shape faces left,
// y = 0 at the bottom of the wheels.
const BEACH = curve([[404, HORIZON - 2, 1], [560, HORIZON - 2, 1], [560, HORIZON + 46, 1], [522, HORIZON + 42], [474, HORIZON + 32], [434, HORIZON + 16], [412, HORIZON + 4]], 6);
const HORSE_BODY = curve([[-28, -66], [8, -70], [38, -66], [46, -54], [38, -40], [6, -36], [-24, -40], [-32, -52]], 6);
const HORSE_NECK = [-30, -62, -16, -66, -28, -104, -44, -98];
const HORSE_HEAD = curve([[-44, -102], [-30, -108], [-26, -100], [-40, -90], [-60, -82], [-66, -88, 1], [-58, -96]], 5);
const HORSE_MANE = [-27, -106, -20, -100, -24, -96, -16, -90, -20, -84, -12, -78, -16, -72, -8, -68, -14, -64, -24, -100];
const HORSE_LEGS = [[-22, -12], [-10, -12], [24, -12], [34, -12]].map(([x]) => [x - 3.5, -42, x + 3.5, -42, x + 3, -12, x - 3, -12]);

function drawTrojanHorse(tick, lit) {
  const wood = lit([180, 128, 74]), dark = lit([118, 78, 44]), light = lit([214, 168, 110]);
  const m = chain(T(486, HORIZON + 29), S(0.78));
  fill(xf(m, ellipse(4, 1, 58, 5, 18)), [0, 0, 0], 0.18);                                // shadow on the sand
  fill(HORSE_LEGS.slice(1, 3).map(leg => xf(m, leg)), dark);                             // far legs, darker
  fill(xf(m, [-50, -14, 54, -14, 54, -6, -50, -6]), dark);                               // the wheeled platform
  for (const wx of [-36, 2, 40]) {
    fill(xf(m, ellipse(wx, -3, 8, 8, 16)), lit([84, 56, 34]));
    fill(xf(m, ellipse(wx, -3, 2.5, 2.5, 8)), light);
  }
  fill([HORSE_LEGS[0], HORSE_LEGS[3]].map(leg => xf(m, leg)), wood);                     // near legs
  fill(xf(m, HORSE_BODY), wood);
  fill(xf(m, HORSE_NECK), wood);
  fill(xf(m, HORSE_HEAD), wood);
  fill(xf(m, [-31, -104, -27, -114, -24, -103]), wood);                                  // ear
  fill(strokeShape(xf(m, HORSE_MANE), 2.2), dark);
  fill(strokeShape(xf(m, [44, -58, 52, -46, 50, -32]), 4 * 0.78), dark);                // tail
  for (const py of [-62, -55, -48, -42]) fill(strokeShape(xf(m, [-28, py, 42, py]), 1), dark, 0.55); // planks
  fill(strokeShape(xf(m, [-2, -50, 14, -50, 14, -40, -2, -40, -2, -50]), 1.4), dark);   // the hidden hatch in its belly
  fill(xf(m, ellipse(-42, -97, 2, 2, 8)), lit([40, 28, 20]));                            // eye
  fill(xf(m, curve([[-26, -68], [8, -70], [36, -66], [8, -64], [-20, -62]], 4)), light, 0.6); // light along its back
}

function drawShip(tick, lit) {
  // At anchor in the open water, bottom right, bow towards the shore: sailing across, it slid behind the dog's
  // head and only its curled prow showed, which looked like a stray line.
  const x = 496 + 4 * Math.sin(tick * 0.02), y = HORIZON + 128 + 2 * Math.sin(tick * 0.12);
  const m = chain(T(x, y), S(-1, 1), R(2 * Math.sin(tick * 0.1)), S(0.62));
  fill(strokeShape(xf(m, [58, -6, 74, 22]), 1.4), lit([92, 62, 40]));                 // anchor rope
  for (let i = 0; i < 6; i++) { // oars resting in the water
    const ox = -34 + i * 13;
    fill(strokeShape(xf(m, [ox, -4, ox - 10, 12]), 1.6), lit([92, 62, 40]));
  }
  fill(xf(m, SHIP_HULL), lit([112, 70, 42]));
  fill(xf(m, [-46, -8, 56, -8, 52, -4, -44, -4]), lit([150, 98, 58]));          // a lighter strake along the deck
  fill(xf(m, ellipse(52, -10, 4.5, 3, 12)), lit([246, 240, 228]));              // the painted eye on the prow
  fill(xf(m, ellipse(53, -10, 2, 2, 10)), lit([30, 24, 20]));
  fill(xf(m, [-2, -4, 2, -4, 2, -74, -2, -74]), lit([92, 62, 40]));            // mast
  fill(xf(m, SHIP_SAIL), lit([244, 232, 208]));
  fill(SHIP_STRIPES.map(stripe => xf(m, stripe)), lit([186, 56, 44]));
  fill(strokeShape(xf(m, [-30, -66, 30, -66]), 2.4), lit([92, 62, 40]));       // yard
}

function drawDolphin(tick, lit) {
  const period = 200, age = tick % period, leap = 26;
  if (age >= leap) return;
  const cycle = Math.floor(tick / period), left = cycle % 2 === 0;
  const t = age / leap, x0 = left ? 430 : 476, dx = left ? 46 : -46; // open water right of the dog; direction alternates
  const x = x0 + dx * t, y = HORIZON + 96 - Math.sin(Math.PI * t) * 40;
  const slope = -Math.cos(Math.PI * t) * 40 * Math.PI / Math.abs(dx);          // dy/dx of the arc
  const angle = Math.atan(slope) * 180 / Math.PI * (left ? 1 : -1);
  const m = chain(T(x, y), S(left ? 1 : -1, 1), R(angle), S(0.9));
  fill(DOLPHIN.map(poly => xf(m, poly)), lit([92, 124, 156]));
  fill(xf(m, ellipse(15, -4.5, 1.6, 1.6, 8)), lit([24, 30, 40]));                // eye
  fill(xf(m, curve([[-18, 2], [0, 3], [16, 1], [6, 4.5], [-12, 4.5]], 3)), lit([214, 226, 236]), 0.8); // pale belly
  for (const edge of [0, 1]) { // splashes where it leaves and re-enters the water
    const near = 1 - Math.abs(t - edge) * 5;
    if (near > 0) fill([0, 1, 2].map(k => ellipse(x0 + dx * edge + (k - 1) * 7, HORIZON + 98 - k * 3, 3, 2, 8)), [240, 248, 255], 0.7 * near);
  }
}

function drawAmphora(x, y, scale, lit) {
  const m = chain(T(x, y), S(scale));
  fill(xf(m, ellipse(0, 2, 30, 6, 18)), [0, 0, 0], 0.18);                       // shadow on the terrace
  for (const side of [-1, 1]) fill(strokeShape(xf(m, [side * 9, -88, side * 24, -94, side * 28, -76]), 4.5 * scale), lit([168, 84, 44]));
  fill(xf(m, AMPHORA), lit([200, 106, 58]));
  fill(xf(m, AMPHORA_BAND), lit([40, 28, 24]));
  // A running wave pattern in the black band, in the clay colour, as on black-figure pottery.
  fill(strokeShape(xf(m, [-28, -44, -22, -55, -16, -44, -10, -55, -4, -44, 2, -55, 8, -44, 14, -55, 20, -44, 26, -55]), 2.2 * scale), lit([214, 120, 66]));
  fill(strokeShape(xf(m, [-30, -59, 30, -59]), 1.4 * scale), lit([214, 120, 66]));
  fill(strokeShape(xf(m, [-31, -40, 31, -40]), 1.4 * scale), lit([214, 120, 66]));
  fill(xf(m, AMPHORA_SHADE), [60, 20, 10], 0.22);
  fill(xf(m, ellipse(-16, -60, 5, 16, 12)), [255, 240, 220], 0.22);
}

function drawScene(scene, tick) {
  const light = scene.light, lit = c => [c[0] * light[0], c[1] * light[1], c[2] * light[2]];
  for (let y = 0; y < HORIZON; y++) fillRow(y, mix(scene.top, scene.hor, Math.pow(y / HORIZON, 1.4)));

  const nightness = scene.night;
  if (nightness > 0.02) {
    for (const s of STARS) {
      const twinkle = 0.55 + 0.45 * Math.sin(tick * 0.13 + s.phase);
      fill(ellipse(s.x, s.y, s.size, s.size, 8), [255, 250, 225], nightness * twinkle);
    }
  }

  // Sun from 6:00 to 19:00, moon from 19:00 to 6:00, each on an arc over the sea.
  const h = scene.hour, arcHeight = HORIZON - 120;
  let glint;
  if (h >= 5.6 && h <= 19.4) {
    const t = (h - 6) / 13, x = 40 + 460 * t, y = HORIZON + 26 - Math.sin(Math.PI * clamp01(t)) * arcHeight;
    const low = 1 - Math.sin(Math.PI * clamp01(t));
    const color = mix([255, 244, 196], [255, 140, 64], smooth(low * 1.4));
    for (const [k, a] of [[2.8, 0.08], [1.9, 0.12], [1.35, 0.2]]) fill(ellipse(x, y, 30 * k, 30 * k, 40), color, a);
    fill(ellipse(x, y, 30, 30, 40), mix(color, [255, 255, 240], 0.4));
    glint = { x, color, alpha: 0.6 };
  }
  if (h >= 19 || h <= 6) {
    const u = ((h - 19 + 24) % 24) / 11, x = 40 + 460 * u, y = HORIZON + 20 - Math.sin(Math.PI * clamp01(u)) * arcHeight;
    const a = clamp01(nightness * 1.3);
    fill(ellipse(x, y, 50, 50, 36), [220, 226, 255], 0.1 * a);
    fill(ellipse(x, y, 24, 24, 36), [244, 242, 226], a);
    for (const [dx, dy, r] of [[-7, -5, 5], [6, 6, 3.6], [5, -10, 2.6]]) fill(ellipse(x + dx, y + dy, r, r, 12), [212, 210, 196], a);
    glint ??= { x, color: [230, 232, 255], alpha: 0.45 * a };
  }

  const cloudColor = mix(scene.hor, [255, 255, 255], 0.65 * (1 - nightness * 0.85));
  for (const c of CLOUDS) {
    const x = ((c.x + tick * c.speed) % (W + 260)) - 130;
    fill(CLOUD_PUFFS.map(([dx, dy, rx, ry]) => ellipse(x + dx * c.s, c.y + dy * c.s, rx * c.s, ry * c.s, 20)), cloudColor, 0.9 - nightness * 0.45);
  }

  if (nightness < 0.6) {
    for (const [i, g] of GULLS.entries()) {
      const x = ((g.x + tick * g.speed) % (W + 80)) - 40, y = g.y + 6 * Math.sin(tick * 0.05 + i), flap = Math.sin(tick * 0.45 + i * 2);
      fill(strokeShape([x - 11, y + flap * 4, x - 5, y - 3, x, y, x + 5, y - 3, x + 11, y + flap * 4], 2.2), [70, 72, 84], 0.8 * (1 - nightness));
    }
  }

  // Sea (redrawn over anything below the horizon, so a low sun sets into it), then the terrace.
  for (let y = HORIZON; y < GROUND; y++) fillRow(y, mix(mix(scene.sea, scene.hor, 0.45), mix(scene.sea, [0, 0, 0], 0.12), (y - HORIZON) / (GROUND - HORIZON)));
  for (let y = GROUND; y < H; y++) fillRow(y, mix(scene.ground, mix(scene.ground, [0, 0, 0], 0.18), (y - GROUND) / (H - GROUND)));
  fill([0, GROUND, W, GROUND, W, GROUND + 6, 0, GROUND + 6], mix(scene.ground, [255, 255, 255], 0.25));
  for (let row = 0; row < 3; row++) {
    const y = GROUND + 40 + row * 70, offset = row % 2 ? 50 : 0;
    for (let i = -1; i < 6; i++) fill([i * 104 + offset - 20, y, i * 104 + offset + 60, y, i * 104 + offset + 60, y + 2, i * 104 + offset - 20, y + 2], mix(scene.ground, [0, 0, 0], 0.15), 0.6);
  }

  fill([0, KEY_Y - 8, W, KEY_Y - 8, W, KEY_Y + KEY_H + 4, 0, KEY_Y + KEY_H + 4], mix(scene.ground, [0, 0, 0], 0.08));
  fill(MEANDER, lit([150, 84, 46]), 0.85);
  drawAmphora(46, 912, 1.0, lit);
  drawAmphora(494, 884, 0.82, lit);

  // White wave crests drifting on the sea.
  for (const c of WAVE_CRESTS) {
    const x = ((c.x + tick * c.speed) % (W + 40)) - 20, rise = 2 + Math.sin(tick * 0.15 + c.phase);
    fill(strokeShape([x - c.w, c.y, x - c.w / 2, c.y - rise, x, c.y, x + c.w / 2, c.y - rise, x + c.w, c.y], 1.6), [255, 255, 255], 0.32 * (1 - nightness * 0.6));
  }

  if (glint) {
    for (let i = 0; i < 12; i++) {
      const w = 6 + i * 3.4 + 4 * Math.sin(tick * 0.21 + i * 1.3);
      fill(ellipse(glint.x + 7 * Math.sin(tick * 0.09 + i * 2), HORIZON + 8 + i * 13, Math.max(1, w), 1.6, 12), glint.color, glint.alpha * (0.6 + 0.4 * Math.sin(tick * 0.3 + i)));
    }
  }

  fill(HILL_LEFT, scene.hill);
  fill(HILL_RIGHT, mix(scene.hill, scene.hor, 0.15));
  // A small temple on the far hill.
  const stone = lit(mix(scene.hill, [246, 236, 214], 0.6 * (1 - nightness * 0.6)));
  fill(TEMPLE.map(p => xf(TEMPLE_M, p)), stone);

  fill(BEACH, lit([226, 204, 158]));
  fill(strokeShape([412, HORIZON + 5, 434, HORIZON + 17, 474, HORIZON + 33, 522, HORIZON + 43, 560, HORIZON + 47], 2.2), [255, 255, 255], 0.45 + 0.2 * Math.sin(tick * 0.1)); // foam along the waterline
  drawTrojanHorse(tick, lit);
  drawShip(tick, lit);
  drawDolphin(tick, lit);

  drawOliveTree(tick, lit);
}

// ---------------------------------------------------------------------------------------------------------------------
// The dog. Coordinates are in "dog space": head centre at (0, 0), about 220 units wide; DOG_SCALE maps them to pixels.

const COLORS = {
  cream: [252, 245, 233], shade: [234, 219, 196], tan: [228, 146, 80], tanDark: [192, 106, 52], earInner: [247, 186, 168],
  nose: [164, 92, 86], noseHi: [214, 150, 140], eye: [50, 30, 22], ink: [92, 56, 42], mouth: [86, 32, 40], tongue: [242, 128, 142],
  blush: [255, 140, 150], collar: [216, 70, 74], gold: [250, 202, 84],
};
const DOG_SCALE = 1.3, DOG_X = 270, DOG_Y = 600;

const HEAD = curve([[0, -98], [58, -84], [100, -42], [110, 6], [94, 52], [56, 86], [0, 99], [-56, 86], [-94, 52], [-110, 6], [-100, -42], [-58, -84]], 8);
const TAN_PATCH = curve([[-111, -4], [-104, -50], [-80, -84], [-44, -96], [-22, -86], [-15, -58], [-24, -34], [-34, -12], [-54, 8], [-86, 24], [-104, 18]], 7);
const MUZZLE = ellipse(0, 46, 50, 40, 32);
const CHIN_SHADE = ellipse(0, 84, 38, 13, 24);
const EAR = curve([[-34, 6], [-42, -38], [-34, -88], [-12, -132], [6, -154, 1], [26, -118], [40, -70], [44, -22], [32, 8]], 7);
const EAR_INNER = curve([[-17, -2], [-23, -38], [-15, -86], [3, -127, 1], [14, -84], [20, -42], [18, -4]], 7);
const BODY = curve([[0, 70], [70, 78], [118, 120], [132, 190], [104, 262], [0, 284], [-104, 262], [-132, 190], [-118, 120], [-70, 78]], 8);
const SHOULDER = curve([[-112, 96], [-82, 100], [-70, 124], [-86, 150], [-114, 140]], 6);
const TAIL = curve([[-13, 6], [-21, -30], [-23, -66], [-14, -102], [0, -126], [14, -108], [22, -68], [20, -28], [13, 6]], 7);
const TAIL_SHADE = curve([[4, 4], [12, -30], [14, -66], [8, -100], [0, -116], [15, -104], [22, -68], [20, -28], [13, 6]], 6);
const COLLAR = curve([[-68, 96, 1], [-34, 110], [0, 114], [34, 110], [68, 96, 1], [64, 118], [30, 132], [0, 136], [-30, 132], [-64, 118]], 6);

/** A pointed tuft of fur from base (x, y) to tip (tx, ty), with its base sunk into the head so it reads as part of it. */
function tuft(x, y, tx, ty, halfWidth) {
  const dx = tx - x, dy = ty - y, l = Math.hypot(dx, dy), nx = -dy / l * halfWidth, ny = dx / l * halfWidth;
  const bx = x - dx * 0.35, by = y - dy * 0.35;
  return curve([[bx + nx, by + ny], [tx, ty, 1], [bx - nx, by - ny], [bx - dx * 0.2, by - dy * 0.2]], 5);
}
const CHEEK_TUFTS = [[100, 30, 126, 22, 9], [96, 52, 124, 56, 10], [84, 72, 104, 88, 9]].flatMap(([x, y, tx, ty, w]) => [tuft(x, y, tx, ty, w), tuft(-x, y, -tx, ty, w)]);

const heart = (cx, cy, size) => {
  const o = [];
  for (let i = 0; i < 28; i++) {
    const t = (i / 28) * Math.PI * 2;
    o.push(cx + size * 16 * Math.sin(t) ** 3 / 16, cy - size * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16);
  }
  return o;
};
const pawPrint = (cx, cy, size) => [ellipse(cx, cy + size * 0.35, size * 0.62, size * 0.5, 18),
  ...[[-0.62, -0.22], [-0.24, -0.62], [0.24, -0.62], [0.62, -0.22]].map(([dx, dy]) => ellipse(cx + dx * size, cy + dy * size, size * 0.24, size * 0.3, 12))];

// ---------------------------------------------------------------------------------------------------------------------
// A handwritten stroke font, only the letters the overlays use. Glyph units: x-height 0.52, cap height 1, baseline 0, y up.

const GLYPHS = {
  L: { w: 0.62, s: [[[0.04, 1], [0.04, 0], [0.54, 0]]] },
  e: { w: 0.6, s: [[[0.03, 0.25], [0.5, 0.25], [0.48, 0.4], [0.38, 0.5], [0.25, 0.53], [0.1, 0.46], [0.02, 0.3], [0.03, 0.14], [0.13, 0.03], [0.28, 0], [0.42, 0.04], [0.5, 0.12]]] },
  t: { w: 0.44, s: [[[0.16, 0.86], [0.16, 0.1], [0.24, 0], [0.38, 0.02]], [[0.02, 0.52], [0.36, 0.52]]] },
  "'": { w: 0.2, s: [[[0.06, 1], [0.06, 0.76]]] },
  s: { w: 0.52, s: [[[0.46, 0.45], [0.32, 0.53], [0.14, 0.5], [0.05, 0.4], [0.12, 0.29], [0.34, 0.23], [0.46, 0.13], [0.38, 0.02], [0.18, 0], [0.03, 0.08]]] },
  l: { w: 0.22, s: [[[0.06, 1], [0.06, 0]]] },
  o: { w: 0.6, s: [[[0.26, 0.53], [0.42, 0.46], [0.5, 0.26], [0.42, 0.07], [0.26, 0], [0.1, 0.07], [0.02, 0.26], [0.1, 0.46], [0.26, 0.53]]] },
  k: { w: 0.52, s: [[[0.05, 1], [0.05, 0]], [[0.44, 0.52], [0.06, 0.2]], [[0.2, 0.32], [0.46, 0]]] },
  a: { w: 0.6, s: [[[0.48, 0.3], [0.42, 0.46], [0.26, 0.53], [0.1, 0.46], [0.02, 0.26], [0.1, 0.07], [0.26, 0], [0.42, 0.07], [0.48, 0.24]], [[0.49, 0.53], [0.49, 0]]] },
  g: { w: 0.6, s: [[[0.48, 0.3], [0.42, 0.46], [0.26, 0.53], [0.1, 0.46], [0.02, 0.27], [0.1, 0.09], [0.26, 0.03], [0.42, 0.09], [0.48, 0.24]], [[0.49, 0.53], [0.49, -0.14], [0.42, -0.28], [0.26, -0.33], [0.08, -0.27]]] },
  i: { w: 0.22, s: [[[0.06, 0.52], [0.06, 0]], [[0.06, 0.78], [0.06, 0.8]]] },
  n: { w: 0.58, s: [[[0.05, 0.53], [0.05, 0]], [[0.05, 0.36], [0.16, 0.49], [0.3, 0.53], [0.43, 0.47], [0.48, 0.32], [0.48, 0]]] },
  ' ': { w: 0.3, s: [] },
};
const textWidth = (text, size) => [...text].reduce((w, ch) => w + (GLYPHS[ch]?.w ?? 0.5) * size + size * 0.1, -size * 0.1);

function drawText(text, x, baseline, size, color, alpha) {
  const width = Math.max(1.5, size * 0.11);
  for (const ch of text) {
    const glyph = GLYPHS[ch];
    if (!glyph) { x += size * 0.6; continue; }
    for (const line of glyph.s) {
      fill(strokeShape(line.flatMap(([gx, gy]) => [x + gx * size, baseline - gy * size]), width), color, alpha);
    }
    x += glyph.w * size + size * 0.1;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Mood: what the dog is doing. react() is called by the agent; each mood has target poses the drawing eases towards.

const MOODS = {
  idle: { shiftX: 0, shiftY: 0, tilt: 0, droop: 0, happy: 0, worry: 0, gaze: 0, point: 0, scan: 0, wag: 0.2, wrong: 0, check: 0 },
  waiting: { shiftX: -40, shiftY: 56, tilt: 5, droop: 0, happy: 0, worry: 0, gaze: 1, point: 1, scan: 0, wag: 0.3, wrong: 0, check: 0 },
  looking: { shiftX: -40, shiftY: 56, tilt: 8, droop: 0, happy: 0, worry: 0, gaze: 1, point: 1, scan: 1, wag: 0.3, wrong: 0, check: 0 },
  wrong: { shiftX: 0, shiftY: 0, tilt: 12, droop: 1, happy: 0, worry: 1, gaze: 0, point: 0, scan: 0, wag: 0, wrong: 1, check: 0 },
  happy: { shiftX: 0, shiftY: 0, tilt: -4, droop: 0, happy: 1, worry: 0, gaze: 0, point: 0, scan: 0, wag: 1, wrong: 0, check: 1 },
};
const EVENTS = { idle: 'idle', waiting: 'waiting', looking: 'looking', matched: 'idle', wrong: 'wrong', confirmed: 'happy', done: 'happy' };
const MOOD_FRAMES = { happy: 4 * FPS, wrong: 5 * FPS }; // after these, the dog goes back to waiting for the next bottle

let mood = 'idle', moodStart = 0, moodHolds = false, lastTick = 0, opening = 0;
const pose = { ...MOODS.idle };

/**
 * Tells the face what just happened in the call:
 * waiting (for the patient to show a bottle), looking (reading the label), matched, wrong, confirmed (a dose taken,
 * more to go), done (every dose taken; stays happy until the call ends), idle.
 */
export function react(event) {
  const next = EVENTS[event];
  if (!next) return;
  mood = next;
  moodStart = lastTick;
  moodHolds = event === 'done';
}

/** timezone: the patient's IANA zone, for the sky; hour: a fixed hour of the day (0-24) for previews, or null for the clock. */
export function configure({ timezone: zone, hour } = {}) {
  if (zone !== undefined) { timezone = zone || undefined; hourCache.at = -1; }
  if (hour !== undefined) hourOverride = hour === null || hour === '' ? null : Number(hour);
}

function updatePose(tick, speaking) {
  if (!moodHolds && MOOD_FRAMES[mood] && tick - moodStart > MOOD_FRAMES[mood]) { mood = 'waiting'; moodStart = tick; }
  const target = MOODS[mood];
  for (const key of Object.keys(pose)) pose[key] += (target[key] - pose[key]) * (key.startsWith('shift') ? 0.1 : 0.2);
  // Quick syllable beats (about four a second) under a slower swell, so the mouth is not a metronome.
  const speech = speaking ? 0.15 + 0.85 * Math.abs(Math.sin(tick * 0.8)) * (0.6 + 0.4 * Math.sin(tick * 0.23 + 1)) : 0;
  opening += (speech - opening) * (speech > opening ? 0.6 : 0.4);
}

function drawDog(tick, light) {
  const L = c => [c[0] * light[0], c[1] * light[1], c[2] * light[2]];
  const p = pose;
  const cx = DOG_X + p.shiftX;
  const breath = Math.sin(tick * 0.12);
  const hop = p.happy * Math.abs(Math.sin(tick * 0.45)) * 5;
  const root = chain(T(cx, DOG_Y + p.shiftY - 1.5 * breath - hop - opening * 1.5), S(DOG_SCALE));
  const draw = (m, poly, color, alpha) => fill(xf(m, poly), L(color), alpha);

  // Tail behind the body: a lazy wag at rest, a fast one when happy, hanging low when worried.
  const wagSpeed = lerp(0.32, 1.25, p.happy);
  const tailAngle = lerp(-30, -64, p.droop) + p.wag * 26 * Math.sin(tick * wagSpeed);
  const tailM = chain(root, T(-112, 122), R(tailAngle));
  draw(tailM, TAIL, COLORS.cream);
  draw(tailM, TAIL_SHADE, COLORS.shade, 0.8);

  const bodyM = chain(root, T(0, 175), S(1, 1 + 0.012 * breath), T(0, -175));
  draw(bodyM, BODY, COLORS.cream);
  draw(bodyM, SHOULDER, COLORS.tan);
  draw(chain(bodyM, S(-1, 1)), SHOULDER, COLORS.tan);
  draw(bodyM, ellipse(0, 200, 52, 58, 24), COLORS.shade, 0.35);
  draw(root, COLLAR, COLORS.collar);
  draw(root, ellipse(0, 146, 11, 11, 18), COLORS.gold);
  draw(root, ellipse(-3, 143, 3.5, 3.5, 10), [255, 248, 210]);

  // Waiting for a bottle: one front paw reaches up towards the label frame and taps.
  if (p.point > 0.02) {
    const shoulder = [86, 150], reach = [184, -64];
    const tap = 5 * Math.sin(tick * 0.55) * p.point;
    const dx = reach[0] - shoulder[0], dy = reach[1] - shoulder[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const end = [shoulder[0] + dx * p.point + ux * tap, shoulder[1] + dy * p.point + uy * tap];
    stroke(root, [shoulder, end], 36, L(COLORS.cream));
    draw(root, ellipse(end[0], end[1], 24, 24, 24), COLORS.cream);
    for (const turn of [-28, 0, 28]) {
      const a = Math.atan2(uy, ux) + turn * Math.PI / 180;
      stroke(root, [[end[0] + Math.cos(a) * 12, end[1] + Math.sin(a) * 12], [end[0] + Math.cos(a) * 21, end[1] + Math.sin(a) * 21]], 3, L(COLORS.ink), 0.55);
    }
  }

  // Head group: tilts around the neck; listening, worrying and talking all move it a little.
  const tilt = p.tilt + 1.4 * Math.sin(tick * 0.07) + 2 * opening * Math.sin(tick * 0.4);
  const headM = chain(root, T(0, 92), R(tilt), T(0, -92));

  // Ears: tall and pricked, perkier when happy, folded down and outwards when worried; an occasional twitch.
  const twitch = side => {
    const phase = (tick + (side > 0 ? 55 : 0)) % 110;
    return phase < 8 ? Math.sin((phase / 8) * Math.PI) * 9 : 0;
  };
  for (const side of [-1, 1]) {
    const angle = lerp(26, 104, p.droop) - 6 * p.happy + 5 * p.happy * Math.sin(tick * 0.9 + side) + twitch(side) * (1 - p.droop);
    const earM = chain(headM, T(side * 64, -64), S(side, 1), R(angle), S(1, 1 - 0.2 * p.droop));
    draw(earM, EAR, COLORS.tan);
    draw(earM, EAR_INNER, COLORS.earInner);
    draw(earM, ellipse(-4, -40, 9, 28, 16), COLORS.cream, 0.55);
  }

  draw(headM, HEAD, COLORS.cream);
  for (const t of CHEEK_TUFTS) draw(headM, t, COLORS.cream);
  draw(headM, TAN_PATCH, COLORS.tan);
  draw(chain(headM, S(-1, 1)), TAN_PATCH, COLORS.tan);
  draw(headM, ellipse(-62, -40, 26, 16, 20), COLORS.tanDark, 0.25);
  draw(chain(headM, S(-1, 1)), ellipse(-62, -40, 26, 16, 20), COLORS.tanDark, 0.25);
  // A scruffy forehead tuft that sways.
  for (const [x, tx, ty, w] of [[-12, -18, -120, 7], [2, 4, -126, 8], [16, 28, -116, 7]]) {
    draw(headM, tuft(x, -92, tx + 2 * Math.sin(tick * 0.18 + x), ty, w), COLORS.cream);
  }
  draw(headM, MUZZLE, [255, 250, 242]);
  draw(headM, CHIN_SHADE, COLORS.shade, 0.6);
  draw(headM, ellipse(-68, 30, 17, 10, 18), COLORS.blush, 0.18 + 0.32 * p.happy);
  draw(headM, ellipse(68, 30, 17, 10, 18), COLORS.blush, 0.18 + 0.32 * p.happy);

  // Eyes: big and shiny, glancing at the label frame while waiting; happy arcs when a dose is taken.
  const blinkPhase = tick % 76;
  const blink = blinkPhase < 4 ? [1, 0.45, 0.08, 0.45][blinkPhase] : 1;
  for (const side of [-1, 1]) {
    const ex = side * 44 + p.gaze * 4, ey = -10 - p.gaze * 3;
    if (p.happy > 0.5) {
      stroke(headM, [[ex - 14, ey + 5], [ex - 8, ey - 5], [ex, ey - 8], [ex + 8, ey - 5], [ex + 14, ey + 5]], 5, L(COLORS.eye));
    } else {
      const ry = 18 * blink * (1 - 0.9 * p.happy) * (1 + 0.08 * p.worry);
      if (ry < 3) stroke(headM, [[ex - 14, ey], [ex + 14, ey]], 4, L(COLORS.eye));
      else {
        draw(headM, ellipse(ex, ey, 16, ry, 26), COLORS.eye);
        draw(headM, ellipse(ex + 5, ey - ry * 0.38, 5.5, 5.5 * ry / 18, 14), [255, 255, 255]);
        draw(headM, ellipse(ex - 5, ey + ry * 0.4, 2.6, 2.6 * ry / 18, 10), [255, 255, 255], 0.8);
      }
    }
    // Brows: inner ends lift when worried, both lift when happy.
    const inner = [side * 26, -36 - 12 * p.worry - 5 * p.happy], outer = [side * 62, -42 + 7 * p.worry - 5 * p.happy];
    stroke(headM, [inner, [side * 44, lerp(-44, -42, p.worry) - 5 * p.happy], outer], 6, L(COLORS.tanDark));
  }

  // Nose and mouth. The mouth opens with speech; when happy it stays open in a smile with the tongue out.
  draw(headM, curve([[-18, 23], [0, 19], [18, 23], [12, 37], [0, 46], [-12, 37]], 6), COLORS.nose);
  draw(headM, ellipse(-6, 27, 6, 3.2, 14), COLORS.noseHi, 0.9);
  const open = Math.max(opening * 24, p.happy * 12);
  const smile = p.happy * 4 - p.worry * 3;
  if (open < 3) {
    stroke(headM, [[0, 46], [0, 55]], 3, L(COLORS.ink));
    for (const side of [-1, 1]) stroke(headM, [[0, 55], [side * 7, 61], [side * 16, 61], [side * 23, 56 - smile]], 3.2, L(COLORS.ink));
  } else {
    stroke(headM, [[0, 46], [0, 54]], 3, L(COLORS.ink));
    draw(headM, curve([[-25, 54 - smile, 1], [0, 53], [25, 54 - smile, 1], [21, 54 + open * 0.6], [0, 56 + open], [-21, 54 + open * 0.6]], 6), COLORS.mouth);
    if (open > 7) {
      const tongueOut = p.happy * (1 - opening);
      const ty = 56 + open * 0.66 + tongueOut * 8;
      draw(headM, ellipse(0, ty, 14 * Math.min(1, open / 16), open * 0.27 + tongueOut * 7, 20), COLORS.tongue);
      if (tongueOut > 0.3) stroke(headM, [[0, ty - 4], [0, ty + 6]], 2, L([214, 96, 110]), tongueOut);
    }
  }
  for (const side of [-1, 1]) for (const [x, y] of [[26, 42], [34, 48], [24, 52]]) draw(headM, ellipse(side * x, y, 1.7, 1.7, 8), COLORS.ink, 0.5);
}

// ---------------------------------------------------------------------------------------------------------------------
// Overlays: a green check with hearts and paw prints, and the amber "look again" note. (While waiting for a bottle the
// dog just raises its paw; the label frame and bottle icon that used to sit in the sky were removed.)

function drawOverlays(tick) {
  const p = pose, cx = DOG_X + p.shiftX, cy = DOG_Y + p.shiftY;

  if (p.check > 0.02) {
    const age = tick - moodStart;
    const pop = mood === 'happy' ? 1 + 0.35 * Math.sin(clamp01(age / 10) * Math.PI) : 1;
    const r = 40 * p.check * pop, bx = W / 2, by = 396;
    fill(ellipse(bx + 2, by + 3, r, r, 32), [0, 60, 30], 0.25 * p.check);
    fill(ellipse(bx, by, r, r, 32), [52, 186, 106], p.check);
    fill(strokeShape([bx - r * 0.4, by + r * 0.02, bx - r * 0.1, by + r * 0.32, bx + r * 0.44, by - r * 0.3], Math.max(2, r * 0.2)), [255, 255, 255], p.check);
    // Hearts and paw prints drifting up on both sides of the head.
    for (let i = 0; i < 12; i++) {
      const period = 54, age2 = ((tick + i * (period / 12)) % period) / period;
      const side = i % 2 ? 1 : -1;
      const x = cx + side * (160 + ((i * 23) % 50)) + 12 * Math.sin(age2 * 6 + i);
      const y = cy + 60 - age2 * 400;
      const alpha = Math.sin(age2 * Math.PI) * p.happy;
      const size = 11 + (i % 3) * 4;
      if (i % 3 === 2) fill(pawPrint(x, y, size), [200, 120, 76], alpha * 0.85);
      else fill(heart(x, y, size), [255, 104, 138], alpha);
    }
  }

  if (p.wrong > 0.02) {
    const text = "Let's look again", size = 28;
    const tw = textWidth(text, size), bw = tw + 64, bh = 58;
    const by = lerp(-bh, 352, smooth(p.wrong)), bx = W / 2 - bw / 2;
    fill(curve([[bx, by + bh / 2], [bx + bh / 2, by, 1], [bx + bw - bh / 2, by, 1], [bx + bw, by + bh / 2], [bx + bw - bh / 2, by + bh, 1], [bx + bh / 2, by + bh, 1]], 6), [255, 206, 112], 0.94 * p.wrong);
    drawText(text, bx + 32, by + bh / 2 + size * 0.36, size, [118, 70, 16], p.wrong);
  }
}

function render(tick, speaking) {
  lastTick = tick;
  updatePose(tick, speaking);
  const scene = sceneAt(currentHour());
  drawScene(scene, tick);
  drawDog(tick, scene.light);
  drawOverlays(tick);
  drawCaption(tick, speaking);
}

const canvasBytes = new Uint8Array(canvas.buffer);

// ---------------------------------------------------------------------------------------------------------------------
// Captions: what the agent is saying, on a card in the sky above the dog, so the patient can still follow when the
// sound breaks up. Up to two lines; the newest words push older lines up. The text is drawn once into a mask whenever
// it changes, and each frame only blends that mask, so captions cost almost nothing per frame.

// Phone-safe placement. A taller phone screen (about 9:19.5) shows this 9:16 frame zoomed to fill, cutting ~48 px off
// each side, and FaceTime's own self-view sits over the top-right corner (about x 362-469, y 54-214 here). So the card
// stays inside x 56-484 and starts just below that corner, as a speech bubble pointing down at the dog.
const SAFE_X0 = 56, SAFE_X1 = W - 56;
const CAPTION = { x: SAFE_X0, y: 222, w: SAFE_X1 - SAFE_X0, pad: 18, lineH: 44, maxLines: 2, scale: 1.36, stroke: 3.3 };
const captionMask = new Uint8ClampedArray(W * H * 4);
let caption = { text: '', done: true, key: '', lines: [], lastSpeechTick: -1e9 };

/** Shows `text` (everything said so far in the current sentence or turn). */
export function setCaption(text) { caption.text = String(text ?? '').replace(/\s+/g, ' ').trim(); caption.done = false; }
/** The current turn's text is complete; it fades out once the agent has stopped speaking. */
export function endCaption() { caption.done = true; }

const glyphWidth = ch => { const g = CAPTION_GLYPHS[ch] ?? CAPTION_GLYPHS['?']; return (g.right - g.left) * CAPTION.scale; };
function wrapCaption(text) {
  const maxW = CAPTION.w - CAPTION.pad * 2, lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const tryLine = line ? `${line} ${word}` : word;
    if ([...tryLine].reduce((w, ch) => w + glyphWidth(ch), 0) <= maxW || !line) line = tryLine;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.slice(-CAPTION.maxLines);
}

function renderCaptionMask(lines) {
  const top = CAPTION.y, height = CAPTION.maxLines * CAPTION.lineH + CAPTION.pad;
  captionMask.fill(0, top * W * 4, (top + height + 4) * W * 4);
  target = captionMask;
  lines.forEach((line, row) => {
    const lineW = [...line].reduce((w, ch) => w + glyphWidth(ch), 0);
    let penX = CAPTION.x + (CAPTION.w - lineW) / 2;
    const baseY = top + CAPTION.pad * 0.6 + row * CAPTION.lineH + 12 * CAPTION.scale;
    const contours = [];
    for (const ch of line) {
      const g = CAPTION_GLYPHS[ch] ?? CAPTION_GLYPHS['?'];
      for (const stroke of g.strokes) {
        const pts = [];
        for (let i = 0; i < stroke.length; i += 2) pts.push(penX + (stroke[i] - g.left) * CAPTION.scale, baseY + stroke[i + 1] * CAPTION.scale);
        contours.push(...strokeShape(pts, CAPTION.stroke));
      }
      penX += (g.right - g.left) * CAPTION.scale;
    }
    if (contours.length) fill(contours, [255, 255, 255]);
  });
  target = canvas;
}

function drawCaption(tick, speaking) {
  if (speaking) caption.lastSpeechTick = tick;
  if (!caption.text) return;
  const quietFor = tick - caption.lastSpeechTick;
  const vis = caption.done ? 1 - smooth((quietFor - 3 * FPS) / FPS) : 1; // fades 3-4 s after the agent stops talking
  if (vis <= 0) { caption.text = ''; return; }
  if (caption.key !== caption.text) { caption.key = caption.text; caption.lines = wrapCaption(caption.text); renderCaptionMask(caption.lines); }
  const { x, y, w, pad, lineH } = CAPTION, h = caption.lines.length * lineH + pad, r = 18;
  const tailX = W / 2;
  const card = [curve([[x, y + r], [x + r, y, 1], [x + w - r, y, 1], [x + w, y + r], [x + w, y + h - r], [x + w - r, y + h, 1], [x + r, y + h, 1], [x, y + h - r]], 6),
    [tailX - 16, y + h - 2, tailX + 16, y + h - 2, tailX + 4, y + h + 18]]; // the bubble's tail
  fill(card.map(part => xf(T(0, 4), part)), [0, 0, 0], 0.16 * vis);                       // soft shadow
  fill(card, [255, 251, 242], 0.94 * vis);
  // Text: blend the mask in a dark warm brown, readable on the cream card at any time of day.
  const ink = [52, 36, 28];
  for (let py = y; py < y + h; py++) {
    for (let px = x, i = (py * W + x) * 4; px < x + w; px++, i += 4) {
      const m = captionMask[i];
      if (!m) continue;
      const a = (m / 255) * vis;
      canvas[i] += (ink[0] - canvas[i]) * a; canvas[i + 1] += (ink[1] - canvas[i + 1]) * a; canvas[i + 2] += (ink[2] - canvas[i + 2]) * a;
    }
  }
}

/**
 * `tick` counts frames; `speaking` is true while the agent talks and moves the mouth.
 * Returns WIDTH x HEIGHT pixels, four bytes each: red, green, blue, alpha.
 */
export function drawFace(tick, speaking) {
  render(tick, speaking);
  return new Uint8Array(canvas.buffer.slice(0));
}

/** Like drawFace, but writes into `out` (a Uint8Array of WIDTH * HEIGHT * 4 bytes) so buffers can be reused. */
export function drawFaceInto(tick, speaking, out) {
  render(tick, speaking);
  out.set(canvasBytes);
  return out;
}
