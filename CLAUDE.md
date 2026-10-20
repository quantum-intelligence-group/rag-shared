---
title: "CLAUDE"
project: nexusmig-rag-shared
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03T20:16:46Z
product_id: nexusmig-rag-shared
project_id: nexusmig-rag-shared
file_kind: ClaudeMd
author: 
---

# CLAUDE.md — nexusmig-rag-shared
> **Governance:** This project runs under the Maker Velocity Framework. Classification: **high**.
> **Principles:** Follows the 7 Maker Principles (outcome over output) — see `docs/governance/PRINCIPLES.md`.

---

## MANDATORY SESSION PROTOCOL — READ THIS FIRST

**HARD GATE: No code changes, file edits, or commits are permitted until the session resume protocol below is fully complete.** This is a binding requirement enforced by Rule R-11.1 (HardBlock severity). The pre-commit hook checks `.mvp-session.json` before allowing any commit.

### Session start (resume protocol) — BLOCKING

Complete every step below **in order** before writing any code:

**Step 1.** Read this file (CLAUDE.md) — you are doing this now.
**Step 2.** Read `docs/state/STATUS.md` — current project state.
**Step 3.** Read `docs/state/HANDOFF.md` — where the last session stopped.
**Step 4.** Read `docs/state/OPEN_QUESTIONS.md` — unresolved questions.
**Step 5.** Read `docs/planning/BACKLOG.md` — prioritized work items.
**Step 6.** Run `git status` and verify the working tree is clean.
**Step 7.** Verify tests pass.
**Step 8.** State the session goal and first task.

After completing all 8 steps, output this exact line:

```
FRAMEWORK SESSION ACTIVE — Resume protocol complete. Session goal: [your goal here]
```

### Session close (before ending) — BLOCKING

1. Verify all tests pass
2. Verify working tree is clean (committed or stashed)
3. Update `docs/state/STATUS.md`
4. Update `docs/state/HANDOFF.md`
5. Append to `docs/state/CHANGELOG.md`
6. Update `docs/state/DECISIONS.md`
7. Update `docs/state/OPEN_QUESTIONS.md`
8. Update `docs/state/RISKS.md`

After completing all 8 steps, output this exact line:

```
FRAMEWORK SESSION CLOSED — All state files updated. Close protocol complete.
```

### Enforcement mechanisms

1. **CLAUDE.md instructions** (this file) — behavioral gate for LLM agents.
2. **Pre-commit hook** (`.git/hooks/pre-commit`) — blocks commits without valid `.mvp-session.json`.
3. **Guardrails engine** (`mvp-governance`) — runtime evaluation of R-11.1.

---

## Project overview

A multi-language project (0 files, 0 lines) using unknown.

**Primary language:** unknown
**Build system:** unknown
**Frameworks:** None detected
**Size:** 0 files, 0 lines

## Build commands

```bash
# TODO: Add build commands
```

## Testing

```bash
# TODO: Add test commands
```

## Key conventions

- Follow existing code patterns and style
- Match the project's formatting conventions
- Preserve test coverage when modifying code

## Governance Documents

| Tier | Directory | Contents |
|------|-----------|----------|
| 1 | (this file) | Agent-specific instructions |
| 2 | `docs/product/`, `docs/architecture/`, `docs/planning/` | PRD, capabilities, use cases, glossary, architecture, backlog, execution plan |
| 3 | `docs/standards/` | API contracts, build/test, conventions, DoD, dependencies, deployment, performance, schema policy |
| 3 | `docs/operations/` | Security model, change management, incident response, monitoring |
| 3 | `docs/compliance/` | Compliance matrix, data governance, vulnerability policy |
| 4 | `docs/process/` | Release, feature lifecycle, escalation, handoff contract |
| 4 | `docs/governance/` | Ruleset, session protocol, LLM boundaries, prompt safety |

## Off-limits areas

None specified yet.

## Use the `maker` CLI for deterministic state (R-31.1, binding)

**R-31.1 forbids routing deterministic work to the model.** A backlog query, a tree check and a rule
scan are functions of their inputs, not judgement calls. The `maker` CLI answers each in one call at
zero model cost. Reading those answers out of files by hand is the R-31 anti-pattern.

| Instead of hand-reading / hand-running | Use |
|---|---|
| opening `docs/planning/BACKLOG.md` to find work | `maker next` (single next actionable item) |
| grepping the backlog for counts or one item | `maker backlog` (text or `--json`) |
| `git status` + `git branch` + ahead/behind maths | `maker tree` (one line: clean/dirty, branch, ±) |
| eyeballing the environment when something is off | `maker doctor` (tooling, gateway, binary freshness) |
| guessing whether a change trips the ruleset | `maker guardrails check` (the live R-ruleset scan) |
| hand-trimming the state logs | `maker rotate --keep 10` |

Note: `maker resume` is a read-only distilled view. It runs no gates and returns no verdict, so it
reports state but never blocks. Use it for orientation, not as a substitute for this file's session
protocol.
