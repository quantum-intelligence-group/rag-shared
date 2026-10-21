---
title: "CLAUDE"
project: rag-shared
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03T20:16:46Z
product_id: rag-shared
project_id: rag-shared
file_kind: ClaudeMd
author: 
---

# CLAUDE.md — rag-shared

<!-- BEGIN qos-protocols (managed by scripts/governance/protocol-announce.mjs) -->
## MANDATORY: two protocols, and both bind BEFORE you start work

**These are not documentation. They are gates, they are required status checks on this repository's
default branch, and they will refuse your commit.** More importantly they govern what you do *before*
your first edit, so meeting them at commit time means redoing the work.

Every session that has skipped them so far discovered them the same way: by being refused, after the
work was already written. Reading this section is the cheaper path.

### 1. Diagnosing anything? The Root Cause Protocol binds first.

`docs/governance/DIAGNOSIS_PROTOCOL.md`

**Before you touch source**, write `docs/state/diagnosis/<ITEM>.json` and commit it. In order:

1. The artifact exists and is committed **before the fix**, not alongside it.
2. **At least three candidate causes**, all starting `"verdict": null`. One candidate is a hypothesis,
   not a diagnosis.
3. A **tool-generated census**, not a summary you wrote. Counts come from a command.
4. **Probe each candidate.** `rejected` needs evidence. Rejected-by-reasoning is `not-probed`, and
   saying so is the point.
5. **Name what would disprove your leader, and commit that, before you run the test.** This single
   step is what separates "the fix failed" from "there is a second cause".
6. **A/B/A**, including the revert limb. If you cannot construct one, say so in the artifact rather
   than implying you did.

Then the fix, as a **separate commit** referencing the artifact. Verdicts are `CAUSE-ESTABLISHED`,
`CORRELATE-ONLY` or `COULD-NOT-DETERMINE`. `CORRELATE-ONLY` closing as mitigated is legitimate; a
guess dressed as a cause is not.

### 2. Shipping a fix? The Correction Loop binds.

`docs/governance/CORRECTION_LOOP.md`

**Fix the system, not the instance.** A capability that ships without something invoking it
unattended is not shipped. Every commit that adds one declares its caller in the commit message:

    Caller: scheduler:hourly("settlement-expiry")
    Caller: events:on("document.ingested")
    Caller: routes/engagements -> screens/EngagementCopy
    Caller: none (diagnostic, expires 2026-10-23, FIND-415)

Those four forms are the whole accepted set, deliberately. A free-text trailer would accept
"Caller: the fleet" and certify nothing.

### Retrieval, at the point of need

    node scripts/state/learnings-search.mjs --files <the files you are about to touch>
    node scripts/state/learnings-search.mjs "<what you are about to do>"

Deterministic, no model call, returns the entries that match and why. No match is a real answer.

### If a gate refuses you

Read the refusal. **It names the step you skipped.** Do not reword the commit message until it
passes: that clears the gate and leaves the defect, and it is the exact failure that made these
protocols mandatory in the first place.
<!-- END qos-protocols -->

<!-- B-005: written by hand, OUTSIDE the managed block above, because protocol-announce.mjs at QOS
     37ecc42db8ce announces only the two protocols above and a re-run would erase anything inside it. -->
## MANDATORY, REPORT-ONLY FOR NOW: three more protocols (Descent, Handoff, Reconciliation)

Installed 2026-10-21 under R-07 (`tkt_edhwatnqnp`), copied unedited from QOS `37ecc42db8ce`.
**They bind now.** What is report-only is the GATE, not the rule: the `commit-msg` hook and
`.github/workflows/protocols.yml` print each verdict and do not yet refuse. Turning a gate to blocking
is a later, deliberate change. A report-only refusal is a finding about your commit, so read it.

- **Descent** (`docs/governance/protocols/descent.md`). Discovered work goes ONE level deep. Working on
  something you found rather than were given: the commit carries `Depth: 1` and `Parent: <the item you
  return to>`. New work you were handed mid-session carries `Assigned: <who gave it>`. Deeper than one
  level is captured as an item, not worked.
- **Handoff** (`docs/governance/protocols/handoff.md`). A handoff is a report, not a foundation. One
  entry per item in `docs/state/HANDOFF.md`, replaced rather than appended; the machine writes the
  state (`node scripts/state/handoff-derive.mjs`), you write the reasoning, and each claim line carries
  a tag: `[decided]` `[proposed]` `[observed]` `[assumed]`.
- **Reconciliation** (`docs/governance/protocols/reconciliation.md`, `docs/governance/RECONCILIATION_PROTOCOL.md`).
  A backlog item you ADD must pass Test 1. The gate judges what a commit adds, never existing debt.

**The Correction Loop's CI half is pending.** Its `correction-loop.yml` at the pin assumes QOS context and
cannot pass in a member; QOS is shipping a member variant (`qos:B-11752`). Until then the Correction Loop
runs locally in `commit-msg` only. This is a reported gap, not a pass.

Known gaps at install, all QOS's to fix (`qos:B-11749`), so do not read silence as a pass:
- `undeclared-descent` sees an id only at the START of a subject. On a conventional subject such as `docs(X-1): x` it reports "no item id in the message" and judges nothing, while `descent-gate` sees the same id. Lead the subject with the bare id.
- `docs/planning/id-allocations/` does not exist here, so `undeclared-descent` reads EVERY id as allocated this session. Until that directory exists, every bare-id commit prints a report-only refusal unless it carries `Assigned:` or `Depth:` and `Parent:`.
- Reconciliation matches only `**Acceptance criteria**`, not `Acceptance Criteria:`.
- This backlog keeps some or all of its items in a TABLE. `reconciliation-gate` splits added items at `##`/`###` headings and requires `**Acceptance criteria**` and `**Scope:**`, which a table row cannot carry, so an added table row will be refused. Report-only today; before it blocks, add items as headings or QOS adds a table reader. The install item below is a heading for that reason.

**Learnings retrieval:** `scripts/state/learnings-search.mjs` does not exist in this repository. Use the
program's copy: `node /opt/apps/QOS/scripts/state/learnings-search.mjs --files <paths>`


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
