// Which scene runs when. Pure functions of local date and time.
//
// Local time on purpose: the show is an evening in front of one house, and both
// windows read the same Pi clock, so they always pick the same scene.
// docs/specs/2026-10-16-seasonal-scenes-design.md has the calendar as a table.

import { DEFAULT_SHOW_CONFIG } from '../director.js';
import { opt } from './options.js';

export const SCENE_NAMES = ['eyes', 'leaves', 'menorah', 'christmas', 'santa'];
/** What the phone can pick. `auto` follows the calendar. */
export const SCENE_CHOICES = ['auto', ...SCENE_NAMES];

/**
 * First evening of Hanukkah as [month, day], by year. It moves every year with the
 * Hebrew calendar, so it is a table rather than a formula. Add a line each year the
 * show runs; a missing year simply never shows the menorah.
 */
export const HANUKKAH_FIRST_EVENING = { 2026: [12, 4] };

/** Santa radar interrupts Christmas evenings for the first RADAR_FOR_MIN of every `radarEvery` minutes (0 = never). */
export const RADAR_FOR_MIN = 2;

// Whole days since the epoch for a calendar date. Via UTC so a DST change, which
// makes one local day 23 or 25 hours long, never skips or repeats a day.
const dayNumber = (year, month, day) => Math.round(Date.UTC(year, month - 1, day) / 86400000);
const localDayNumber = (date) => dayNumber(date.getFullYear(), date.getMonth() + 1, date.getDate());

/** Which night of Hanukkah this evening is, 1–8, or 0 when it is not Hanukkah. */
export function hanukkahNight(date) {
  const first = HANUKKAH_FIRST_EVENING[date.getFullYear()];
  if (!first) return 0;
  const night = localDayNumber(date) - dayNumber(date.getFullYear(), ...first) + 1;
  return night >= 1 && night <= 8 ? night : 0;
}

/** Sleeps until Christmas morning: 1 on Christmas Eve, 0 from Christmas Day to New Year. */
export function sleepsUntilChristmas(date) {
  return Math.max(0, dayNumber(date.getFullYear(), 12, 25) - localDayNumber(date));
}

/** The scene the calendar picks for an evening, before Christmas radar checks. */
export function seasonFor(date) {
  const month = date.getMonth() + 1;
  if (hanukkahNight(date)) return 'menorah';
  if (month === 11 && date.getDate() <= 29) return 'leaves';
  if (month === 11 || month === 12) return 'christmas';
  return 'eyes';
}

/** The scene on screen at tMs. A forced choice from the phone or URL wins; anything else follows the calendar. */
export function sceneAt(tMs, choice = 'auto', opts) {
  if (choice !== 'auto' && SCENE_NAMES.includes(choice)) return choice;
  const date = new Date(tMs);
  const season = seasonFor(date);
  if (season !== 'christmas') return season;
  if (date.getMonth() === 11 && date.getDate() === 24) return 'santa';
  const every = opt(opts, 'radarEvery');
  return every && date.getMinutes() % every < RADAR_FOR_MIN ? 'santa' : 'christmas';
}

/** 0 at the start of show hours, 1 at the end, clamped. Drives burn-down and snow depth. */
export function eveningProgress(tMs, cfg = DEFAULT_SHOW_CONFIG) {
  const d = new Date(tMs);
  const hour = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  const u = (hour - cfg.eveningStartHour) / (cfg.eveningEndHour - cfg.eveningStartHour);
  return Math.max(0, Math.min(1, u));
}
