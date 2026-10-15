// Builds index.html and styles.css for the Tamagotchi breakdown figure.
// Geometry is computed once here with the Anatomy kit; main.js only moves, sorts and redraws the LCD.
//   node build.mjs --project [--dark]   index.html + styles.css for the UI Experiments site (light by default)
//   node build.mjs [--light]            a standalone page for the Anatomy community gallery:
//                                       tamagotchi-teardown.html (dark) or tamagotchi-teardown-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = process.argv.includes("--project");
const THEME = PROJECT ? (process.argv.includes("--dark") ? "dark" : "light") : process.argv.includes("--light") ? "light" : "dark";

// World units are 0.5 mm: the egg is 43.0 × 50.0 mm, so 86 × 100 units. y runs from the back (−) to the face (+), z is up.
const W = 900;
const H = 600;
const AZIMUTH = 48;
const ELEVATION = 28;
const ZC = 62; // egg centre height above the plate
const EGG = { w: 86, h: 100 };
const WIN = { x: 0, z: ZC + 8, hw: 22, hh: 21.5, r: 4 }; // 22.0 × 21.5 mm window
const BUTTONS = [
  { id: "A", x: -17, z: ZC - 32 },
  { id: "B", x: 0, z: ZC - 35 },
  { id: "C", x: 17, z: ZC - 32 },
];
const BTN_HOLE = 4.8;
const BTN_R = 4;

// Stack, back to front (y of each layer's back and front face).
const Y = {
  battery: [-17, -14],
  shell: [-14, 0],
  shellMain: -9, // the full-size wall; behind it the back steps in twice, like a dome
  floor: -7,
  cell: [-14, -3.2],
  pcb: [-2, 1],
  sponge: [1, 6.4],
  paper: [6.4, 7],
  zebra: [1, 7],
  lcd: [7, 11],
  pad: [1, 3],
  dome: [3, 17.4],
  protector: [11, 12.8],
  cover: [0, 15],
  coverMain: 10.5,
  coverTier: 13,
};
const TIERS = [2.6, 5.6]; // insets of the two steps that round the face and the back

const PIECES = {
  cover: { name: "Front cover", say: "front cover · window and three button holes", move: 228 },
  protector: { name: "Screen window", say: "screen window · clear plastic over the LCD", move: 168 },
  pad: { name: "Silicone buttons", say: "silicone buttons · carbon pills close the board's pads", move: 140 },
  lcd: { name: "LCD and zebra strips", say: "LCD · 32 × 16 dots, wired by two zebra strips", move: 112 },
  paper: { name: "Background paper", say: "background paper · the printed scene behind the dots", move: 86 },
  sponge: { name: "Sponge", say: "sponge · presses the LCD onto the zebra strips", move: 63 },
  pcb: { name: "Circuit board", say: "circuit board · 4-bit MCU under the black epoxy", move: 36 },
  shell: { name: "Back shell", say: "back shell · buzzer, reset switch, battery wells", move: 0 },
  cells: { name: "LR44 cells", say: "2 × LR44 in series · 3.0 V", move: -44 },
  battery: { name: "Battery cover", say: "battery cover · one screw", move: -80 },
};
const STAGGER = ["cover", "battery", "protector", "pad", "cells", "lcd", "paper", "sponge", "pcb"];
const SPRING = { stagger: 0.04, stiffness: 64, damping: 14.2, substeps: 4 };
const ORDER = ["cover", "protector", "pad", "lcd", "paper", "sponge", "pcb", "shell", "cells", "battery"];

const PLATE = { x: -64, y: -112, w: 128, d: 372, r: 10 };
const PLATE_H = 10;
const FOOT_H = 5;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [0, -97, 124], [0, 243, 114], [44, 243, 60], [-44, -97, 60]],
  W,
  H,
  { pad: 18, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const LIGHT = G.lightOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const pathOf = k.pathOf;
const fmt = (n) => (Math.round(n * 100) / 100).toString();

// ---------- Outlines in the face plane (x, z) ----------
const TAU = Math.PI * 2;
function eggRing(steps = 120) {
  // z = ZC − 50 cos t, wider below the middle like the real shell.
  return Array.from({ length: steps }, (_, i) => {
    const t = (i / steps) * TAU;
    return [(EGG.w / 2) * Math.sin(t) * (1 + 0.13 * Math.cos(t)), ZC - (EGG.h / 2) * Math.cos(t)];
  });
}
const area = (ring) => ring.reduce((sum, [x0, z0], i) => {
  const [x1, z1] = ring[(i + 1) % ring.length];
  return sum + x0 * z1 - x1 * z0;
}, 0) / 2;
const ccw = (ring) => (area(ring) > 0 ? ring : [...ring].reverse());
function offsetRing(ring, d) {
  // Moves every vertex inward by d along the averaged normal (fine for smooth convex rings).
  const r = ccw(ring);
  const n = r.length;
  return r.map(([x, z], i) => {
    const [px, pz] = r[(i - 1 + n) % n];
    const [nx, nz] = r[(i + 1) % n];
    const tx = nx - px;
    const tz = nz - pz;
    const len = Math.hypot(tx, tz) || 1;
    // inward normal of a ccw ring is (−tz, tx)
    return [x + (-tz / len) * d, z + (tx / len) * d];
  });
}
function roundRect(cx, cz, hw, hh, r, steps = 6) {
  return k.roundedPlan({ x: cx - hw, y: cz - hh, w: hw * 2, d: hh * 2, r }, steps);
}
const circle = (cx, cz, r, steps = 40) => Array.from({ length: steps }, (_, i) => [cx + r * Math.cos((i / steps) * TAU), cz + r * Math.sin((i / steps) * TAU)]);
function hull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
const EGG_RING = eggRing();
// The egg's lower edge, for the cradle: z of the outline at x on the bottom half.
function eggBottomAt(x) {
  let best = null;
  EGG_RING.forEach(([ax, az], i) => {
    const [bx, bz] = EGG_RING[(i + 1) % EGG_RING.length];
    if (az > ZC || bz > ZC) return;
    if ((ax - x) * (bx - x) <= 0 && ax !== bx) {
      const z = az + ((x - ax) / (bx - ax)) * (bz - az);
      if (best === null || z < best) best = z;
    }
  });
  return best;
}
function clipBelow(ring, zMax) {
  // Sutherland–Hodgman against z <= zMax.
  const out = [];
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const ain = a[1] <= zMax;
    const bin = b[1] <= zMax;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (zMax - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, zMax]);
    }
  });
  return out;
}

// ---------- A prism along y, with holes, drawn like the kit's extrude ----------
const bandOfNormal = (n) => G.bandOf(G.dot3(G.unit3(n), LIGHT));
const FRONT_BAND = bandOfNormal([0, 1, 0]);
const shadeClass = (band) => (band >= 4 ? `class="iso-top"` : `class="iso-shade" data-shade="${band}"`);
const ringAt = (ring, y) => ring.map(([x, z]) => at([x, y, z]));
const oriented = (pts) => (area(pts.map(([x, y]) => [x, -y])) > 0 ? pts : [...pts].reverse());

function runsOf(flags, wanted) {
  const n = flags.length;
  const start = flags.findIndex((f) => f !== wanted);
  if (start < 0) return wanted ? [[...Array(n + 1).keys()].map((i) => i % n)] : [];
  const runs = [];
  let run = null;
  for (let s = 1; s <= n; s++) {
    const i = (start + s) % n;
    if (flags[i] === wanted) {
      if (!run) run = [i];
      run.push((i + 1) % n);
    } else if (run) {
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);
  return runs;
}

/**
 * ring: [x, z] outline (any winding), the prism runs from y0 (back) to y1 (front).
 * holes: [{ ring, depth, floor?: { holes } }] cut into the front face.
 * Returns svg parts so callers can slot interior items between the back of a recess and its front face.
 */
function yPrism(ring, y0, y1, { holes = [], convex = true, bevel = 0 } = {}) {
  const r = ccw(ring);
  const n = r.length;
  const normals = r.map(([ax, az], i) => {
    const [bx, bz] = r[(i + 1) % n];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    return [(bz - az) / len, -(bx - ax) / len]; // outward for ccw in (x, z)
  });
  const facing = normals.map(([nx, nz]) => nx * V[0] + nz * V[2] > 1e-9);
  const front = ringAt(r, y1);
  const back = ringAt(r, y0);
  const buckets = [[], [], [], [], []];
  for (let i = 0; i < n; i++) {
    if (!facing[i]) continue;
    const j = (i + 1) % n;
    buckets[bandOfNormal([normals[i][0], 0, normals[i][1]])].push(pathOf(oriented([front[i], front[j], back[j], back[i]]), true));
  }
  const outline = [];
  const crease = [];
  for (const run of runsOf(facing, false)) outline.push(pathOf(run.map((i) => front[i])));
  for (const run of runsOf(facing, true)) {
    crease.push(pathOf(run.map((i) => front[i])));
    outline.push(pathOf(run.map((i) => back[i])));
  }
  for (let i = 0; i < n; i++) if (facing[(i + n - 1) % n] !== facing[i]) outline.push(pathOf([front[i], back[i]]));
  let fill;
  if (convex) fill = pathOf(hull([...front, ...back]), true);
  else {
    const parts = [pathOf(oriented(front), true), pathOf(oriented(back), true)];
    for (let i = 0; i < n; i++) if (facing[i]) parts.push(pathOf(oriented([front[i], front[(i + 1) % n], back[(i + 1) % n], back[i]]), true));
    fill = parts.join("");
  }
  const holePaths = holes.map((h) => pathOf(ringAt(ccw(h.ring), y1), true)).join("");
  let bevelPath = "";
  if (bevel) bevelPath = pathOf(ringAt(offsetRing(r, bevel), y1), true);
  // Hole walls and floors.
  const inside = holes.map((h) => {
    const hr = ccw(h.ring);
    const m = hr.length;
    const yb = y1 - h.depth;
    const hf = ringAt(hr, y1);
    const hb = ringAt(hr, yb);
    const walls = [[], [], [], [], []];
    const seen = [];
    for (let i = 0; i < m; i++) {
      const [ax, az] = hr[i];
      const [bx, bz] = hr[(i + 1) % m];
      const len = Math.hypot(bx - ax, bz - az) || 1;
      const inward = [-(bz - az) / len, (bx - ax) / len];
      const vis = inward[0] * V[0] + inward[1] * V[2] > 1e-9;
      seen.push(vis);
      if (vis) walls[bandOfNormal([inward[0], 0, inward[1]])].push(pathOf(oriented([hf[i], hf[(i + 1) % m], hb[(i + 1) % m], hb[i]]), true));
    }
    // The far rim of the hole, plus the generators where its wall turns edge-on, so the rim ends on the front edge.
    let backEdge = runsOf(seen, true).map((run) => pathOf(run.map((i) => hb[i]))).join("");
    for (let i = 0; i < m; i++) if (seen[(i + m - 1) % m] !== seen[i]) backEdge += pathOf([hf[i], hb[i]]);
    const floor = h.floor
      ? `<path class="${FRONT_BAND >= 4 ? "iso-top" : "iso-shade"} tg-holed" data-shade="${FRONT_BAND}" d="${pathOf(hb, true)}${(h.floor.holes || []).map((fh) => pathOf(ringAt(ccw(fh), yb), true)).join("")}"/>`
      : "";
    const floorFill = h.floor ? `<path class="iso-fill tg-holed" d="${pathOf(hb, true)}${(h.floor.holes || []).map((fh) => pathOf(ringAt(ccw(fh), yb), true)).join("")}"/>` : "";
    const wallSvg = walls.map((list, band) => (list.length ? `<path ${shadeClass(band)} d="${list.join("")}"/>` : "")).join("");
    return { floor: floorFill + floor, walls: wallSvg, backEdge, rim: pathOf(hf, true) };
  });
  return {
    fill: `<path class="iso-fill tg-holed" d="${fill}${holePaths}"/>`,
    sides: buckets.map((list, band) => (list.length ? `<path ${shadeClass(band)} d="${list.join("")}"/>` : "")).join(""),
    face: `<path class="${FRONT_BAND >= 4 ? "iso-top" : "iso-shade"} tg-holed tg-face" data-shade="${FRONT_BAND}" d="${pathOf(front, true)}${holePaths}"/>`,
    inside,
    crease: crease.join(""),
    outline: outline.join(""),
    bevel: bevelPath,
  };
}

function prismSvg(parts, { tone = "hi", crease = "faint", lit = false, before = "", after = "", afterHoles = "" } = {}) {
  const out = [parts.fill, parts.sides];
  out.push(before);
  for (const h of parts.inside) out.push(h.floor, h.walls, Ln(h.backEdge, { tone: "faint" }));
  out.push(afterHoles);
  out.push(parts.face);
  for (const h of parts.inside) out.push(Ln(h.rim, { tone: "lo" }));
  if (parts.bevel) out.push(Ln(parts.bevel, { tone: "faint" }));
  out.push(after);
  if (crease !== "none") out.push(`<path class="iso-line iso-crease" data-tone="${crease}" d="${parts.crease}"/>`);
  out.push(`<path class="iso-line iso-edge" data-tone="${tone}" d="${parts.outline}"/>`);
  return `<g class="iso-solid"${lit ? " data-lit" : ""}>${out.join("")}</g>`;
}

// The face plane at y: local (x, −z) → screen, as the desk computer draws its CRT.
const planeOf = (y) => k.sideMatrix([0, y], 0, P, "left");
const local = (points) => pathOf(points.map(([x, z]) => [x, -z]), true);
const localOpen = (points) => pathOf(points.map(([x, z]) => [x, -z]));
const onFace = (y, inner) => `<g transform="${planeOf(y)}">${inner}</g>`;
const faceLine = (y, d, style) => onFace(y, Ln(d, style));

// Turned parts along y.
const alongY = (x, z, y = 0) => G.frameAlong([x, y, z], [0, 1, 0]);
const turnedY = (x, z, profile, opts = {}) => G.solidOf(profile, alongY(x, z), P, opts);

// ---------- Items ----------
const items = [];
function put(piece, key, svg, extra = {}) {
  items.push({ piece, key, svg, ...extra });
}
let clipId = 0;

// ---------- Stand ----------
function stand() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = k.corners(PLATE, 20).sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: Ln(k.sideSeam(PLATE, -PLATE_H + 3, P, 8), { tone: "faint" }) }));
  out.push(Ln(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(Ln(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Ruler strip along the far edge: 2 mm minor ticks (4 units), 10 mm majors.
  const strip = { x: PLATE.x + 10, y: PLATE.y + 22, w: 8, d: PLATE.d - 44, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.y + 4, strip.y + strip.d - 4, 4, 5, strip.x + strip.w, 0.6, [-2.2, -4], P, "y");
  out.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 4, strip.y + 2, 0.6]), at([strip.x + 4, strip.y + strip.d - 2, 0.6])], { size: 0.45 }));
  // Label plate near the front.
  const label = { x: PLATE.x + 30, y: PLATE.y + PLATE.d - 26, w: 46, d: 12, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(Ln(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 3), { tone: "faint" }));
  out.push(Ln([30, 22, 26].map((w, i) => k.lineOnTop([label.x + 4, label.y + 3 + i * 3], [label.x + 4 + w, label.y + 3 + i * 3], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + label.w - 3.5, label.y + 3, 0.8]), at([label.x + label.w - 3.5, label.y + label.d - 3, 0.8])], { size: 0.42 }));
  return out.join("");
}
put("stand", -1000, stand());

// The cradle: a block whose top is cut to the egg's lower curve, under the back shell's wall.
function cradle() {
  const CX = 30;
  const curve = [];
  for (let x = CX; x >= -CX; x -= 2) curve.push([x, eggBottomAt(x) - 0.2]);
  const ring = [[-CX - 4, 0], [CX + 4, 0], [CX + 4, curve[0][1]], ...curve, [-CX - 4, curve[curve.length - 1][1]]];
  const parts = yPrism(ring, Y.shellMain, -1, { convex: false });
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: -CX - 4, y: Y.shellMain, w: CX * 2 + 8, d: -1 - Y.shellMain, r: 2 }, 0, 6, P)}"/>`];
  out.push(prismSvg(parts, { tone: "mid" }));
  out.push(Dots([at([-CX + 0.5, -1, 4]), at([CX - 0.5, -1, 4])], { size: 0.5 }));
  return out.join("");
}

// ---------- Battery cover (leaves backwards) ----------
function batteryCover() {
  const ring = clipBelow(offsetRing(EGG_RING, TIERS[1] + 3.4), ZC + 4);
  const parts = yPrism(ring, Y.battery[0], Y.battery[1], { bevel: 1.2 });
  const yf = Y.battery[1];
  const face = [
    faceLine(yf, local(clipBelow(offsetRing(EGG_RING, TIERS[1] + 8), ZC - 1)), { tone: "faint" }),
    onFace(yf, `<path class="tg-dark" d="${local(circle(0, ZC - 6, 1.6, 24))}"/>`),
    faceLine(yf, local(circle(0, ZC - 6, 3.2, 32)), { tone: "lo" }),
    faceLine(yf, local(roundRect(-18, ZC - 26, 5, 1.2, 1.2, 3)) + local(roundRect(18, ZC - 26, 5, 1.2, 1.2, 3)), { tone: "lo" }),
  ].join("");
  const pins = [-26, 26].map((x) => S(turnedY(x, ZC - 4, [[yf, 1.6], [yf + 2, 1.6], [yf + 2.5, 1.1, 1], [yf + 2.7, 0]]), { tone: "mid" })).join("");
  return prismSvg(parts, { tone: "mid", after: face }) + pins;
}

// ---------- Back shell (stays in the cradle) ----------
const CELLS = [
  { x: -13, z: ZC - 14, plus: true },
  { x: 13, z: ZC - 14, plus: false },
];
const CELL_R = 11.6; // LR44: 11.6 mm × 5.4 mm, so 23.2 × 10.8 units… radius in units is 11.6
const WELL_R = 12.6;
const BOSSES = [[-28, ZC + 22], [28, ZC + 22], [-27, ZC - 30], [27, ZC - 30]];
const BUZZER = { x: 0, z: ZC + 24, r: 11 };
const RESET = { x: 0, z: ZC + 5 };
const INNER = offsetRing(EGG_RING, 3);
const WELLS = () => CELLS.map((c) => circle(c.x, c.z, WELL_R, 48));

function lug() {
  const ring = roundRect(0, ZC + 52, 7, 8, 6, 8);
  const parts = yPrism(ring, Y.shellMain, Y.shellMain + 6, { holes: [{ ring: circle(0, ZC + 55, 2.6, 28), depth: 6 }] });
  return prismSvg(parts, { tone: "mid" });
}

function shellBack() {
  // Two steps behind the wall round the back, each pierced by the battery wells.
  const steps = [
    [TIERS[1], Y.shell[0], Y.shell[0] + 2.5],
    [TIERS[0], Y.shell[0] + 2.5, Y.shellMain],
  ].map(([inset, y0, y1]) => prismSvg(yPrism(offsetRing(EGG_RING, inset), y0, y1, { holes: WELLS().map((ring) => ({ ring, depth: y1 - y0 })) }), { tone: "mid" }));
  const parts = yPrism(EGG_RING, Y.shellMain, Y.shell[1], {
    holes: [{ ring: INNER, depth: Y.shell[1] - Y.floor, floor: { holes: WELLS() } }],
  });
  // Back half: fill, outer sides, floor with wells, inner walls. The rim (front face) is a separate, later item.
  // The outer wall is drawn later, after what sits inside, so the wall hides parts near it.
  const out = [...steps, parts.fill];
  const h = parts.inside[0];
  out.push(h.floor, h.walls, Ln(h.backEdge, { tone: "faint" }));
  const yf = Y.floor;
  for (const c of CELLS) out.push(S(G.ringBand(yf, yf + 3, WELL_R, WELL_R + 1.6, alongY(c.x, c.z), P), { tone: "mid" }));
  return { svg: out.join(""), sides: `<g class="iso-solid">${parts.sides}</g>`, parts };
}

function shellInterior() {
  const list = [];
  // Screw bosses.
  for (const [x, z] of BOSSES) {
    const F = alongY(x, z);
    const svg = S(G.disc(Y.floor, -2.2, 3, F, P), { tone: "mid" }) + `<path class="tg-dark" d="${G.circleOf(F, -2.2, 1.2, P)}"/>` + Ln(G.circleOf(F, -2.2, 1.9, P), { tone: "faint" });
    list.push([-2.2, svg]);
  }
  // Buzzer: brass disc, ceramic disc, silver electrode, glued to the floor.
  const BF = alongY(BUZZER.x, BUZZER.z);
  let buzz = S(G.disc(Y.floor, Y.floor + 0.6, BUZZER.r, BF, P), { tone: "mid" });
  buzz += S(G.disc(Y.floor + 0.6, Y.floor + 1.1, 7.4, BF, P), { tone: "hi" });
  buzz += Ln(G.circleOf(BF, Y.floor + 1.1, 6, P), { tone: "faint" });
  buzz += Dots([at([BUZZER.x - 9, Y.floor + 0.6, BUZZER.z]), at([BUZZER.x + 9, Y.floor + 0.6, BUZZER.z])], { size: 0.45 });
  list.push([Y.floor + 1.1, `<g data-buzzer>${buzz}</g>`]);
  // Two contact springs from the buzzer up to the board.
  for (const dx of [-3.5, 3.5]) {
    // Each spring ends in a small contact cup that the board presses on.
    const c = k.coil(Y.floor + 0.8, -2.7, [BUZZER.x + dx, BUZZER.z], 1.4, 5, "y", P);
    const cup = S(G.disc(-2.9, -2.1, 1.9, alongY(BUZZER.x + dx, BUZZER.z), P), { tone: "mid" });
    // A solder joint where each spring leaves the buzzer.
    const joint = Dots([at([BUZZER.x + dx + 1.4, Y.floor + 0.8, BUZZER.z])], { size: 0.7, tone: "mid" });
    list.push([-2.1, Ln(c.back, { tone: "lo" }) + Ln(c.front, { tone: "mid" }) + cup + joint]);
  }
  // Reset switch: a square body with a metal dome, pressed through a pin hole in the back.
  const rf = { x: RESET.x, z: RESET.z };
  const body = yPrism(roundRect(rf.x, rf.z, 3.2, 3.2, 0.6, 2), Y.floor, Y.floor + 3);
  list.push([Y.floor + 3, prismSvg(body, { tone: "mid" }) + S(G.solidOf([[Y.floor + 3, 1.9], [Y.floor + 3.6, 1.9], [Y.floor + 4.2, 1.2, 1], [Y.floor + 4.4, 0]], alongY(rf.x, rf.z), P), { tone: "hi" })]);
  // Bridge strip across the two cells (it stays in the shell, the cells leave behind it).
  const bridge = yPrism(hull([...circle(CELLS[0].x, CELLS[0].z, 4.2, 20), ...circle(CELLS[1].x, CELLS[1].z, 4.2, 20)]), -3.2, -2.7);
  const tab = yPrism(roundRect(0, ZC - 14, 1, 2.2, 0.4, 2), Y.floor, -3.2);
  list.push([-2.69, prismSvg(tab, { tone: "lo", crease: "none" }) + prismSvg(bridge, { tone: "mid" }) + Dots([at([0, -2.7, ZC - 14])], { size: 0.5, tone: "mid" })]);
  return list;
}

function shellRim(parts) {
  const out = [parts.face];
  out.push(Ln(parts.inside[0].rim, { tone: "lo" }));
  out.push(`<path class="iso-line iso-crease" data-tone="faint" d="${parts.crease}"/>`);
  out.push(`<path class="iso-line iso-edge" data-tone="hi" d="${parts.outline}"/>`);
  // Pin hole for the reset switch and the screw holes show on the back only; on the rim, two locating notches.
  out.push(faceLine(0, local(roundRect(0, ZC - 49, 3, 0.9, 0.9, 3)), { tone: "lo" }));
  return `<g class="iso-solid">${out.join("")}</g>`;
}

function cell(c) {
  const F = alongY(c.x, c.z);
  const y0 = Y.cell[0];
  const y1 = Y.cell[1];
  const profile = c.plus
    ? [[y0, 0], [y0, CELL_R], [y1 - 0.4, CELL_R], [y1, CELL_R - 0.5, 1], [y1, 0]]
    : [[y0, 0], [y0, CELL_R], [y1 - 1.2, CELL_R], [y1 - 0.8, CELL_R - 0.6, 1], [y1 - 0.8, 7.4], [y1, 7.4], [y1, 0]];
  let svg = S(G.lathe(profile, F, P), { tone: "hi" });
  svg += Ln(G.arcOf(F, y1 - 2.4, CELL_R, P), { tone: "faint" });
  if (c.plus) svg += faceLine(y1, localOpen([[c.x - 2.4, c.z + 4], [c.x + 2.4, c.z + 4]]) + localOpen([[c.x, c.z + 1.6], [c.x, c.z + 6.4]]), { tone: "lo", free: true });
  else svg += Ln(G.circleOf(F, y1, 5.8, P), { tone: "faint" });
  return svg;
}

// ---------- Circuit board ----------
const PCB_RING = offsetRing(EGG_RING, 6.5);
const FINGER_Z = [WIN.z + 22.6, WIN.z - 22.6];
function pcb() {
  const [y0, y1] = Y.pcb;
  const holes = BOSSES.map(([x, z]) => ({ ring: circle(x, z, 1.5, 20), depth: 3 }));
  const parts = yPrism(PCB_RING, y0, y1, { holes, bevel: 0.6 });
  const face = [];
  // Traces: from the finger rows round to the epoxy blob, and from the button pads up to it. Drawn first; the blob covers their ends.
  const traces = [];
  for (let i = 0; i < 24; i++) {
    const x = -21.5 + i * (43 / 23);
    const bend = WIN.z + 13 - Math.abs(x) * 0.12;
    traces.push(localOpen([[x, FINGER_Z[0] - 0.8], [x, bend], [x * 0.55, WIN.z + 6]]));
    const lowBend = WIN.z - 13 + Math.abs(x) * 0.12;
    traces.push(localOpen([[x, FINGER_Z[1] + 0.8], [x, lowBend], [x * 0.55, WIN.z - 6]]));
  }
  for (const b of BUTTONS) traces.push(localOpen([[b.x, b.z + 4.5], [b.x, b.z + 9], [b.x * 0.5, WIN.z - 26], [b.x * 0.5, WIN.z - 23.4]]));
  face.push(Ln(traces.join(""), { tone: "faint" }));
  // Finger rows the zebra strips stand on.
  for (const zf of FINGER_Z) {
    const fingers = Array.from({ length: 24 }, (_, i) => local(roundRect(-21.5 + i * (43 / 23), zf, 0.5, 1.6, 0.3, 2))).join("");
    face.push(`<path class="tg-gold" d="${fingers}"/>`);
  }
  // Carbon button pads: an outer ring and an inner disc, interdigitated.
  for (const b of BUTTONS) {
    face.push(`<path class="tg-carbon" d="${local(circle(b.x, b.z, 4.6, 36))}${local(circle(b.x, b.z, 3.4, 36))}"/>`);
    face.push(`<path class="tg-carbon" d="${local(circle(b.x, b.z, 2.2, 28))}"/>`);
    face.push(Ln(local(circle(b.x, b.z, 4.6, 36)), { tone: "lo" }));
  }
  // Boss holes: copper rings.
  for (const [x, z] of BOSSES) face.push(Ln(local(circle(x, z, 2.6, 24)), { tone: "lo" }));
  // Silkscreen outline around the chip area and a pin-1 dot.
  face.push(Ln(local(roundRect(WIN.x, WIN.z, 18, 15, 3, 4)), { tone: "faint" }));
  face.push(`<circle class="tg-ink" cx="-15.5" cy="${-(WIN.z + 12.4)}" r="0.7"/>`);
  return { parts, face: onFace(y1, face.join("")) };
}
function blob() {
  // Chip-on-board epoxy: an irregular low dome over the die and its bond wires.
  const pts = Array.from({ length: 28 }, (_, i) => {
    const t = (i / 28) * TAU;
    const r = 1 + 0.06 * Math.sin(3 * t + 0.6) + 0.04 * Math.cos(5 * t);
    return [WIN.x + 1 + Math.cos(t) * 15 * r, WIN.z + Math.sin(t) * 12.5 * r];
  });
  const ring = hull(pts);
  const base = yPrism(ring, Y.pcb[1], Y.pcb[1] + 1.4, { bevel: 1 });
  const top = yPrism(offsetRing(ring, 3), Y.pcb[1] + 1.4, Y.pcb[1] + 2.2, { bevel: 1.2 });
  return `<g class="tg-epoxy">${prismSvg(base, { tone: "mid" })}${prismSvg(top, { tone: "mid" })}</g>`;
}
function pcbParts() {
  const y1 = Y.pcb[1];
  const list = [];
  // 32.768 kHz watch crystal, lying along x.
  const xF = G.frameAlong([16, y1 + 1.7, ZC - 13], [1, 0, 0]);
  list.push([y1 + 3.4, S(G.solidOf([[-4.5, 1.7], [3.2, 1.7], [3.2, 1.2], [4.5, 1.2]], xF, P), { tone: "hi" }) + Ln(G.arcOf(xF, -3.2, 1.7, P), { tone: "faint" })]);
  // Electrolytic capacitor, standing on the board with its vent cross.
  const cF = alongY(-31, ZC - 12);
  list.push([y1 + 7, S(G.solidOf([[y1, 3], [y1 + 6.4, 3], [y1 + 6.8, 2.6, 1], [y1 + 7, 0]], cF, P), { tone: "hi", inner: Ln(G.arcOf(cF, y1 + 1.4, 3, P), { tone: "faint" }) }) + faceLine(y1 + 7, localOpen([[-32.6, ZC - 12], [-29.4, ZC - 12]]) + localOpen([[-31, ZC - 13.6], [-31, ZC - 10.4]]), { tone: "lo", free: true })]);
  // Three SMD parts beside the blob.
  for (const [x, z] of [[24, ZC - 2], [24, ZC + 4], [-24, ZC - 2]]) {
    const smd = yPrism(roundRect(x, z, 1.8, 1, 0.3, 2), y1, y1 + 1);
    list.push([y1 + 1, prismSvg(smd, { tone: "mid" }) + faceLine(y1 + 1, localOpen([[x - 1.1, z - 1], [x - 1.1, z + 1]]) + localOpen([[x + 1.1, z - 1], [x + 1.1, z + 1]]), { tone: "faint" })]);
  }
  list.push([y1 + 2.2, blob()]);
  return list;
}

// ---------- LCD module ----------
const LCD = { hw: 27, hh: 25 };
const MATRIX = { cols: 32, rows: 16, pitch: 1.15 };
MATRIX.x0 = -(MATRIX.cols * MATRIX.pitch) / 2;
MATRIX.z0 = WIN.z + (MATRIX.rows * MATRIX.pitch) / 2;
const ICON = { size: 8, pitch: 0.72, xs: [-15.2, -5.1, 5.1, 15.2], zTop: WIN.z + 15.4, zBottom: WIN.z - 15.4 };

function zebra(z) {
  const [y0, y1] = Y.zebra;
  const ring = roundRect(0, z, 23, 1.5, 0.6, 2);
  const parts = yPrism(ring, y0, y1);
  const stripes = [];
  for (let x = -22.5; x <= 22.6; x += 1) stripes.push(k.segment([x, y0, z + 1.5], [x, y1, z + 1.5], P));
  return prismSvg(parts, { tone: "mid", after: Ln(stripes.join(""), { tone: "lo" }) });
}
function lcdGlass() {
  const [y0, y1] = Y.lcd;
  const ring = roundRect(0, WIN.z, LCD.hw, LCD.hh, 1, 2);
  const parts = yPrism(ring, y0, y1);
  // Glass is see-through: the background paper shows through it.
  parts.fill = parts.fill.replace('class="iso-fill tg-holed"', 'class="tg-glass-fill tg-holed"');
  parts.face = parts.face.replace('tg-face"', 'tg-face tg-lcd-face"');
  const face = [];
  face.push(Ln(local(roundRect(0, WIN.z, LCD.hw - 2.2, LCD.hh - 3.2, 0.8, 3)), { tone: "faint" }));
  // Contact ledges at top and bottom: the ITO lines the zebra strips touch.
  for (const s of [1, -1]) face.push(Ln(localOpen([[-LCD.hw, WIN.z + s * (LCD.hh - 3.2)], [LCD.hw, WIN.z + s * (LCD.hh - 3.2)]]), { tone: "faint" }));
  // Ghost of every dot and icon segment, and the live layers main.js fills.
  const ghost = [];
  for (let r = 0; r < MATRIX.rows; r++) for (let c = 0; c < MATRIX.cols; c++) ghost.push(`M${fmt(MATRIX.x0 + c * MATRIX.pitch + 0.08)} ${fmt(-(MATRIX.z0 - r * MATRIX.pitch) + 0.08)}h0.99v0.99h-0.99z`);
  face.push(`<path class="tg-ghost" d="${ghost.join("")}"/>`);
  face.push(`<g data-lcd><path class="tg-icons-off" data-icons-ghost d=""/><path class="tg-px" data-px d=""/><path class="tg-px" data-icons d=""/></g>`);
  return prismSvg(parts, { tone: "hi", after: onFace(y1, face.join("")) });
}
function paper() {
  const [y0, y1] = Y.paper;
  const ring = roundRect(0, WIN.z, 24, 20.5, 0.6, 2);
  const parts = yPrism(ring, y0, y1);
  const face = [];
  // Printed scene: a wavy band and two rows of stars, as on the original.
  const wave = (z0, amp) => localOpen(Array.from({ length: 49 }, (_, i) => [-24 + i, z0 + amp * Math.sin(i / 3.2)]));
  face.push(Ln(wave(WIN.z + 4, 1.6) + wave(WIN.z - 1, 1.6) + wave(WIN.z - 6, 1.2), { tone: "faint" }));
  const star = (cx, cz, r) => local(Array.from({ length: 10 }, (_, i) => {
    const t = (i / 10) * TAU - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return [cx + Math.cos(t) * rr, cz - Math.sin(t) * rr];
  }));
  const stars = [-16, -5, 6, 17].flatMap((x, i) => [star(x, WIN.z + 14.5 - (i % 2) * 1.5, 3.2), star(x + 3, WIN.z - 14.5 + (i % 2) * 1.5, 3.2)]);
  face.push(Ln(stars.join(""), { tone: "lo" }));
  return prismSvg(parts, { tone: "mid", after: onFace(y1, face.join("")) });
}
function sponge() {
  const [y0, y1] = Y.sponge;
  const ring = roundRect(0, WIN.z, 22, 19, 1, 3);
  const parts = yPrism(ring, y0, y1);
  const pores = [];
  for (let zi = 0; zi < 11; zi++) for (let xi = 0; xi < 13; xi++) pores.push(at([-19 + xi * 3.2 + (zi % 2) * 1.6, y1, WIN.z - 16 + zi * 3.2]));
  return prismSvg(parts, { tone: "mid", after: Dots(pores, { size: 0.4, tone: "lo" }) });
}

// ---------- Buttons ----------
function pad() {
  const [y0, y1] = Y.pad;
  const ring = hull(BUTTONS.flatMap((b) => circle(b.x, b.z, 7.6, 32)));
  const parts = yPrism(ring, y0, y1, { bevel: 1 });
  return prismSvg(parts, { tone: "mid" });
}
const DOME_BASE = (y) => [[Y.dome[0], 5.2], [Y.dome[0] + 1.6, 5.2], [Y.dome[0] + 1.6, BTN_R], [y, BTN_R]];
const DOME_CAP = (y) => [[y, BTN_R], [Y.dome[1] - 1.4, BTN_R], [Y.dome[1] - 0.6, BTN_R - 0.9, 1], [Y.dome[1] - 0.15, BTN_R - 2.1, 1], [Y.dome[1], 0]];
const CAP_FROM = Y.cover[1] - 0.2;
function domeBase(b) {
  return S(G.solidOf(DOME_BASE(CAP_FROM), alongY(b.x, b.z), P), { tone: "hi" });
}
function domeCap(b) {
  return S(G.solidOf(DOME_CAP(CAP_FROM), alongY(b.x, b.z), P, { smooth: { rows: 4 } }), { tone: "hi" });
}

// ---------- Screen window ----------
function protector() {
  const [y0, y1] = Y.protector;
  const ring = [...roundRect(0, WIN.z, 25, 24, 2, 4)];
  const parts = yPrism(ring, y0, y1);
  parts.fill = parts.fill.replace('class="iso-fill tg-holed"', 'class="tg-clear-fill tg-holed"');
  parts.face = parts.face.replace("tg-face", "tg-face tg-clear-face");
  const tabs = [WIN.z + 25.6, WIN.z - 25.6].map((z) => prismSvg(yPrism(roundRect(0, z, 7, 1.6, 0.8, 3), y0, y0 + 1), { tone: "lo" })).join("");
  // A glint across one corner, edge to edge.
  const glint = faceLine(y1, localOpen([[-25, WIN.z + 13], [-12, WIN.z + 24]]) + localOpen([[-25, WIN.z + 8], [-7, WIN.z + 24]]), { tone: "faint" });
  return tabs + prismSvg(parts, { tone: "lo", after: glint });
}

// ---------- Front cover ----------
function starburst() {
  // The printed splash round the window, kept inside the shell's face.
  const limit = offsetRing(EGG_RING, TIERS[1] + 3.5);
  const inside = (x, z) => {
    let wind = false;
    for (let i = 0, j = limit.length - 1; i < limit.length; j = i++) {
      const [xi, zi] = limit[i];
      const [xj, zj] = limit[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) wind = !wind;
    }
    return wind;
  };
  const pts = [];
  const N = 44;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * TAU;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const edge = Math.min(WIN.hw / Math.max(Math.abs(c), 1e-6), WIN.hh / Math.max(Math.abs(s), 1e-6));
    let r = edge + (i % 2 ? 2.6 : 7.4 + 1.6 * Math.sin(i * 1.7));
    while (r > edge + 1.6 && !inside(WIN.x + c * r, WIN.z + s * r)) r -= 0.4;
    pts.push([WIN.x + c * r, WIN.z + s * r]);
  }
  return local(pts);
}
function cover() {
  const [y0, y1] = Y.cover;
  const win = (depth) => ({ ring: roundRect(WIN.x, WIN.z, WIN.hw, WIN.hh, WIN.r, 6), depth });
  const keys = (depth) => BUTTONS.map((b) => ({ ring: circle(b.x, b.z, BTN_HOLE, 40), depth }));
  // The wall, then two steps that round the face; the window and button holes run through all three.
  const main = yPrism(EGG_RING, y0, Y.coverMain, { holes: [win(0.1), ...keys(3)] });
  const tier = yPrism(offsetRing(EGG_RING, TIERS[0]), Y.coverMain, Y.coverTier, { holes: [win(Y.coverTier - Y.protector[1]), ...keys(Y.coverTier - Y.coverMain)] });
  const face = yPrism(offsetRing(EGG_RING, TIERS[1]), Y.coverTier, y1, { holes: [win(y1 - Y.coverTier), ...keys(y1 - Y.coverTier)], bevel: 0.9 });
  const print = [
    Ln(starburst(), { tone: "lo" }),
    Ln(local(roundRect(WIN.x, WIN.z, WIN.hw + 1.6, WIN.hh + 1.6, WIN.r + 1.6, 6)), { tone: "faint" }),
  ].join("");
  return prismSvg(main, { tone: "hi" }) + prismSvg(tier, { tone: "hi" }) + prismSvg(face, { tone: "hi", after: onFace(y1, print) });
}

// ---------- Ball chain, from the lug down the right side onto the plate ----------
function chain() {
  const route = [
    [0, -9, ZC + 55],
    [10, -9, ZC + 58.5],
    [26, -9, ZC + 52],
    [44, -9, ZC + 34],
    [52, -9, ZC + 8],
    [54, -9, 1.1],
    [55, 8, 1.1],
    [50, 26, 1.1],
    [40, 34, 1.1],
    [30, 30, 1.1],
  ];
  const line = G.fillet(route, 7, 10);
  const pts = G.resample(line, 2.15);
  const balls = pts.map((p) => {
    const [sx, sy] = at(p);
    return `<circle cx="${fmt(sx)}" cy="${fmt(sy)}" r="${fmt(0.95 * G.scaleOf(P) * 0.62)}"/>`;
  });
  const clasp = (() => {
    const p = G.pointAlong(line, G.pathLength(line) * 0.66);
    const t = G.tangentAlong(line, G.pathLength(line) * 0.66);
    const F = G.frameAlong(p, t);
    return S(G.solidOf([[-2.6, 0.8], [-1.6, 1.3, 1], [0, 1.5, 1], [1.6, 1.3, 1], [2.6, 0.8]], F, P), { tone: "mid" });
  })();
  return `<g class="tg-chain">${balls.join("")}</g>${clasp}`;
}

// ---------- Halo under each floating layer ----------
function haloUnder(xHalf, y0, y1) {
  return `<path class="iso-halo tg-float-halo" d="${k.haloOf({ x: -xHalf, y: y0 - 2, w: xHalf * 2, d: y1 - y0 + 4, r: 2 }, 0, 0.1, P)}"/>`;
}

// ---------- Assemble the item list (key = front y of the item; main.js adds move × share) ----------
const back = shellBack();
put("battery", Y.battery[1], batteryCover());
CELLS.forEach((c, i) => put("cells", Y.cell[1] - 0.01 * i, cell(c)));
put("shell", Y.shellMain + 6, lug());
put("shell", Y.floor - 0.5, back.svg);
shellInterior().forEach(([key, svg]) => put("shell", key, svg));
put("shell", -0.5, back.sides);
put("stand", -0.45, cradle());
put("shell", -0.48, chain());
put("shell", 0, shellRim(back.parts));
const board = pcb();
put("pcb", Y.pcb[1], prismSvg(board.parts, { tone: "hi", after: board.face }));
pcbParts().forEach(([key, svg]) => put("pcb", key, svg));
FINGER_Z.forEach((z) => put("lcd", Y.zebra[1] - 0.05, zebra(z)));
put("sponge", Y.sponge[1], sponge());
put("paper", Y.paper[1], paper());
put("lcd", Y.lcd[1], lcdGlass());
put("pad", Y.pad[1], pad());
BUTTONS.forEach((b, i) => put("pad", Y.cover[1] - 0.3, domeBase(b), { button: i }));
put("protector", Y.protector[1], protector());
put("cover", Y.cover[1], cover());
BUTTONS.forEach((b, i) => put("pad", Y.dome[1], domeCap(b), { button: i, cap: true }));
// Halos for the parts that float when apart.
const HALO = { cover: [43, ...Y.cover], protector: [25, ...Y.protector], pad: [25, Y.pad[0], Y.dome[1]], lcd: [27, ...Y.lcd], paper: [24, ...Y.paper], sponge: [22, ...Y.sponge], pcb: [37, Y.pcb[0], Y.pcb[1] + 7], cells: [25, ...Y.cell], battery: [40, ...Y.battery] };
for (const [id, [xh, y0, y1]] of Object.entries(HALO)) put(id, -900, haloUnder(xh, y0, y1), { halo: true });

const groups = items.map((item, index) => {
  const dy = PIECES[item.piece]?.move ?? 0;
  const attrs = [`class="it"`, `data-piece="${item.piece}"`, `data-k="${item.key.toFixed(2)}"`, `data-m="${dy}"`, `data-i="${index}"`];
  if (item.button !== undefined) attrs.push(`data-btn="${item.button}"`);
  if (item.cap) attrs.push(`data-cap`);
  if (item.halo) attrs.push(`data-halo`);
  return `<g ${attrs.join(" ")}>${item.svg}</g>`;
});

const LABEL =
  "A Tamagotchi standing upright in a cradle on a bench plate, with a ball chain from its lug. Taken apart, its layers float out along its axis: front cover, screen window, silicone buttons, the LCD with two zebra strips, the background paper, a sponge, the circuit board with its epoxy-covered chip, crystal and capacitor; the back shell stays in the cradle with its buzzer, reset switch and battery wells, and two LR44 cells and the battery cover come out of the back.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: `<g class="tg-items">${groups.join("")}</g>`, className: "tg-svg" });

const unit = (v) => {
  const o = at([0, 0, 0]);
  const p = at(v);
  return [p[0] - o[0], p[1] - o[1]];
};
// Two framings: tight on the egg when it is whole, the whole bench when it is apart.
function frame(points, pad) {
  const flat = points.map(at);
  let x0 = Math.min(...flat.map((p) => p[0])) - pad;
  let x1 = Math.max(...flat.map((p) => p[0])) + pad;
  let y0 = Math.min(...flat.map((p) => p[1])) - pad;
  let y1 = Math.max(...flat.map((p) => p[1])) + pad;
  const aspect = W / H;
  if ((x1 - x0) / (y1 - y0) < aspect) {
    const grow = (y1 - y0) * aspect - (x1 - x0);
    x0 -= grow / 2;
    x1 += grow / 2;
  } else {
    const grow = (x1 - x0) / aspect - (y1 - y0);
    y0 -= grow / 2;
    y1 += grow / 2;
  }
  return [x0, y0, x1 - x0, y1 - y0].map((n) => Math.round(n * 10) / 10);
}
const HOME_VIEW = frame([[-50, -20, 0], [50, -20, 0], [-50, 40, 0], [58, 40, 0], [0, -9, ZC + 62], [-44, 16, ZC], [56, -9, ZC]], 26);
// Where each layer scales from when hovered: its middle, at home.
const CENTRES = Object.fromEntries(Object.entries({
  cover: [0, 7.5, ZC], protector: [0, 11.9, WIN.z], pad: [0, 8, ZC - 33], lcd: [0, 9, WIN.z], paper: [0, 6.7, WIN.z],
  sponge: [0, 3.7, WIN.z], pcb: [0, 0, ZC], shell: [0, -7, ZC], cells: [0, -8.6, ZC - 14], battery: [0, -15.5, ZC - 20],
}).map(([id, p]) => [id, at(p)]));
const DATA = {
  EY: unit([0, 1, 0]),
  views: { home: HOME_VIEW, apart: [0, 0, W, H] },
  pieces: Object.fromEntries(Object.entries(PIECES).map(([id, p]) => [id, { name: p.name, say: p.say, move: p.move, centre: CENTRES[id].map((n) => Math.round(n * 10) / 10) }])),
  stagger: STAGGER,
  spring: SPRING,
  order: ORDER,
  matrix: MATRIX,
  icon: ICON,
  pressDepth: 1.6,
  capFrom: CAP_FROM,
};

const PARTS = ORDER.map((id, i) => `<button type="button" class="tg-part" data-part="${id}"><span class="tg-num">${String(i + 1).padStart(2, "0")}</span>${PIECES[id].name}</button>`).join("");
// The gallery box shows only the drawing: no title, hint or readout (the player would print the readout under it).
const corners = PROJECT
  ? `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="title">Tamagotchi · 1996</span><span class="iso-plate-corner" data-corner="readout" data-readout>hunger ♥♥♥♡ · happy ♥♥♡♡</span></div>`
  : "";
const controls = `<div class="tg-controls"><span class="tg-keys" role="group" aria-label="Tamagotchi buttons"><button type="button" class="tg-key" data-press="0" aria-label="A: next icon">A</button><button type="button" class="tg-key" data-press="1" aria-label="B: choose">B</button><button type="button" class="tg-key" data-press="2" aria-label="C: back">C</button></span><button type="button" class="tg-apart" data-apart aria-pressed="false">Take apart</button><span class="tg-hint"><b>A</b> next icon · <b>B</b> choose · <b>C</b> back · <b>Space</b> take apart</span><span class="tg-live" aria-live="polite" data-live></span></div>`;
const TIP = `<div class="tg-tip" data-tip aria-hidden="true"><b data-tip-name></b><span data-tip-say></span></div>`;
const stage = `<div class="tg-stage" tabindex="0" role="group" aria-label="Tamagotchi teardown. Press A, B and C to play with it; Space takes it apart and puts it back; the parts list below highlights one layer.">${TIP}${PROJECT ? "" : `<span class="tg-live" aria-live="polite" data-live></span>`}${svg.replace(`viewBox="0 0 ${W} ${H}"`, `viewBox="${HOME_VIEW.join(" ")}"`)}</div>`;
const caption =
  "Inside the 1996 egg is a 4-bit Epson microcontroller bonded straight onto the board and sealed under a blob of black epoxy, ticking from a 32.768 kHz watch crystal. Every few minutes of its clock the pet gets hungrier and sadder. The three buttons are silicone domes with carbon pills that close interleaved pads on the board; the chip answers by driving a 32 × 16 dot LCD whose rows and columns reach the board through two zebra strips of conductive rubber, pressed into contact by a sponge. Two LR44 cells in series give 3.0 V; a piezo disc in the back shell beeps. Time runs fast here: a heart drains in under half a minute.";
const body = `<figure class="iso-figure tg"><div class="iso-plate">${corners}${stage}${PROJECT ? controls : ""}</div><figcaption class="iso-legend"><span class="tg-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const COMPONENT_CSS = `
.tg-holed{fill-rule:evenodd}
.tg-dark{fill:var(--anatomy-hi);opacity:.82}
.tg-ink{fill:var(--anatomy-mid)}
.tg-gold{fill:var(--anatomy-mid);opacity:.55}
.tg-carbon{fill:var(--anatomy-lo);fill-rule:evenodd;opacity:.6}
.tg-epoxy .iso-top,.tg-epoxy .iso-shade,.tg-epoxy .iso-fill{fill:var(--tg-epoxy)}
.tg-epoxy .iso-shade[data-shade="0"],.tg-epoxy .iso-shade[data-shade="1"]{fill:var(--tg-epoxy-side)}
.tg-glass-fill{fill:var(--anatomy-paper);opacity:.35}
.tg-lcd-face{fill:var(--tg-lcd)!important;opacity:.72}
.tg-clear-fill{fill:var(--anatomy-paper);opacity:.08}
.tg-clear-face{opacity:.18}
.tg-ghost{fill:var(--anatomy-lit);opacity:.03}
.tg-icons-off{fill:var(--anatomy-lit);opacity:.07}
.tg-px{fill:var(--anatomy-lit)}
[data-lcd]{transition:opacity .45s var(--anatomy-ease)}
.tg-chain circle{fill:var(--anatomy-face);stroke:var(--anatomy-mid);stroke-width:var(--anatomy-weight)}
.tg-float-halo{opacity:0;filter:blur(5px)}
.it[data-btn]{cursor:pointer}
.tg{--tg-epoxy:#59595d;--tg-epoxy-side:#48484c;--tg-lcd:#d9ddd2}
.iso[data-theme="dark"] .tg{--tg-epoxy:#0c0c0c;--tg-epoxy-side:#070707;--tg-lcd:#2a2d27}
.tg-stage{position:relative;touch-action:pan-y;outline:none;margin:0 -24px}
.tg .iso-plate{overflow:hidden}
.tg-key,.tg-apart{background:var(--anatomy-card)!important}
.tg-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.tg-stage[data-focus] .it:not([data-on]):not([data-piece="stand"]){--anatomy-hi:var(--anatomy-mid);--anatomy-mid:var(--anatomy-lo)}
.tg-stage[data-focus] .it[data-piece="stand"]{--anatomy-mid:var(--anatomy-lo)}
.it[data-on]{--anatomy-hi:var(--anatomy-lit);--anatomy-mid:var(--anatomy-hi)}
.it[data-on] .iso-top{fill:var(--anatomy-lit-top)}
.it[data-on] .iso-shade{fill:var(--anatomy-lit-shade)}
.tg-controls{position:absolute;left:20px;right:20px;bottom:14px;display:flex;align-items:center;gap:14px;font-family:var(--anatomy-mono);font-size:10.5px;letter-spacing:.04em;color:var(--anatomy-muted)}
.tg-keys{display:inline-flex;gap:6px}
.tg-key,.tg-apart,.tg-part{font:inherit;color:var(--anatomy-text);background:none;border:0;box-shadow:0 0 0 1px var(--anatomy-lo);border-radius:999px;transition:box-shadow .16s var(--anatomy-ease),color .16s var(--anatomy-ease),transform .12s var(--anatomy-ease)}
.tg-key{width:26px;height:26px;display:grid;place-items:center;padding:0}
.tg-apart{height:26px;padding:0 12px;text-transform:uppercase;letter-spacing:.1em}
.tg-key:hover,.tg-apart:hover,.tg-part:hover{box-shadow:0 0 0 1px var(--anatomy-mid);color:var(--anatomy-strong)}
.tg-key:active{transform:scale(.94)}
.tg-key[data-down]{box-shadow:0 0 0 1px var(--anatomy-hi);color:var(--anatomy-strong)}
.tg-apart[aria-pressed="true"]{box-shadow:0 0 0 1px var(--anatomy-hi);color:var(--anatomy-strong)}
.tg-key:focus-visible,.tg-apart:focus-visible,.tg-part:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:3px}
.tg-hint{text-transform:uppercase;letter-spacing:.1em;margin-left:auto}
.tg-tip{position:absolute;left:0;top:0;z-index:2;pointer-events:none;display:grid;gap:2px;padding:7px 10px;max-width:260px;background:var(--anatomy-card);box-shadow:0 0 0 1px var(--anatomy-mid),0 6px 18px -8px #0003;font-family:var(--anatomy-mono);font-size:11.5px;line-height:1.4;color:var(--anatomy-text);opacity:0;transform:translate(var(--tx),var(--ty)) scale(.96);transform-origin:0 0;transition:opacity .16s var(--anatomy-ease),transform .22s var(--anatomy-ease)}
.tg-tip[data-on]{opacity:1;transform:translate(var(--tx),var(--ty)) scale(1)}
.tg-tip b{font-weight:500;color:var(--anatomy-strong)}
.tg-stage[data-apart] .it:not([data-piece="stand"]):not([data-halo]){cursor:pointer}
@media (prefers-reduced-motion:reduce){.tg-tip{transition:none}}
.tg-cursor{position:absolute;left:0;top:0;z-index:3;width:18px;height:18px;border-radius:50%;background:#8E8E93;box-shadow:0 0 0 1px #ffffff8c,0 2px 6px -1px #0004;pointer-events:none;will-change:transform}
.tg-hint b{font-weight:inherit;color:var(--anatomy-strong)}
.tg-live{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.tg .iso-plate{padding:52px 24px 60px}
.tg .iso-plate-corner[data-corner="title"]{right:auto;left:0}
.tg .iso-plate-corner[data-corner="readout"]{top:0;bottom:auto;left:auto;right:0;transform:none}
.tg-parts{display:flex;flex-wrap:wrap;gap:6px}
.tg-part{display:inline-flex;align-items:center;gap:8px;height:26px;padding:0 11px 0 9px;font-family:var(--anatomy-mono);font-size:11px;letter-spacing:.02em}
.tg-part[data-on]{box-shadow:0 0 0 1px var(--anatomy-hi);color:var(--anatomy-strong)}
.tg-num{color:var(--anatomy-muted);font-variant-numeric:tabular-nums}
@media (max-width:640px){
  .tg .iso-plate{padding:48px 8px 104px}
  .tg-stage{margin:0 -8px}
  .tg-controls{flex-wrap:wrap;row-gap:10px;bottom:12px}
  .tg .iso-plate{padding-top:64px}
  .tg .iso-plate{padding-bottom:124px}
  .tg-hint{margin-left:0;width:100%;letter-spacing:.06em}
  .tg .iso-plate-corner[data-corner="readout"]{top:20px;bottom:auto;left:0;right:auto;transform:none}
}
`;
const PAGE_CSS = `
.iso-page{width:min(1440px,100% - 48px,(100vh - 150px) * 1.45);margin:24px auto 56px}
.tg .iso-plate-corner{font-size:12.5px}
.tg-controls{font-size:12px!important}
.tg-key{width:32px!important;height:32px!important}
.tg-apart{height:32px!important;padding:0 16px!important}
.tg-part{height:30px!important;font-size:12.5px!important}
.tg .iso-legend{font-size:14.5px}
body.iso{background:var(--anatomy-page);color:var(--anatomy-text);font:14px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;height:auto;min-height:100%}
html{color-scheme:light}
html:has(body[data-theme="dark"]){color-scheme:dark}
`;

const DATA_TAG = `<script type="application/json" id="tg-data">${JSON.stringify(DATA)}</script>`;
if (PROJECT) {
  // The site's shared reset, linked from the page (only in --project mode; the gallery page is self-contained).
  const SITE_BASE_CSS = ["..", "..", "shared", "css", "base.css"].join("/");
  const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Tamagotchi Breakdown</title>
<link rel="stylesheet" href="${SITE_BASE_CSS}" />
<link rel="stylesheet" href="styles.css" />
</head>
<body class="iso" data-theme="${THEME}">
<script>{const t = new URLSearchParams(location.search).get("theme"); if (t === "dark" || t === "light") document.body.dataset.theme = t;}</script>
<main class="iso-page">
${body}
</main>
${DATA_TAG}
<script src="main.js" defer></script>
</body>
</html>
`;
  writeFileSync(join(HERE, "index.html"), HTML);
  writeFileSync(join(HERE, "styles.css"), `/* Generated by build.mjs: the Anatomy kit's ISO_CSS plus this figure's styles. */
${k.ISO_CSS}${PAGE_CSS}${COMPONENT_CSS}`);
  console.log(`wrote index.html (${(HTML.length / 1024).toFixed(0)} KB, ${items.length} items) and styles.css · theme ${THEME}`);
} else {
  // One self-contained page: styles, data and the live script inlined.
  const name = THEME === "light" ? "tamagotchi-teardown-light.html" : "tamagotchi-teardown.html";
  // The recording demo stays on the site; the gallery page leaves it out.
  const live = readFileSync(join(HERE, "main.js"), "utf8").replace(/[ \t]*\/\/ @demo-start[\s\S]*?\/\/ @demo-end\n/g, "");
  const GALLERY_CSS = `
.iso-page{width:min(1440px,100% - 32px)}
.tg .iso-plate{padding:40px 12px 44px}
.tg-stage{margin:0 -12px}
.tg-stage .it:not([data-piece="stand"]):not([data-halo]){cursor:pointer}
`;
  const page = k.pageHtml({ title: "Tamagotchi teardown", theme: THEME, body: `<style>${PAGE_CSS}${COMPONENT_CSS}${GALLERY_CSS}</style>${body}${DATA_TAG}`, script: live, width: 1440 });
  writeFileSync(join(HERE, name), page);
  console.log(`wrote ${name} (${(page.length / 1024).toFixed(0)} KB, ${items.length} items)`);
}
