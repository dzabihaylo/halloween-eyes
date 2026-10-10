# Halloween Eyes

Two animated eyes, one per front window, on a Raspberry Pi 5.

## Run locally

    nvm use
    python3 server/serve.py --root public --port 8080
    open "http://localhost:8080/?viewport=left"
    open "http://localhost:8080/?viewport=left&gag=bothOneWindow"   # loop one performance

Valid gag names are in public/js/poses.js (GAG_NAMES, REACTION_NAMES).

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

The show runs 17:45–23:30 nightly in October (`deploy/crontab.example`). Outside show
hours the monitors sleep after 10 idle minutes; keyboard, mouse or SSH login wakes them.
After pulling changes to `deploy/`, re-run the installer — the service files and crontab
are installed copies.

## Design

See `docs/DESIGN.md` for the design spec and `docs/PLAN.md` for the implementation plan.
