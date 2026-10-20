---
title: "STATUS"
project: qig-maker-standards
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03
product_id: qig-maker-standards
project_id: qig-maker-standards
file_kind: Status
author: gray.mccabe@qig.ai
---

# Status — QIG-Maker-Standards

**Last updated:** 2026-06-03

## Project Snapshot

- **Purpose:** Canonical, authored source of truth for all QIG engineering standards
  (governance ruleset, Maker Principles, conventions, CI/CD, testing, language-specific,
  brand, security, dependencies, document taxonomy, release/version governance).
- **Type:** Documentation / standards repository — no application code; the docs are the product.
- **Repo:** github.com/quantum-intelligence-group/QIG-Maker-Standards (private).
- **Tests:** N/A (no application code).

## Done

- Onboarded to Maker Velocity framework (scaffold).
- Created private GitHub repo; initialized git; pushed initial commit + brand assets.
- Confirmed project purpose: canonical standards repo (the docs are the product).
- Confirmed source-of-truth role: this repo will **become** the SoT; `mvp-governance` to
  consume from here (inversion deferred — see DECISIONS D-2).
- Surveyed the standards landscape: `pair-programmer-platform`, `operative`, and 4 active
  consuming repos (QIG, LLM-Gateway, cadence, lodestar).
- Produced a complete inventory of what is already covered: **115 rules / 27 categories**,
  **7 Maker Principles**, and ~25 standards/governance/process/ops/compliance docs.
- Corrected an earlier error: this repo is **not** stale — it carries the full v5.0.0
  115-rule set, identical to the platform (verified by rule count).
- Wrote identity design spec: `docs/requirements/2026-06-03-repo-identity-design.md`.

## In Flight

- Scoping the **net-new (gap) standards** to author. Catalog of existing coverage complete;
  the inverse gap list is the next artifact. Prioritization is **pending a conversation
  with Wiley**.

## Next

- Produce the gap list (what is not covered / only skeletal) as a repo doc.
- Author net-new standards once prioritized with Wiley — candidates: language-specific
  (Rust/TS/Python), AI/LLM/RAG, service/API baseline, quality/delivery/security.
- After Wiley: revisit the `[migrate]` work and the SoT inversion (DECISIONS D-2).
- Deferred: finish identity docs (README/PRD/CAPABILITIES/CLAUDE.md rewrites), canonical
  machine-readable rule format, PP→Maker rename, optional pre-commit session-gate hook.
