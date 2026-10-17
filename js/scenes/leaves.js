// Leaf gusts (November).
//
// Leaves flutter down into a pile in the left window. Late in every cycle a gust
// streaks across both windows and carries the pile behind the wall, through the
// right window and off its far edge. Ambient leaves fall through both windows the
// whole time. Settings: leafColors, gustMinutes (the cycle length).
//
// Every position is a function of (time, leaf index). Nothing accumulates between
// frames: the cycle ends with the pile blown away and the next starts empty, so a
// window that restarts mid-gust draws exactly what the other window is drawing.

import { rand01 } from '../rng.js';
import { opt } from './options.js';

export const PILE_COUNT = 14;
export const AMBIENT_COUNT = 7;

const FALL_MIN_MS = 8000;
const FALL_SPAN_MS = 4000;
const GUST_STAGGER_MS = 1400;    // leaves lift one after another, not as a block
const TRAVEL_MIN_MS = 5000;
const TRAVEL_SPAN_MS = 2500;
const WIND_MS = 5000;

/**
 * The cycle's beats, scaled to its length. Checked for the shortest cycle (1 min):
 * the last leaf lands by ~38s, the gust starts at 42–47s, the last leaf is gone by
 * ~56s. Longer cycles only add calm.
 */
export function timing(opts) {
  const cycle = opt(opts, 'gustMinutes') * 60000;
  return {
    cycle,
    firstSpawn: 0.02 * cycle,
    spawnSpread: 0.45 * cycle,
    gustEarliest: 0.7 * cycle,
    gustJitter: 0.08 * cycle
  };
}

// Fill and edge per leaf, by palette.
const PALETTES = {
  autumn: [['#f08a2e', '#a8461a'], ['#d9442a', '#7e1f12'], ['#f2b632', '#a86c12'], ['#c0532a', '#6e2810'], ['#e66a24', '#8f3512']],
  gold: [['#f7c948', '#a8820f'], ['#f2b632', '#a86c12'], ['#ffd866', '#b08a1c'], ['#e9a31f', '#99610c']],
  crimson: [['#d9442a', '#7e1f12'], ['#b8232f', '#650f16'], ['#e0563a', '#86251a'], ['#a81f3d', '#5c0d1e']]
};

// Unit leaves, about 24 units tall, stem pointing down.
const SHAPES = {
  maple: 'M0,-12 L2,-7 L6,-9 L5,-4 L10,-5 L7,0 L9,2 L3,3 L4,8 L0,6 L-4,8 L-3,3 L-9,2 L-7,0 L-10,-5 L-5,-4 L-6,-9 L-2,-7Z',
  oak: 'M0,-12 C3,-10 5,-8 3,-6 C6,-5 6,-2 3,-1 C6,0 6,3 3,4 C5,6 3,9 0,10 C-3,9 -5,6 -3,4 C-6,3 -6,0 -3,-1 C-6,-2 -6,-5 -3,-6 C-5,-8 -3,-10 0,-12Z'
};
const VEINS = {
  maple: 'M0,-8 L0,12 M0,2 L6,-4 M0,2 L-6,-4 M0,4 L5,2 M0,4 L-5,2',
  oak: 'M0,-10 L0,13 M0,-4 L3,-5 M0,0 L-3,-1 M0,4 L3,4'
};

const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

/** When this cycle's gust starts, in ms after the cycle begins. */
export function gustAt(cycle, opts) {
  const t = timing(opts);
  return t.gustEarliest + rand01(cycle, 101) * t.gustJitter;
}

function look(seed) {
  return {
    kind: rand01(seed, 5) < 0.6 ? 'maple' : 'oak',
    tone: rand01(seed, 6),                // picks a color from whichever palette is on
    size: 0.09 + rand01(seed, 7) * 0.04   // fraction of the viewport height
  };
}

/**
 * Pile leaf `i` at tMs, in stage pixels: { x, y, rot, size, kind, tone }, or null
 * when it has not fallen yet this cycle or has already blown away.
 */
export function pileLeaf(tMs, i, geo, opts) {
  const t = timing(opts);
  const cycle = Math.floor(tMs / t.cycle);
  const into = tMs - cycle * t.cycle;
  const seed = cycle * 64 + i;
  const spawn = t.firstSpawn + (i / PILE_COUNT) * t.spawnSpread;
  if (into < spawn) return null;

  const { H } = geo;
  const fallMs = FALL_MIN_MS + rand01(seed, 3) * FALL_SPAN_MS;
  const restX = geo.left.x0 + geo.vw * (0.1 + 0.8 * rand01(seed, 1));
  const restY = H * (0.86 + 0.08 * rand01(seed, 2));
  const restRot = (rand01(seed, 4) * 2 - 1) * Math.PI * 0.6;
  const swayPhase = rand01(seed, 8) * 6;

  // Falling into the pile, then resting there with a slight rock.
  const settled = (ms) => {
    const u = (ms - spawn) / fallMs;
    if (u < 1) {
      return {
        x: restX + Math.sin(u * Math.PI * 3 + swayPhase) * H * 0.06 * (1 - u),
        y: -0.1 * H + (restY + 0.1 * H) * u,
        rot: restRot + Math.sin(u * Math.PI * 4) * 0.8 * (1 - u)
      };
    }
    return { x: restX, y: restY, rot: restRot + 0.06 * Math.sin(ms / 700 + i) };
  };

  const gust = gustAt(cycle, opts) + rand01(seed, 9) * GUST_STAGGER_MS;
  if (into < gust) return { ...settled(into), ...look(seed) };

  const u = (into - gust) / (TRAVEL_MIN_MS + rand01(seed, 10) * TRAVEL_SPAN_MS);
  if (u >= 1) return null;
  const from = settled(gust);
  const e = easeInOut(u);
  const endX = geo.totalW + H * 0.3;   // past the right window's far edge
  const lift = H * (0.35 + 0.3 * rand01(seed, 11));
  const spin = (2 + 3 * rand01(seed, 12)) * Math.PI * 2 * (rand01(seed, 13) < 0.5 ? -1 : 1);
  return {
    x: from.x + (endX - from.x) * e,
    y: from.y - lift * Math.sin(Math.PI * u) + Math.sin(u * 14 + swayPhase) * H * 0.02,
    rot: from.rot + spin * e,
    ...look(seed)
  };
}

/** Ambient leaf `i`: always falling somewhere across the whole stage, wrapping bottom to top. */
export function ambientLeaf(tMs, i, geo) {
  const { H } = geo;
  const period = 15000 + rand01(i, 21) * 7000;
  const shifted = tMs + rand01(i, 22) * period;
  const loop = Math.floor(shifted / period);
  const u = (shifted - loop * period) / period;
  const seed = 100000 + i * 997 + loop;
  return {
    x: geo.totalW * rand01(seed, 1) + Math.sin(u * Math.PI * 3 + rand01(seed, 8) * 6) * H * 0.08,
    y: -0.15 * H + 1.3 * H * u,
    rot: rand01(seed, 4) * Math.PI * 2 + u * (rand01(seed, 12) * 2 - 1) * 6,
    ...look(seed),
    size: 0.07 + rand01(seed, 7) * 0.03
  };
}

/** How hard the wind is blowing, 0..1: a swell around each gust. */
export function gustStrength(tMs, opts) {
  const { cycle: len } = timing(opts);
  const cycle = Math.floor(tMs / len);
  const w = (tMs - cycle * len - gustAt(cycle, opts) + 600) / WIND_MS;
  return w > 0 && w < 1 ? Math.sin(Math.PI * w) : 0;
}

// ---- Drawing ---------------------------------------------------------------

let paths = null;   // Path2D exists only in the browser, so build on first draw

function drawLeaf(ctx, leaf, H, alpha, palette) {
  const s = (leaf.size * H) / 24;
  const [fill, edge] = palette[Math.floor(leaf.tone * palette.length)];
  ctx.save();
  ctx.translate(leaf.x, leaf.y);
  ctx.rotate(leaf.rot);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.fill(paths[leaf.kind]);
  ctx.strokeStyle = edge;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.9;
  ctx.stroke(paths[leaf.kind]);
  ctx.lineWidth = 0.7;
  ctx.stroke(paths[`${leaf.kind}Veins`]);
  ctx.restore();
}

function drawWind(ctx, tMs, view, opts) {
  const { vw, H, totalW } = view;
  const { cycle: len } = timing(opts);
  const cycle = Math.floor(tMs / len);
  const sinceGust = tMs - cycle * len - gustAt(cycle, opts);
  ctx.lineCap = 'round';
  ctx.lineWidth = H * 0.006;
  for (let k = 0; k < 4; k++) {
    const w = (sinceGust - k * 250 + 600) / (WIND_MS - 500);
    if (w <= 0 || w >= 1) continue;
    const head = -0.4 * vw + (totalW + 0.8 * vw) * w;
    const len = vw * 0.35;
    const y = H * (0.3 + 0.13 * k);
    ctx.strokeStyle = `rgba(243, 236, 223, ${(0.45 * Math.sin(Math.PI * w)).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(head - len, y + H * 0.04);
    ctx.quadraticCurveTo(head - len / 2, y - H * 0.03, head, y);
    ctx.stroke();
  }
}

/** Draw this window's slice. ctx is already translated so stage x maps to this window. */
export function draw(ctx, tMs, view, opts) {
  paths ??= {
    maple: new Path2D(SHAPES.maple), mapleVeins: new Path2D(VEINS.maple),
    oak: new Path2D(SHAPES.oak), oakVeins: new Path2D(VEINS.oak)
  };
  const palette = PALETTES[opt(opts, 'leafColors')];
  const { x0, vw, H } = view;
  const margin = H * 0.15;
  const onScreen = (leaf) => leaf && leaf.x > x0 - margin && leaf.x < x0 + vw + margin;

  // A low warm glow, like a streetlight on a lawn; the rest stays near-black.
  const glow = ctx.createRadialGradient(x0 + vw / 2, H * 1.15, H * 0.1, x0 + vw / 2, H * 1.15, H * 1.3);
  glow.addColorStop(0, '#2a1a10');
  glow.addColorStop(1, '#050409');
  ctx.fillStyle = glow;
  ctx.fillRect(x0, 0, vw, H);

  for (let i = 0; i < AMBIENT_COUNT; i++) {
    const leaf = ambientLeaf(tMs, i, view);
    if (onScreen(leaf)) drawLeaf(ctx, leaf, H, 0.9, palette);
  }
  drawWind(ctx, tMs, view, opts);
  for (let i = 0; i < PILE_COUNT; i++) {
    const leaf = pileLeaf(tMs, i, view, opts);
    if (onScreen(leaf)) drawLeaf(ctx, leaf, H, 1, palette);
  }
}
