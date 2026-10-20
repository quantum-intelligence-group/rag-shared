---
name: qp-help
description: What Quantum Pack is and how to use it — lifecycle, commands, the gate, enforcement levels.
model: haiku
---

## Instructions

Give a **concise** orientation (don't dump files; QP-R8):

**Quantum Pack** turns this CLI into a governed **idea → outcome** lifecycle — Claude + GitHub only,
token-frugal, white-label.

**Commands**
- `/qp-idea <text>` — capture + classify an idea; opens its OutcomeThread.
- `/qp-spec <id>` — visualize into an **Agreed spec bundle** (this is the build gate).
- `/qp-build <id>` — build the agreed outcome; emit it to the thread.
- `/qp-status` — where each idea stands.
- `/qp-portal [role] [--html] [--scope local|company]` — role-calibrated visibility (terminal, or a
  white-label interactive page with `--html`).
- `/qp-coverage [org]` — operator: which repos carry QP / Maker; opt-in onboarding PR.

**The gate (QP-R3):** no build before an Agreed spec bundle. Level `QP_ENFORCEMENT` =
`off`/`warn`/`block` (default `warn`). In a **Maker**-managed repo, QP defers the commit gate to
Maker (coexistence).

Full rules: `.claude/qp/RULES.md`. Keep the answer short.
