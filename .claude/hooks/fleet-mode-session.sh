#!/usr/bin/env bash
# B-1211/B-1212 — SessionStart: tell the session where builds go, and let the operator SEE it.
#
# B-929 shipped the policy (docs/governance/FLEET_ROUTING.md) and the switch (`maker fleet`). Neither
# changes what a session does. The mode is runtime state that differs between sessions and terminals, so
# asking the model to remember to go and look it up is the class of prevention LEARNINGS #163 rules out:
# it depends on remembering. This runs whether or not the model thinks to, which is the point of the hook
# layer.
#
# TWO CHANNELS, BECAUSE STDOUT IS NOT THE OPERATOR'S SCREEN (B-1212). B-1211 printed the banner as bare
# text and called AC-3 met. Bare stdout from a SessionStart hook goes into the MODEL's context; the
# operator's terminal shows only a collapsed `SessionStart:startup hook success` line. The banner printed
# on every session start for a day and the operator never saw one. So the hook now emits a JSON object:
#   systemMessage  → rendered in the operator's transcript (one line: which lane this session is in)
#   additionalContext → injected into the session context (the full binding policy)
# Both are needed. One line in the transcript answers "is this session handing off?"; the policy body in
# context is what actually binds the model, and putting all of it on screen every start is noise.
#
# FAIL-OPEN BY CONTRACT. This runs on every session start in the repo the fleet itself operates in. A hook
# that can end a session is worse than no hook, so every path here prints something and exits 0 — a missing
# binary, a non-zero exit, an unparseable line. It informs; it never gates. Invalid JSON degrades safely
# too: the harness falls back to treating stdout as plain-text context, which is exactly B-1211 behaviour.
#
# PROJECT-AGNOSTIC (B-1212 AC-7). One copy of this file, installed user-level, must cover every QIG repo,
# so the repo comes from CLAUDE_PROJECT_DIR and nothing here is QOS-specific. In a repo with no Maker
# layout it prints nothing at all: a fleet-routing banner in an ungoverned repo is noise at best and a
# false instruction at worst.
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
# `read -d ''`, not `$(cat)`: cat comes from PATH, and this hook is required to work with PATH unset.
# Caught by the test harness, which runs with a stub-only PATH — the read silently produced an empty blob,
# so the once-per-session guard below never engaged and the banner printed twice.
STDIN_JSON=""
IFS= read -r -d '' STDIN_JSON || true

# --- fire once per session, however many copies are installed ------------------------------------
# This file is installed in two places on purpose: user-level (~/.claude), which covers every repo the
# operator opens, and repo-level (.claude/hooks), which covers the service accounts and CI runners that
# do not share that home directory. Both layers are wanted; two banners are not. The guard is a marker
# file keyed to the harness's own session id, claimed under `noclobber` so the claim is atomic — `:` and
# redirection are builtins, and mkdir is not.
#
# No session id (a manual run, an older harness) means no guard: printing twice is a far smaller failure
# than printing never, which is the failure this whole item exists to fix.
SID="${STDIN_JSON#*\"session_id\":\"}"
case "$STDIN_JSON" in
  *'"session_id":"'*)
    SID="${SID%%\"*}"
    case "$SID" in
      */*|*' '*|'') ;;                     # anything path-shaped or empty is not a usable marker name
      *)
        MARK="${TMPDIR:-/tmp}/qig-fleet-banner-${SID}"
        ( set -o noclobber; : > "$MARK" ) 2>/dev/null || exit 0
        ;;
    esac
    ;;
esac

# --- JSON emission, with bash builtins only -------------------------------------------------------
# `printf` and parameter expansion are builtins; `jq` is not installed on every box the fleet touches and
# PATH is not guaranteed populated here (see the parse note below). The three escapes below are the ones
# the policy text actually contains: backslashes, the double quotes around the Lane: lines, and newlines.
# Backslash MUST be replaced first, or it re-escapes the backslashes introduced by the later rules.
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\r'/}"
  s="${s//$'\t'/\\t}"
  s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

# One object, both channels. Written once so no branch below can emit a different shape.
emit_json() {
  printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' \
    "$(json_escape "$1")" "$(json_escape "$2")"
}

# `read -d ''` rather than `$(cat …)`: cat comes from PATH. Returns non-zero at EOF by design and still
# assigns, which is why `set -e` is deliberately not in force on line 30.
read_block() { IFS= read -r -d '' "$1"; }

# --- is this repo governed at all? ----------------------------------------------------------------
# Existence checks plus a builtin content scan; no grep. A repo Maker governs has either the runtime state
# dir, a session marker, or a CLAUDE.md that names the framework.
governed() {
  [ -d "$ROOT/.mvp" ] && return 0
  [ -f "$ROOT/.mvp-session.json" ] && return 0
  [ -f "$ROOT/CLAUDE.md" ] || return 1
  while IFS= read -r _l || [ -n "$_l" ]; do
    case "$_l" in
      *'Maker Velocity'*|*'MANDATORY SESSION PROTOCOL'*|*'maker fleet'*) return 0 ;;
    esac
  done < "$ROOT/CLAUDE.md"
  return 1
}
governed || exit 0

# Resolve maker the way the fleet does (qos-autopilot.sh), not via PATH alone: an interactive shell and the
# LaunchDaemon do not share a PATH, and reporting a mode from a different binary than the fleet runs would
# be worse than reporting none.
MAKER=""
for c in "${MAKER_BIN:-}" /opt/apps/ops/bin/maker "$HOME/.local/bin/maker" "$(command -v maker 2>/dev/null || true)"; do
  [ -n "$c" ] && [ -x "$c" ] && MAKER="$c" && break
done

UNKNOWN_CTX='FLEET ROUTING: unknown — the build-routing mode could not be read.
Treat this as UNSET and say so before handing any coding task off; do not assume a mode.'

if [ -z "$MAKER" ]; then
  emit_json "FLEET ROUTING: unknown — no \`maker\` binary found. Do not assume a lane." \
            "$UNKNOWN_CTX"
  exit 0
fi

RAW="$("$MAKER" fleet status --path "$ROOT" 2>/dev/null)" || RAW=""

# Parsed with BASH BUILTINS, no sed/head/tr. Those come from PATH, and a hook that needs PATH to be
# populated fails in exactly the environment where it is least expected to: running the parse with a
# minimal PATH printed `sed: command not found` four times and then reported the mode as unknown, which
# looks identical to a genuinely unset mode. Builtins cannot go missing.
#
# Anchored on the `fleet mode: ` prefix rather than a field split, so a reworded suffix cannot shift which
# token is read (LEARNINGS #160): a timestamp or a username containing "off" must not flip a mode of "on".
LINE="${RAW%%$'\n'*}"
case "$LINE" in
  'fleet mode: '*) REST="${LINE#fleet mode: }" ;;
  *)               REST="" ;;
esac
MODE="${REST%% *}"
DETAIL=""
case "$REST" in *' '*) DETAIL="${REST#* }" ;; esac

case "$MODE" in
  on|off) ;;
  *)
    emit_json "FLEET ROUTING: unknown — \`maker fleet status\` returned nothing readable. Do not assume a lane." \
              "$UNKNOWN_CTX"
    exit 0
    ;;
esac

# A `case`, not `${MODE^^}` and not `tr`: case expansion is bash 4+ and /bin/bash here is 3.2.57, while
# `tr` is another PATH dependency. The mode has exactly two values, so a lookup is both portable and
# dependency-free. The bash-4 form was caught by running the hook under /bin/bash, which printed
# `bad substitution` INTO the banner and then carried on as if the mode had been read.
case "$MODE" in on) MODE_UPPER="ON" ;; off) MODE_UPPER="OFF" ;; *) MODE_UPPER="$MODE" ;; esac

BANNER="════════════════════════════════════════════════════════════════════
  FLEET ROUTING: ${MODE_UPPER}   ${DETAIL}
════════════════════════════════════════════════════════════════════"

if [ "$MODE" = "on" ]; then
  # AC-2: one line, and it has to say what the mode MEANS. "FLEET ROUTING: ON" alone is a label; an
  # operator glancing at it needs to know a coding task is about to be queued rather than built here.
  SYS="⬡ FLEET ROUTING: ON ${DETAIL:+$DETAIL }— coding goes to the build fleet; every coding task declares its lane."
  read_block POLICY <<'POLICY'
Build routing is FLEET-FIRST. This is binding for this session.

- Coding and testing go to the BUILD FLEET, not to Anthropic. Your job is to author the backlog item
  with numbered acceptance criteria, queue it, review what comes back, and feed corrections back for a
  rebuild rather than fixing it by hand.
- Corrections re-enter through the existing rework path (scripts/fleet/sot-rework.mjs): a reject tagged
  cause=code re-queues the item with your feedback, and the next worker receives it with the item spec.
- Build it directly ONLY in these four cases:
    1. the change fixes the fleet itself (routing that through a broken fleet can deadlock);
    2. the item is outside the fleet's demonstrated envelope (roughly >150 changed lines or >5 files);
    3. the operator needs it sooner than a fleet round trip;
    4. the work is exploratory, so the acceptance criteria cannot be written in advance.
- DECLARE THE LANE ON EVERY CODING TASK, before starting it, in one line the operator can see:
      "Lane: FLEET — queued as <repo>/<item>"
      "Lane: DIRECT — exception <n>, <one clause saying why>"
  An undeclared lane is a policy violation, not a style preference: the operator cannot otherwise tell
  which engine did the work, and that ambiguity is what this hook exists to remove.
- A failed fleet attempt runs on a QIG-controlled model at no marginal token cost. Retries are cheap and
  each failure is diagnostic data. Do not silently reroute to the frontier model because an attempt failed.

Full policy: docs/governance/FLEET_ROUTING.md (generated by maker; do not hand-edit).
POLICY
else
  SYS="⬡ FLEET ROUTING: OFF ${DETAIL:+$DETAIL }— coding is done here, directly; the fleet is not fed for this work."
  read_block POLICY <<'POLICY'
Build routing is DIRECT. Coding and testing are done here, by Anthropic, as normal; the fleet is not fed
for this work. Everything else still applies: a backlog item before code (R-21.2), numbered acceptance
criteria (R-21.6), a worktree rather than the shared tree, and the full gate stack before any commit.

Say "Lane: DIRECT (fleet mode off)" on the first coding task, so the operator can see the mode took effect.
POLICY
fi

emit_json "$SYS" "${BANNER}
${POLICY}"
exit 0
