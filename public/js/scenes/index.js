// The scene layer: every show that is not the eyes.
//
// main.js loads this file with a guarded dynamic import. If anything here fails
// to load, the page keeps showing the eyes. Each scene paints its whole window
// every frame, background included.

import { sceneAt as calendarSceneAt } from './calendar.js';
import * as leaves from './leaves.js';
import * as menorah from './menorah.js';
import * as christmas from './christmas.js';
import * as santa from './santa.js';

const SCENES = { leaves, menorah, christmas, santa };

/** The scene on screen at tMs. `opts` is the live config (choice and per-scene settings). */
export function sceneAt(tMs, choice, opts) {
  const name = calendarSceneAt(tMs, choice, opts);
  return SCENES[name] ? name : 'eyes';
}

export function drawScene(name, ctx, tMs, view, opts) {
  SCENES[name].draw(ctx, tMs, view, opts);
}
