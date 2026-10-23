#!/usr/bin/env bash
# start-if-show-hours.sh — at boot, start the show only if now is inside show hours.
#
# Run by cron's @reboot line (deploy/crontab.example), so a power blip at 19:00
# on Oct 31 brings the eyes back instead of leaving them dark until tomorrow.
# A 3am reboot still leaves the windows dark: outside the window this does nothing.
#
# The show windows are NOT defined here. They are read from the start and stop lines
# of deploy/crontab.example (the file install-autostart.sh installs), so the
# boot check and the nightly schedule cannot drift apart.
#
# Usage:
#   deploy/start-if-show-hours.sh
# Testing (no systemctl, just print the decision):
#   DRY_RUN=1 SHOW_NOW="2026-10-31 19:00" deploy/start-if-show-hours.sh
set -euo pipefail

DEPLOY="$(cd "$(dirname "$0")" && pwd)"
CRONTAB="$DEPLOY/crontab.example"
SERVICE="halloween-eyes.service"

# Pull "minute hour month" out of every cron line that runs a given verb, in order.
# Matches e.g. "45 17 * 10-12 * systemctl --user start halloween-eyes.service".
# The month is one number or a range.
cron_fields() {
  awk -v verb="$1" -v svc="$SERVICE" '
    $6 == "systemctl" && $7 == "--user" && $8 == verb && $9 == svc { print $1, $2, $4 }
  ' "$CRONTAB"
}

# A read loop, not mapfile, so the DRY_RUN test also runs on macOS's bash 3.2.
starts=() stops=()
while read -r line; do starts+=("$line"); done < <(cron_fields start)
while read -r line; do stops+=("$line"); done < <(cron_fields stop)

# Refuse to guess if the crontab changed shape; a loud failure beats a wrong start.
if (( ${#starts[@]} == 0 || ${#starts[@]} != ${#stops[@]} )); then
  echo "start-if-show-hours: cannot pair start and stop lines in $CRONTAB" >&2
  exit 1
fi

# The Pi has no clock battery, so at boot the clock resumes from the last
# shutdown until network time arrives. On 2026-10-17 that started the show at
# 15:29 because the clock still said 22:57. Wait up to 2 minutes for the sync;
# with no network, carry on with the clock as it is.
if [[ -z "${SHOW_NOW:-}" ]]; then
  for _ in $(seq 60); do
    [[ "$(timedatectl show -p NTPSynchronized --value 2>/dev/null)" == yes ]] && break
    sleep 2
  done
fi

# "Now" as "YYYY-MM-DD HH:MM". SHOW_NOW overrides it for testing.
now="${SHOW_NOW:-$(date '+%Y-%m-%d %H:%M')}"
if ! [[ "$now" =~ ^[0-9]{4}-([0-9]{2})-[0-9]{2}\ ([0-9]{2}):([0-9]{2})$ ]]; then
  echo "start-if-show-hours: bad time '$now' (want YYYY-MM-DD HH:MM)" >&2
  exit 1
fi
# 10# forces base 10, so "08" and "09" are not read as octal.
now_month=$((10#${BASH_REMATCH[1]}))
now_minutes=$((10#${BASH_REMATCH[2]} * 60 + 10#${BASH_REMATCH[3]}))

decision=skip
for i in "${!starts[@]}"; do
  read -r start_min start_hour start_month <<<"${starts[$i]}"
  read -r stop_min stop_hour stop_month <<<"${stops[$i]}"
  for v in "$start_min" "$start_hour" "$stop_min" "$stop_hour"; do
    if ! [[ "$v" =~ ^[0-9]+$ ]]; then
      echo "start-if-show-hours: cannot read the show window from $CRONTAB" >&2
      exit 1
    fi
  done
  if [[ "$start_month" != "$stop_month" ]]; then
    echo "start-if-show-hours: start and stop lines name different months" >&2
    exit 1
  fi
  if ! [[ "$start_month" =~ ^([0-9]+)(-([0-9]+))?$ ]]; then
    echo "start-if-show-hours: cannot read the show months from $CRONTAB" >&2
    exit 1
  fi
  first_month=$((10#${BASH_REMATCH[1]}))
  last_month=$((10#${BASH_REMATCH[3]:-${BASH_REMATCH[1]}}))
  start_minutes=$((10#$start_hour * 60 + 10#$start_min))
  stop_minutes=$((10#$stop_hour * 60 + 10#$stop_min))

  # Same rule cron applies: in a show month, start <= now < stop.
  if (( now_month >= first_month && now_month <= last_month && now_minutes >= start_minutes && now_minutes < stop_minutes )); then
    decision=start
  fi
  printf 'start-if-show-hours: now=%s window=months %s %02d:%02d-%02d:%02d\n' \
    "$now" "$start_month" "$((10#$start_hour))" "$((10#$start_min))" "$((10#$stop_hour))" "$((10#$stop_min))"
done
echo "start-if-show-hours: -> $decision"

[[ "$decision" == start ]] || exit 0
[[ -z "${DRY_RUN:-}" ]] || exit 0

# At @reboot the user service manager may not be up yet. Wait for it (linger
# starts it early; 2 minutes is generous). The service itself then retries
# until the desktop is up, so starting before the desktop is fine.
for _ in $(seq 60); do
  systemctl --user show-environment >/dev/null 2>&1 && break
  sleep 2
done
systemctl --user start "$SERVICE"
