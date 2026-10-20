#!/usr/bin/env bash
# Quantum Pack — SessionStart activation gate (Phase 1, D22).
# Licensing gates ACTIVATION, not obstruction: QP's discipline is injected into the session ONLY
# when licensed. When inactive, the session runs as plain Claude — and we explicitly neutralize the
# static "Quantum Pack active" pointer in CLAUDE.md so the model doesn't operate under QP. Stdout
# from a SessionStart hook is added to the session context. Token-frugal (QP-R8): one line.
set -uo pipefail
cat >/dev/null 2>&1 || true   # consume the SessionStart JSON on stdin (unused in Phase 1)
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
HERE="$(cd "$(dirname "$0")" && pwd)"

# MAKER PRECEDENCE — operator rule, 2026-07-19: where the Maker Velocity Framework governs, the
# Quantum Pack DEFERS ENTIRELY. Checked BEFORE the license gate on purpose, so a Maker repo emits
# exactly one unambiguous line whether or not QP is licensed.
#
# Without this branch, a Maker repo with QP unlicensed printed "Quantum Pack is INACTIVE this
# session ... ignore the QP pointer", and a Maker repo with QP licensed printed "Quantum Pack
# ACTIVE — operate under the idea→outcome discipline". Both announce QP in a repo QP is supposed
# to defer to, and users reported it as "Claude comes up as QP instead of Maker".
#
# Detection keys on INSTALLATION, not on a live session. .mvp-session.json is written when a
# session opens and is absent between sessions, so testing it alone answers "is a session running
# right now", not "is this repo Maker-governed". The CLAUDE.md banner is the durable signal: it is
# what the Maker scaffold installs and what declares the repo governed.
maker_governs() {
  [ -f "$ROOT/.mvp-session.json" ] && return 0
  [ -d "$ROOT/.maker" ] && return 0
  grep -qls 'Maker Velocity Framework\|MANDATORY SESSION PROTOCOL' "$ROOT/CLAUDE.md" 2>/dev/null && return 0
  return 1
}

if maker_governs; then
  echo "Maker governs this repo. Follow the session protocol in CLAUDE.md exactly as written; it is the authority, and no other resume command substitutes for it. Quantum Pack DEFERS this session: its idea→outcome discipline is NOT in force here, and its rules file should not be loaded."
  exit 0
fi

if CLAUDE_PROJECT_DIR="$ROOT" "$HERE/qp-licensed.sh" >/dev/null 2>&1; then
  # Licensed → activate QP for this session.
  echo "Quantum Pack ACTIVE — operate under the idea→outcome discipline; rules at .claude/qp/RULES.md (load on demand)."
else
  # Unlicensed/expired → do NOT start under QP. Counter the static CLAUDE.md pointer.
  echo "Quantum Pack is INACTIVE this session (unlicensed or expired) — ignore the QP pointer in CLAUDE.md and operate as standard Claude Code. To re-enable: add a license key / re-authorize the QP GitHub App, or run /qp-uninstall to remove QP."
fi
exit 0
