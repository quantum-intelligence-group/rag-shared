---
title: "DECISIONS"
project: nexusmig-rag-shared
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03
product_id: qig-maker-standards
project_id: qig-maker-standards
file_kind: Decisions
author: gray.mccabe@qig.ai
---

# Decisions

## D-1: Repo purpose is a canonical standards repository

**Context:** Every scaffolded file read "project / unknown / 0 files"; the repo's purpose
was undefined.

**Decision:** QIG-Maker-Standards is the canonical, authored home of QIG's engineering
standards. The docs are the product; there is no application code (so no build/test suite).

**Alternatives:** Tooling/engine repo; combined standards + tooling.

**Consequences:** Build/test/CI-for-code standards do not apply to this repo itself; OQ-1
and OQ-2 (build commands, frameworks) are N/A here.

## D-2: This repo becomes the source of truth (inversion deferred)

**Context:** Standards are currently defined in code (`mvp-governance/src/ruleset.rs`) and
scaffolded into projects; there is no human-browsable canonical home.

**Decision:** Standards will be authored here as canonical; `mvp-governance` and the Maker
SaaS will be refactored to consume from this repo. The inversion itself is future work and
is **parked pending a conversation with Wiley**.

**Alternatives:** Published mirror only; authoring-home-for-gaps only.

**Consequences:** A canonical machine-readable format must be chosen (OQ-3); drift risk
exists until the inversion lands (RISKS R-3).

## D-3: Dual location

**Decision:** The repo lives both in each developer's local projects folder (working
reference) and is built into the Maker SaaS.

## D-4: Canonical name is "Maker / Maker Velocity"

**Context:** Naming drifts between "Maker Velocity" (`.mvp-*`) and "Pair Programmer"
(`.pp-*`) across repos.

**Decision:** "Maker / Maker Velocity" is canonical going forward (matches the repo name and
`.mvp-framework.toml`). The cross-repo PP→Maker rename is deferred (OQ-5).

## D-5: Session scope discipline

**Context:** Risk of ballooning a documentation task into a cross-repo refactor.

**Decision:** Keep sessions narrowly scoped; defer the `[migrate]` work, the inversion, the
format choice, the rename, and the enforcement hook to their own specs/backlog items.

## D-6: Priority — author net-new standards before reconciling existing ones

**Context:** Operator wants to focus on gap standards first and revisit built-in standards
after talking to Wiley.

**Decision:** Prioritize authoring net-new (gap) standards; defer `[migrate]` reconciliation
until after the Wiley conversation.
