import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));



const WIDTH = 600, HEIGHT = 470, OX = 0, DW = 600;

// ---- world (units ~ mm, z up). Viewer looks from +x +y. ----
const PLATE = { x: -96, y: -92, w: 190, d: 184, r: 10 };
const PLATE_H = 8, FOOT_H = 5;
const BODY = { x: -66, y: -66, w: 132, d: 132, r: 30 };
const BASE_H = 14, SHELL_T = 5, WALL_TOP = 124;
const DR = { x: -50, y: -50, w: 100, d: 100, r: 16 };
const DR_FLOOR = BASE_H + 3, DR_TOP = 48, LIP_TOP = 24, DR_T = 3;
const PL = { x: -45, y: -45, w: 90, d: 90, r: 12 }, PL_Z = 30, PL_TOP = 31.4;
const FOOD_TOP = PL_TOP + 3.4;
const BAR_Z = 61, COIL_Z = 64;
const FAN_Z = 86, FAN_R = 34, HUB_R = 6;
const MOTOR_R = 12, MOTOR_Z0 = 104, MOTOR_Z1 = 118, ARM_TOP = 122;
const KNOB = [26, 56], KNOB_R = 4.6, KNOB_H = 6;
const LAMP = [6, 56];
const IN = -66 + SHELL_T; // inner face of the back shell on its straight runs
const PROBE = { x: 18, y: IN, w: 4, d: 24, r: 1.4 }, PROBE_Z = 66;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-66, -66, WALL_TOP], [-66, 66, WALL_TOP], [66, -66, WALL_TOP], [82, 0, 34], [0, 0, ARM_TOP]],
  DW, HEIGHT, { pad: 30, azimuth: 45, elevation: 30 },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const R = A.recorder(P);
const put = (name, centre, svg, shapes, extra = {}) => R.put({ name, at: centre, svg, shapes: shapes.map((s) => R.solid(s)), ...extra });

// far half (x + y <= 0) and near half of a rounded plan, as a band of thickness t
function halfBand(plan, t, far, steps = 10) {
  const sel = (ring) => {
    const n = ring.length, keep = ring.map(([x, y]) => (far ? x + y <= 0.001 : x + y >= -0.001));
    let s = keep.findIndex((v, i) => v && !keep[(i - 1 + n) % n]);
    const out = [];
    for (let i = 0; i < n; i++) { const j = (s + i) % n; if (!keep[j]) break; out.push(ring[j]); }
    return out;
  };
  const o = sel(k.ringOf(plan, steps)), inner = sel(k.ringOf(k.insetPlan(plan, t), steps));
  // align ends: both lists run the same way round
  return [...o, ...inner.reverse()];
}

// ---- bench plate ----
{
  for (const [x, y] of k.corners(PLATE, 20)) {
    put(R.nameFor("stand.foot"), [x, y, -PLATE_H - 2],
      S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }) + S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }),
      [A.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, { name: "stand.foot.pad" }), A.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, { name: "stand.foot" })]);
  }
  const screws = k.corners(PLATE, 9);
  const strip = { x: -60, y: PLATE.y + PLATE.d - 13, w: 128, d: 7, r: 1 };
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  const svg = `<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>` +
    S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid", inner: L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }) }) +
    L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }) + D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }) +
    S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }) + L(ticks.minor, { tone: "lo" }) + L(ticks.major, { tone: "mid" }) +
    D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 });
  put("stand.plate", [0, 0, -PLATE_H], svg, [A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate" }), A.slab(strip, 0, 0.6, { name: "stand.strip" }, 3)]);
}
// ---- appliance base (rounded body footprint) ----
{
  const svg = `<path class="iso-halo" d="${k.haloOf(BODY, 0, BASE_H, P)}" style="filter:blur(5px)"/>` +
    S(k.slabOf(BODY, 0, BASE_H, P, 10, 1.2), { tone: "mid", inner: L(k.sideSeam(BODY, 4, P, 10), { tone: "lo" }) }) +
    L(k.planOutline(k.insetPlan(BODY, 3.5), BASE_H, P, 10), { tone: "faint" });
  put("base.body", [0, 0, 4], svg, [A.slab(BODY, 0, BASE_H, { name: "base.body" }, 10)]);
  const [x, y] = KNOB;
  const ticks = k.radialTicks(x, y, KNOB_R + 1.2, 24, 4, BASE_H, [1, 1.9], P, Math.PI * 0.25, Math.PI * 1.5);
  const ksvg = L(ticks.minor, { tone: "lo" }) + L(ticks.major, { tone: "mid" }) +
    S(k.cylinder(x, y, KNOB_R + 0.8, BASE_H, 1, P, 28), { tone: "mid" }) +
    S(k.cylinder(x, y, KNOB_R, BASE_H + 1, KNOB_H - 1, P, 32, 0.4), { tone: "hi", crease: "lo" }) +
    L(k.knurl(x, y, KNOB_R, BASE_H + 1.4, BASE_H + KNOB_H - 0.6, 30, P), { tone: "lo" }) +
    `<path data-part="knob" class="iso-line" data-tone="lit" data-free="end" style="stroke-width:0.9" d="${k.lineOnTop([x, y], [x + Math.sin(Math.PI * 1.75) * (KNOB_R - 1), y - Math.cos(Math.PI * 1.75) * (KNOB_R - 1)], BASE_H + KNOB_H, P)}"/>` +
    D([at([x, y, BASE_H + KNOB_H])], { size: 0.5, tone: "hi" });
  put("base.knob", [x, y, BASE_H + 3], ksvg, [A.cylinder(x, y, KNOB_R + 0.8, BASE_H, 1, { name: "base.knob.collar" }), A.cylinder(x, y, KNOB_R, BASE_H + 1, KNOB_H - 1, { name: "base.knob" })]);
  const [lx, ly] = LAMP, lc = at([lx, ly, BASE_H + 2.2]);
  put("base.lamp", [lx, ly, BASE_H + 1], S(k.cylinder(lx, ly, 3, BASE_H, 1, P, 24), { tone: "mid" }) + S(k.cylinder(lx, ly, 2, BASE_H + 1, 1.2, P, 20), { tone: "hi" }) +
    `<circle data-part="lamp" cx="${lc[0]}" cy="${lc[1]}" r="1.5" style="fill:#e5484d;opacity:0"/>`,
    [A.cylinder(lx, ly, 3, BASE_H, 1, { name: "base.lamp.bezel" }), A.cylinder(lx, ly, 2, BASE_H + 1, 1.2, { name: "base.lamp" })]);
}
// ---- back half of the rounded outer shell (cutaway) ----
{
  const ring = halfBand(BODY, SHELL_T, true);
  const h = WALL_TOP - BASE_H;
  const slots = [];
  for (let i = 0; i < 6; i++) { const x0 = -30 + i * 10; slots.push(`M${at([x0, IN, 98]).join(" ")}L${at([x0 + 6, IN, 98]).join(" ")}L${at([x0 + 6, IN, 114]).join(" ")}L${at([x0, IN, 114]).join(" ")}Z`); }
  const svg = S(k.extrude(ring, BASE_H, h, P, { convex: false, bevel: 0.5 }), { tone: "mid" }) + L(slots.join(""), { tone: "lo" }) +
    D([-40, -20, 0, 20, 40].map((x) => at([x, IN, 24])), { size: 0.4, tone: "lo" });
  put("shell", [-40, -40, 70], svg, [A.extruded(ring, BASE_H, h, { name: "shell", owner: "shell" })]);
}
// ---- pull-out drawer: floor (drip pan), far wall, low near lip, handle ----
{
  put("drawer.floor", [0, 0, BASE_H + 1.5], S(k.slabOf(DR, BASE_H, DR_FLOOR - BASE_H, P, 8, 0.5), { tone: "lo" }) +
    L(k.planOutline(k.insetPlan(DR, DR_T + 1.5), DR_FLOOR, P, 8), { tone: "mid" }),
    [A.slab(DR, BASE_H, DR_FLOOR - BASE_H, { name: "drawer.floor", owner: "drawer" })]);
  const far = halfBand(DR, DR_T, true, 8), near = halfBand(DR, DR_T, false, 8);
  put("drawer.wall", [-30, -30, 32], S(k.extrude(far, DR_FLOOR, DR_TOP - DR_FLOOR, P, { convex: false, bevel: 0.4 }), { tone: "mid" }),
    [A.extruded(far, DR_FLOOR, DR_TOP - DR_FLOOR, { name: "drawer.wall", owner: "drawer" })]);
  put("drawer.lip", [30, 30, 20], S(k.extrude(near, DR_FLOOR, LIP_TOP - DR_FLOOR, P, { convex: false, bevel: 0.4 }), { tone: "mid" }),
    [A.extruded(near, DR_FLOOR, LIP_TOP - DR_FLOOR, { name: "drawer.lip", owner: "drawer" })]);
  const arm = { x: 49.5, y: -6, w: 22, d: 12, r: 2 }, grip = { x: 70, y: -9, w: 12, d: 18, r: 4 };
  put("drawer.handle", [72, 0, 24], S(k.slabOf(arm, 18, 5, P, 3, 0.4), { tone: "mid" }) + D([at([arm.x + 8, 0, 23]), at([arm.x + 16, 0, 23])], { size: 0.45 }) +
    S(k.slabOf(grip, 16, 18, P, 6, 0.8), { tone: "mid" }) + L(k.planOutline(k.insetPlan(grip, 2.5), 34, P), { tone: "faint" }) +
    L([21, 25, 29].map((z) => k.sideSeam(grip, z, P, 6)).join(""), { tone: "lo" }),
    [A.slab(arm, 18, 5, { name: "drawer.arm", owner: "drawer" }, 3), A.slab(grip, 16, 18, { name: "drawer.grip", owner: "drawer" }, 6)]);
}
// ---- crisper plate on four legs, drip space below ----
{
  for (const [x, y] of [[-32, -32], [32, -32], [-32, 32], [32, 32]]) {
    put(R.nameFor("plate.leg"), [x, y, 24], S(k.cylinder(x, y, 2.2, DR_FLOOR, PL_Z - DR_FLOOR, P, 18), { tone: "mid" }), [A.cylinder(x, y, 2.2, DR_FLOOR, PL_Z - DR_FLOOR, { name: "plate.leg", owner: "plate" })]);
  }
  const holes = [];
  for (let gx = -39; gx <= 39; gx += 4.875) for (let gy = -39; gy <= 39; gy += 4.875) {
    if (Math.max(Math.abs(gx), Math.abs(gy)) > 37 && Math.hypot(Math.abs(gx) - 33, Math.abs(gy) - 33) > 4) continue;
    if (Math.abs(gx) > 33 && Math.abs(gy) > 33 && Math.hypot(Math.abs(gx) - 33, Math.abs(gy) - 33) > 4) continue;
    holes.push(k.ring(gx, gy, 1.1, PL_TOP, P, 10));
  }
  put("plate.mesh", [0, 0, PL_TOP], S(k.slabOf(PL, PL_Z, PL_TOP - PL_Z, P, 8, 0.4), { tone: "mid" }) + L(holes.join(""), { tone: "lo" }) +
    L(k.planOutline(k.insetPlan(PL, 2.4), PL_TOP, P, 8), { tone: "lo" }),
    [A.slab(PL, PL_Z, PL_TOP - PL_Z, { name: "plate.mesh", owner: "plate" })]);
}
// ---- fries on the plate ----
const FRIES = [[-22, -10, 20, 0.3], [-6, -24, 22, -0.5], [10, -8, 18, 1.2], [-14, 14, 24, 0.9], [8, 16, 20, -0.2], [24, 2, 14, 1.6], [-28, 4, 12, -1.1], [0, 0, 16, 0.6], [18, -24, 12, 0.1], [2, 32, 12, 0.2], [-30, -26, 12, 0.8], [28, 24, 12, -0.9]];
{
  const list = FRIES.map(([cx, cy, len, ang]) => { const c = Math.cos(ang), s = Math.sin(ang); return { cx, cy, ring: [[-len / 2, -1.7], [len / 2, -1.7], [len / 2, 1.7], [-len / 2, 1.7]].map(([u, v]) => [cx + u * c - v * s, cy + u * s + v * c]) }; });
  for (const { ring, cx, cy } of list) put(R.nameFor("food.fry"), [cx, cy, PL_TOP + 1.7], `<g data-part="fry">${S(k.extrude(ring, PL_TOP, FOOD_TOP - PL_TOP, P, { bevel: 0.3 }), { tone: "hi" })}</g>`, [A.extruded(ring, PL_TOP, FOOD_TOP - PL_TOP, { name: "food.fry" })]);
}
// ---- heating element ----
const COIL = [];
{
  const bar = { x: IN, y: -2, w: 38 - IN, d: 4, r: 1 };
  put("element.bar", [-10, 0, BAR_Z + 1], S(k.slabOf(bar, BAR_Z, COIL_Z - BAR_Z - 0.6, P, 3, 0.3), { tone: "mid" }) + D([-30, -10, 10, 30].map((x) => at([x, 0, COIL_Z - 0.6])), { size: 0.4, tone: "lo" }),
    [A.slab(bar, BAR_Z, COIL_Z - BAR_Z - 0.6, { name: "element.bar", owner: "element" }, 3)]);
  for (let i = 0; i <= 240; i++) { const t = i / 240, a = t * 3 * Math.PI * 2 + Math.PI, r = 8 + 29 * t; COIL.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const tail = [COIL[COIL.length - 1], [-46, 0]];
  const d = k.onTop(COIL, COIL_Z, P) + k.onTop(tail, COIL_Z, P);
  put("element.coil", [0, 0, COIL_Z], `<path class="iso-line" d="${d}" style="stroke:var(--anatomy-mid);stroke-width:3.4"/><path data-part="glow" class="iso-line" d="${d}" style="stroke:#e5484d;stroke-width:2;opacity:0"/>` +
    D([at([COIL[0][0], COIL[0][1], COIL_Z]), at([-46, 0, COIL_Z])], { size: 1.2, tone: "mid" }),
    [A.cylinder(0, 0, 38.8, COIL_Z - 0.6, 1.2, { name: "element.coil", owner: "element" }), A.slab({ x: -47.5, y: -2, w: 12, d: 4, r: 1 }, COIL_Z - 0.6, 1.2, { name: "element.tail", owner: "element" }, 3)]);
}
// ---- thermostat probe ----
const PROBE_TIP = [PROBE.x + 2, PROBE.y + PROBE.d + 2];
{
  const boss = { x: PROBE.x - 3, y: IN, w: 10, d: 3, r: 1 };
  put("probe", [PROBE.x + 2, IN + 12, PROBE_Z], S(k.slabOf(boss, PROBE_Z - 3, 9, P, 3), { tone: "mid" }) + S(k.slabOf(PROBE, PROBE_Z, 3, P, 3, 0.3), { tone: "mid" }) +
    S(k.cylinder(PROBE_TIP[0], PROBE_TIP[1], 2, PROBE_Z - 0.2, 3.4, P, 18), { tone: "hi" }) + D([at([PROBE.x - 1, IN + 3, PROBE_Z + 6]), at([PROBE.x + 5, IN + 3, PROBE_Z + 6])], { size: 0.4 }),
    [A.slab(boss, PROBE_Z - 3, 9, { name: "probe.boss", owner: "probe" }, 3), A.slab(PROBE, PROBE_Z, 3, { name: "probe.stem", owner: "probe" }, 3), A.cylinder(PROBE_TIP[0], PROBE_TIP[1], 2, PROBE_Z - 0.2, 3.4, { name: "probe.tip", owner: "probe" })]);
}
// ---- fan, shaft, motor, arm ----
{
  put("fan.shaft", [0, 0, 96], S(k.cylinder(0, 0, 1.6, FAN_Z + 2, MOTOR_Z0 - FAN_Z - 2, P, 16), { tone: "mid", crease: "none" }), [A.cylinder(0, 0, 1.6, FAN_Z + 2, MOTOR_Z0 - FAN_Z - 2, { name: "fan.shaft", owner: "fan" })]);
  put("fan.rotor", [0, 0, FAN_Z], S(k.cylinder(0, 0, FAN_R, FAN_Z - 1.2, 1.2, P, 72, 0.5), { tone: "mid" }) + L(k.ring(0, 0, FAN_R - 2, FAN_Z, P, 72), { tone: "lo" }) +
    `<path data-part="blades" class="iso-line" data-tone="hi" d="" style="stroke-width:0.9"/>` + S(k.cylinder(0, 0, HUB_R, FAN_Z - 2, 4, P, 28, 0.4), { tone: "mid" }) + D([at([0, 0, FAN_Z + 2])], { size: 0.6, tone: "hi" }),
    [A.cylinder(0, 0, FAN_R, FAN_Z - 1.2, 1.2, { name: "fan.rotor", owner: "fan" }), A.cylinder(0, 0, HUB_R, FAN_Z - 2, 4, { name: "fan.hub", owner: "fan" })]);
  put("fan.motor", [0, 0, 111], S(k.cylinder(0, 0, MOTOR_R, MOTOR_Z0, MOTOR_Z1 - MOTOR_Z0, P, 48, 0.6), { tone: "mid", inner: L(k.sideArc(0, 0, MOTOR_R, MOTOR_Z0 + 4, P, 32) + k.sideArc(0, 0, MOTOR_R, MOTOR_Z1 - 2, P, 32), { tone: "lo" }) }) +
    L(k.knurl(0, 0, MOTOR_R, MOTOR_Z0 + 4, MOTOR_Z1 - 2, 22, P), { tone: "lo" }), [A.cylinder(0, 0, MOTOR_R, MOTOR_Z0, MOTOR_Z1 - MOTOR_Z0, { name: "fan.motor", owner: "fan" })]);
  const arm = { x: -9, y: IN, w: 18, d: -IN + MOTOR_R, r: 3 };
  put("fan.arm", [0, -25, 120], S(k.slabOf(arm, MOTOR_Z1, ARM_TOP - MOTOR_Z1, P, 4, 0.5), { tone: "mid" }) + D([at([-5, IN + 8, ARM_TOP]), at([5, IN + 8, ARM_TOP]), at([-5, 6, ARM_TOP]), at([5, 6, ARM_TOP])], { size: 0.45 }),
    [A.slab(arm, MOTOR_Z1, ARM_TOP - MOTOR_Z1, { name: "fan.arm", owner: "fan" }, 4)]);
}

A.settle(R, P);
const items = [...R.items].sort((a, b) => a.key - b.key);
A.auditOrExit(R, P);

const body = [];
items.forEach((it) => {
  if (it.name === "plate.mesh") body.push(`<g data-part="air-under"></g>`);
  if (it.name === "fan.rotor") body.push(`<g data-part="air-mid"></g>`);
  body.push(`<g data-item="${it.name}">${it.svg}</g>`);
  if (it.name === "shell") body.push(`<g data-part="air-back"></g>`);
});
body.push(`<g data-part="air-front"></g>`);

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT,
  label: "A cutaway basket air fryer. Inside the rounded housing, a pull-out drawer holds a perforated crisper plate on short legs, with fries on it and drip space below. A flat spiral heating element sits just above the food, a fan driven by a motor sits above the element, and a thermostat probe beside the element switches it around the dial setpoint.",
  body,
});

const live = `
const P = ${JSON.stringify(P)};
const FAN_Z = ${FAN_Z}, FAN_R = ${FAN_R}, HUB_R = ${HUB_R}, KNOB = ${JSON.stringify(KNOB)}, KNOB_R = ${KNOB_R}, KNOB_TOP = ${BASE_H + KNOB_H};
const PL_Z = ${PL_Z}, PL_HALF = 45, FOOD_TOP = ${FOOD_TOP}, COIL_Z = ${COIL_Z}, DR_FLOOR = ${DR_FLOOR};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const $ = (n) => svg.querySelector('[data-part="' + n + '"]');
const blades = $("blades"), knob = $("knob"), lamp = $("lamp"), glow = $("glow");
const L = { back: $("air-back"), under: $("air-under"), mid: $("air-mid"), front: $("air-front") };
const fries = [...svg.querySelectorAll('[data-part="fry"]')];
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const NS = "http://www.w3.org/2000/svg";
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// ---- model: lumped chamber air, bang-bang thermostat with a 4 C band, lagging food surface ----
const AMB = 22, TMAX = 262, TAU = 130, BAND = 4, TAU_FOOD = 75, BROWN_ON = 140, SIM = 20, SET_MIN = 80, SET_MAX = 200;
let S = { air: AMB, food: AMB, on: true, set: 200, brown: 0, el: 0, fan: 0, reached: false, moist: 1 };
function step(dt) {
  if (S.on && S.air >= S.set + BAND / 2) { S.on = false; S.reached = true; }
  if (!S.on && S.air <= S.set - BAND / 2) S.on = true;
  S.air += ((S.on ? TMAX : AMB) - S.air) * (1 - Math.exp(-dt / TAU));
  // while the surface is wet, evaporation pins it near 100 C; it rises toward the air only once it has dried
  const cap = S.moist > 0 ? Math.min(S.air, 100) : S.air;
  S.food += (cap - S.food) * (1 - Math.exp(-dt / TAU_FOOD));
  if (S.moist > 0 && S.food > 95) S.moist = Math.max(0, S.moist - dt * Math.max(0, S.air - 100) / 12000);
  if (S.food > BROWN_ON) S.brown = Math.min(1, S.brown + dt * ((S.food - BROWN_ON) / 60) / 120);
}
const STAGES = ["Heating up", "Circulating", "Holding temp", "Browning"];
function stageOf() {
  if (S.food >= BROWN_ON && S.reached) return 3;
  if (!S.reached) return S.air > S.set - 40 ? 1 : 0;
  return 2;
}
// ---- airflow ----
const N = 46, parts = [];
for (let i = 0; i < N; i++) { const el = document.createElementNS(NS, "circle"); el.setAttribute("r", "1.35"); el.setAttribute("class", "air"); parts.push({ el, a: (i % 7) / 7 * Math.PI * 2 + i * 0.37, s: i / N, ru: 6 + ((i * 7) % 28), host: null }); }
const loop = (ru) => [[ru, DR_FLOOR + 5], [ru, FOOD_TOP + 2], [5, COIL_Z + 12], [8, FAN_Z - 2], [44, FAN_Z - 3], [44, FAN_Z - 10], [44, 36], [42, DR_FLOOR + 5]];
function along(path, s) {
  const seg = []; let tot = 0;
  for (let i = 0; i < path.length; i++) { const a = path[i], b = path[(i + 1) % path.length]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push(l); tot += l; }
  let d = (((s % 1) + 1) % 1) * tot;
  for (let i = 0; i < path.length; i++) { if (d <= seg[i]) { const a = path[i], b = path[(i + 1) % path.length], f = d / seg[i]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; } d -= seg[i]; }
  return path[0];
}
function drawAir(dt) {
  const heat = clamp((S.air - AMB) / (200 - AMB), 0, 1);
  const fill = "rgb(" + Math.round(90 + 140 * heat) + "," + Math.round(96 - 20 * heat) + "," + Math.round(110 - 60 * heat) + ")";
  for (const p of parts) {
    p.s += dt * 0.16 * S.fan; p.a += dt * 0.15 * S.fan;
    const [r, z] = along(loop(p.ru), p.s);
    const x = Math.cos(p.a) * r, y = Math.sin(p.a) * r;
    const host = z < PL_Z && Math.abs(x) < PL_HALF && Math.abs(y) < PL_HALF ? L.under : r < FAN_R + 1 && z < FAN_Z && z > FOOD_TOP ? L.mid : x + y > 0 ? L.front : L.back;
    if (p.host !== host) { host.appendChild(p.el); p.host = host; }
    const [sx, sy] = iso([x, y, z], P);
    p.el.setAttribute("cx", sx.toFixed(2)); p.el.setAttribute("cy", sy.toFixed(2));
    p.el.style.opacity = (0.25 + 0.6 * S.fan).toFixed(2); p.el.style.fill = fill;
  }
}
let fanAngle = 0;
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hex = (c) => "rgb(" + c.join(",") + ")";
function draw() {
  let d = "";
  for (let i = 0; i < 6; i++) { const a = fanAngle + i * Math.PI / 3, b = a + 0.32; d += lineOnTop([Math.cos(a) * HUB_R, Math.sin(a) * HUB_R], [Math.cos(b) * (FAN_R - 2), Math.sin(b) * (FAN_R - 2)], FAN_Z, P); }
  blades.setAttribute("d", d);
  const ka = Math.PI * 0.25 + (S.set - SET_MIN) / (SET_MAX - SET_MIN) * Math.PI * 1.5;
  knob.setAttribute("d", lineOnTop(KNOB, [KNOB[0] + Math.sin(ka) * (KNOB_R - 1), KNOB[1] - Math.cos(ka) * (KNOB_R - 1)], KNOB_TOP, P));
  glow.style.opacity = S.el.toFixed(3); glow.style.stroke = hex(mix([150, 60, 50], [240, 110, 40], S.el));
  lamp.style.opacity = S.on ? "1" : "0.08";
  const b = S.brown;
  const top = hex(mix([246, 230, 170], [228, 176, 84], b)), side = hex(mix([228, 205, 130], [200, 138, 56], b)), dark = hex(mix([214, 188, 112], [166, 106, 40], b));
  for (const f of fries) f.setAttribute("style", "--anatomy-top:" + top + ";--anatomy-shade-3:" + side + ";--anatomy-shade-2:" + side + ";--anatomy-shade-1:" + dark + ";--anatomy-shade-0:" + dark + ";--anatomy-paper:" + side);
  const st = stageOf();
  const text = STAGES[st] + " · air " + Math.round(S.air) + " °C · set " + S.set + " °C · element " + (S.on ? "on" : "off") + "";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(S.set)); stage.setAttribute("aria-valuetext", STAGES[st] + ". " + text);
}
let frame = 0, last = 0, visible = false, touring = true;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  for (let i = 0; i < 4; i++) step(dt * SIM / 4);
  S.el += ((S.on ? 1 : 0) - S.el) * (1 - Math.exp(-dt / 0.9));
  S.fan += (1 - S.fan) * (1 - Math.exp(-dt / 0.6));
  fanAngle += dt * S.fan * 9;
  drawAir(dt); draw();
  if (touring && S.brown >= 1) { touring = false; setTimeout(restart, 2500); }
  frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
}
function restart() { Object.assign(S, { air: AMB, food: AMB, brown: 0, on: true, reached: false, moist: 1 }); touring = true; }
const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function steer(set) { S.set = Math.round(clamp(set, SET_MIN, SET_MAX) / 5) * 5; draw(); }
function stillFrame() { S.set = 200; S.fan = 1; for (let i = 0; i < 2000; i++) step(0.25); S.el = S.on ? 1 : 0; drawAir(0); draw(); }
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (e) => { const box = svg.getBoundingClientRect(); steer(SET_MIN + clamp(((e.clientX - box.left) / box.width - 0.25) / 0.5, 0, 1) * (SET_MAX - SET_MIN)); });
const fresh = () => { restart(); if (still.matches) { drawAir(0); draw(); } else run(); };
stage.addEventListener("click", fresh);
stage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp" || e.key === "ArrowRight") steer(S.set + 5);
  else if (e.key === "ArrowDown" || e.key === "ArrowLeft") steer(S.set - 5);
  else if (e.key === "Enter" || e.key === " ") fresh();
  else return;
  e.preventDefault();
});
still.addEventListener("change", () => { if (still.matches) stillFrame(); else run(); });
// ?t=<sim seconds> fast-forwards the model (for captures and deep links)
const tRaw = Number(new URLSearchParams(location.search).get("t"));
const skip = Number.isNaN(tRaw) ? 0 : Math.min(Math.max(tRaw, 0), 600);
for (let t = 0; t < skip; t += 0.25) step(0.25);
if (skip) { S.el = S.on ? 1 : 0; S.fan = 1; }
if (still.matches) stillFrame(); else { drawAir(0); draw(); }
`;

const style = `<style>.air{stroke:none}</style>`;
const plate = k.plateHtml({
  fig: "Fig 1",
  title: "Basket air fryer",
  hint: "Hover: dial · click: new batch",
  readout: "Heating up · air 22 °C · set 200 °C · element on",
  keys: [
    { mark: "lit", label: "Heating element: glows while the thermostat holds it on" },
    { mark: "raised", label: "Crisper plate in the pull-out drawer; drip space below" },
    { mark: "dotted", label: "Air: out from the fan, down the drawer walls, up through the plate" },
  ],
  caption:
    "A cutaway basket air fryer. The element sits just above the food and the fan just above the element, so heated air is thrown outward, down the drawer walls, under the perforated crisper plate and up through it and the fries, back to the fan. Fat and crumbs fall through the plate into the drawer below. A probe beside the element feeds the thermostat, which cuts the element just above the setpoint and restores it just below, so the air saw-tooths around the dial while the fan keeps running. Fast, hot air dries the food's surface (while it is wet, evaporation holds it near 100 °C), and then it browns (Maillard reactions, roughly above 140 °C) as in a convection oven, but in a small chamber. The readout names the stage (heating up, circulating, holding temp, browning) and comes from a simple first-order thermal model, run at 20× time.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Air fryer: arrow keys change the setpoint, Enter starts a fresh batch" aria-valuemin="80" aria-valuemax="200" aria-valuenow="200">${svg}</div>${style}`,
});
writeFileSync(join(HERE, "air-fryer-gallery.html"), k.pageHtml({ title: "Basket air fryer", theme: "light", body: plate, script: kitScript() + live }));
console.log("wrote air-fryer-gallery.html items", items.length);
