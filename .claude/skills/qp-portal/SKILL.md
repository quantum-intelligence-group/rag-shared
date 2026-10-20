---
name: qp-portal
description: Role-calibrated delivery cockpit for the governed SDLC — terminal summary by default, or a self-contained interactive HTML page (--html) that embeds the full text of the governed docs. CLI mode, no hosted app.
argument-hint: [role: cio|mgr|maker] [--html]
model: sonnet
---

## Instructions

Present the **delivery cockpit** for the governed SDLC: idea → decision → spec → build →
outcome, computed from real on-disk state (the SDLC docs, OutcomeThreads, git, GitHub). No hosted
portal — Claude + GitHub are the source of truth.

**Audience roles** (this portal's roles only — `CFO` / `CEO` belong to the Maker-SaaS / QOS
executive portals, not here):
- **CIO** — all governed projects (org-wide lens).
- **Dept Manager** — one department's projects.
- **Maker** — this project (QOS / quantum-pack).

`$1` = role (`cio` | `mgr` | `maker`; if omitted, give a brief all-role summary or ask).

### Terminal mode (default, no `--html`)

Give a **role-calibrated delivery summary** at the role's altitude — projects in scope, open
decisions, open backlog, uncommitted work, in-flight OutcomeThreads. Pull compact signals (`gh`
CLI, OutcomeThread tables, `BACKLOG.md` / `STATUS.md`); reason on the extract, don't dump repos
(QP-R8 token frugality). Then answer follow-ups conversationally.

### Interactive HTML (`--html`)

Run `tools/qp-portal-gen.py`. It **reads the governed SDLC docs from disk, embeds their full
text**, and writes a self-contained page to `.claude/qp/reports/portal-<YYYY-MM-DD>.html`
(open with `wslview` / `xdg-open` / `open` / `start`, else print the path).

The page has a **role selector** (CIO / Dept Manager / Maker — role-scoped: CIO = all governed
projects, Dept Manager = a department, Maker = this project) and six tabs:

- **Projects** — governed projects in the role's scope, with enforcement level.
- **Decisions** — decided + open governance decisions.
- **Backlog** — open delivery items.
- **Uncommitted** — real working-tree state.
- **Documents** — the **full text of the governed SDLC docs, embedded** in the page. This is the
  proof point: the governing record travels with the deliverable, no server required.
- **Threads** — OutcomeThreads (idea → outcome lineage).

**Token frugality (QP-R8):** the HTML/CSS/JS lives in `templates/portal.html` (a static shipped
asset, zero per-run tokens); the generator builds only the compact data payload and embeds the
docs. The page is a **snapshot** — re-run to refresh.
