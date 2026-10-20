---
title: "HANDOFF"
project: qig-maker-standards
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03
product_id: qig-maker-standards
project_id: qig-maker-standards
file_kind: Handoff
author: gray.mccabe@qig.ai
---

# Handoff

## Where We Stopped

Repo identity and direction are settled and documented. The session pivoted from "install
enforcement hook" → "define identity" → "author net-new standards." We completed a full
inventory of currently-covered standards (115 rules / 7 principles / standards docs) and
were about to produce the inverse **gap list**. Prioritization of net-new standards is
parked pending a conversation with **Wiley**, and the `[migrate]` work + SoT inversion are
also parked pending that conversation.

## What's Next

1. Produce the **gap list** — what is not covered or only a skeleton (language-specific
   standards, AI/LLM/RAG standards, service/API baseline, CI/CD baseline, test-coverage
   targets, observability format, a11y, secret-rotation, API deprecation). Save as a repo doc.
2. Talk to Wiley to prioritize which net-new standards to author first, and to confirm the
   SoT inversion sequencing (OQ-4).
3. Author the prioritized net-new standards.
4. Deferred follow-ups (own specs): identity-doc rewrites (README/PRD/CAPABILITIES/CLAUDE.md),
   canonical machine-readable rule format (OQ-3), PP→Maker rename (OQ-5), pre-commit
   session-gate hook.

## Quick Reference

- Design spec: `docs/requirements/2026-06-03-repo-identity-design.md`
- Existing coverage inventory: 115 rules in `docs/governance/RULESET.md` (v5.0.0, 27
  categories), 7 principles in `docs/governance/PRINCIPLES.md`, standards docs under
  `docs/standards/`, `docs/process/`, `docs/operations/`, `docs/compliance/`.
- Source-of-truth today (until inversion): `pair-programmer-platform/crates/mvp-governance/src/ruleset.rs`.

## What to Watch

- **No backup count for tests** — this is a docs repo; do not look for a test suite.
- The state-doc edits from this session may be uncommitted (see close note); commit/push as desired.
- Do not re-assert the "stale 73-rule" claim — it was disproven; the repo has 115 rules.
- Many `docs/` files are scaffolded skeletons with `project: project` frontmatter and TODOs;
  the identity-doc rewrite (deferred) will clean these up.
