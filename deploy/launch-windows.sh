#!/usr/bin/env bash
# launch-windows.sh — starts one Chromium window per monitor.
#
# The pages come from the show server, which runs all day as its own service
# (deploy/eyes-server.service) so the phone control page works outside show hours.
#
# Run by the halloween-eyes systemd user service (deploy/halloween-eyes.service),
# not by hand. Install steps: deploy/install-autostart.sh.
#
# Differences from docs/PLAN.md Task 12, all from docs/SPIKE-NOTES.md:
# - The session is labwc (Wayland). Chromium runs under XWayland, which honors
#   --window-position, so there is no xrandr step. xset does not apply either.
#   Blanking is handled by eyes-idle.service, which never sleeps the monitors
#   while this service is active.
# - Each window gets an explicit ?viewport= so placement never depends on
#   launch order.
# - --password-store=basic stops a keyring dialog from covering the show.
#
# If either window dies, the script exits and systemd restarts both. The show
# is a function of wall-clock time, so a restarted window rejoins in phase with
# nothing to restore.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/halloween-eyes}"
PORT="${PORT:-8080}"
URL="http://localhost:${PORT}/"

# Chromium under XWayland needs both of these; without DISPLAY it exits with
# "Missing X server or \$DISPLAY".
export DISPLAY="${DISPLAY:-:0}"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"

cd "$APP_DIR"

# If the desktop is not up yet (boot, or mid-relogin), fail fast and let
# systemd retry, rather than launching windows into nothing.
if [ ! -S "${XDG_RUNTIME_DIR}/${WAYLAND_DISPLAY}" ]; then
  echo "desktop not ready (no ${WAYLAND_DISPLAY}); retrying later" >&2
  exit 1
fi

# Wait for the server (just after boot it may still be starting) rather than
# sleeping a guessed number of seconds. Still down: fail and let systemd retry.
server_up=
for _ in $(seq 1 50); do
  if curl -fsS "${URL}config.json" >/dev/null 2>&1; then server_up=1; break; fi
  sleep 0.2
done
if [ -z "$server_up" ]; then
  echo "show server not answering on ${URL}; retrying later" >&2
  exit 1
fi

CHROME_FLAGS=(
  # Force XWayland. With WAYLAND_DISPLAY set, Chromium otherwise picks native
  # Wayland on its own, where --window-position is ignored.
  --ozone-platform=x11
  --kiosk
  --password-store=basic
  --noerrdialogs
  --disable-session-crashed-bubble
  --disable-infobars
  --check-for-update-interval=31536000
)

chromium "${CHROME_FLAGS[@]}" --user-data-dir=/tmp/eyes-left \
  --window-position=0,0    "${URL}?viewport=left" &
chromium "${CHROME_FLAGS[@]}" --user-data-dir=/tmp/eyes-right \
  --window-position=1920,0 "${URL}?viewport=right" &

# Hide the mouse pointer. The page sets cursor: none, but Chromium applies it
# only on a pointer event, and a mouse that has sat still since boot never sends
# one, so the arrow stays on the left screen all night. A 1px nudge, repeated
# while the pages load, makes it apply. Needs wlrctl (sudo apt install wlrctl);
# without it this does nothing. Disowned, so `wait -n` below never counts it.
nudge_pointer() {
  command -v wlrctl >/dev/null || return 0
  for _ in 1 2 3 4 5 6; do
    sleep 5
    wlrctl pointer move 1 0 && wlrctl pointer move -1 0 || true
  done
}
nudge_pointer & disown

# Exit as soon as either window dies; systemd restarts both.
wait -n
echo "a show process exited; restarting the set" >&2
exit 1
