// Tests for the Santa radar's state.
//
// Run: node --test   (Node 22 — `nvm use` first)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { santaState } from '../public/js/scenes/santa.js';

const at = (month, day, hour = 19, minute = 0) => new Date(2026, month - 1, day, hour, minute).getTime();

test('before Christmas Eve: pre-flight checks, blip circling the North Pole', () => {
  const s = santaState(at(12, 10));
  assert.equal(s.phase, 'preflight');
  assert.ok(s.blip.y < -0.6, 'blip near the top of the scope');
  assert.equal(s.lines.foot, 'Takeoff in 14 days');
  assert.equal(santaState(at(12, 23)).lines.foot, 'Takeoff tomorrow');
});

test('the status line changes every few seconds and repeats the same way', () => {
  const t = at(12, 10);
  assert.equal(santaState(t).lines.big, santaState(t).lines.big);
  const seen = new Set([0, 5, 10, 15, 20].map((s) => santaState(t + s * 1000).lines.big));
  assert.ok(seen.size > 1);
});

test('Christmas Eve: Santa closes in all evening and arrives at 9:00 pm', () => {
  const miles = [];
  for (let m = 0; m <= 195; m += 15) {
    const s = santaState(at(12, 24, 17, 45) + m * 60000);
    if (s.phase === 'flight') miles.push(s.miles);
  }
  assert.equal(miles[0], 3100);
  for (let i = 1; i < miles.length; i++) assert.ok(miles[i] < miles[i - 1], `miles ${miles}`);
  assert.equal(santaState(at(12, 24, 19)).lines.foot, 'Arrives 9:00 pm');
  assert.match(santaState(at(12, 24, 19)).lines.big, /^[\d,]+ mi$/);

  const arrived = santaState(at(12, 24, 21));
  assert.equal(arrived.phase, 'arrived');
  assert.equal(arrived.lines.big, 'Go to sleep!');
  assert.ok(Math.hypot(arrived.blip.x, arrived.blip.y) < 0.05, 'blip at the house');
});

test('the blip moves toward the center as the miles drop', () => {
  const r = (h, m) => { const b = santaState(at(12, 24, h, m)).blip; return Math.hypot(b.x, b.y); };
  assert.ok(r(18, 0) > r(19, 30) && r(19, 30) > r(20, 45));
});

test('Christmas Day and after: all delivered, no blip', () => {
  for (const day of [25, 28]) {
    const s = santaState(at(12, day));
    assert.equal(s.phase, 'delivered');
    assert.equal(s.blip, null);
  }
});
