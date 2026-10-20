---
name: idea
description: Capture and classify a new idea, and open its OutcomeThread.
argument-hint: [idea description]
model: sonnet
---

## Instructions

Capture the idea in `$ARGUMENTS` (ask 1–2 clarifying questions only if it's vague), then:

1. **Classify** it — `build` / `enhancement` / `action` (QP-R2).
2. **Assign an idea id:** `idea-<slug>-NNN`.
3. **Open the OutcomeThread** at `.claude/qp/lineage/threads/<idea-id>.md` using the
   discipline's append-only format: one event table, `status: captured`, then append the
   `classify` event.
4. **Route:** `build`/`enhancement` → tell the user to run `/qp-spec` (visualize). `action`
   → record a terminal outcome on the thread (no build).

Do **not** start building (QP-R3 — no build before an Agreed spec bundle).
