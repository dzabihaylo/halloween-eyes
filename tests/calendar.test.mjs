// Tests for the season calendar: which scene runs when.
//
// Run: node --test   (Node 22 — `nvm use` first)
//
// Dates are built with local-time constructors, so the tests mean the same thing
// in any time zone — as the show does, which runs on the Pi's local evening.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sceneAt, seasonFor, hanukkahNight, sleepsUntilChristmas, eveningProgress,
  SCENE_NAMES, SCENE_CHOICES
} from '../public/js/scenes/calendar.js';

const at = (month, day, hour = 19, minute = 0) => new Date(2026, month - 1, day, hour, minute);

test('October is the eyes, untouched', () => {
  for (const day of [1, 15, 31]) assert.equal(sceneAt(at(10, day).getTime()), 'eyes');
});

test('November 1 to 29 is leaves', () => {
  assert.equal(seasonFor(at(11, 1)), 'leaves');
  assert.equal(seasonFor(at(11, 29)), 'leaves');
  assert.equal(seasonFor(at(11, 30)), 'christmas');
});

test('Hanukkah 2026 is eight evenings, Dec 4 to Dec 11', () => {
  assert.equal(hanukkahNight(at(12, 3)), 0);
  assert.equal(hanukkahNight(at(12, 4)), 1);
  assert.equal(hanukkahNight(at(12, 8)), 5);
  assert.equal(hanukkahNight(at(12, 11)), 8);
  assert.equal(hanukkahNight(at(12, 12)), 0);
});

test('the menorah takes over every Hanukkah evening, with no radar checks', () => {
  for (const minute of [0, 1, 7, 30]) {
    assert.equal(sceneAt(at(12, 6, 19, minute).getTime()), 'menorah');
  }
});

test('a year with no Hanukkah entry never shows the menorah', () => {
  assert.equal(hanukkahNight(new Date(2031, 11, 20, 19)), 0);
});

test('Christmas evenings: snow and countdown, with a 2-minute radar check every 15', () => {
  assert.equal(sceneAt(at(12, 1, 19, 0).getTime()), 'santa');
  assert.equal(sceneAt(at(12, 1, 19, 1).getTime()), 'santa');
  assert.equal(sceneAt(at(12, 1, 19, 2).getTime()), 'christmas');
  assert.equal(sceneAt(at(12, 1, 19, 14).getTime()), 'christmas');
  assert.equal(sceneAt(at(12, 1, 19, 15).getTime()), 'santa');
});

test('Christmas Eve is the radar all evening', () => {
  for (const minute of [0, 5, 33, 59]) {
    assert.equal(sceneAt(at(12, 24, 20, minute).getTime()), 'santa');
  }
});

test('a forced choice wins over the calendar; auto and junk follow it', () => {
  const oct = at(10, 20).getTime();
  assert.equal(sceneAt(oct, 'leaves'), 'leaves');
  assert.equal(sceneAt(oct, 'eyes'), 'eyes');
  assert.equal(sceneAt(oct, 'auto'), 'eyes');
  assert.equal(sceneAt(oct, 'fireworks'), 'eyes');
  assert.equal(sceneAt(at(11, 10).getTime(), 'eyes'), 'eyes', 'eyes can be forced in November');
});

test('sleeps till Christmas count down to zero and stay there', () => {
  assert.equal(sleepsUntilChristmas(at(11, 30)), 25);
  assert.equal(sleepsUntilChristmas(at(12, 16)), 9);
  assert.equal(sleepsUntilChristmas(at(12, 24, 23, 59)), 1);
  assert.equal(sleepsUntilChristmas(at(12, 25)), 0);
  assert.equal(sleepsUntilChristmas(at(12, 31)), 0);
});

test('a daylight-saving change does not skip or repeat a sleep', () => {
  // Nov 1 2026 is the end of DST in the US; local days still differ by exactly one.
  assert.equal(sleepsUntilChristmas(at(10, 31)) - sleepsUntilChristmas(at(11, 1)), 1);
  assert.equal(sleepsUntilChristmas(at(11, 1)) - sleepsUntilChristmas(at(11, 2)), 1);
});

test('evening progress runs 0 at 17:45 to 1 at 23:30, clamped', () => {
  assert.equal(eveningProgress(at(12, 1, 17, 0).getTime()), 0);
  assert.equal(eveningProgress(at(12, 1, 17, 45).getTime()), 0);
  assert.ok(Math.abs(eveningProgress(at(12, 1, 20, 37).getTime()) - 0.5) < 0.01);
  assert.equal(eveningProgress(at(12, 1, 23, 30).getTime()), 1);
  assert.equal(eveningProgress(at(12, 1, 23, 59).getTime()), 1);
});

test('every scene the calendar can pick is a choice on the control page', () => {
  assert.deepEqual(SCENE_CHOICES, ['auto', ...SCENE_NAMES]);
  for (const month of [10, 11, 12]) {
    for (let day = 1; day <= 31; day++) {
      const d = at(month, day);
      if (d.getMonth() !== month - 1) continue;
      for (const minute of [0, 5]) {
        assert.ok(SCENE_NAMES.includes(sceneAt(at(month, day, 19, minute).getTime())));
      }
    }
  }
});
