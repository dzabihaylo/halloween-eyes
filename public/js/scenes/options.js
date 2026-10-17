// Per-scene settings the phone can change.
//
// The allowed values are listed once, here. server/serve.py keeps a copy, and
// tests/test_serve.py fails if the two drift apart. The control page shows each
// scene's keys only while that scene is on screen.

export const SCENE_OPTIONS = {
  leafColors: ['autumn', 'gold', 'crimson'],
  gustMinutes: [1, 2, 4],
  menorahNight: ['auto', 1, 2, 3, 4, 5, 6, 7, 8],
  burnDown: [true, false],
  snowAmount: ['light', 'steady', 'blizzard'],
  countdown: [true, false],
  radarEvery: [15, 30, 0]
};

export const OPTION_DEFAULTS = {
  leafColors: 'autumn',
  gustMinutes: 2,
  menorahNight: 'auto',
  burnDown: true,
  snowAmount: 'steady',
  countdown: true,
  radarEvery: 15
};

/** opts[key] if it is an allowed value, else the default. Scenes read every setting through this. */
export function opt(opts, key) {
  const value = opts?.[key];
  return SCENE_OPTIONS[key].includes(value) ? value : OPTION_DEFAULTS[key];
}
