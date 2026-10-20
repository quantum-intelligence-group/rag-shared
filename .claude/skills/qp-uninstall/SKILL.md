---
name: qp-uninstall
description: Cleanly remove Quantum Pack from this repo — skills, hooks, settings wiring, rules, and the CLAUDE.md pointer. Leaves the repo as plain Claude.
model: haiku
---

## Instructions

Remove Quantum Pack so the repo reverts to standard Claude Code. **Confirm with the user before
deleting anything**, then remove **only** QP artifacts — never touch unrelated config.

1. **Confirm:** list what will be removed and ask the user to proceed (QP governs nothing once gone).
2. **Skills:** delete `.claude/skills/qp-*/`.
3. **Hooks:** delete `.claude/hooks/qp-gate.sh`, `.claude/hooks/qp-session.sh`,
   `.claude/hooks/qp-licensed.sh` (and `.claude/hooks/qp-verify-key.sh` if present).
4. **Settings:** in `.claude/settings.json`, remove **only** the QP keys — the `SessionStart` and
   `PreToolUse` hook entries that point at `qp-*.sh`, plus `spinnerVerbs` (Quantumizing) and the QP
   `statusLine`. **Merge-aware:** keep every other hook/permission/key intact; if removing QP empties
   `hooks`, leave an empty object rather than corrupting the file. Never touch `settings.local.json`.
5. **QP dir:** delete `.claude/qp/` (rules, templates, assets, marker, statusline). Note: this also
   removes `.claude/qp/lineage/threads/` and `.claude/qp/specs/` — if the user wants to keep their
   OutcomeThreads/spec bundles as a record, offer to move them out first.
6. **CLAUDE.md:** delete only the appended line
   `> Quantum Pack active — see .claude/qp/RULES.md (load on demand).` Leave the rest of CLAUDE.md
   untouched (and if QP created the whole file, ask before deleting it).
7. **Report:** confirm what was removed and that the next session will start as plain Claude.

Keep it surgical and reversible — a customer who lets a license lapse should walk away with no
broken hooks and no QP residue. (QP-R8: don't dump file contents; just act and report.)
