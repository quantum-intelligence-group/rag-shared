# Quantum Pack — nexusmig-rag-shared

> Quantum Pack is a portable governance discipline that turns a coding CLI into an idea→outcome
> lifecycle (capture → classify → visualize → create), with a build gate and machine-enforced rules.
> Classification: **QIG Confidential**.

## What is here

- `RULES.md` — the binding rules for this repo (load on demand).
- `GOVERNANCE.md` — the governance model: gates, enforcement levels, lineage.
- `quantum-pack.json` — pack manifest (namespace, stages, enforcement defaults).
- `lineage/` — the OutcomeThread lineage records for work done under the pack.
- The pack's skills and hooks live at the shared `.claude/skills` and `.claude/hooks` roots
  (used across all installed packs: qp/cp/di/pat).

## Using it

Invoke a pack command as a slash command (e.g. `/qp-idea`, `/qp-spec`, `/qp-status`). See
`INSTALL.md` to wire enforcement into `.claude/settings.json`. The discipline is provider-agnostic.
