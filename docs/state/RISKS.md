---
title: "RISKS"
project: qig-maker-standards
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03
product_id: qig-maker-standards
project_id: qig-maker-standards
file_kind: Risks
author: gray.mccabe@qig.ai
---

# Risks — QIG-Maker-Standards

## R-1: Test coverage unknown

**Severity:** Low
**Status:** Closed (N/A)
**Note:** No application code — no test suite applies to a standards/docs repo.

## R-2: No version control detected

**Severity:** High
**Status:** Resolved
**Note:** Git initialized and pushed to the private GitHub repo this session.

## R-3: Standards drift between this repo and `mvp-governance`

**Severity:** Medium
**Status:** Open
**Mitigation:** D-2 makes this repo the SoT but the inversion is deferred. Until then, the
authoritative definitions remain in `mvp-governance/src/ruleset.rs`. Avoid authoring
conflicting canonical content here before the inversion sequencing (OQ-4) is agreed.

## R-4: This repo's own governance is unenforced

**Severity:** Low
**Status:** Open
**Mitigation:** No pre-commit hook / session-gate is installed, so commits here are
ungoverned despite CLAUDE.md describing one. Optional hook work is deferred; until then,
governance is behavioral only.
