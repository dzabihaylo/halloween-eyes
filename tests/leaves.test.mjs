// Tests for the leaf-gust scene's state functions.
//
// Run: node --test   (Node 22 — `nvm use` first)
//
// Drawing is checked on the rig; these pin down where each leaf is, which is the
// part both windows must agree on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeStage } from '../public/js/stage.js';
import { BASE } from '../public/js/geometry.js';
import {
  pileLeaf, ambientLeaf, gustAt, gustStrength, timing, PILE_COUNT, AMBIENT_COUNT
} from '../public/js/scenes/leaves.js';

const vw = 1920, H = 1080;
const stage = makeStage({ viewportW: vw, eyeW: vw * (BASE.rx * 2 / BASE.W) });
const geo = { vw, H, totalW: stage.totalW, left: stage.viewports.left, right: stage.viewports.right };

const CYCLE = 1_000_000;   // an arbitrary cycle far from zero
const { cycle: CYCLE_MS, gustEarliest, gustJitter } = timing();
const start = CYCLE * CYCLE_MS;
const gustStart = (c) => c * CYCLE_MS + gustAt(c);

test('a leaf is in the same place for the same time, every time', () => {
  for (const ms of [5_000, 40_000, gustAt(CYCLE) + 3_000]) {
    for (let i = 0; i < PILE_COUNT; i++) {
      assert.deepEqual(pileLeaf(start + ms, i, geo), pileLeaf(start + ms, i, geo));
    }
  }
});

test('the gust comes at a different moment each cycle, always late in it', () => {
  const times = [];
  for (let c = CYCLE; c < CYCLE + 20; c++) {
    const g = gustAt(c);
    assert.ok(g >= gustEarliest && g < gustEarliest + gustJitter);
    times.push(g);
  }
  assert.ok(new Set(times).size > 10, 'gust timing varies between cycles');
});

test('before the gust, the pile stays inside the left window', () => {
  for (let ms = 0; ms < gustAt(CYCLE); ms += 500) {
    for (let i = 0; i < PILE_COUNT; i++) {
      const leaf = pileLeaf(start + ms, i, geo);
      if (!leaf) continue;
      assert.ok(leaf.x > geo.left.x0 && leaf.x < geo.left.x1, `leaf ${i} at ${ms}ms: x=${leaf.x}`);
      assert.ok(leaf.y < H);
    }
  }
});

test('every pile leaf has landed and is resting when the gust arrives', () => {
  const g = gustStart(CYCLE);
  for (let i = 0; i < PILE_COUNT; i++) {
    const a = pileLeaf(g - 2_000, i, geo), b = pileLeaf(g - 1, i, geo);
    assert.ok(a && b, `leaf ${i} is visible`);
    assert.equal(a.x, b.x);
    assert.equal(a.y, b.y);
  }
});

test('the gust carries each leaf behind the wall, into the right window, then off its far edge', () => {
  const g = gustStart(CYCLE);
  for (let i = 0; i < PILE_COUNT; i++) {
    let seenGap = false, seenRight = false, gone = false;
    for (let ms = 0; ms < 12_000; ms += 20) {
      const leaf = pileLeaf(g + ms, i, geo);
      if (!leaf) { gone = true; continue; }
      assert.ok(!gone, `leaf ${i} came back after leaving`);
      if (leaf.x > geo.left.x1 && leaf.x < geo.right.x0) seenGap = true;
      if (leaf.x > geo.right.x0 && leaf.x < geo.right.x1) {
        assert.ok(seenGap, `leaf ${i} reached the right window without crossing the wall`);
        seenRight = true;
      }
    }
    assert.ok(seenGap && seenRight && gone, `leaf ${i}: gap=${seenGap} right=${seenRight} gone=${gone}`);
  }
});

test('the cycle ends clean: no pile leaf is left on screen to jump at the boundary', () => {
  for (let i = 0; i < PILE_COUNT; i++) {
    assert.equal(pileLeaf(start + CYCLE_MS - 1, i, geo), null);
    assert.equal(pileLeaf(start + CYCLE_MS, i, geo), null, 'next cycle starts empty');
  }
});

test('the wind blows only around the gust', () => {
  const g = gustStart(CYCLE);
  assert.equal(gustStrength(g - 5_000), 0);
  assert.ok(gustStrength(g + 1_500) > 0.5);
  assert.equal(gustStrength(g + 20_000), 0);
});

test('ambient leaves only ever fall downward within a loop', () => {
  for (let i = 0; i < AMBIENT_COUNT; i++) {
    let prev = null;
    for (let ms = 0; ms < 60_000; ms += 100) {
      const leaf = ambientLeaf(start + ms, i, geo);
      if (prev && leaf.y < prev.y) {
        assert.ok(prev.y > H && leaf.y < 0, `leaf ${i} only jumps up when it wraps from bottom to top`);
      }
      prev = leaf;
    }
  }
});

test('every wind setting keeps the cycle clean: pile landed before the gust, gone before the end', () => {
  for (const gustMinutes of [1, 2, 4]) {
    const opts = { gustMinutes };
    const len = timing(opts).cycle;
    for (let c = CYCLE; c < CYCLE + 10; c++) {
      const s = c * len, g = s + gustAt(c, opts);
      for (let i = 0; i < PILE_COUNT; i++) {
        const a = pileLeaf(g - 1500, i, geo, opts), b = pileLeaf(g - 1, i, geo, opts);
        assert.ok(a && b && a.y === b.y, `${gustMinutes} min, leaf ${i}: resting before the gust`);
        assert.equal(pileLeaf(s + len - 1, i, geo, opts), null, `${gustMinutes} min, leaf ${i}: gone by cycle end`);
      }
    }
  }
});

test('an unknown wind setting falls back to the default', () => {
  assert.equal(timing({ gustMinutes: 7 }).cycle, timing().cycle);
});
