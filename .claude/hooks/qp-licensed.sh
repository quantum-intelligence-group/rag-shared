#!/usr/bin/env bash
# Quantum Pack — single license-decision point (Phase 1 of commercialization, D22).
# Contract: exit 0 = QP licensed/active; exit non-0 = inactive (callers degrade to plain Claude).
# Prints a one-line human reason to stdout only when inactive; silent when active.
# Token-frugal (QP-R8): no network in Phase 1. This is the ONE place the verdict is decided —
# Phase 2 (contract keys) and Phase 3 (online check) plug in here, nothing else changes.
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# --- Manual override (testing / opt-out) --------------------------------------------------------
# QP_LICENSE=off|none|disabled|0|false → force inactive, to prove the plain-Claude path works.
case "${QP_LICENSE:-}" in
  off|none|disabled|0|false) echo "QP disabled via QP_LICENSE=${QP_LICENSE}"; exit 1 ;;
esac

# --- Phase 2: contract key (signed scope+expiry, D24) --------------------------------------------
# A VALID signed key → active. A PRESENT-but-invalid key → inactive (plain Claude, never blocked).
# No key → fall through to the pre-GA default below. Repo-level overrides user-level.
for KEYFILE in "$ROOT/.claude/qp/license" "${XDG_CONFIG_HOME:-$HOME/.config}/qp/license"; do
  [ -f "$KEYFILE" ] || continue
  if "$(dirname "$0")/qp-verify-key.sh" "$KEYFILE" "$ROOT" >/dev/null 2>&1; then
    exit 0
  else
    echo "QP license present but invalid/expired/out-of-scope — running as plain Claude"; exit 1
  fi
done

# --- Phase 3 extension point: online check (org App + Stripe via /license, D23) -------------------
# When the endpoint exists (resolves OQ4), do the online validation here, cache the verdict briefly,
# and on unreachable: self-serve fails closed (exit 1); a valid offline contract key still passes above.

# --- Pre-GA default ------------------------------------------------------------------------------
# No enforcement backend exists yet → QP is active by default during the design-partner phase.
exit 0
