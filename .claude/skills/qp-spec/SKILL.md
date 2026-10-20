---
name: qp-spec
description: Visualize an idea into an Agreed spec bundle (the build gate).
argument-hint: [idea-id]
model: inherit
---

## Instructions

Run the **visualize** discipline for the idea (`$ARGUMENTS`):

1. Copy `.claude/qp/templates/spec-bundle.md` to `.claude/qp/specs/<idea-id>.md`; fill all 7
   sections. Keep it lean — one artifact (QP-R8).
2. Resolve open questions with the user. The bundle stays `status: Draft — pending agreement`.
3. **Agreement gate (QP-R3):** only the user flips it. On explicit agreement, set
   `status: Agreed` and append a `visualized` event to `.claude/qp/lineage/threads/<idea-id>.md`.

Nothing may be built until status is `Agreed`.
