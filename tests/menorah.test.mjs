// Tests for the menorah scene's state functions.
//
// Run: node --test   (Node 22 — `nvm use` first)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeStage } from '../public/js/stage.js';
import { BASE } from '../public/js/geometry.js';
import { nightFor, slotX, candleHeight, DEMO_NIGHT_MS } from '../public/js/scenes/menorah.js';

const vw = 1920, H = 1080;
const stage = makeStage({ viewportW: vw, eyeW: vw * (BASE.rx * 2 / BASE.W) });
const geo = { vw, H, totalW: stage.totalW, left: stage.viewports.left, right: stage.viewports.right };
const at = (month, day, hour = 19, minute = 0) => new Date(2026, month - 1, day, hour, minute).getTime();

test('on Hanukkah, the night comes from the date', () => {
  assert.equal(nightFor(at(12, 4)), 1);
  assert.equal(nightFor(at(12, 8)), 5);
  assert.equal(nightFor(at(12, 11)), 8);
});

test('out of season, auto cycles through all eight nights so the rig can be tested', () => {
  const seen = new Set();
  for (let ms = 0; ms < DEMO_NIGHT_MS * 8; ms += DEMO_NIGHT_MS) seen.add(nightFor(at(10, 20) + ms));
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('a night picked on the phone wins over the date', () => {
  assert.equal(nightFor(at(12, 4), { menorahNight: 6 }), 6);
  assert.equal(nightFor(at(10, 20), { menorahNight: 3 }), 3);
});

test('candles fill from the far right as seen from the street, four per window', () => {
  const xs = [...Array(8)].map((_, k) => slotX(k, geo));
  for (let k = 1; k < 8; k++) assert.ok(xs[k] < xs[k - 1], 'each new candle is left of the last');
  for (let k = 0; k < 4; k++) assert.ok(xs[k] > geo.right.x0 && xs[k] < geo.right.x1, `candle ${k + 1} in the right window`);
  for (let k = 4; k < 8; k++) assert.ok(xs[k] > geo.left.x0 && xs[k] < geo.left.x1, `candle ${k + 1} in the left window`);
});

test('candles burn down over the evening, unless burn-down is off', () => {
  const dusk = candleHeight(at(12, 6, 17, 45)), mid = candleHeight(at(12, 6, 20, 30)), late = candleHeight(at(12, 6, 23, 30));
  assert.equal(dusk, 1);
  assert.ok(mid < dusk && late < mid && late > 0.3, `heights ${dusk} ${mid} ${late}`);
  assert.equal(candleHeight(at(12, 6, 23, 30), { burnDown: false }), 1);
});
