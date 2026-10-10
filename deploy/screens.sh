#!/usr/bin/env bash
# screens.sh — put both monitors to sleep, or wake them, without touching the layout.
#
# Uses wlopm (Wayland output power management), so outputs stay enabled at their
# kanshi positions and the monitors just go dark. Not wlr-randr --off: that
# disables the outputs, the same state as the 2026-09-28 "HDMI no signal" bug.
#
# Usage:
#   deploy/screens.sh on
#   deploy/screens.sh off          # does nothing while the show is running
#   deploy/screens.sh off --force  # sleep even during the show
#
# Called by: eyes-idle.service (idle timeout / input resume), halloween-eyes.service
# (wake before the show, sleep after a clean stop) and ~/.profile on SSH login.
# Needs: sudo apt install wlopm
set -euo pipefail

export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

case "${1:-}" in
  on)
    wlopm --on '*'
    ;;
  off)
    # Never blank the show. Checked here so every caller gets the same rule.
    if [[ "${2:-}" != "--force" ]] &&
       systemctl --user is-active --quiet halloween-eyes.service; then
      exit 0
    fi
    wlopm --off '*'
    ;;
  *)
    echo "usage: $0 on|off [--force]" >&2
    exit 2
    ;;
esac
