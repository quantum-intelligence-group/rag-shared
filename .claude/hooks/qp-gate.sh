#!/usr/bin/env bash
# Quantum Pack gate (QP-R3): no build/commit before an Agreed spec bundle exists.
# Wired as a PreToolUse hook on the build/commit boundary (e.g. Bash(git commit *)).
# Silent on success (QP-R8: no per-call token bleed); speaks only when it warns or blocks.
set -euo pipefail
cat >/dev/null   # consume the hook input JSON on stdin (not needed for this check)

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Coexist with Maker (QP-R11 / D20): if Maker governs this repo, defer the commit gate to its
# pre-commit — never double-gate. QP's skills/portal/coverage still work alongside Maker.
if [ -f "$ROOT/.mvp-session.json" ] || [ -d "$ROOT/.maker" ]; then exit 0; fi

# Licensing (Phase 1 / D22): if QP is not active (unlicensed/expired), never gate a commit —
# the repo behaves as plain Claude. The single decision point is qp-licensed.sh.
if ! CLAUDE_PROJECT_DIR="$ROOT" "$(dirname "$0")/qp-licensed.sh" >/dev/null 2>&1; then exit 0; fi

# Enforcement level: env override, else manifest default, else 'warn'.
LEVEL="${QP_ENFORCEMENT:-}"
for cfg in "$ROOT/.claude/qp/quantum-pack.json" "$ROOT/quantum-pack/quantum-pack.json"; do
  if [ -z "$LEVEL" ] && [ -f "$cfg" ]; then
    LEVEL="$(grep -o '"default"[[:space:]]*:[[:space:]]*"[a-z]*"' "$cfg" 2>/dev/null \
      | grep -o '[a-z]*' | tail -1 || true)"
  fi
done
LEVEL="${LEVEL:-warn}"

[ "$LEVEL" = "off" ] && exit 0

# Staged-content [GATE] checks (secrets, .env, destructive DDL, stubs) — independent of the spec gate.
QP_ENFORCEMENT="$LEVEL" "$(dirname "$0")/qp-scan.sh" "$ROOT" || exit $?

# An "Agreed spec bundle" = a markdown file declaring `kind: SpecBundle` and `status: Agreed`.
if grep -rlZ --include='*.md' 'kind: SpecBundle' "$ROOT" 2>/dev/null \
   | xargs -0 -r grep -lq '^status: Agreed' 2>/dev/null; then
  exit 0   # gate open — silent
fi

MSG="Quantum Pack (QP-R3): no build before an Agreed spec bundle. Run /qp-spec and get it to status: Agreed first."
if [ "$LEVEL" = "block" ]; then
  echo "$MSG" >&2
  exit 2          # block the action
else
  echo "[qp warn] $MSG" >&2
  exit 0          # warn, but proceed
fi
