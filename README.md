# Halloween Eyes

Two animated eyes, one per front window, on a Raspberry Pi 5. After Halloween the
same two windows run seasonal scenes, picked by date (`public/js/scenes/calendar.js`):

| Dates | Scene |
|---|---|
| October | eyes |
| Nov 1–29 | leaf gusts |
| Hanukkah (2026: Dec 4–11) | menorah |
| Other Christmas evenings | snow + countdown, with a 2-minute Santa radar check every 15 min |
| Dec 24 | Santa radar all evening |

## Run locally

    nvm use
    python3 server/serve.py --root public --port 8080
    open "http://localhost:8080/?viewport=left"
    open "http://localhost:8080/?viewport=left&gag=bothOneWindow"   # loop one performance

    open "http://localhost:8080/?viewport=right&scene=menorah&at=2026-12-08T19:00"  # preview a scene on a date

Valid gag names are in public/js/poses.js (GAG_NAMES, REACTION_NAMES); scene names in
public/js/scenes/calendar.js. `?at=` runs the clock from that local time.

## Phone control page

`http://eyes.local:8080/control.html` on the home Wi-Fi. Pick a show or leave it on
**Auto (by date)**; the page lists only the settings of the show on screen. Settings
and their allowed values live in `public/js/scenes/options.js`, with a copy in
`server/serve.py` that a test keeps in sync.

## Test

    node --test                       # scans recursively from the repo root
    .venv/bin/pytest tests/
    ./tools/check-no-random.sh

Note: pass no path to `node --test`. On Node 22 a positional directory argument
is treated as a file to execute, so `node --test tests/` fails to resolve.

## On the Pi

    bash ~/halloween-eyes/deploy/install-autostart.sh   # (re)install service, cron, idle sleep
    systemctl --user start halloween-eyes               # run the show now
    ~/halloween-eyes/deploy/screens.sh on               # wake the monitors (off: sleep them)

The show runs 17:45–23:30 nightly, October through December (`deploy/crontab.example`). Outside show
hours the monitors sleep after 10 idle minutes; keyboard, mouse or SSH login wakes them.
After pulling changes to `deploy/`, re-run the installer — the service files and crontab
are installed copies. The installer needs `swayidle`, `wlopm` and `wlrctl` (`wlrctl` nudges
the mouse so the hidden cursor takes effect).

## Design

See `docs/DESIGN.md` for the design spec and `docs/PLAN.md` for the implementation plan.
Seasonal scenes: `docs/specs/2026-10-16-seasonal-scenes-design.md`.
