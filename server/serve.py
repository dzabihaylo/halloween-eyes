#!/usr/bin/env python3
"""Local server for the Halloween eyes show.

Serves the static page to both browser windows and holds the runtime config
they poll. Standard library only — no third-party dependencies to install or
audit on a Raspberry Pi.

Run:
    python3 server/serve.py --root public --port 8080

Security: bind to the LAN only and never port-forward this. The write endpoint
is unauthenticated, which is acceptable because the blast radius is four enum
values on a Halloween decoration — but only while it stays off the internet.
The same goes for /poweroff: anyone on the home Wi-Fi can turn the Pi off.
"""
from __future__ import annotations

import argparse
import json
import logging
import subprocess
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

logger = logging.getLogger("halloween-eyes")

#: Every performance the show can play: a copy of GAG_NAMES + REACTION_NAMES in
#: public/js/poses.js. tests/test_serve.py fails if the two lists drift apart.
PERFORMANCE_NAMES = (
    "crossEyed", "wallEyed", "wanderingEye", "bothOneWindow",
    "lockOn", "suspicious", "mockSurprise", "slowSquint",
)

#: Which show runs: "auto" follows the calendar, anything else forces that scene.
#: A copy of SCENE_CHOICES in public/js/scenes/calendar.js; tests/test_serve.py
#: fails if the two lists drift apart.
SCENE_CHOICES = ("auto", "eyes", "leaves", "menorah", "christmas", "santa")

#: Per-scene settings and their allowed values, in the order the control page
#: shows them. A copy of SCENE_OPTIONS in public/js/scenes/options.js;
#: tests/test_serve.py fails if the two drift apart.
SCENE_OPTIONS = {
    "leafColors": ("autumn", "gold", "crimson"),
    "gustMinutes": (1, 2, 4),
    "menorahNight": ("auto", 1, 2, 3, 4, 5, 6, 7, 8),
    "burnDown": (True, False),
    "snowAmount": ("light", "steady", "blizzard"),
    "countdown": (True, False),
    "radarEvery": (15, 30, 0),
}
SCENE_OPTION_DEFAULTS = {
    "leafColors": "autumn",
    "gustMinutes": 2,
    "menorahNight": "auto",
    "burnDown": True,
    "snowAmount": "steady",
    "countdown": True,
    "radarEvery": 15,
}

#: Allowed values. Anything else is rejected rather than coerced.
VALID = {
    "shape": {"amber", "ember", "aniridia"},
    "palette": {"amber", "green", "violet", "ghost", "slime"},
    "energyDrift": {True, False},
    "crowdStyle": {"shrink", "squash"},
    # A test gag loops one performance for two minutes (docs/specs/2026-10-05-test-gags-design.md).
    "testGag": {"off", *PERFORMANCE_NAMES},
    "scene": set(SCENE_CHOICES),
    **{key: set(values) for key, values in SCENE_OPTIONS.items()},
}

DEFAULTS = {
    "shape": "amber",
    "palette": "amber",
    "energyDrift": True,
    "crowdStyle": "shrink",
    "effectiveAt": 0,
    "testGag": "off",
    "testGagAt": 0,
    "scene": "auto",
    **SCENE_OPTION_DEFAULTS,
}

#: A change is scheduled this far ahead so both windows, polling every 2s,
#: are guaranteed to see it before it fires. Lead time MUST exceed the poll
#: interval or a window can apply late — which is the tear this design avoids.
SCHEDULE_LEAD_MS = 5000

MAX_BODY_BYTES = 4096

#: A clean shutdown, so pulling the plug afterwards cannot corrupt the SD card
#: (on 2026-10-17 a hard power-off left the Wi-Fi config as empty files).
#: deploy/sudoers-poweroff allows exactly this command without a password.
POWEROFF_CMD = ("sudo", "-n", "/usr/bin/systemctl", "poweroff")


def _allowed(key: str, value) -> bool:
    """True only for an exact allowed value.

    Compares type as well as value: in Python ``1 == True``, and a list can't be
    looked up in a set at all, so a plain ``value in VALID[key]`` either accepts
    the wrong thing or raises.
    """
    return any(type(value) is type(option) and value == option for option in VALID[key])


def load_config(path: Path) -> dict:
    """Read the config, falling back to defaults on anything unreadable."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as err:
        logger.warning("config unreadable (%s); using defaults", err)
        return dict(DEFAULTS)
    if not isinstance(data, dict):
        logger.warning("config is not a JSON object; using defaults")
        return dict(DEFAULTS)

    config = dict(DEFAULTS)
    for key in VALID:
        if key in data and _allowed(key, data[key]):
            config[key] = data[key]
    if isinstance(data.get("effectiveAt"), (int, float)):
        config["effectiveAt"] = data["effectiveAt"]
    if isinstance(data.get("testGagAt"), (int, float)) and not isinstance(data.get("testGagAt"), bool):
        config["testGagAt"] = data["testGagAt"]
    return config


def _validate(payload: dict) -> tuple[dict | None, str | None]:
    if not isinstance(payload, dict):
        return None, "body must be a JSON object"
    unknown = set(payload) - set(VALID)
    if unknown:
        return None, f"unknown keys: {', '.join(sorted(unknown))}"
    for key, value in payload.items():
        if not _allowed(key, value):
            return None, f"invalid value for {key}: {value!r}"
    return payload, None


def make_server(
    root: Path, config_path: Path, port: int, bind: str, poweroff_cmd=POWEROFF_CMD
) -> ThreadingHTTPServer:
    root = Path(root).resolve()
    config_path = Path(config_path)

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

        # Static files: "no-cache" means Chromium must check with us before reusing
        # its copy. Without it, a restarted window can keep running cached OLD JS
        # after a deploy. Revalidating against localhost costs nothing.
        cache_control = "no-cache"

        def end_headers(self):
            self.send_header("Cache-Control", self.cache_control)
            super().end_headers()

        def log_message(self, fmt, *args):
            logger.debug("%s", fmt % args)

        def _send_json(self, status: int, payload: dict) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.cache_control = "no-store"  # config must never come from a cache
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):  # noqa: N802 - stdlib naming
            if self.path.split("?")[0] == "/config.json":
                self._send_json(HTTPStatus.OK, load_config(config_path))
                return
            super().do_GET()

        def _poweroff(self) -> None:
            # Requiring a JSON content type makes a browser send a CORS preflight,
            # which this server never approves, so another web page open on a
            # phone cannot switch the Pi off behind the user's back.
            if (self.headers.get("Content-Type") or "").split(";")[0].strip() != "application/json":
                self._send_json(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, {"error": "send application/json"})
                return
            # systemctl poweroff only queues the shutdown, so this returns at once
            # and the reply still reaches the phone.
            result = subprocess.run(poweroff_cmd, capture_output=True, text=True, timeout=15)
            if result.returncode != 0:
                logger.warning("poweroff failed: %s", result.stderr.strip())
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": result.stderr.strip() or "poweroff failed"})
                return
            logger.info("powering off at the control page's request")
            self._send_json(HTTPStatus.OK, {"ok": True})

        def do_POST(self):  # noqa: N802 - stdlib naming
            if self.path.split("?")[0] == "/poweroff":
                self._poweroff()
                return
            if self.path.split("?")[0] != "/config":
                self._send_json(HTTPStatus.NOT_FOUND, {"error": "no such endpoint"})
                return

            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0 or length > MAX_BODY_BYTES:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": "bad body length"})
                return

            try:
                payload = json.loads(self.rfile.read(length))
            except json.JSONDecodeError:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": "body is not valid JSON"})
                return

            clean, error = _validate(payload)
            if error:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": error})
                return

            config = load_config(config_path)
            config.update(clean)
            start = int(time.time() * 1000) + SCHEDULE_LEAD_MS
            config["effectiveAt"] = start
            # A test gag gets its own start time, set only when a test is posted,
            # so a later style change cannot replay an old test.
            if clean.get("testGag", "off") != "off":
                config["testGagAt"] = start

            tmp = config_path.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(config, indent=2), encoding="utf-8")
            tmp.replace(config_path)
            logger.info("config updated: %s", clean)
            self._send_json(HTTPStatus.OK, config)

    return ThreadingHTTPServer((bind, port), Handler)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("public"))
    parser.add_argument("--config", type=Path, default=Path("server/config.json"))
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--bind", default="0.0.0.0", help="LAN only; never port-forward")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if not args.config.exists():
        default = Path(__file__).parent / "config.default.json"
        args.config.write_text(default.read_text(encoding="utf-8"), encoding="utf-8")
        logger.info("seeded %s from config.default.json", args.config)

    server = make_server(args.root, args.config, args.port, args.bind)
    logger.info("serving %s on %s:%d", args.root, args.bind, args.port)
    server.serve_forever()


if __name__ == "__main__":
    main()
