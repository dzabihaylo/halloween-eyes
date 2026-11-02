# Season 2026 snapshot

Taken off the Pi on 2026-11-02 before it was wiped.

- `crontab.live` — the crontab actually running (has the Oct 31 colour-cycle lines and the all-day Halloween tweak that `crontab.example` lacks).
- `config.json` — the show's last settings (`server/config.json`, gitignored).

Next year: reflash, run `deploy/setup-root.sh`, `deploy/install-autostart.sh`, `deploy/lightdm/install.sh`,
then `crontab deploy/season-2026/crontab.live` and copy `config.json` to `server/` if you want last year's exact setup.
