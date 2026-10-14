// Tamagotchi breakdown: moves the layers apart on springs, keeps them in painter's order,
// and runs a tiny pet on the 32 × 16 LCD. Static geometry comes from build.mjs.
const D = JSON.parse(document.getElementById("tg-data").textContent);


const root = document.querySelector(".tg");
const stage = root.querySelector(".tg-stage");
const svg = stage.querySelector("svg");
const layer = svg.querySelector(".tg-items");
const readout = root.querySelector("[data-readout]");
const live = root.querySelector("[data-live]");
const apartButton = root.querySelector("[data-apart]");
// The gallery page has no control bar: the drawing itself is the control, and a corner hint says how.
const BARE = !apartButton;
const galleryHint = root.querySelector("[data-gallery-hint]");
const HINTS = { together: "Press its buttons to play · click the egg to take it apart", apart: "Hover a part to name it · click the bench to put it back" };
const keyButtons = [...root.querySelectorAll("[data-press]")];
const partButtons = [...root.querySelectorAll(".tg-part")];
const lcd = svg.querySelector("[data-lcd]");
const pxPath = lcd.querySelector("[data-px]");
const iconPath = lcd.querySelector("[data-icons]");
const iconGhost = lcd.querySelector("[data-icons-ghost]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

// ---------- Layers, springs and painter's order ----------
const nodes = [...layer.querySelectorAll(".it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  key: Number(el.dataset.k),
  m: Number(el.dataset.m),
  btn: el.dataset.btn === undefined ? -1 : Number(el.dataset.btn),
  halo: el.hasAttribute("data-halo"),
  shown: "",
  alpha: "",
}));
let order = nodes.map((_, i) => i);
const IDS = Object.keys(D.pieces);
const piece = Object.fromEntries(IDS.map((id) => [id, { x: 0, v: 0, target: 0, pending: null }]));
const SPRING = D.spring;
const press = [0, 0, 0].map(() => ({ x: 0, v: 0, held: 0 }));
const grow = Object.fromEntries(IDS.map((id) => [id, { x: 1, v: 0 }]));
const GROW = 1.035;

let clock = 0;
let apart = false;
let selected = null;
let pinned = null; // chosen from the parts list or the arrow keys
let hovered = null; // under the pointer while apart
const show = () => select(hovered ?? pinned);

function setApart(on) {
  if (apart === on) return;
  apart = on;
  const goal = on ? 1 : 0;
  // Reschedule only the layers whose target changes, so a quick reversal never lets a later layer overtake an earlier one.
  const list = (on ? D.stagger : [...D.stagger].reverse()).filter((id) => piece[id].target !== goal || piece[id].pending);
  list.forEach((id, index) => {
    if (piece[id].target === goal) piece[id].pending = null;
    else piece[id].pending = { value: goal, at: clock + (still.matches ? 0 : index * SPRING.stagger) };
  });
  if (apartButton) {
    apartButton.setAttribute("aria-pressed", String(on));
    apartButton.textContent = on ? "Put together" : "Take apart";
  }
  if (galleryHint) galleryHint.textContent = on ? HINTS.apart : HINTS.together;
  stage.toggleAttribute("data-apart", on);
  if (!on) {
    pinned = null;
    hovered = null;
    hideTip();
    select(null);
  }
  announce(on ? "Taking it apart." : "Putting it back together.");
  run();
}

function select(id) {
  if (selected === id) return;
  selected = id;
  for (const node of nodes) {
    if (id !== null && node.piece === id && !node.halo) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  stage.toggleAttribute("data-focus", id !== null);
  partButtons.forEach((b) => b.toggleAttribute("data-on", b.dataset.part === id));
  if (id && id === pinned) announce(D.pieces[id].name + ": " + D.pieces[id].say + ".");
  run();
}

function stepSpring(state, dt, calm) {
  if (state.pending && clock >= state.pending.at) {
    state.target = state.pending.value;
    state.pending = null;
  }
  if (calm) {
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }
  for (let i = 0; i < SPRING.substeps; i++) {
    const h = dt / SPRING.substeps;
    state.v += ((state.target - state.x) * SPRING.stiffness - state.v * SPRING.damping) * h;
    state.x += state.v * h;
  }
  if (Math.abs(state.target - state.x) < 2e-4 && Math.abs(state.v) < 2e-4) {
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }
  return true;
}

function place() {
  for (const node of nodes) {
    const share = piece[node.piece] ? piece[node.piece].x : 0;
    let dy = node.m * share;
    if (node.btn >= 0) dy -= press[node.btn].x * D.pressDepth;
    let text = Math.abs(dy) < 0.005 ? "" : `translate(${(D.EY[0] * dy).toFixed(2)} ${(D.EY[1] * dy).toFixed(2)})`;
    const g = grow[node.piece];
    if (g && !node.halo && Math.abs(g.x - 1) > 1e-4) {
      const [cx, cy] = D.pieces[node.piece].centre;
      text += ` translate(${cx} ${cy}) scale(${g.x.toFixed(4)}) translate(${-cx} ${-cy})`;
    }
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
    if (node.halo) {
      const alpha = Math.min(1, Math.abs(share) * 1.4).toFixed(2);
      if (alpha !== node.alpha) {
        node.alpha = alpha;
        node.el.style.opacity = alpha;
      }
    }
  }
  // Every layer is a plate across y, so the nearer one is the one further along +y: sort by its front face plus its move.
  const keyOf = (n) => n.key + n.m * (piece[n.piece] ? piece[n.piece].x : 0);
  const next = nodes.map((_, i) => i).sort((a, b) => keyOf(nodes[a]) - keyOf(nodes[b]) || a - b);
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    layer.appendChild(fragment);
    order = next;
  }
}

const moving = () => IDS.some((id) => piece[id].pending || Math.abs(piece[id].x - piece[id].target) > 1e-4 || piece[id].v !== 0);
const home = (...ids) => ids.every((id) => piece[id].x < 0.004 && !piece[id].pending && piece[id].target === 0);
const wired = () => home("lcd", "sponge", "pcb", "paper");
const padOnBoard = () => home("pad", "pcb");

// ---------- The pet ----------
const COLS = D.matrix.cols;
const ROWS = D.matrix.rows;
const fb = new Uint8Array(COLS * ROWS);
const sprite = (rows) => rows.map((row) => [...row].map((c) => c === "#"));
const PET = {
  stand: sprite([
    "................",
    ".....######.....",
    "...##......##...",
    "..#..........#..",
    ".#............#.",
    ".#..##....##..#.",
    "#...##....##...#",
    "#..............#",
    "#......##......#",
    "#.....#..#.....#",
    ".#.....##.....#.",
    ".#............#.",
    "..##........##..",
    "....########....",
    "....##....##....",
    "................",
  ]),
  step: sprite([
    ".....######.....",
    "...##......##...",
    "..#..........#..",
    ".#............#.",
    ".#..##....##..#.",
    "#...##....##...#",
    "#..............#",
    "#......##......#",
    "#.....#..#.....#",
    ".#.....##.....#.",
    ".#............#.",
    "..##........##..",
    "....########....",
    "...##......##...",
    "..##........##..",
    "................",
  ]),
  chew: sprite([
    "................",
    ".....######.....",
    "...##......##...",
    "..#..........#..",
    ".#............#.",
    ".#..##....##..#.",
    "#...##....##...#",
    "#..............#",
    "#.....####.....#",
    "#.....#..#.....#",
    ".#....####....#.",
    ".#............#.",
    "..##........##..",
    "....########....",
    "....##....##....",
    "................",
  ]),
  glad: sprite([
    "................",
    ".....######.....",
    "...##......##...",
    "..#..........#..",
    ".#............#.",
    ".#.#..#..#..#.#.",
    "#...##....##...#",
    "#..............#",
    "#.....####.....#",
    "#......##......#",
    ".#............#.",
    ".#............#.",
    "..##........##..",
    "....########....",
    "....##....##....",
    "................",
  ]),
  blink: sprite([
    "................",
    ".....######.....",
    "...##......##...",
    "..#..........#..",
    ".#............#.",
    ".#............#.",
    "#..####..####..#",
    "#..............#",
    "#......##......#",
    "#.....#..#.....#",
    ".#.....##.....#.",
    ".#............#.",
    "..##........##..",
    "....########....",
    "....##....##....",
    "................",
  ]),
};
const FOOD = [
  sprite(["...##...", "..####..", ".######.", ".######.", "##....##", "##....##", "########", ".######."]),
  sprite(["........", "........", ".....#..", "....###.", "##...###", "##....##", "########", ".######."]),
  sprite(["........", "........", "........", "........", "........", "......##", "...#####", "..#####."]),
];
const HEART = sprite([".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."]);
const HEART_EMPTY = sprite([".##.##.", "#..#..#", "#.....#", ".#...#.", "..#.#..", "...#..."]);
const ICONS = [
  ["food", sprite([".#.#..#.", ".#.#.##.", ".###.##.", "..#..##.", "..#..##.", "..#...#.", "..#...#.", "..#...#."])],
  ["light", sprite(["..####..", ".#....#.", "#......#", "#......#", ".#....#.", "..#..#..", "..####..", "..####.."])],
  ["game", sprite(["..####..", ".#.##.#.", "#..##..#", "########", "########", "#..##..#", ".#.##.#.", "..####.."])],
  ["medicine", sprite(["......#.", ".....#.#", "....#.#.", "...#.#..", "..#.#...", ".#.#....", "#.#.....", "##......"])],
  ["clean-up", sprite(["..##....", ".#.##...", ".####...", "..##....", ".#####.#", "#.....##", "#......#", ".######."])],
  ["status", sprite(["########", "#......#", "#.##.#.#", "#......#", "#.#.##.#", "#......#", "########", "........"])],
  ["discipline", sprite([".######.", "#......#", "#..##..#", "#..##..#", "#......#", "#..##..#", ".######.", "...#...."])],
  ["attention", sprite(["...##...", "..####..", ".######.", ".######.", ".######.", "########", "........", "...##..."])],
];

const pet = {
  hunger: 3,
  happy: 2,
  menu: -1,
  mode: "home", // home | eat | play | status | dark | blink | refuse
  t: 0,
  page: 0,
  x: 8,
  dir: 1,
  hungerClock: 0,
  happyClock: 0,
  lastPx: "",
  lastIcons: "",
};
const HUNGER_EVERY = 22;
const HAPPY_EVERY = 28;

function blit(s, x0, y0, flip = false) {
  const h = s.length;
  const w = s[0].length;
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      if (!s[r][flip ? w - 1 - c : c]) continue;
      const x = x0 + c;
      const y = y0 + r;
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) fb[y * COLS + x] = 1;
    }
}

function drawPet() {
  fb.fill(0);
  const t = still.matches ? 0 : pet.t;
  switch (pet.mode) {
    case "eat": {
      const bite = Math.min(2, Math.floor(t / 0.8));
      blit(FOOD[bite], 2, 7);
      blit(Math.floor(t / 0.3) % 2 ? PET.chew : PET.stand, 13, 0, true);
      break;
    }
    case "refuse":
      blit(PET.stand, 8, 0, Math.floor(t / 0.25) % 2 === 1);
      break;
    case "play": {
      const hop = Math.abs(Math.sin(t * Math.PI * 1.6));
      blit(hop > 0.5 ? PET.glad : PET.stand, 8, -Math.round(hop * 3));
      if (Math.floor(t / 0.2) % 2) {
        blit(sprite(["#.#", ".#.", "#.#"]), 3, 3);
        blit(sprite(["#.#", ".#.", "#.#"]), 27, 5);
      }
      break;
    }
    case "status": {
      const value = pet.page === 0 ? pet.hunger : pet.happy;
      // A fork for hunger, a note for happiness, then four hearts.
      blit(pet.page === 0 ? sprite(["#.#.", "#.#.", "###.", ".#..", ".#..", ".#.."]) : sprite(["..##", "..#.", "..#.", "###.", "###.", "....."]), 1, 1);
      for (let i = 0; i < 4; i++) blit(i < value ? HEART : HEART_EMPTY, 1 + i * 8, 9);
      break;
    }
    case "dark":
      fb.fill(1);
      break;
    case "blink":
      blit(Math.floor(t / 0.35) % 2 ? PET.blink : PET.glad, 8, 0);
      break;
    default: {
      blit(Math.floor(t / 0.5) % 2 ? PET.step : PET.stand, Math.round(pet.x), 0, pet.dir < 0);
    }
  }
}

function frameD() {
  const { x0, z0, pitch } = D.matrix;
  const out = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (fb[r * COLS + c]) out.push(`M${(x0 + c * pitch + 0.08).toFixed(2)} ${(-(z0 - r * pitch) + 0.08).toFixed(2)}h0.99v0.99h-0.99z`);
  return out.join("");
}
function iconD(list) {
  const { size, pitch, xs, zTop, zBottom } = D.icon;
  const out = [];
  for (const i of list) {
    const [, bits] = ICONS[i];
    const cx = xs[i % 4];
    const cz = i < 4 ? zTop : zBottom;
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (bits[r][c]) out.push(`M${(cx + (c - size / 2) * pitch + 0.05).toFixed(2)} ${(-(cz + (size / 2 - r) * pitch) + 0.05).toFixed(2)}h${(pitch - 0.1).toFixed(2)}v${(pitch - 0.1).toFixed(2)}h-${(pitch - 0.1).toFixed(2)}z`);
  }
  return out.join("");
}
iconGhost.setAttribute("d", iconD([0, 1, 2, 3, 4, 5, 6, 7]));

const needsCare = () => pet.hunger === 0 || pet.happy === 0;
function renderLcd() {
  drawPet();
  const d = frameD();
  if (d !== pet.lastPx) {
    pet.lastPx = d;
    pxPath.setAttribute("d", d);
  }
  const on = [];
  if (pet.menu >= 0) on.push(pet.menu);
  if (needsCare() && (still.matches || Math.floor(clock * 2) % 2 === 0)) on.push(7);
  const key = on.join(",");
  if (key !== pet.lastIcons) {
    pet.lastIcons = key;
    iconPath.setAttribute("d", iconD(on));
  }
}

function petTick(dt) {
  pet.t += dt;
  if (still.matches) dt = 0;
  pet.hungerClock += dt;
  pet.happyClock += dt;
  if (pet.hungerClock >= HUNGER_EVERY) {
    pet.hungerClock = 0;
    if (pet.hunger > 0 && --pet.hunger === 0) beep(3);
  }
  if (pet.happyClock >= HAPPY_EVERY) {
    pet.happyClock = 0;
    if (pet.happy > 0 && --pet.happy === 0) beep(3);
  }
  if (pet.mode === "home") {
    pet.x += pet.dir * dt * 2.2;
    if (pet.x > 16) pet.dir = -1;
    if (pet.x < 1) pet.dir = 1;
  }
  const ends = { eat: 2.4, play: 2.2, blink: 1.4, refuse: 1.3 };
  if (ends[pet.mode] && pet.t >= ends[pet.mode]) {
    if (pet.mode === "eat") {
      pet.hunger = Math.min(4, pet.hunger + 1);
      pet.hungerClock = 0;
      announce(`Fed. Hunger ${pet.hunger} of 4.`);
    }
    if (pet.mode === "play") {
      pet.happy = Math.min(4, pet.happy + 1);
      pet.happyClock = 0;
      announce(`Played. Happy ${pet.happy} of 4.`);
    }
    toHome();
  }
}
function toHome() {
  pet.mode = "home";
  pet.menu = -1;
  pet.t = 0;
}

function act(button) {
  // The chip only sees a press when the carbon pill closes the board's pads.
  if (!padOnBoard()) return;
  beep(1);
  if (button === 2) {
    if (pet.mode === "dark") pet.menu = -1;
    toHome();
    return;
  }
  if (pet.mode === "dark") {
    if (button === 1 && pet.menu === 1) toHome();
    return;
  }
  if (pet.mode === "status") {
    if (button === 1) {
      if (pet.page === 0) pet.page = 1;
      else toHome();
    }
    return;
  }
  if (pet.mode !== "home") return;
  if (button === 0) {
    pet.menu = (pet.menu + 1) % 7;
    return;
  }
  if (button === 1 && pet.menu >= 0) {
    pet.t = 0;
    const name = ICONS[pet.menu][0];
    if (name === "food") pet.mode = pet.hunger >= 4 ? "refuse" : "eat";
    else if (name === "game") pet.mode = "play";
    else if (name === "status") {
      pet.mode = "status";
      pet.page = 0;
    } else if (name === "light") pet.mode = "dark";
    else pet.mode = "blink";
  }
}

function pressButton(i) {
  press[i].held = 0.12;
  if (keyButtons[i]) keyButtons[i].setAttribute("data-down", "");
  act(i);
  run();
}

// ---------- Sound: the piezo is driven at 2,048 Hz, one of the chip's buzzer frequencies ----------
let audio = null;
function wake() {
  if (audio || !window.AudioContext) return;
  audio = new AudioContext();
}
function beep(count) {
  if (!audio || still.matches) return;
  if (audio.state === "suspended") audio.resume();
  for (let i = 0; i < count; i++) {
    const t0 = audio.currentTime + i * 0.14;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "square";
    osc.frequency.value = 2048;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.035, t0 + 0.005);
    gain.gain.setValueAtTime(0.035, t0 + 0.06);
    gain.gain.linearRampToValueAtTime(0, t0 + 0.07);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + 0.08);
  }
}

// ---------- Readout ----------
const hearts = (n) => "♥".repeat(n) + "♡".repeat(4 - n);
function say() {
  let text;
  if (moving()) text = apart ? "taking apart" : "closing up";
  else if (selected) text = D.pieces[selected].say;
  else if (apart) text = "apart · 10 parts · LCD off";
  else {
    text = `hunger ${hearts(pet.hunger)} · happy ${hearts(pet.happy)}`;
    if (pet.menu >= 0 && pet.mode === "home") text += ` · ${ICONS[pet.menu][0]}`;
    else if (pet.mode === "eat") text += " · eating";
    else if (pet.mode === "play") text += " · playing";
    else if (pet.mode === "refuse") text += " · full";
    else if (pet.mode === "dark") text += " · lights off";
    else if (needsCare()) text += " · needs you";
  }
  if (readout && readout.textContent !== text) readout.textContent = text;
}
let lastSaid = "";
function announce(text) {
  if (text === lastSaid) return;
  lastSaid = text;
  if (live) live.textContent = text;
}

// ---------- Input wakes the sound; nothing plays on its own ----------
function takeOver() {
  wake();
}

// ---------- Camera: close on the egg when whole, pulled back while any layer is out ----------
const cam = { x: 0, v: 0, shown: "" };
function stepCamera(dt, calm) {
  const want = apart || moving() ? 1 : 0;
  if (calm) {
    cam.x = want;
    cam.v = 0;
  } else {
    // Critically damped, 0.42 s: it leads the layers out and follows them home.
    const w = 1 / 0.42;
    for (let i = 0; i < 4; i++) {
      const h = dt / 4;
      cam.v += (w * w * (want - cam.x) - 2 * w * cam.v) * h;
      cam.x += cam.v * h;
    }
    if (Math.abs(want - cam.x) < 1e-4 && Math.abs(cam.v) < 1e-4) {
      cam.x = want;
      cam.v = 0;
    }
  }
  const e = cam.x * cam.x * (3 - 2 * cam.x);
  const box = D.views.home.map((a, i) => a + (D.views.apart[i] - a) * e);
  const text = box.map((n) => n.toFixed(2)).join(" ");
  if (text !== cam.shown) {
    cam.shown = text;
    svg.setAttribute("viewBox", text);
  }
}

// ---------- Loop ----------
let frame = 0;
let last = 0;
let visible = false;
let lcdOn = null;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  const wall = last ? (now - last) / 1000 : 1 / 60; // unclamped, for the recording timeline
  last = now;
  const calm = still.matches;
  clock += dt;
  let busy = false;
  for (const id of IDS) busy = stepSpring(piece[id], dt, calm) || busy;
  for (const p of press) {
    p.held = Math.max(0, p.held - dt);
    const want = p.held > 0 ? 1 : 0;
    if (calm) p.x = want;
    else for (let i = 0; i < 4; i++) {
      const h = dt / 4;
      p.v += ((want - p.x) * 900 - p.v * 48) * h;
      p.x += p.v * h;
    }
    if (Math.abs(want - p.x) < 1e-3 && Math.abs(p.v) < 1e-3) {
      p.x = want;
      p.v = 0;
    } else busy = true;
    if (p.held > 0) busy = true;
  }
  for (const id of IDS) {
    const g = grow[id];
    const want = hovered === id && apart && piece[id].x > 0.9 ? GROW : 1;
    if (calm) {
      g.x = want;
      g.v = 0;
    } else {
      // A light spring that overshoots a touch, so the part breathes out to meet the pointer.
      for (let i = 0; i < 4; i++) {
        const h = dt / 4;
        g.v += ((want - g.x) * 420 - g.v * 22) * h;
        g.x += g.v * h;
      }
      if (Math.abs(want - g.x) < 1e-4 && Math.abs(g.v) < 1e-4) {
        g.x = want;
        g.v = 0;
      }
    }
  }
  keyButtons.forEach((b, i) => press[i].held === 0 && b.hasAttribute("data-down") && b.removeAttribute("data-down"));
  place();
  stepCamera(dt, calm);
  // @demo-start
  if (DEMO) demoTick(wall);
  // @demo-end
  petTick(dt);
  const on = wired();
  if (on !== lcdOn) {
    lcdOn = on;
    lcd.style.opacity = on ? "1" : "0";
  }
  renderLcd();
  say();
  // The pet keeps living, so the loop runs while the figure is on screen.
  frame = visible ? requestAnimationFrame(tick) : 0;
  if (!visible) last = 0;
  return busy;
}
function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

// ---------- Hover a layer while apart ----------
const tip = stage.querySelector("[data-tip]");
const tipName = tip.querySelector("[data-tip-name]");
const tipSay = tip.querySelector("[data-tip-say]");
function hideTip() {
  tip.removeAttribute("data-on");
}
function placeTip(event) {
  const box = stage.getBoundingClientRect();
  let x = event.clientX - box.left + 16;
  let y = event.clientY - box.top + 18;
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  if (x + w > box.width - 8) x = event.clientX - box.left - w - 16;
  if (y + h > box.height - 8) y = event.clientY - box.top - h - 14;
  tip.style.setProperty("--tx", x + "px");
  tip.style.setProperty("--ty", y + "px");
}
svg.addEventListener("pointermove", (event) => {
  if (!apart || event.pointerType === "touch") return;
  const node = event.target.closest(".it");
  const id = node && !node.hasAttribute("data-halo") && node.dataset.piece !== "stand" ? node.dataset.piece : null;
  if (id !== hovered) {
    hovered = id;
    show();
    if (id) {
      tipName.textContent = D.pieces[id].name;
      tipSay.textContent = D.pieces[id].say.split(" · ").slice(1).join(" · ") || D.pieces[id].say;
    }
  }
  if (id) {
    placeTip(event);
    tip.setAttribute("data-on", "");
  } else hideTip();
  run();
});
svg.addEventListener("pointerleave", () => {
  hovered = null;
  hideTip();
  show();
});

// @demo-start
// ---------- Recording demo ----------
// Runs only under the offline renderer (tools/render installs window.__vt before the page loads)
// or with ?demo in the URL for a preview. A drawn cursor presses the buttons, takes the egg apart,
// hovers a few layers and puts it back together, on a fixed timeline so every render is identical.
const DEMO = !BARE && (!!window.__vt || new URLSearchParams(location.search).has("demo"));
const plate = root.querySelector(".iso-plate");
const KEY = (i) => () => keyButtons[i];
const APART = () => apartButton;
const PART = (id) => ({ part: id });
const DEMO_STEPS = [
  [0.0, "cursor", PART("cover")],
  [1.5, "move", KEY(0)], [2.0, "press", 0],
  [2.25, "move", KEY(1)], [2.6, "press", 1], // food: it eats
  [5.0, "move", KEY(0)], [5.3, "press", 0], [5.55, "press", 0], [5.8, "press", 0],
  [6.0, "move", KEY(1)], [6.3, "press", 1], // game: it hops
  [8.4, "move", APART], [8.9, "click", "apart"],
  [9.8, "move", PART("cover")], [10.15, "hover", "cover"],
  [10.5, "move", PART("lcd")], [10.85, "hover", "lcd"],
  [11.2, "move", PART("pcb")], [11.55, "hover", "pcb"],
  [11.9, "move", PART("cells")], [12.25, "hover", "cells"],
  [12.65, "move", APART], [12.85, "hover", null], [13.1, "click", "together"],
  [14.6, "move", KEY(1)],
];
const demo = { clock: 0, step: 0, el: null, at: [0, 0], from: [0, 0], to: [0, 0], t0: 0, dur: 0.42, tap: -1 };
function demoPoint(target) {
  const box = plate.getBoundingClientRect();
  if (target && target.part) {
    const id = target.part;
    const [cx, cy] = D.pieces[id].centre;
    const dy = D.pieces[id].move * (apart ? 1 : 0);
    const p = svg.createSVGPoint();
    p.x = cx + D.EY[0] * dy;
    p.y = cy + D.EY[1] * dy;
    const s = p.matrixTransform(svg.getScreenCTM());
    return [s.x - box.left, s.y - box.top];
  }
  const r = target().getBoundingClientRect();
  return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
}
function demoTick(dt) {
  demo.clock += dt;
  while (demo.step < DEMO_STEPS.length && demo.clock >= DEMO_STEPS[demo.step][0]) {
    const [, action, arg] = DEMO_STEPS[demo.step++];
    if (action === "cursor") {
      demo.el = document.createElement("div");
      demo.el.className = "tg-cursor";
      demo.el.setAttribute("aria-hidden", "true");
      plate.appendChild(demo.el);
      demo.at = demo.from = demo.to = demoPoint(arg);
    } else if (action === "move") {
      demo.from = demo.at;
      demo.to = demoPoint(arg);
      demo.t0 = demo.clock;
    } else if (action === "press") {
      demo.tap = demo.clock;
      pressButton(arg);
    } else if (action === "click") {
      demo.tap = demo.clock;
      setApart(arg === "apart");
    } else if (action === "hover") {
      hovered = arg;
      show();
      if (arg) {
        tipName.textContent = D.pieces[arg].name;
        tipSay.textContent = D.pieces[arg].say.split(" · ").slice(1).join(" · ") || D.pieces[arg].say;
        const box = plate.getBoundingClientRect();
        placeTip({ clientX: demo.to[0] + box.left, clientY: demo.to[1] + box.top });
        tip.setAttribute("data-on", "");
      } else hideTip();
    }
  }
  if (!demo.el) return;
  const k = Math.min(1, (demo.clock - demo.t0) / demo.dur);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  demo.at = [demo.from[0] + (demo.to[0] - demo.from[0]) * e, demo.from[1] + (demo.to[1] - demo.from[1]) * e];
  const age = demo.clock - demo.tap;
  const squeeze = age >= 0 && age < 0.22 ? 1 - 0.22 * Math.sin((age / 0.22) * Math.PI) : 1;
  demo.el.style.transform = `translate(${demo.at[0].toFixed(1)}px, ${demo.at[1].toFixed(1)}px) translate(-50%, -50%) scale(${squeeze.toFixed(3)})`;
}

// @demo-end

// ---------- Input ----------
const KEYS = { a: 0, b: 1, c: 2, Enter: 1 };
stage.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key in KEYS) {
    event.preventDefault();
    takeOver();
    pressButton(KEYS[key]);
    return;
  }
  if (key === " ") {
    event.preventDefault();
    takeOver();
    setApart(!apart);
    return;
  }
  if (key === "Escape") {
    event.preventDefault();
    takeOver();
    if (pinned) {
      pinned = null;
      show();
    }
    else if (apart) setApart(false);
    else pressButton(2);
    return;
  }
  if (key === "ArrowDown" || key === "ArrowUp" || key === "ArrowRight" || key === "ArrowLeft") {
    event.preventDefault();
    takeOver();
    const step = key === "ArrowDown" || key === "ArrowRight" ? 1 : -1;
    const index = selected ? D.order.indexOf(selected) : step > 0 ? -1 : D.order.length;
    const next = index + step;
    setApart(true);
    pinned = next < 0 || next >= D.order.length ? null : D.order[next];
    show();
  }
});
svg.addEventListener("click", (event) => {
  if (BARE) {
    takeOver();
    const node = event.target.closest(".it");
    const id = node && !node.hasAttribute("data-halo") && node.dataset.piece !== "stand" ? node.dataset.piece : null;
    if (!apart) {
      const hit = event.target.closest("[data-btn]");
      if (hit) pressButton(Number(hit.dataset.btn));
      else if (id) setApart(true);
    } else if (id) {
      // A tap names a part on touch screens, where there is no hover.
      pinned = pinned === id ? null : id;
      show();
    } else setApart(false);
    stage.focus({ preventScroll: true });
    return;
  }
  if (apart) {
    const node = event.target.closest(".it");
    const id = node && !node.hasAttribute("data-halo") && node.dataset.piece !== "stand" ? node.dataset.piece : null;
    pinned = pinned === id ? null : id;
    show();
    return;
  }
  const hit = event.target.closest("[data-btn]");
  if (hit) {
    takeOver();
    pressButton(Number(hit.dataset.btn));
    stage.focus({ preventScroll: true });
  }
});
keyButtons.forEach((b) => b.addEventListener("click", () => {
  takeOver();
  pressButton(Number(b.dataset.press));
}));
if (apartButton) apartButton.addEventListener("click", () => {
  takeOver();
  setApart(!apart);
});
partButtons.forEach((b) => b.addEventListener("click", () => {
  takeOver();
  const id = b.dataset.part;
  if (pinned === id) pinned = null;
  else {
    setApart(true);
    pinned = id;
  }
  show();
}));
stage.addEventListener("pointerdown", wake, { once: true });

place();
renderLcd();
lcd.style.opacity = "1";
say();
