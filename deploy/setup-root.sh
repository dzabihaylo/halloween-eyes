#!/bin/sh
# setup-root.sh — one-time Pi setup that needs root. Safe to re-run.
# Run again after reflashing the SD card.
#
# Run from your Mac, in the repo root:
#   ssh -t eyesadmin@eyes.local 'sudo sh ~/halloween-eyes/deploy/setup-root.sh'
set -e

DEPLOY="$(cd "$(dirname "$0")" && pwd)"

# Log eyesadmin straight into the desktop at boot. Without it the Pi stops at
# the login screen and the show has nowhere to run (seen 2026-10-17).
raspi-config nonint do_boot_behaviour B4

# Wi-Fi power saving lets the radio doze, and then the phone control page and
# SSH stop answering ("idle" in Google Wifi, 2026-10-17).
for c in $(nmcli -g NAME,TYPE connection show | awk -F: '$2 == "802-11-wireless" { print $1 }'); do
  nmcli connection modify "$c" 802-11-wireless.powersave 2
done
iw dev wlan0 set power_save off || true

# The control page's Power off button (deploy/sudoers-poweroff).
visudo -cf "$DEPLOY/sudoers-poweroff"
install -m 0440 "$DEPLOY/sudoers-poweroff" /etc/sudoers.d/eyes-poweroff

echo "Done. Reboot to start the desktop: sudo reboot"
