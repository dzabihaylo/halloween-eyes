#!/usr/bin/env bash
# install-autostart.sh — installs the show's systemd user service and nightly cron.
#
# Run ON THE PI as eyesadmin (no sudo), after copying the repo to ~/halloween-eyes:
#   bash ~/halloween-eyes/deploy/install-autostart.sh
# Safe to re-run.
set -euo pipefail

DEPLOY="$(cd "$(dirname "$0")" && pwd)"

# Keep the user service manager alive with no one logged in, so the show
# survives the gap while the desktop restarts (see deploy/lightdm/).
loginctl enable-linger "$USER"

for tool in swayidle wlopm wlrctl; do
  if ! command -v "$tool" >/dev/null; then
    echo "Missing $tool. Install it first: sudo apt install swayidle wlopm wlrctl" >&2
    exit 1
  fi
done

mkdir -p ~/.config/systemd/user
cp "$DEPLOY/halloween-eyes.service" "$DEPLOY/eyes-idle.service" "$DEPLOY/eyes-server.service" ~/.config/systemd/user/
systemctl --user daemon-reload

# The show server runs all day, so the phone control page always answers.
systemctl --user enable eyes-server.service
systemctl --user restart eyes-server.service

# Monitors sleep after 10 idle minutes outside show hours; keyboard/mouse wakes them.
systemctl --user enable eyes-idle.service
systemctl --user restart eyes-idle.service

# SSH login wakes the monitors; logout puts them back to sleep (never during the
# show — screens.sh checks). Appended once, between markers, so re-runs are safe.
add_block() {
  local file="$1" body="$2"
  touch "$file"
  grep -q '# >>> halloween-eyes screens' "$file" && return 0
  printf '\n# >>> halloween-eyes screens\n%s\n# <<< halloween-eyes screens\n' "$body" >>"$file"
}
add_block ~/.profile \
  '[ -n "$SSH_CONNECTION" ] && "$HOME/halloween-eyes/deploy/screens.sh" on 2>/dev/null'
add_block ~/.bash_logout \
  '[ -n "$SSH_CONNECTION" ] && "$HOME/halloween-eyes/deploy/screens.sh" off 2>/dev/null'

# Monitor layout, so outputs come back on after a monitor power cycle.
# SIGHUP makes a running kanshi reload its config.
mkdir -p ~/.config/kanshi
cp "$DEPLOY/kanshi/config" ~/.config/kanshi/config
pkill -HUP -x kanshi || true

# eyesadmin's crontab holds only the show schedule, so replace it whole.
crontab "$DEPLOY/crontab.example"

echo "Installed. Start the show now with: systemctl --user start halloween-eyes"
echo "Enabled at boot (expect 'static': cron's @reboot check starts it only in show hours): $(systemctl --user is-enabled halloween-eyes.service || true)"
