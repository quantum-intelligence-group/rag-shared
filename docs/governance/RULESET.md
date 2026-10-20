---
title: "RULESET"
project: nexusmig-rag-shared
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03T20:16:46Z
product_id: nexusmig-rag-shared
project_id: nexusmig-rag-shared
file_kind: Ruleset
author: 
---

# Maker Velocity Framework Ruleset — nexusmig-rag-shared
**Version:** 5.0.0

**Classification:** high

---

## HallucinationControl

### R-1.1 — No invented APIs

**Severity:** HardBlock

Never reference an API endpoint, function signature, CLI flag, or library method unless you have verified it exists in the current codebase or official documentation.

### R-1.2 — No fabricated paths

**Severity:** HardBlock

Never reference a file path, directory, or module that does not exist. Verify existence before referencing.

### R-1.3 — Verify library versions

**Severity:** SoftBlock

When specifying a dependency version, confirm it exists in the package registry. Do not guess version numbers.

### R-1.4 — Match actual error messages

**Severity:** SoftBlock

When referencing or handling error messages, use the exact text from the codebase or runtime output.

### R-1.5 — Admit uncertainty

**Severity:** Advisory

When unsure about an API, version, or behavior, state the uncertainty rather than guessing.

## FaithfulnessDuringEdits

### R-2.1 — No behavior changes during refactor

**Severity:** HardBlock

A refactor commit must not change observable behavior. If behavior change is needed, it must be a separate commit.

### R-2.2 — No silent deletions

**Severity:** SoftBlock

Do not remove code, comments, or configuration without explicit instruction or confirmation.

### R-2.3 — Edit in place

**Severity:** SoftBlock

Modify existing files rather than creating new files and deleting old ones, unless restructuring is explicitly requested.

### R-2.4 — Show diffs for large changes

**Severity:** Advisory

For changes spanning more than 20 lines, describe what changed and why before applying.

### R-2.5 — Confirm destructive changes

**Severity:** SoftBlock

Deleting files, dropping tables, removing features, or resetting state requires explicit confirmation.

### R-2.6 — Preserve formatting conventions

**Severity:** Advisory

Match the existing formatting style (indentation, line length, bracket placement) of the file being edited.

### R-2.7 — No orphaned imports

**Severity:** Advisory

When removing code that was the only user of an import, remove the import too.

### R-2.8 — Destructive pattern soft-block

**Severity:** SoftBlock

Patterns like rm -rf, DROP TABLE, git reset --hard, and force-push require explicit approval.

## CodebaseRespect

### R-3.1 — Read before write

**Severity:** HardBlock

Read the target file and its surrounding context before making any edit. Never write blind.

### R-3.2 — Match existing patterns

**Severity:** Advisory

Follow the naming conventions, architectural patterns, and idioms already established in the codebase.

### R-3.3 — Respect module boundaries

**Severity:** Advisory

Place code in the module where similar code already lives. Do not scatter related logic across distant files.

### R-3.4 — Configuration file changes require review

**Severity:** SoftBlock

Edits to configuration files (Cargo.toml, package.json, tsconfig, CI configs) must be called out explicitly.

### R-3.5 — Honor existing abstractions

**Severity:** Advisory

Use existing utility functions, shared types, and helper modules rather than duplicating their logic.

### R-3.6 — Understand before changing

**Severity:** Advisory

Before modifying unfamiliar code, read enough context to understand its purpose and invariants.

### R-3.7 — Preserve test coverage

**Severity:** Advisory

When modifying code that has tests, update the tests to reflect the new behavior.

## DefensiveCodeDiscipline

### R-4.1 — No reflexive try/except

**Severity:** Advisory

Do not wrap code in broad exception handlers. Catch specific errors with specific recovery strategies.

### R-4.2 — No premature optimization

**Severity:** Advisory

Write clear, correct code first. Optimize only when measurements show a bottleneck.

### R-4.3 — No global mutable state

**Severity:** Advisory

Avoid global variables and singletons. Pass state explicitly through function parameters.

### R-4.4 — Fail explicitly

**Severity:** Advisory

When a function cannot fulfill its contract, return an error or raise an exception. Do not return partial or default results silently.

### R-4.5 — Validate at boundaries

**Severity:** Advisory

Validate input at system boundaries (user input, API endpoints, file reads). Trust internal function calls.

### R-4.6 — Minimize dependencies

**Severity:** Advisory

Prefer standard library features over third-party dependencies for simple tasks.

### R-4.7 — No magic numbers

**Severity:** Advisory

Use named constants for non-obvious numeric or string literals.

## TestingHonesty

### R-5.1 — Tests must assert

**Severity:** SoftBlock

Every test must contain at least one assertion. A test that only calls code without checking results proves nothing.

### R-5.2 — No self-fulfilling mocks

**Severity:** SoftBlock

Mocks must not mock the system under test. Mock dependencies, not the thing being verified.

### R-5.3 — Never disable tests without justification

**Severity:** SoftBlock

Do not comment out, skip, or ignore tests without documenting why and creating a follow-up to fix them.

## ExecutionState

### R-6.1 — Distinguish ran from wrote

**Severity:** SoftBlock

Explicitly state whether code was executed and verified versus written but not yet run.

### R-6.2 — Surface stubs and workarounds

**Severity:** SoftBlock

If you create a temporary stub, workaround, or placeholder, mark it clearly and note what it replaces. Stubs must be listed in HANDOFF.md.

### R-6.3 — No silent mocks in production code

**Severity:** SoftBlock

Mock objects and fake implementations must never appear in production code paths. Functions returning hardcoded placeholder values are mocks.

## ScopeDiscipline

### R-7.1 — Smallest unit of edit

**Severity:** SoftBlock

Make the smallest change that achieves the stated goal. Do not bundle unrelated improvements.

### R-7.2 — No unprompted boilerplate

**Severity:** Advisory

Do not generate template code, starter files, or scaffolding unless explicitly requested.

### R-7.3 — Scope expansion requires confirmation

**Severity:** SoftBlock

If the required change is larger than initially described, explain the expanded scope and get confirmation before proceeding.

### R-7.4 — One concern per commit

**Severity:** Advisory

Each commit should address a single logical change. Do not mix features, fixes, and refactors.

## SecurityAndSecrets

### R-8.1 — No hardcoded credentials

**Severity:** AuditedBlock

Never include API keys, passwords, tokens, or other secrets in source code, configuration files, or comments.

### R-8.2 — No logged secrets

**Severity:** AuditedBlock

Never log, print, or display secrets, tokens, or credentials in any output.

### R-8.3 — No committed env files

**Severity:** AuditedBlock

Never commit .env files, credential stores, or key files to version control.

### R-8.4 — Sanitize user input

**Severity:** HardBlock

All user-provided input must be sanitized before use in queries, commands, or rendered output.

## SideEffectsAndExternalState

### R-9.1 — No unprompted writes

**Severity:** SoftBlock

Do not write to the filesystem, database, or external service without explicit instruction.

### R-9.2 — No unprompted network calls

**Severity:** SoftBlock

Do not make HTTP requests, API calls, or other network operations unless explicitly requested.

### R-9.3 — Environment-dependent code warning

**Severity:** Advisory

Code that behaves differently based on environment variables, OS detection, or machine state should be called out.

## VersionControlHygiene

### R-10.1 — No commits without instruction

**Severity:** SoftBlock

Do not create git commits unless explicitly told to. Stage and commit are distinct, intentional actions.

### R-10.2 — No push without instruction

**Severity:** HardBlock

Never push to a remote repository without explicit instruction.

### R-10.3 — No force-push without instruction

**Severity:** HardBlock

Never force-push to any branch without explicit instruction and confirmation of the target branch.

### R-10.4 — Destructive git patterns require approval

**Severity:** SoftBlock

git reset --hard, git clean -f, git checkout -- (destructive), and branch deletion require explicit approval.

## ApprovalAndToolUse

### R-11.1 — Read CLAUDE.md first

**Severity:** HardBlock

Read the project's CLAUDE.md before making any changes. It contains project-specific rules that override defaults.

### R-11.2 — Show commands before running

**Severity:** Advisory

Display shell commands before executing them so the user can review and approve.

### R-11.3 — No self-approval

**Severity:** HardBlock

Never approve your own changes, merge your own PRs, or bypass review gates.

### R-11.4 — Tool execution requires permission

**Severity:** HardBlock

Do not invoke tools, scripts, or external processes that are not on the approved list without permission.

## WhenStuck

### R-12.1 — Two-attempt limit

**Severity:** SoftBlock

If two attempts at solving a specific problem fail, stop and escalate to the human for guidance.

### R-12.2 — Escalate for scope clarification

**Severity:** Advisory

When the required scope is unclear or the task seems larger than initially described, ask for clarification rather than guessing.

## Performance

### R-13.1 — No unbounded collections

**Severity:** SoftBlock

Do not create Vec, HashMap, or other growable collections that accept unbounded external input without a size limit.

### R-13.2 — Pagination required for list endpoints

**Severity:** Advisory

All API endpoints and Tauri commands that return lists must support pagination via cursor or offset/limit.

### R-13.3 — No blocking in async context

**Severity:** SoftBlock

Do not perform synchronous I/O, CPU-intensive computation, or thread-blocking operations inside async functions. Use spawn_blocking for blocking work.

## Observability

### R-14.1 — Structured logging required

**Severity:** Advisory

Use tracing spans and structured key-value fields. Do not use string interpolation for log context.

### R-14.2 — Error context required

**Severity:** Advisory

Errors must include enough context (operation, input, state) to diagnose without reproducing.

### R-14.3 — No silent error swallowing

**Severity:** SoftBlock

Do not use .ok(), .unwrap_or_default(), or _ = result to silently discard errors without logging or justification.

## Dependencies

### R-15.1 — New dependency requires justification

**Severity:** SoftBlock

Adding a new crate dependency requires documenting why the standard library or existing dependencies are insufficient.

### R-15.2 — License compatibility required

**Severity:** HardBlock

All dependencies must use approved licenses (MIT, Apache-2.0, BSD, ISC, Zlib, MPL-2.0). GPL, AGPL, and SSPL are prohibited.

### R-15.3 — No pinned git dependencies

**Severity:** SoftBlock

Use crates.io published versions, not git repository references or path dependencies to external repos.

## DatabaseAndSchema

### R-16.1 — Migrations must be forward-only

**Severity:** HardBlock

Database migrations must not use DROP COLUMN, DROP TABLE, or other destructive DDL without a documented migration plan and rollback strategy.

### R-16.2 — New columns must have defaults

**Severity:** SoftBlock

New non-nullable columns must include a DEFAULT value or a backfill migration for existing rows.

### R-16.3 — Dual-store parity required

**Severity:** SoftBlock

Schema changes must be applied to both SQLite and PostgreSQL stores. Store trait changes must be implemented in both SqliteStore and PostgresStore.

## ApiDesign

### R-17.1 — Breaking API changes require deprecation

**Severity:** SoftBlock

Breaking changes to public REST API endpoints must follow the deprecation process: announce in prior release, provide migration path, sunset with notice.

### R-17.2 — Standard error envelope

**Severity:** Advisory

API error responses must use the standard envelope: { error: { code, message, detail } }.

### R-17.3 — Tauri commands must return Result

**Severity:** Advisory

All Tauri commands must return Result<T, String> and convert errors via .map_err(|e| e.to_string()).

## ConcurrencyAndSafety

### R-18.1 — No unwrap in production code

**Severity:** SoftBlock

Do not use .unwrap() or .expect() in non-test code. Use proper error handling with ? or match.

### R-18.2 — Lock scope minimization

**Severity:** Advisory

Hold RwLock/Mutex guards for the minimum duration. Clone data out of the lock scope before performing I/O or computation.

## LlmBehavior

### R-19.1 — LLM output must be typed

**Severity:** Advisory

Parse LLM responses through typed serde deserialization, not raw string processing. Use extract_json_object() + serde.

### R-19.2 — Prompt safety boundaries required

**Severity:** SoftBlock

System instructions must be separated from user content with explicit delimiters. User content must never be interpolated into system prompts.

## PromptCompliance

### R-20.1 — Implementation must match prompt specification

**Severity:** HardBlock

When an implementation brief, prompt, or backlog acceptance criteria specifies component architecture, visual layout, naming, file structure, or behavioral contracts, the implementation must match exactly. Deviations are only permitted when the specification conflicts with an existing governance rule.

### R-20.2 — No merging or flattening specified structure

**Severity:** HardBlock

When a prompt specifies N separate components, files, modules, or architectural layers, the implementation must create all N artifacts. Combining multiple specified artifacts into a single file or flattening a specified hierarchy is a violation.

### R-20.3 — Document deviations from prompt

**Severity:** SoftBlock

If a specification cannot be implemented exactly as written due to technical constraints, the deviation must be documented inline with a comment referencing the prompt and explaining the constraint. Silent deviation is never acceptable.

### R-20.4 — Literal execution of numbered instructions

**Severity:** HardBlock

When given numbered steps, checklists, or explicitly sequenced instructions, execute each step exactly as written, in order, without skipping, reordering, combining, or reinterpreting. If a step appears wrong, contradictory, or suboptimal — STOP and ask the operator before proceeding. Do not silently substitute an alternative approach.

### R-20.5 — No unsolicited improvements to instructions

**Severity:** SoftBlock

Do not add features, refactor surrounding code, change naming conventions, alter file organization, introduce abstractions, or improve anything beyond what the instruction explicitly requests. If the operator's instruction is narrowly scoped, the execution must be equally narrow. Unsolicited scope expansion requires operator confirmation before proceeding.

### R-20.6 — Ambiguity must be resolved by asking, not by assuming

**Severity:** SoftBlock

When an instruction is ambiguous, underspecified, or could be interpreted multiple ways, the agent must stop and ask for clarification. The agent must not pick the interpretation it considers most likely and proceed silently. The question must state the ambiguity and present the competing interpretations.

### R-20.7 — Step completion reporting

**Severity:** HardBlock

After completing each numbered step or acceptance criterion in an execution instruction, the agent must report: step reference (which step or AC was just executed), action taken (one-sentence summary), files changed (list of files created, modified, or deleted), and expectation match (explicit confirmation that the result matches the instruction, or a flagged deviation with justification). This report must appear in the conversation before proceeding to the next step. Batch-completing multiple steps with a single summary at the end is a violation.

### R-20.8 — Diff-to-instruction traceability gate

**Severity:** HardBlock

Before marking any task, backlog item, or instruction set as complete, the agent must produce a traceability summary that maps every file change (addition, modification, deletion) back to the specific instruction step or acceptance criterion that required it. Any change that cannot be traced to an explicit instruction must be called out as untraced, justified with a specific reason, and accepted by the operator before the task is marked complete. If the traceability summary reveals changes that were not instructed and cannot be justified, those changes must be reverted before completion.

### R-20.9 — Mid-execution compliance checkpoints

**Severity:** SoftBlock

For instruction sets with 5 or more steps or acceptance criteria, the agent must pause at defined checkpoints to verify alignment with the specification before continuing. Checkpoints occur after completing step 3 (if total steps >= 5), at the midpoint of the instruction set, and after the final step before declaring completion. At each checkpoint the agent must list all steps completed so far and their status, confirm alignment with overall instruction intent, flag any accumulated drift or assumptions, and ask the operator to confirm continuation if deviations were flagged. The operator may waive checkpoints with 'skip checkpoints' but the final traceability gate (R-20.8) always applies.

## DeliveryIntegrity

### R-21.1 — Acceptance criteria verification before shipping

**Severity:** HardBlock

Before marking any backlog item as Shipped, the agent MUST verify each acceptance criterion against the actual implementation. For each criterion: read the relevant source code, confirm the feature exists and functions as specified, and report the verdict (PASS/PARTIAL/FAIL). Any FAIL means the item cannot be marked shipped. Any PARTIAL must be explicitly acknowledged with a remediation plan.

### R-21.2 — No code changes without a backlog item

**Severity:** HardBlock

Every code change MUST trace to an active backlog item. The agent must identify the backlog item before starting work. If no item exists, one must be created first. Ad-hoc changes, drive-by fixes, and scope creep outside the stated backlog item are prohibited. Emergency hotfixes require a backlog item created retroactively in the same session.

### R-21.3 — No stub implementations marked as complete

**Severity:** HardBlock

A function, command, handler, or UI component that contains placeholder logic (hardcoded return values, not-yet-implemented messages, empty bodies, TODO comments as the only logic) MUST NOT be counted toward acceptance criteria. Stub implementations must be explicitly listed as incomplete in HANDOFF.md.

### R-21.4 — Phased build plan exit gates are binding

**Severity:** SoftBlock

When a backlog item specifies a phased build plan with exit gates, each gate must be verified before advancing to the next phase. Skipping phases or advancing with a failing gate is prohibited. If a gate cannot be met, the session must stop and document why in HANDOFF.md.

### R-21.5 — No execution with unsatisfied dependencies or unresolved decisions

**Severity:** HardBlock

A backlog item MUST NOT be started if: (1) any item listed in its Depends-on field has a status other than Shipped, (2) the item references an open question (OQ) that has not been resolved in OPEN_QUESTIONS.md, or (3) the item spec contains decision placeholders (TBD, to be decided, pending decision). Before beginning work, the agent must verify all dependencies are shipped and all referenced decisions are resolved. If a dependency is missing, the agent must either execute the dependency first or stop and document the blocker in HANDOFF.md.

### R-21.6 — Every backlog item must define acceptance criteria

**Severity:** HardBlock

A backlog item MUST NOT be executed unless it has explicit, numbered acceptance criteria. Each criterion must be verifiable against the implementation (testable, observable, or auditable). Vague criteria like 'works correctly' or 'is implemented' are not acceptable. If a backlog item lacks acceptance criteria, the agent must draft them and get operator approval before starting work.

### R-21.7 — No session completion without full acceptance criteria review

**Severity:** HardBlock

A session that implements a backlog item MUST NOT complete (close protocol) until every acceptance criterion has been reviewed and verified against the actual implementation. The agent must read the relevant source code for each criterion and report PASS, PARTIAL, or FAIL. Sessions with any FAIL criteria must document the failures in HANDOFF.md and must NOT mark the backlog item as Shipped.

### R-21.8 — Session close must include compliance checklist

**Severity:** HardBlock

When the session close protocol runs, the agent MUST output a compliance checklist showing: (1) the backlog item ID, (2) each acceptance criterion with its PASS/PARTIAL/FAIL status, (3) the file or command used to verify each criterion, and (4) a summary count (N PASS, N PARTIAL, N FAIL). This checklist is part of the session close output and must appear before the FRAMEWORK SESSION CLOSED line.

### R-21.9 — Backlog status must be updated when work ships

**Severity:** HardBlock

When a session implements a backlog item and all acceptance criteria pass verification, the agent MUST update the item's **Status:** line in docs/planning/BACKLOG.md from Not started (or In Progress) to Shipped with the commit hash, session number, and date. This update is part of the session close protocol and must occur in the same commit as the state file updates.

## PlatformIntegrity

### R-22.1 — No hardcoded filesystem paths

**Severity:** HardBlock

Absolute filesystem paths to external tools, scan roots, project directories, or user-specific locations MUST NOT be embedded in source code. Paths must come from configuration (environment variables, app settings, plugin registry, or user input). Use relative paths and std::path::Path::join() for path construction. Constants like DEFAULT_PORT are acceptable; constants like DEFAULT_PROJECT_DIR = "C:\\Projects" are not.

### R-22.2 — Magic strings must be constants or registry entries

**Severity:** SoftBlock

Provider names, model IDs, API endpoint paths, and pricing data must be defined as named constants, enum variants, or registry entries — not scattered as string literals across multiple files. If the same string appears in more than one file, it must be extracted to a shared constant.

### R-22.3 — External tool output schemas must be verified

**Severity:** SoftBlock

Before writing deserialization code for external tool output (CLI stdout, API responses, webhook payloads), verify the actual schema against real output. Silent .ok() swallowing of parse failures is prohibited for external data — log or surface the mismatch. Deserialization structs for external tools must include a comment citing the source of the schema definition.

### R-22.4 — Cross-platform path construction

**Severity:** Advisory

Filesystem paths must use std::path::Path::join() or PathBuf, not string concatenation or format!(). Forward-slash literal construction breaks on Windows; backslash construction breaks on Unix.

### R-22.5 — Store migration parity

**Severity:** SoftBlock

Every SQLite migration must have a corresponding PostgreSQL migration with equivalent schema. Schema differences between backends must be documented and justified. Migration file counts for both backends must be verified at session close when store changes are made.

### R-22.6 — Resource cleanup for spawned tasks and listeners

**Severity:** Advisory

Event listeners, spawned async tasks, and allocated closures must have a cleanup path. Closure::forget() and untracked JoinHandles must be justified with a comment explaining why cleanup is not needed, or replaced with proper lifecycle management (unlisten, AbortHandle, drop guard).

### R-22.7 — No absolute paths in persisted data

**Severity:** HardBlock

Project paths stored in the database or config files must be workspace-root-relative, never absolute. Absolute paths break silently when the workspace moves to a different drive or machine. Use Project::make_relative() before persisting and Project::resolve_path() when reading.

## BrandCompliance

### R-23.1 — Color palette must use approved brand colors

**Severity:** SoftBlock

CSS, SCSS, and Leptos style blocks must only use the 6 approved QIG brand colors: Midnight Atlas #0A1E2F, Quantum Blue #1F4ED8, Cloud Steel #9BB7D4, Ivory Field #FBF7EE, Graphite #2F2F33, Signal Copper #C06A1A. Off-brand hex codes in style contexts are rejected.

### R-23.2 — Typography must use approved font families

**Severity:** SoftBlock

Font-family declarations must use Georgia (headings) or Segoe UI (body). Non-approved font families like Arial, Helvetica, or Times New Roman are rejected.

### R-23.3 — Voice and tone must follow brand guidelines

**Severity:** Advisory

Content must reflect the 5 QIG voice attributes: Authoritative, Precise, Strategic, Trusted, Forward-Looking. Anti-patterns (arrogant, oversimplified, academic, cold, buzzword-heavy language) trigger an advisory.

### R-23.4 — Classification footers required on classified documents

**Severity:** SoftBlock

Documents marked with a classification level (Restricted, Confidential, Public) must include the correct classification footer text. Missing or incorrect footers are rejected.

### R-23.5 — Tagline must appear verbatim

**Severity:** SoftBlock

The QIG tagline 'Intelligence you can trust. Outcomes you can measure.' must appear exactly as written when used. Any alteration (word substitutions, reordering, truncation) is rejected.

### R-23.6 — Logo must meet minimum size and background requirements

**Severity:** Advisory

The QIG logo must not appear below minimum display size and must only be placed on approved background colors (Midnight Atlas or Ivory Field).

## DocumentGovernance

### R-24.1 — Canonical directory taxonomy

**Severity:** HardBlock

Files under docs/ must reside in one of the 14 canonical subdirectories (architecture, compliance, design, governance, integration, operations, planning, process, product, prompts, reports, requirements, standards, state). Files at docs/ root level are prohibited.

### R-24.2 — Design directory naming convention

**Severity:** HardBlock

Files under docs/design/ must be organized in B-{NNN}-{slug}/ subdirectories with a MANIFEST.md. Loose files directly in docs/design/ are prohibited.

### R-24.3 — Markdown branding header required

**Severity:** HardBlock

Markdown files under docs/ must include YAML frontmatter with at minimum: title, project, classification, created, and updated fields.

### R-24.4 — HTML branding header required

**Severity:** HardBlock

HTML files under docs/ must include a comment header containing at minimum a Classification field: <!-- ... Classification: ... -->.

### R-24.5 — No version suffixes on filenames

**Severity:** HardBlock

Document filenames must not contain version suffixes matching patterns like -v2, _v3, (2), or _V1. Versioning is managed through git history, not filename conventions.

### R-24.6 — No cross-project document references

**Severity:** Advisory

Document content must not contain absolute references to other project directories. Use relative paths within the project or reference external projects by name only.

## UserDocumentation

### R-25.1 — Every governed project must have a User Manual

**Severity:** SoftBlock

Every project onboarded to the Maker Velocity Framework must contain a docs/user-guide/manual.html file. The session close protocol must verify the file exists and is not empty. The user manual documents end-user functionality and value. It does not replace developer-facing docs (CLAUDE.md, README, architecture docs, API specs). If the project keeps a primary manual elsewhere (e.g., portal/manual.html), the governance copy must be synced at session close.

### R-25.2 — User Manual must be updated when code changes

**Severity:** SoftBlock

If any source files were modified during the session (detected via git diff against session start), docs/user-guide/manual.html must also appear in the changeset. Exempt sessions that only modify governance docs, state files, or non-functional files (.md in docs/state/, docs/governance/, docs/planning/).

### R-25.3 — User Manual format must be consistent

**Severity:** Advisory

The user manual must follow a standard HTML template structure (header, TOC, overview, installation, configuration, usage, feature reference, troubleshooting, FAQ, release notes appendix, footer) so that format stays consistent across releases and across projects. All CSS must be inline or in a <style> block — no external stylesheets, no external JS, no CDN links. This is required for Teams compatibility.

## ReleaseProcess

### R-26.1 — Version bump commits must include a release report

**Severity:** HardBlock

When the workspace version is bumped, a release report must exist at docs/reports/Release_{version}.html covering all backlog items shipped since the previous version. The report must include component ownership (PP CLI / LLM Gateway / Governance / Both), commit references, session numbers, and a totals summary. The report is generated by the mvp-governance release_report module.

## VersionGovernance

### R-28.1 — All MVP-managed projects must register versions with the Version Service

**Severity:** SoftBlock

Every project under MVP governance must have a GitHub repository configured, a GitHub webhook registered that publishes release/tag events to the MVP Version Service, and at least one version registered in the Version Service. A project is non-compliant if any of these conditions are unmet, or if the latest registered version is older than the project's latest GitHub release.

---

*This file is generated by the Maker Velocity Platform. Do not edit manually.*
