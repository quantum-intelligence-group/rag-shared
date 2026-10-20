#!/usr/bin/env bash
# QP command guard — GOVERNANCE [GATE] rules that act at command time (PreToolUse on Bash).
# Reads the PreToolUse JSON on stdin, extracts the command, and blocks (exit 2) on a violation.
# Same posture as the commit gate: defer to Maker, no-op when QP is inactive, respect QP_ENFORCEMENT.
# Token-frugal: silent unless it warns or blocks.
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
input=$(cat 2>/dev/null || true)

# Coexist: defer to Maker; no-op when QP inactive (plain Claude) or enforcement off.
if [ -f "$ROOT/.mvp-session.json" ] || [ -d "$ROOT/.maker" ]; then exit 0; fi
if ! CLAUDE_PROJECT_DIR="$ROOT" "$(dirname "$0")/qp-licensed.sh" >/dev/null 2>&1; then exit 0; fi
LEVEL="${QP_ENFORCEMENT:-warn}"; [ "$LEVEL" = "off" ] && exit 0

# Extract the command string from the tool input (no jq dependency).
cmd=$(printf '%s' "$input" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
[ -n "$cmd" ] || exit 0

deny=""; warns=""
# R-10.3 — force-push (hard block)
if printf '%s' "$cmd" | grep -Eq -- 'git[[:space:]]+push.*(--force-with-lease|--force([[:space:]]|$)|-f([[:space:]]|$))'; then
  [ "${QP_ALLOW_FORCEPUSH:-}" = "1" ] || deny="${deny}
  [R-10.3] force-push (override: QP_ALLOW_FORCEPUSH=1)"
fi
# R-2.8 — destructive shell (hard block)
if printf '%s' "$cmd" | grep -Eq -- 'rm[[:space:]]+-[A-Za-z]*r[A-Za-z]*f|rm[[:space:]]+-[A-Za-z]*f[A-Za-z]*r|git[[:space:]]+reset[[:space:]]+--hard|git[[:space:]]+clean[[:space:]]+-[A-Za-z]*f'; then
  deny="${deny}
  [R-2.8] destructive command (rm -rf / git reset --hard / git clean -f)"
fi
# R-10.2 — push (warn: confirm it was instructed) ; R-11.3 — self-approval (warn)
printf '%s' "$cmd" | grep -Eq -- 'git[[:space:]]+push' && warns="${warns}
  [R-10.2] push — confirm this was explicitly instructed"
printf '%s' "$cmd" | grep -Eq -- 'gh[[:space:]]+pr[[:space:]]+(merge|review[[:space:]]+--approve)' && warns="${warns}
  [R-11.3] PR merge/approve — never approve or merge your own PR"

if [ -n "$deny" ] && [ "$LEVEL" = "block" ]; then
  printf 'Quantum Pack governance — command BLOCKED:%s\n' "$deny" >&2
  exit 2
fi
if [ -n "${deny}${warns}" ]; then
  printf '[qp warn] governance:%s%s\n' "$deny" "$warns" >&2
fi
exit 0
