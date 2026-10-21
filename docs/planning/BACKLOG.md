---
title: "BACKLOG"
project: rag-shared
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03T20:16:46Z
product_id: rag-shared
project_id: rag-shared
file_kind: Backlog
author: 
---

# Backlog — rag-shared
| ID | Title | Priority | Status |
|----|-------|----------|--------|
| B-001 | Write the rag-shared user manual at docs/user-guide/manual.html (R-25.1) and remove rag-shared from docs/governance/user-manual-baseline.json | HIGH | Pending |
| B-002 | Replace the scaffolded template prose in docs/ with rag-shared's real architecture, requirements and dependencies | HIGH | Pending |
| B-003 | Install the CI diagnosis gate (scripts/governance/diagnosis-gate-install.mjs) so fixes follow the Root Cause Protocol | MEDIUM | Pending |
| B-004 | Confirm rag-shared's build and test commands in CLAUDE.md run on a clean clone, and wire them into CI | MEDIUM | Pending |

### B-005: install the six QOS protocol gates, Descent/Handoff/Reconciliation report-only, at QOS pin 37ecc42db8ce

**Priority:** P1 · **Status:** In progress (2026-10-21) · **Found:** 2026-10-21, Nexus to QOS migration; authorized by R-07 (`tkt_edhwatnqnp`, andrew.kelly 2026-10-19: admit, with the missing CI gates scaffolded as part of admission), confirmed by the operator 2026-10-21.

**Scope:** Root Cause, Correction Loop and Caller via `scripts/governance/diagnosis-gate-install.mjs` and `scripts/governance/correction-loop-install.mjs` run at the pin; `scripts/governance/{descent-gate,undeclared-descent,handoff-gate,reconciliation-gate,item-namespaces,chain-record}.mjs` `scripts/state/{handoff-derive,handoff-per-item}.mjs` `scripts/backlog/reconciliation.mjs` `scripts/diagnosis/recurrence-probe.mjs` (each with its test) `docs/governance/protocols/{descent,handoff,reconciliation}.md` `docs/governance/RECONCILIATION_PROTOCOL.md` `scripts/governance/hooks/commit-msg` `.github/workflows/protocols.yml` `CLAUDE.md` `AGENTS.md`

Same shape as rag-orchestration PR #61, whose CI is green. Descent, Handoff and Reconciliation are copied unedited and are report-only until a second, deliberate change. The Correction Loop's CI workflow is held pending QOS's member variant (`qos:B-11752`).

**Acceptance criteria**
1. Each copied file is byte-identical to QOS 37ecc42db8ce.
2. `diagnosis-gate-install.mjs --check` reads "already installed" and `correction-loop-install.mjs --check` reads INSTALLED.
3. The commit-msg hook runs diagnosis, the correction loop, then four report-only gates before the delivery-gate `exec`, and parses under `sh -n`.
4. The copied tests pass in this tree.
5. Known gaps (`qos:B-11749`) and this repository's namespace coverage are stated rather than counted.
6. CLAUDE.md and AGENTS.md announce all five protocols and agree.
7. One real CI run of `protocols.yml`. Deletions against the merge base: 0.
