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

---

## Scope lines for the scaffold items

Scope lines and acceptance criteria added 2026-10-28 so the fleet's intake can read these items. Titles and statuses are unchanged. Each fact below was checked against this repository's `main` on 2026-10-28.

### B-001 — Write the rag-shared user manual at docs/user-guide/manual.html (R-25.1) and remove rag-shared from docs/governance/user-manual-baseline.json

**Priority:** HIGH
**Status:** Pending
**Source:** 2026-10-28, scope line added for fleet intake (B-12005); the original title and status are unchanged.
**Scope:** `docs/governance/user-manual-baseline.json`
**Description:** The manual half of this item is already on `main`: `docs/user-guide/manual.html` was added by pull request #5 (merged 2026-10-28). What remains is the second half of the title: `docs/governance/user-manual-baseline.json` still lists `rag-shared` as grandfathered user-manual debt (`"members": ["rag-shared"]`, `"total": 1`). Remove the entry so `members` is empty and `total` is 0, keeping the file's other fields. Do not edit the manual.
**Acceptance criteria**
1. `node -e "const d=require('./docs/governance/user-manual-baseline.json'); process.exit(d.members.includes('rag-shared')||d.total!==d.members.length?1:0)"` exits 0.
2. `node scripts/compliance/scan.mjs . --gate` exits 0 and prints PASS.
3. `git diff --stat` shows `docs/governance/user-manual-baseline.json` only.

### B-002 — Replace the scaffolded template prose in docs/ with rag-shared's real architecture, requirements and dependencies

**Priority:** HIGH
**Status:** Pending
**Source:** 2026-10-28, scope line added for fleet intake (B-12005); the original title and status are unchanged.
**Scope:** `docs/architecture/ARCHITECTURE.md`, `docs/product/CAPABILITIES.md`, `docs/standards/DEPENDENCIES.md`
**Description:** These three files still hold the scaffold's placeholder text (`(not scanned)`, `**unknown**`, `TODO:` lines and the scaffold's three-letter to-be-determined marker): the language table, the build system, the capability table and the dependency list. Replace each placeholder with what the repository actually contains, read from its code, manifests and scripts, and list the files you read in the pull request description. The product requirements and success criteria in `docs/product/PRD.md`, and the use cases, are product decisions: they are not part of this item and must stay as they are. `docs/standards/BUILD_AND_TEST.md` belongs to B-004. State only what you can verify; where a fact is not in the repository, say it is not documented instead of guessing. Write no secret values.
**Acceptance criteria**
1. `grep -nE '\(not scanned\)|\*\*unknown\*\*|\bT[B]D\b|TODO:' docs/architecture/ARCHITECTURE.md docs/product/CAPABILITIES.md docs/standards/DEPENDENCIES.md` prints nothing.
2. Every file path, manifest name and dependency named in those three files exists in the repository.
3. `node scripts/compliance/scan.mjs . --gate` exits 0 and prints PASS.
4. `git diff --stat` shows only those three files.
