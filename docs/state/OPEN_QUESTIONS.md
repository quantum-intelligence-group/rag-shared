---
title: "OPEN QUESTIONS"
project: qig-maker-standards
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03
product_id: qig-maker-standards
project_id: qig-maker-standards
file_kind: OpenQuestions
author: gray.mccabe@qig.ai
---

# Open Questions — QIG-Maker-Standards

## OQ-1: Are build commands correct?

**Blocking:** No
**Status:** Resolved (N/A)

Resolved by D-1: this is a documentation/standards repo with no application code. There are
no build commands to verify.

## OQ-2: What frameworks does this project use?

**Blocking:** No
**Status:** Resolved (N/A)

Resolved by D-1: no application frameworks. The repo's subject matter is the Maker Velocity
governance framework, but the repo itself builds nothing.

## OQ-3: What canonical machine-readable format should rules be stored in?

**Blocking:** Yes (for the SoT inversion, D-2)
**Target:** Engineering / Wiley
**Status:** Open

If `mvp-governance` is to consume standards from this repo, the rules need a canonical
machine-readable form (TOML / JSON / structured Markdown + parser). Decide before authoring
content that must round-trip into code.

## OQ-4: How is the source-of-truth inversion sequenced?

**Blocking:** Yes (for `[migrate]` work)
**Target:** Wiley
**Status:** Open

D-2 commits to this repo becoming the SoT. The order of operations (when `mvp-governance`
stops owning `ruleset.rs` and starts importing) must be agreed with Wiley before migration.

## OQ-5: Pair Programmer → Maker rename across repos?

**Blocking:** No
**Target:** Team
**Status:** Open

`.mvp-*` vs `.pp-*` naming coexists across the fleet. D-4 sets "Maker" as canonical; the
cross-repo rename is a separate coordinated effort.

## OQ-6: Which net-new standards do we author first?

**Blocking:** No (but gates the next session's work)
**Target:** Wiley
**Status:** Open

Candidates: language-specific (Rust/TS/Python), AI/LLM/RAG, service/API baseline,
quality/delivery/security (CI/CD, coverage targets, observability, a11y, secret rotation,
API deprecation). Prioritization pending the Wiley conversation.
