#!/usr/bin/env bash
# QP staged-content scan — GOVERNANCE [GATE] rules enforced at commit time. exit 2 = block, 0 = ok.
# Scans the git staged diff for: committed credential files (R-8.3), hardcoded secrets (R-8.1),
# destructive DDL (R-2.8), and stub-as-complete (R-21.3). Token-frugal: silent when clean.
set -uo pipefail
ROOT="${1:-${CLAUDE_PROJECT_DIR:-$(pwd)}}"
LEVEL="${QP_ENFORCEMENT:-warn}"

staged=$(git -C "$ROOT" diff --cached --name-only 2>/dev/null || true)
added=$(git -C "$ROOT" diff --cached -U0 2>/dev/null | grep -E '^\+' | grep -Ev '^\+\+\+' || true)
fail=""

# R-8.3 — credential/secret files staged (excluding example/sample/template)
secret_files=$(printf '%s\n' "$staged" \
  | grep -Ei '(^|/)\.env($|\.(local|prod|production|dev))|\.(pem|p12|pfx|keystore)$|(^|/)id_(rsa|ed25519|ecdsa)$' \
  | grep -Eiv '\.(example|sample|template)$' || true)
[ -n "$secret_files" ] && fail="${fail}
  [R-8.3] credential/secret file staged: $(printf '%s' "$secret_files" | tr '\n' ' ')"

# R-8.1 — hardcoded secrets / long credential assignments in added lines
if printf '%s\n' "$added" | grep -Eq -- '-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36,}|xox[baprs]-[A-Za-z0-9-]{10,}'; then
  fail="${fail}
  [R-8.1] hardcoded secret/key detected in staged changes"
fi
if printf '%s\n' "$added" | grep -Eiq -- "(api[_-]?key|secret|password|access[_-]?token)[[:space:]]*[:=][[:space:]]*[\"'][^\"'\$]{12,}[\"']"; then
  fail="${fail}
  [R-8.1] hardcoded credential assignment in staged changes"
fi

# R-2.8 — destructive DDL without an explicit allow marker
if printf '%s\n' "$added" | grep -Eiq -- 'DROP[[:space:]]+(TABLE|COLUMN|DATABASE)' \
   && ! printf '%s\n' "$added" | grep -qi 'qp-allow-destructive'; then
  fail="${fail}
  [R-2.8] destructive DDL (DROP ...) staged — add a 'qp-allow-destructive' comment if intended"
fi

if [ -n "$fail" ]; then
  printf 'Quantum Pack governance — commit BLOCKED:%s\n' "$fail" >&2
  exit 2
fi

# R-21.3 — stub/placeholder marked complete (heuristic): block at 'block' level, else warn
if printf '%s\n' "$added" | grep -Eiq -- 'unimplemented!\(\)|TODO:[[:space:]]*implement|NotImplementedError|not[[:space:]]+implemented'; then
  if [ "$LEVEL" = "block" ] && [ "${QP_ALLOW_STUB:-}" != "1" ]; then
    printf 'Quantum Pack (R-21.3): stub/placeholder in staged changes is not shippable. Override: QP_ALLOW_STUB=1.\n' >&2
    exit 2
  fi
  printf '[qp warn] (R-21.3) possible stub/placeholder in staged changes\n' >&2
fi
exit 0
