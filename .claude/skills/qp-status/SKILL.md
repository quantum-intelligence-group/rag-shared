---
name: qp-status
description: Show the active OutcomeThread(s) and the gate state.
model: haiku
effort: low
---

## Instructions

Read `.claude/qp/lineage/threads/*.md`. For each idea report: id, classification, status, the
**latest 3 events**, and whether its spec bundle (`.claude/qp/specs/<idea-id>.md`) is `Agreed`
(gate open / closed). Note the enforcement level from `.claude/qp/quantum-pack.json`.

Read only the thread tables — do **not** load full spec bundles (QP-R8). Keep the output short.
