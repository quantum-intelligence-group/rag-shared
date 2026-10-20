---
name: qp-build
description: Create stage — build the Agreed bundle into a real outcome.
argument-hint: [idea-id]
model: inherit
---

## Instructions

Run the extracted **maker** discipline (QP-R4):

1. **Precondition (QP-R3):** the idea's spec bundle (`.claude/qp/specs/<idea-id>.md`) MUST be
   `status: Agreed`. If not, stop and run `/qp-spec`.
2. **Plan:** derive an ordered increment list from the bundle's §4 Shape + §5 Acceptance.
3. **Build:** implement the increments (Claude-native). Read only the files each increment
   needs (QP-R8) — don't reload the whole repo.
4. **Verify before complete (QP-R14 / R-21.1):** before emitting or marking the idea done, check
   EACH acceptance criterion from the Agreed bundle's §5 against the actual implementation and
   verdict it **PASS / PARTIAL / FAIL**. Distinguish code *run & verified* from code merely
   *written* (R-6.1). A stub / placeholder / empty body never counts as complete (R-21.3). Any
   **FAIL** blocks completion — fix or stop; each **PARTIAL** must carry a one-line remediation note.
5. **Emit:** only once no criterion is FAIL, append a `create` event + the outcome to
   `.claude/qp/lineage/threads/<idea-id>.md` by reference, including the per-criterion verdicts
   (and any PARTIAL remediation notes) on the thread.

Builder is the CLI itself; the maker-platform service is an optional bridge, not required.
