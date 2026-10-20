#!/usr/bin/env bash
# Quantum Pack — verify a contract license key (D24). exit 0 = valid + in-scope + unexpired.
# Usage: qp-verify-key.sh <key-file> <repo-root>   (key-file holds a QPLIC1.<payload>.<sig> token)
# Offline checks: signature (ssh-keygen -Y verify vs the shipped public trust anchor), expiry, scope.
# (Online denylist by key_id — OQ4 — plugs in at the marked point when the endpoint exists.)
set -uo pipefail
KEYFILE="${1:?key file}"; ROOT="${2:-$(pwd)}"
HERE="$(cd "$(dirname "$0")" && pwd)"; NS="qp-license"

# Locate the trust anchor (ships with QP). Installed layout first, then source-module fallbacks.
AS=""
for c in "$ROOT/.claude/qp/keys/qp-allowed-signers" "$HERE/../qp/keys/qp-allowed-signers" "$HERE/../keys/qp-allowed-signers"; do
  [ -f "$c" ] && { AS="$c"; break; }
done
[ -n "$AS" ] || { echo "no QP trust anchor (allowed_signers) found"; exit 1; }

token=$(tr -d '[:space:]' < "$KEYFILE" 2>/dev/null)
case "$token" in QPLIC1.*) ;; *) echo "not a Quantum Pack license key"; exit 1;; esac
pl=$(printf '%s' "$token" | cut -d. -f2); sg=$(printf '%s' "$token" | cut -d. -f3)

# url-safe, padding-free base64 → bytes
dec(){ local d="$1"; local pad=$(( (4 - ${#d} % 4) % 4 )); d="$d$(printf '%*s' "$pad" '' | tr ' ' '=')"; printf '%s' "$d" | tr '_-' '/+' | base64 -d 2>/dev/null; }

payload=$(dec "$pl") || { echo "corrupt key payload"; exit 1; }
[ -n "$payload" ] || { echo "corrupt key payload"; exit 1; }
tmp=$(mktemp); printf '%s' "$payload" > "$tmp"
dec "$sg" > "$tmp.sig" 2>/dev/null || { rm -f "$tmp" "$tmp.sig"; echo "corrupt signature"; exit 1; }

ID=$(awk 'NF&&$1!~/^#/{print $1; exit}' "$AS")
if ! ssh-keygen -Y verify -f "$AS" -I "$ID" -n "$NS" -s "$tmp.sig" < "$tmp" >/dev/null 2>&1; then
  rm -f "$tmp" "$tmp.sig"; echo "signature invalid (not issued by QIG)"; exit 1
fi
rm -f "$tmp" "$tmp.sig"

field(){ printf '%s' "$payload" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p"; }
EXPIRES=$(field expires); SCOPE=$(field scope); ORG=$(field org)
[ -n "$EXPIRES" ] || { echo "license has no expiry"; exit 1; }
TODAY=$(date -u +%Y-%m-%d)
if [ "$TODAY" \> "$EXPIRES" ]; then echo "license expired ($EXPIRES)"; exit 1; fi

# --- online denylist (OQ4) plugs in here: revoked key_id → exit 1 even if signature/expiry pass ---

if [ "$SCOPE" = "enterprise" ]; then echo "valid: enterprise, until $EXPIRES"; exit 0; fi

# repo/org scope → resolve this repo's slug from origin
url=$(git -C "$ROOT" remote get-url origin 2>/dev/null || true)
slug=$(printf '%s' "$url" | sed -E 's#(git@[^:]+:|https?://[^/]+/)##; s#\.git$##')
if printf '%s' "$payload" | tr -d ' ' | grep -q "\"$slug\""; then echo "valid: repo $slug, until $EXPIRES"; exit 0; fi
if [ -n "$ORG" ] && [ "${slug%%/*}" = "$ORG" ]; then echo "valid: org $ORG, until $EXPIRES"; exit 0; fi
echo "repo '$slug' is not in this license's scope"; exit 1
