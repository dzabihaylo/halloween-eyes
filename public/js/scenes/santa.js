// Santa radar (Christmas).
//
// Left window: a radar scope with the house at the center and a sweeping beam.
// Right window: a readout. Before Christmas Eve the blip circles the North Pole
// through pre-flight checks. On Christmas Eve a built-in route brings it to the
// house by 9:00 pm, computed from the clock: no internet feed to fail on the one
// night it matters. Place names stay generic because this repo is public.

import { sleepsUntilChristmas } from './calendar.js';

const SWEEP_MS = 4000;
const STATUS_MS = 5000;
const TAKEOFF_HOUR = 17.75;   // show start on Christmas Eve
const START_MILES = 3100;

/** Minutes after takeoff, where he is, and how far away. He arrives at the last waypoint. */
const ROUTE = [
  [0, 'Over the Arctic', 3100],
  [50, 'Over Greenland', 2200],
  [100, 'Over Canada', 1200],
  [150, 'Over the next state', 300],
  [180, 'Over the next town', 25],
  [195, 'Over your street', 0]
];
const ARRIVAL = '9:00 pm';   // takeoff + 195 minutes

const STATUSES = ['Sleigh: loaded', 'Reindeer: ready', 'Cocoa: hot', 'List: checked twice', 'Bells: tuned'];

const commas = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Bearing (degrees clockwise from north) and distance (0–1 of the scope radius) to x/y, y down. */
const polar = (bearing, r) => ({
  x: r * Math.sin((bearing * Math.PI) / 180),
  y: -r * Math.cos((bearing * Math.PI) / 180)
});

/** Everything the radar shows at tMs: phase, blip (scope units, or null) and readout lines. */
export function santaState(tMs) {
  const date = new Date(tMs);
  const sleeps = sleepsUntilChristmas(date);
  const header = 'SANTA TRACKER';

  if (sleeps === 0) {
    return { phase: 'delivered', blip: null, lines: { header, title: 'All delivered!', big: 'Merry Christmas', foot: '' } };
  }

  if (sleeps > 1) {
    const orbit = (tMs / 20000) * Math.PI * 2;
    const pole = polar(0, 0.8);
    const days = sleeps - 1;
    return {
      phase: 'preflight',
      blip: { x: pole.x + 0.07 * Math.cos(orbit), y: pole.y + 0.07 * Math.sin(orbit) },
      lines: {
        header,
        title: 'Pre-flight check',
        big: STATUSES[Math.floor(tMs / STATUS_MS) % STATUSES.length],
        foot: days === 1 ? 'Takeoff tomorrow' : `Takeoff in ${days} days`
      }
    };
  }

  // Christmas Eve.
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const minutes = Math.max(0, (hours - TAKEOFF_HOUR) * 60);
  const [arriveAt] = ROUTE.at(-1);
  if (minutes >= arriveAt) {
    return { phase: 'arrived', blip: { x: 0, y: 0 }, lines: { header, title: "He's close!", big: 'Go to sleep!', foot: '' } };
  }
  const leg = ROUTE.findLastIndex(([m]) => m <= minutes);
  const [m0, place, d0] = ROUTE[leg];
  const [m1, , d1] = ROUTE[leg + 1];
  const miles = d0 + ((d1 - d0) * (minutes - m0)) / (m1 - m0);
  return {
    phase: 'flight',
    miles,
    blip: polar(10 + 25 * (1 - miles / START_MILES), 0.9 * (miles / START_MILES)),
    lines: { header, title: place, big: `${commas(miles)} mi`, foot: `Arrives ${ARRIVAL}` }
  };
}

// ---- Drawing ---------------------------------------------------------------

const GREEN = '111, 227, 161';

function drawScope(ctx, tMs, view, s) {
  const { x0, vw, H } = view;
  const cx = x0 + vw / 2, cy = H * 0.5, R = H * 0.43;

  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * 0.9);
  bg.addColorStop(0, '#0c2a20');
  bg.addColorStop(1, '#030d0a');
  ctx.fillStyle = bg;
  ctx.fillRect(x0, 0, vw, H);

  ctx.lineWidth = H * 0.004;
  ctx.strokeStyle = `rgba(${GREEN}, 0.45)`;
  for (const f of [1 / 3, 2 / 3, 1]) { ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = `rgba(${GREEN}, 0.22)`;
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
  ctx.fillStyle = `rgba(${GREEN}, 0.8)`;
  ctx.font = `700 ${H * 0.04}px system-ui, "DejaVu Sans", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('N', cx, cy - R - H * 0.01);

  // The beam: a fading wedge behind a bright leading edge, clockwise from north.
  const sweep = ((tMs % SWEEP_MS) / SWEEP_MS) * Math.PI * 2;
  const toCanvas = (a) => a - Math.PI / 2;
  const slices = 24, width = 0.7;
  for (let k = 0; k < slices; k++) {
    const a1 = sweep - (k / slices) * width, a0 = sweep - ((k + 1) / slices) * width;
    ctx.fillStyle = `rgba(${GREEN}, ${(0.32 * (1 - k / slices)).toFixed(3)})`;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, toCanvas(a0), toCanvas(a1)); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = `rgba(${GREEN}, 0.95)`;
  ctx.lineWidth = H * 0.006;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.sin(sweep), cy - R * Math.cos(sweep)); ctx.stroke();

  // The house.
  const h = H * 0.035;
  ctx.fillStyle = '#f3ecdf';
  ctx.beginPath();
  ctx.moveTo(cx - h, cy + h); ctx.lineTo(cx - h, cy); ctx.lineTo(cx, cy - h); ctx.lineTo(cx + h, cy); ctx.lineTo(cx + h, cy + h);
  ctx.closePath(); ctx.fill();

  if (!s.blip) return;
  // Brightest just after the beam passes, fading until the next pass, like a real scope.
  const angle = Math.atan2(s.blip.x, -s.blip.y);
  const since = (((sweep - angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  let bright = 0.3 + 0.7 * (1 - since / (Math.PI * 2));
  if (s.phase === 'arrived') bright = 0.6 + 0.4 * Math.sin(tMs / 250);
  const bx = cx + s.blip.x * R, by = cy + s.blip.y * R;
  const glow = ctx.createRadialGradient(bx, by, 0, bx, by, H * 0.06);
  glow.addColorStop(0, `rgba(255, 74, 58, ${(0.75 * bright).toFixed(3)})`);
  glow.addColorStop(1, 'rgba(255, 74, 58, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(bx - H * 0.06, by - H * 0.06, H * 0.12, H * 0.12);
  ctx.globalAlpha = bright;
  ctx.fillStyle = '#ff3b2f';
  ctx.beginPath(); ctx.arc(bx, by, H * 0.016, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

/** Text that shrinks to fit the window width. */
function line(ctx, text, x, y, px, color, maxW, weight = 800) {
  if (!text) return;
  ctx.font = `${weight} ${px}px system-ui, "DejaVu Sans", sans-serif`;
  const w = ctx.measureText(text).width;
  if (w > maxW) ctx.font = `${weight} ${(px * maxW) / w}px system-ui, "DejaVu Sans", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function drawReadout(ctx, tMs, view, s) {
  const { x0, vw, H } = view;
  const cx = x0 + vw / 2, maxW = vw * 0.86;
  ctx.fillStyle = '#061219';
  ctx.fillRect(x0, 0, vw, H);
  const { header, title, big, foot } = s.lines;
  line(ctx, header, cx, H * 0.2, H * 0.06, `rgb(${GREEN})`, maxW, 700);
  if (Math.floor(tMs / 600) % 2 === 0) {
    ctx.font = `700 ${H * 0.06}px system-ui, "DejaVu Sans", sans-serif`;
    const half = ctx.measureText(header).width / 2;
    ctx.fillStyle = '#ff3b2f';
    ctx.beginPath(); ctx.arc(cx - half - H * 0.05, H * 0.2, H * 0.015, 0, Math.PI * 2); ctx.fill();
  }
  line(ctx, title, cx, H * 0.38, H * 0.1, '#e9e1cf', maxW);
  line(ctx, big, cx, H * 0.56, H * 0.16, '#ffcf7a', maxW);
  line(ctx, foot, cx, H * 0.74, H * 0.075, '#e9e1cf', maxW, 700);
}

/** Draw this window's slice. ctx is already translated so stage x maps to this window. */
export function draw(ctx, tMs, view) {
  const s = santaState(tMs);
  if (view.x0 === view.left.x0) drawScope(ctx, tMs, view, s);
  else drawReadout(ctx, tMs, view, s);
}
