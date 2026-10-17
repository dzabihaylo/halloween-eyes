// Boot, viewport detection, and the render loop.

import { eyeGeometry, BASE } from './geometry.js';
import { PALETTES, SHAPES } from './themes.js';
import { createEyeSvg, updateEye } from './render.js';
import { makeStage, DEFAULT_GAP_EYE_WIDTHS } from './stage.js';
import { showState, DEFAULT_SHOW_CONFIG, testGagFrom } from './director.js';

/**
 * Which half of the stage this window renders.
 *
 * Derived from the window's own position rather than passed in at launch, so a
 * window is correct for wherever it actually landed. Two Chromium windows starting
 * together is a race; if the compositor resolves it by launch order the assignment
 * can differ between boots, and the failure is subtle — a swapped pair scowls
 * outward instead of inward rather than showing anything obviously broken.
 */
export function detectViewport() {
  const override = new URLSearchParams(location.search).get('viewport');
  if (override === 'left' || override === 'right') return override;
  // On an extended desktop the second output starts at x = width of the first.
  return window.screenX >= window.screen.width / 2 ? 'right' : 'left';
}

const state = {
  shape: 'amber',
  palette: 'amber',
  energyDrift: true,
  crowdStyle: 'shrink',
  testGag: 'off',   // from the control page; see testGagFrom()
  testGagAt: 0,
  scene: 'auto'     // see scenes/calendar.js
};

let viewport, stage, eyes, stageEl, sceneCanvas, sceneCtx;
let scenes = null;      // the scene layer, once loaded; null means eyes only
let showing = 'eyes';

// ?gag=<name> loops one performance at a desk (docs/specs/2026-10-05-test-gags-design.md).
const urlGag = new URLSearchParams(location.search).get('gag');
// ?scene=<name> forces a scene at a desk (docs/specs/2026-10-16-seasonal-scenes-design.md).
const urlScene = new URLSearchParams(location.search).get('scene');
// ?at=2026-12-08T19:00 runs the clock from that local time, to preview a date at a desk.
const urlAt = Date.parse(new URLSearchParams(location.search).get('at'));
const clockOffset = Number.isFinite(urlAt) ? urlAt - Date.now() : 0;

function buildEyes() {
  stageEl.replaceChildren();
  const palette = PALETTES[state.palette];
  const shape = SHAPES[state.shape];
  const pupilShape = shape.pupilFixed ? shape.pupil : palette.pupilOverride ?? shape.pupil;

  eyes = ['L', 'R'].map((side) => {
    const geom = eyeGeometry(state.shape, side);
    const svg = createEyeSvg(geom, palette, 'eye');
    const holder = document.createElement('div');
    holder.className = 'eye';
    holder.appendChild(svg);
    stageEl.appendChild(holder);
    return { side, geom, svg, holder, pupilShape };
  });
}

function layout() {
  const vw = window.innerWidth;
  const eyeW = vw * (BASE.rx * 2 / BASE.W);
  stage = makeStage({ viewportW: vw, eyeW, gapEyeWidths: DEFAULT_GAP_EYE_WIDTHS });
  for (const e of eyes) e.holder.style.width = `${vw}px`;
  const dpr = window.devicePixelRatio || 1;
  sceneCanvas.width = Math.round(vw * dpr);
  sceneCanvas.height = Math.round(window.innerHeight * dpr);
}

function show(which) {
  if (which === showing) return;
  showing = which;
  stageEl.hidden = which !== 'eyes';
  sceneCanvas.hidden = which === 'eyes';
}

/** Draw a scene's slice of the stage. Returns false if it could not, so the eyes take over. */
function drawScene(name, tMs) {
  const dpr = window.devicePixelRatio || 1;
  const x0 = stage.viewports[viewport].x0;
  try {
    // Scenes draw in stage coordinates; shift so this window's slice lands on screen.
    sceneCtx.setTransform(dpr, 0, 0, dpr, -x0 * dpr, 0);
    scenes.drawScene(name, sceneCtx, tMs, {
      x0, vw: stage.viewportW, H: window.innerHeight, totalW: stage.totalW,
      left: stage.viewports.left, right: stage.viewports.right
    });
    return true;
  } catch (err) {
    // A broken scene must not leave a dark window. Back to the eyes for this session.
    console.warn(`Scene ${name} failed; showing the eyes instead.`, err);
    scenes = null;
    return false;
  }
}

function frame() {
  const now = Date.now() + clockOffset;
  const name = scenes ? scenes.sceneAt(now, urlScene ?? state.scene) : 'eyes';
  if (name !== 'eyes' && drawScene(name, now)) {
    show('scene');
    requestAnimationFrame(frame);
    return;
  }
  show('eyes');

  const s = showState(now, {
    ...DEFAULT_SHOW_CONFIG,
    energyDrift: state.energyDrift,
    testGag: testGagFrom({ urlGag, testGag: state.testGag, testGagAt: state.testGagAt })
  });
  const vw = stage.viewportW;
  // Both eyes' positions and their ONE shared scale, derived from the stage.
  const placement = stage.crowdPlacement(s.crowd);

  for (const e of eyes) {
    const eyeState = e.side === 'L' ? s.eyeL : s.eyeR;
    updateEye(e.svg._refs, { ...eyeState, pupilShape: e.pupilShape });

    // The holder is one viewport wide with the eye at its center, so its left
    // edge sits half a viewport left of the eye's center. Wander is shared.
    const centerX = placement[e.side].centerX + eyeState.stageOffset * vw;
    const localX = stage.toViewportX(centerX - vw / 2, viewport);

    // Crowding compresses the eyes so two fit in one window. `squash` distorts
    // horizontally (squash-and-stretch, reads as crowded); `shrink` scales
    // uniformly (reads as receding).
    const k = placement.scale;
    const scale = state.crowdStyle === 'squash' ? `scaleX(${k})` : `scale(${k})`;

    e.holder.style.transform = `translateX(${localX}px) ${scale}`;
  }
  requestAnimationFrame(frame);
}

function applyConfig(next) {
  const rebuild = next.shape !== state.shape || next.palette !== state.palette;
  Object.assign(state, next);
  if (rebuild) buildEyes();
}

function showSetupOverlay() {
  const el = document.getElementById('setup-overlay');
  el.textContent = viewport.toUpperCase();
  el.hidden = false;
}

/**
 * Attach the control channel, if it is there.
 *
 * Deliberately a dynamic import inside a try/catch rather than a static import
 * at the top of this file. The show must never depend on the control channel:
 * a static import makes a missing, broken or syntactically invalid
 * config-client.js a hard boot failure, which is the one outcome that is not
 * allowed — an evening of dark windows because a feature nobody needs failed to
 * parse. Losing the channel costs a phone-switchable palette. Losing the show
 * costs the whole night.
 */
async function startConfigChannel(onConfig) {
  try {
    const mod = await import('./config-client.js');
    mod.startConfigClient(onConfig);
  } catch (err) {
    console.warn('Control channel unavailable; the show continues without it.', err);
  }
}

/** Load the scene layer the same guarded way: if it fails, the page shows the eyes all season. */
async function loadScenes() {
  try {
    scenes = await import('./scenes/index.js');
  } catch (err) {
    console.warn('Scene layer unavailable; showing the eyes.', err);
  }
}

function boot() {
  stageEl = document.getElementById('stage');
  sceneCanvas = document.getElementById('scene');
  sceneCtx = sceneCanvas.getContext('2d');
  viewport = detectViewport();
  buildEyes();
  layout();
  window.addEventListener('resize', layout);
  if (new URLSearchParams(location.search).has('setup')) showSetupOverlay();
  startConfigChannel(applyConfig);
  loadScenes();
  requestAnimationFrame(frame);
}

boot();
