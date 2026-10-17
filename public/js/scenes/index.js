// The scene layer: every show that is not the eyes.
//
// main.js loads this file with a guarded dynamic import. If anything here fails
// to load, the page keeps showing the eyes.

import { sceneAt as calendarSceneAt } from './calendar.js';
import * as leaves from './leaves.js';

const SCENES = { leaves };

/** The scene on screen at tMs. A scene that is not built yet falls back to the eyes. */
export function sceneAt(tMs, choice) {
  const name = calendarSceneAt(tMs, choice);
  return SCENES[name] ? name : 'eyes';
}

export function drawScene(name, ctx, tMs, view) {
  SCENES[name].draw(ctx, tMs, view);
}
