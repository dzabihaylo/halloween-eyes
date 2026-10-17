// Snow + countdown (Christmas evenings).
//
// Snow falls across both windows and piles up into one snowbank that spans the
// house; its depth follows the evening and starts fresh each night. A garland
// hangs in each window with one ornament per sleep left, a big number in the left
// window and "sleeps till Christmas" in the right. Settings: snowAmount, countdown.

import { rand01 } from '../rng.js';
import { eveningProgress, sleepsUntilChristmas } from './calendar.js';
import { opt } from './options.js';

export const FLAKES = { light: 70, steady: 150, blizzard: 280 };
const MAX_ORNAMENTS = 25;   // Nov 30 is 25 sleeps out
const ORNAMENT_COLORS = ['#d8323a', '#f0b42e', '#4aa3e0', '#eef0f6', '#c64ad6'];

/** Snowbank depth as a fraction of the window height: a dusting at dusk, deep by bedtime. */
export function snowDepth(tMs) {
  return 0.03 + 0.25 * eveningProgress(tMs);
}

/** Stage y of the snow's surface at stage x. Waves are in stage x, so the bank runs unbroken behind the wall. */
export function pileTop(x, tMs, geo) {
  const { vw, H } = geo;
  const wave = 0.025 * Math.sin((2 * Math.PI * x) / (0.9 * vw) + 1.3) + 0.012 * Math.sin((2 * Math.PI * x) / (0.27 * vw) + 0.4);
  return H * (1 - snowDepth(tMs) + wave);
}

/** Flake `i`: falls across the whole stage, wrapping bottom to top with a new x each loop. */
export function flake(tMs, i, geo) {
  const { H } = geo;
  const period = 9000 + rand01(i, 31) * 7000;
  const shifted = tMs + rand01(i, 32) * period;
  const loop = Math.floor(shifted / period);
  const u = (shifted - loop * period) / period;
  const seed = 200000 + i * 991 + loop;
  return {
    x: geo.totalW * rand01(seed, 1) + Math.sin(u * Math.PI * 2 + rand01(seed, 2) * 6) * H * 0.03,
    y: -0.05 * H + 1.1 * H * u,
    r: H * (0.004 + 0.008 * rand01(i, 33)),
    alpha: 0.55 + 0.45 * rand01(i, 34)
  };
}

export function ornamentCount(date) {
  return Math.min(MAX_ORNAMENTS, sleepsUntilChristmas(date));
}

export function countdownText(date) {
  const sleeps = sleepsUntilChristmas(date);
  if (sleeps === 0) return { left: 'Merry', right: ['Christmas!'] };
  return { left: String(sleeps), right: [sleeps === 1 ? 'sleep' : 'sleeps', 'till Christmas'] };
}

// ---- Drawing ---------------------------------------------------------------

function drawGarland(ctx, win, H, count, offset) {
  const sag = H * 0.3, y0 = H * 0.07;
  const ax = win.x0 - H * 0.04, bx = win.x1 + H * 0.04, cx = (ax + bx) / 2;
  const point = (t) => ({
    x: (1 - t) ** 2 * ax + 2 * (1 - t) * t * cx + t * t * bx,
    y: (1 - t) ** 2 * y0 + 2 * (1 - t) * t * sag + t * t * y0
  });
  const curve = () => { ctx.beginPath(); ctx.moveTo(ax, y0); ctx.quadraticCurveTo(cx, sag, bx, y0); ctx.stroke(); };
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#173f2b'; ctx.lineWidth = H * 0.05; curve();
  ctx.setLineDash([H * 0.008, H * 0.01]);
  ctx.strokeStyle = '#2f7d55'; ctx.lineWidth = H * 0.06; curve();
  ctx.setLineDash([]);

  for (let j = 0; j < count; j++) {
    const p = point((j + 0.5) / count * 0.86 + 0.07);
    const r = H * 0.024, hang = H * 0.035;
    ctx.strokeStyle = '#cfc6b0'; ctx.lineWidth = H * 0.003;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + hang); ctx.stroke();
    ctx.fillStyle = ORNAMENT_COLORS[(j + offset) % ORNAMENT_COLORS.length];
    ctx.beginPath(); ctx.arc(p.x, p.y + hang + r, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath(); ctx.arc(p.x - r * 0.35, p.y + hang + r * 0.6, r * 0.25, 0, Math.PI * 2); ctx.fill();
  }
}

function glowText(ctx, text, x, y, px, weight = 800) {
  ctx.font = `${weight} ${px}px system-ui, "DejaVu Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 207, 122, 0.55)';
  ctx.shadowBlur = px * 0.12;
  ctx.fillStyle = '#fff1d6';
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

/** Draw this window's slice. ctx is already translated so stage x maps to this window. */
export function draw(ctx, tMs, view, opts) {
  const { x0, vw, H } = view;
  const date = new Date(tMs);

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0b1730');
  sky.addColorStop(1, '#050912');
  ctx.fillStyle = sky;
  ctx.fillRect(x0, 0, vw, H);

  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < FLAKES[opt(opts, 'snowAmount')]; i++) {
    const f = flake(tMs, i, view);
    if (f.x < x0 - f.r || f.x > x0 + vw + f.r) continue;
    ctx.globalAlpha = f.alpha;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (opt(opts, 'countdown')) {
    const n = ornamentCount(date), leftCount = Math.ceil(n / 2);
    const text = countdownText(date);
    const isLeft = x0 === view.left.x0;
    if (isLeft) {
      drawGarland(ctx, view.left, H, leftCount, 0);
      glowText(ctx, text.left, x0 + vw / 2, H * 0.52, H * (text.left.length > 2 ? 0.2 : 0.4));
    } else {
      drawGarland(ctx, view.right, H, n - leftCount, leftCount);
      if (text.right.length === 1) {
        glowText(ctx, text.right[0], x0 + vw / 2, H * 0.52, H * 0.2);
      } else {
        glowText(ctx, text.right[0], x0 + vw / 2, H * 0.47, H * 0.17);
        glowText(ctx, text.right[1], x0 + vw / 2, H * 0.62, H * 0.085, 700);
      }
    }
  }

  // The snowbank, in front of everything.
  const bank = ctx.createLinearGradient(0, H * 0.65, 0, H);
  bank.addColorStop(0, '#f4f8ff');
  bank.addColorStop(1, '#b9cbe4');
  ctx.fillStyle = bank;
  ctx.beginPath();
  ctx.moveTo(x0, H);
  for (let s = 0; s <= 64; s++) {
    const x = x0 + (vw * s) / 64;
    ctx.lineTo(x, pileTop(x, tMs, view));
  }
  ctx.lineTo(x0 + vw, H);
  ctx.closePath();
  ctx.fill();
}
