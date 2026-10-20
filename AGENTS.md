---
title: "AGENTS"
project: nexusmig-rag-shared
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03T20:16:46Z
product_id: nexusmig-rag-shared
project_id: nexusmig-rag-shared
file_kind: AgentsMd
author: 
---

# AGENTS.md — Universal Agent Governance

> This file defines governance rules for **all** LLM coding agents working on project.
> Tool-specific instructions: `CLAUDE.md`, `.cursor/rules`, `.github/copilot-instructions.md`, `.windsurfrules`.
> **Principles:** Follows the 7 Maker Principles (outcome over output) — see `docs/governance/PRINCIPLES.md`.

## Session Lifecycle

Follow the protocol in `docs/governance/SESSION_PROTOCOL.md` (if it exists) or `CLAUDE.md`.

## Governance Rules

73 rules across 19 categories. See `docs/governance/RULESET.md` for the full reference.

**Never violate** (HardBlock/AuditedBlock):
- R-1.1/R-1.2: No invented APIs or fabricated paths
- R-2.1: No behavior changes in refactor commits
- R-3.1: Read before write
- R-8.1/R-8.2/R-8.3: No hardcoded, logged, or committed secrets
- R-8.4: Sanitize all user input
- R-10.2/R-10.3: No push/force-push without instruction
- R-11.1: Read governance files before changes
- R-11.3: No self-approval

## Build Commands

TODO: Add build commands for this project.

## Key Conventions

- Follow existing code patterns and style
- Match formatting conventions
- Preserve test coverage
