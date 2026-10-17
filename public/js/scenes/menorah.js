// The menorah (Hanukkah).
//
// A silver-blue menorah across both windows, four branches in each, white candles
// on deep blue. Night n lights n candles, filling from the far right as seen from
// the street. The arms curve down toward the middle of the house, where the stem
// would stand behind the wall; the shamash is a real electric candle on the sill
// there. Settings: menorahNight (auto or 1–8), burnDown.

import { hanukkahNight, eveningProgress } from './calendar.js';
import { opt } from './options.js';

/** Out of season, auto steps through the nights this often, so every state can be checked on the rig. */
export const DEMO_NIGHT_MS = 4000;
const BURN_TO = 0.4;   // a candle's height at the end of the evening, as a fraction of full

/** Which night to show: the phone's pick, else the date, else (out of season) a demo cycle. */
export function nightFor(tMs, opts) {
  const picked = opt(opts, 'menorahNight');
  if (picked !== 'auto') return picked;
  return hanukkahNight(new Date(tMs)) || 1 + (Math.floor(tMs / DEMO_NIGHT_MS) % 8);
}

/** Stage x of candle k (0 = the first night's candle, far right from the street). */
export function slotX(k, geo) {
  const win = k < 4 ? geo.right : geo.left;
  return win.x0 + geo.vw * (0.8 - 0.2 * (k % 4));
}

/** A lit candle's height, 1 = full: shortens over the evening when burn-down is on. */
export function candleHeight(tMs, opts) {
  return opt(opts, 'burnDown') ? 1 - (1 - BURN_TO) * eveningProgress(tMs) : 1;
}

// ---- Drawing ---------------------------------------------------------------

function drawFlame(ctx, x, y, H, tMs, k) {
  // Flicker from sines of the clock: smooth, and identical in both windows.
  const stretch = 1 + 0.07 * Math.sin(tMs / 83 + k * 1.7) + 0.04 * Math.sin(tMs / 31 + k * 3.1);
  const lean = 0.12 * Math.sin(tMs / 170 + k * 2.3);
  const h = H * 0.085 * stretch, w = H * 0.034;

  const glow = ctx.createRadialGradient(x, y - h * 0.5, 0, x, y - h * 0.5, H * 0.11);
  glow.addColorStop(0, 'rgba(255, 211, 106, 0.38)');
  glow.addColorStop(1, 'rgba(255, 211, 106, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - H * 0.11, y - h * 0.5 - H * 0.11, H * 0.22, H * 0.22);

  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, 0, lean, 1, 0, 0);
  const teardrop = (hh, ww) => {
    ctx.beginPath();
    ctx.moveTo(0, -hh);
    ctx.bezierCurveTo(ww * 0.6, -hh * 0.55, ww * 0.55, -hh * 0.05, 0, 0);
    ctx.bezierCurveTo(-ww * 0.55, -hh * 0.05, -ww * 0.6, -hh * 0.55, 0, -hh);
    ctx.fill();
  };
  ctx.fillStyle = '#ffc94d';
  teardrop(h, w * 1.6);
  ctx.fillStyle = '#fff2c4';
  teardrop(h * 0.55, w);
  ctx.fillStyle = '#7fb2ff';
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.08, w * 0.22, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draw this window's slice. ctx is already translated so stage x maps to this window. */
export function draw(ctx, tMs, view, opts) {
  const { x0, vw, H } = view;
  const night = nightFor(tMs, opts);
  const height = H * 0.3 * candleHeight(tMs, opts);
  const cupY = H * 0.6, cupW = H * 0.075, cupH = H * 0.032, candleW = H * 0.046;
  const middle = (view.left.x1 + view.right.x0) / 2;   // where the stem would be, behind the wall

  const bg = ctx.createRadialGradient(x0 + vw / 2, H * 0.62, H * 0.05, x0 + vw / 2, H * 0.62, H * 0.95);
  bg.addColorStop(0, '#16306e');
  bg.addColorStop(1, '#040816');
  ctx.fillStyle = bg;
  ctx.fillRect(x0, 0, vw, H);

  const metal = ctx.createLinearGradient(0, cupY, 0, H);
  metal.addColorStop(0, '#dbe6f8');
  metal.addColorStop(1, '#8ea6cf');

  for (let k = 0; k < 8; k++) {
    const x = slotX(k, view);
    if (x < x0 - vw * 0.1 || x > x0 + vw * 1.1) continue;   // the other window's half

    // Arm: down from the cup, curving in toward the hidden stem.
    ctx.strokeStyle = metal;
    ctx.lineWidth = H * 0.026;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, cupY + cupH);
    ctx.quadraticCurveTo(x, H * 0.92, middle, H * 0.94);
    ctx.stroke();

    ctx.fillStyle = metal;
    ctx.beginPath();
    ctx.roundRect(x - cupW / 2, cupY, cupW, cupH, cupH * 0.35);
    ctx.fill();

    if (k >= night) continue;
    const top = cupY - height;
    const wax = ctx.createLinearGradient(x - candleW / 2, 0, x + candleW / 2, 0);
    wax.addColorStop(0, '#d7e0f0');
    wax.addColorStop(0.4, '#ffffff');
    wax.addColorStop(1, '#c9d4ea');
    ctx.fillStyle = wax;
    ctx.fillRect(x - candleW / 2, top, candleW, height);
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = H * 0.004;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top - H * 0.012);
    ctx.stroke();
    drawFlame(ctx, x, top - H * 0.008, H, tMs, k);
  }
}
