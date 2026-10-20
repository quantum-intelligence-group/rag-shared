#!/usr/bin/env bash
# continue-on-stop.sh — machine fix for the premature-stop issue (operator-authorized, 2026-06-18).
#
# WHY: behavioral reminders ("don't stop to wait") degrade — the agent kept ending turns by narrating
# "next I'll do X" instead of doing X. QOS enforces a recurring mis-step as a machine gate, not prose
# (LEARNINGS #8). This Stop hook intercepts every turn-end and forces the agent to continue an
# incomplete directive. LOOP-SAFE: it nudges at most ONCE per natural stop (via stop_hook_active), so it
# can never run away — a second consecutive stop is always allowed.
#
# B-11405: IT NOW ASKS WHETHER WORK IS ACTUALLY OPEN FIRST.
#
# The original blocked EVERY first natural stop and read its input only for stop_hook_active, so it fired
# identically whether a session had work in flight or had finished and committed everything. Measured over
# 7 days: 1,568 forced extra turns, each one re-sending the full context. On 2026-10-05 it fired on a turn
# whose work was committed and pushed, and the forced continuation produced a restatement and nothing else.
#
# A nudge that cannot tell "finished" from "stopped early" is not enforcing the rule, it is charging a toll
# on every turn end. So the check below is deterministic and cheap: a dirty tree or unpushed commits mean
# work is open and the nudge is EARNED. A clean tree with nothing ahead means the session really is at a
# boundary, and the stop is allowed.
#
# IF THE STATE CANNOT BE MEASURED, IT BLOCKS, and says so. An unmeasured check must never read as a pass
# (R-14.4), and here "pass" means "let the session stop", which is the outcome that loses work.
set -uo pipefail
input="$(cat 2>/dev/null || true)"

# Already nudged in this stop sequence -> allow the stop (prevents an infinite continue-loop).
if printf '%s' "$input" | grep -qE '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

nudge() {
  cat <<JSON
{"decision":"block","reason":"STOP CHECK (continue-on-stop hook). $1 If an active task or operator directive is NOT yet fully complete and verified, CONTINUE executing it now — do NOT end the turn to wait, to ask permission for an obvious next step, or merely to narrate what you intend to do next. Stop ONLY when one of these is true, and then say which: (1) the directive is complete and verified; (2) you are blocked on a decision or credential ONLY the operator can provide (state it); (3) a hard external gate blocks you (name it); (4) you finished an approved plan step and the next step is not yet approved, in which case NAME the step you finished and stop, because starting unapproved work is the failure this condition exists to prevent. Otherwise, take the next concrete action right now."}
JSON
  exit 0
}

REPO="${CLAUDE_PROJECT_DIR:-}"
[ -n "$REPO" ] || nudge "Could not determine the project directory, so whether work is open is NOT MEASURED and this nudge is conservative."
command -v git >/dev/null 2>&1 || nudge "git is unavailable, so whether work is open is NOT MEASURED and this nudge is conservative."

# GENERATED PATHS DO NOT COUNT AS OPEN WORK. These are written by tooling, owned by no publisher, and are
# present in a tree that has just finished and pushed. Counting them would make the hook fire forever on a
# session that is genuinely done, which is the defect this item exists to remove rather than relocate.
# An UNTRACKED `.bak` is never original work: it is a copy some tool left behind, and the thing it copied is
# tracked. `docs/process/CLAIM_REGISTRY.md.bak` sat in the tree all session, byte-identical to the tracked
# file beside it, and held this check open on every turn. Deleting another process's file to satisfy a
# check is the wrong direction, and so is treating churn as open work: the instrument was wrong, so the
# instrument is what changes. Narrow deliberately to `?? ` (untracked) so a .bak somebody added ON PURPOSE
# and staged still counts.
dirty="$(git -C "$REPO" status --porcelain 2>/dev/null \
  | grep -vE '^\?\? \.fleet-worktree-in-use$' \
  | grep -vE '^\?\? .*\.bak$' \
  | grep -vE '^\?\? docs/state/chains/' \
  | grep -vE '^\?\? \.artefact-refresh-' \
  | grep -vE 'docs/planning/FLEET_QUEUE\.md$' \
  | grep -vE 'docs/state/refusal-archive/' \
  | grep -vE 'docs/planning/id-allocations/' \
  | grep -vE 'docs/operations/CONTROL_BACKLOG\.md$' \
  | grep -vE 'docs/governance/RULE_ENFORCEMENT\.md$' \
  | grep -vE 'docs/architecture/COUPLING_MAP\.md$' \
  | grep -vE 'docs/compliance/CI_COVERAGE\.md$' \
  | grep -vE 'docs/architecture/.*\.html$' \
  | grep -cE '.' || true)"
if ! [[ "$dirty" =~ ^[0-9]+$ ]]; then
  nudge "The working tree state could not be read, so whether work is open is NOT MEASURED and this nudge is conservative."
fi

# Unpushed commits on the CURRENT branch against ITS OWN upstream. Never `--branches --not --remotes`:
# in a shared tree that counts every local branch and reports hundreds, which is not this session's work.
ahead="$(git -C "$REPO" rev-list --count '@{upstream}..HEAD' 2>/dev/null || echo unknown)"
[ -n "$ahead" ] || ahead=unknown

if [ "$dirty" -gt 0 ]; then
  nudge "The working tree has $dirty uncommitted path(s), so work is still open."
fi
if [ "$ahead" = "unknown" ]; then
  # No upstream is a real state, not an error: a fresh local branch has nothing to compare against, and
  # its commits are by definition unpushed.
  if git -C "$REPO" rev-parse --abbrev-ref '@{upstream}' >/dev/null 2>&1; then
    nudge "The distance from the upstream could not be read, so whether work is open is NOT MEASURED and this nudge is conservative."
  fi
  nudge "This branch has no upstream, so any commits on it are unpushed and work is open."
fi
if [ "$ahead" -gt 0 ] 2>/dev/null; then
  nudge "There are $ahead commit(s) ahead of the upstream, so work is open and unpushed."
fi

# Clean tree, nothing ahead: the session is genuinely at a boundary. ALLOW THE STOP. This is the whole
# point of the item, and it is what makes the nudge mean something when it does fire.
exit 0
