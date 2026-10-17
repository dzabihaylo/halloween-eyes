# Seasonal scenes — design

Approved 2026-10-16. Sketches: https://claude.ai/artifact/MXb53FGcCbPGvh8NFbMMZh
Issues: #22 leaf gusts, #27 menorah, #24 snow pile, #25 countdown, #26 Santa radar.

## Goal

Keep the rig running after Halloween with shows that are not eyes: leaf gusts in
November, a menorah for Hanukkah, and snow, a countdown and a Santa radar for
Christmas. Same Pi, same two windows, same rules: playful, readable from the
sidewalk, no randomness, both windows computed independently from the clock.

## Calendar

| Dates (local) | Scene |
|---|---|
| October | `eyes` (unchanged) |
| Nov 1–29 | `leaves` |
| Hanukkah, 8 evenings (2026: Dec 4–11) | `menorah`, all evening |
| Nov 30 – Dec 31, other evenings | `christmas` (snow + countdown); `santa` for the first 2 minutes of every 15 |
| Dec 24 | `santa` all evening |

`public/js/scenes/calendar.js` holds this as pure functions of local time. The
phone control page adds a **Show** row (`auto` default, or force any scene) and the
URL takes `?scene=<name>` for desk testing. Both go through the scheduled-config
path, so the two windows switch on the same frame.

## Rendering

One full-screen `<canvas>` per window, drawn in **stage coordinates**: the same
stage as the eyes (`stage.js`), each window translating by its own viewport offset.
An object that leaves the left window's slice is in the wall gap, then appears in
the right window's slice, with no messaging between windows.

Every scene is `draw(ctx, tMs, view)`, backed by pure state functions
(`leafState(t, i, geo)`, `snowDepth(t)`, `candlesLit(date)` …) that take the time
and an object's index and return where it is. Nothing is simulated frame to frame,
so a restarted window rejoins in phase. Variation comes from `rng.js`.

## Isolation

`main.js` loads `scenes/index.js` with a guarded dynamic import, like the config
channel. If it fails to load, or a scene throws while drawing, the page falls back
to the eyes for the rest of the session. When the scene is `eyes` the existing
code path runs untouched.

## Scenes

- **leaves** — leaves flutter down into a pile in the left window. About every two
  minutes a gust (wind streaks across both windows) lifts the pile and carries it
  behind the wall, through the right window and off its far edge. Ambient leaves
  fall through both windows the whole time.
- **menorah** — silver-blue menorah on deep blue, four branches per window. Night
  *n* lights *n* candles, filling from the far right as seen from the street.
  Candles shorten over the evening. Out of season (testing), the night cycles 1–8.
  The shamash is a real electric candle on the sill between the windows.
- **christmas** — snow falls across both windows and piles up; depth follows
  evening progress and resets nightly. A garland with one ornament per sleep left
  (max 25), a big number in the left window, "sleeps till Christmas" in the right.
  Dec 25 onward: "Merry / Christmas!".
- **santa** — radar scope (left) with the house at the center; readout (right).
  Before Dec 24: pre-flight checks, blip circling the North Pole. Dec 24: a built-in
  route brings the blip from the North Pole to the house by 9:00 pm, then "He's
  close. Go to sleep!". Place names stay generic ("Canada", "the next town over"):
  this repo is public.

## Schedule

The crontab's month field becomes `10-12`. `start-if-show-hours.sh` accepts a
month or a range. Must be on the Pi by Nov 1.

## Testing

`node --test` covers the calendar (dates → scene, Hanukkah nights, sleeps) and each
scene's state functions (determinism, crossings, depth over the evening). Drawing
is checked on the rig via the phone's Show row.
