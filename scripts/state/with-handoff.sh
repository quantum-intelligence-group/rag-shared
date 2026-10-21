#!/bin/bash
# HANDOFF PROTOCOL — the run wrapper. B-11291.
#
# Usage:  bash scripts/state/with-handoff.sh <command> [args...]
#
# Runs the command and, if it does NOT end cleanly, records an abnormal-ending entry. The close gate
# already covers a session that reaches its own close; nothing covered a session that is killed, reaped,
# OOMed, timed out or disconnected, so the next session resumed from an entry describing work two
# sessions back.
#
# THREE THINGS THIS DOES NOT DO, each on purpose:
#   it does not write a normal handoff        an abnormal ending is the ABSENCE of a handoff, and a record
#                                            that looks like a clean close stops the next session looking
#   it does not change the exit code          the trap preserves and re-raises it; a wrapper that swallows
#                                            the failure it recorded is worse than no wrapper
#   it does not run on exit 0                the clean path has its own protocol and does not need this
#
# Signals are re-raised rather than exited, so a supervisor sees the real cause of death and not a plain 1.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Resolved from PATH, never hardcoded: a baked-in interpreter path is wrong on the next host, and this
# wrapper is meant to travel to member repositories. If node is not on PATH the wrapper says so and still
# preserves the exit code, because a missing recorder must not become a missing failure.
NODE="${NODE:-$(command -v node || true)}"
RECORDER="$HERE/abnormal-end-handoff.mjs"

if [ "$#" -eq 0 ]; then
  echo "with-handoff: no command given. Usage: with-handoff.sh <command> [args...]" >&2
  exit 2
fi

record() {
  local kind="$1" detail="$2"
  # Never let the recorder's own failure mask the command's outcome.
  if [ -n "$NODE" ] && command -v "$NODE" >/dev/null 2>&1; then
    if [ "$kind" = "signal" ]; then
      "$NODE" "$RECORDER" --signal "$detail" 2>&1 | sed 's/^/  /' || true
    else
      "$NODE" "$RECORDER" --code "$detail" 2>&1 | sed 's/^/  /' || true
    fi
  else
    echo "  with-handoff: node not found, so no abnormal-ending record was written. This is a gap, not a clean end." >&2
  fi
}

on_signal() {
  local sig="$1"
  record signal "SIG$sig"
  # Re-raise so the real cause of death reaches whatever supervises this.
  trap - "$sig"
  kill -s "$sig" $$
}
for sig in INT TERM HUP QUIT; do
  # shellcheck disable=SC2064
  trap "on_signal $sig" "$sig"
done

"$@"
rc=$?
if [ "$rc" -ne 0 ]; then record exit "$rc"; fi
exit "$rc"
