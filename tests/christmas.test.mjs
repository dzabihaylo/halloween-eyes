// Tests for the snow + countdown scene's state functions.
//
// Run: node --test   (Node 22 — `nvm use` first)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeStage } from '../public/js/stage.js';
import { BASE } from '../public/js/geometry.js';
import { flake, snowDepth, pileTop, ornamentCount, countdownText, FLAKES } from '../public/js/scenes/christmas.js';

const vw = 1920, H = 1080;
const stage = makeStage({ viewportW: vw, eyeW: vw * (BASE.rx * 2 / BASE.W) });
const geo = { vw, H, totalW: stage.totalW, left: stage.viewports.left, right: stage.viewports.right };
const at = (month, day, hour = 19, minute = 0) => new Date(2026, month - 1, day, hour, minute);

test('the snow piles up over the evening and starts fresh the next night', () => {
  const depths = [[17, 45], [19, 0], [21, 0], [23, 30]].map(([h, m]) => snowDepth(at(12, 10, h, m).getTime()));
  for (let i = 1; i < depths.length; i++) assert.ok(depths[i] > depths[i - 1], `depths ${depths}`);
  assert.equal(snowDepth(at(12, 11, 17, 45).getTime()), depths[0], 'next evening starts as shallow as the last');
  assert.ok(depths.at(-1) < 0.35, 'never buries more than a third of the window');
});

test('the snowbank is one continuous surface across the wall', () => {
  const t = at(12, 10, 21).getTime();
  const y1 = pileTop(geo.left.x1 - 1, t, geo), y2 = pileTop(geo.left.x1, t, geo);
  assert.ok(Math.abs(y1 - y2) < 1, 'no step at the window edge');
  assert.ok(pileTop(geo.right.x0 + 10, t, geo) < H);
});

test('a flake is in the same place for the same time, and only falls', () => {
  const t = at(12, 10).getTime();
  for (let i = 0; i < FLAKES.blizzard; i += 7) {
    assert.deepEqual(flake(t, i, geo), flake(t, i, geo));
    const a = flake(t, i, geo), b = flake(t + 100, i, geo);
    if (b.y < a.y) assert.ok(a.y > H && b.y < 0, `flake ${i} only jumps up when it wraps`);
  }
});

test('one ornament per sleep left, at most 25', () => {
  assert.equal(ornamentCount(at(11, 30)), 25);
  assert.equal(ornamentCount(at(12, 16)), 9);
  assert.equal(ornamentCount(at(12, 25)), 0);
  assert.equal(ornamentCount(at(10, 20)), 25, 'testing in October caps the garland');
});

test('the countdown reads naturally, down to Christmas', () => {
  assert.deepEqual(countdownText(at(12, 16)), { left: '9', right: ['sleeps', 'till Christmas'] });
  assert.deepEqual(countdownText(at(12, 24)), { left: '1', right: ['sleep', 'till Christmas'] });
  assert.deepEqual(countdownText(at(12, 25)), { left: 'Merry', right: ['Christmas!'] });
  assert.deepEqual(countdownText(at(12, 30)), { left: 'Merry', right: ['Christmas!'] });
});
