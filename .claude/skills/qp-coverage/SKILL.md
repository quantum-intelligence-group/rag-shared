---
name: qp-coverage
description: Operator/onboarding tool — scan a GitHub org and report which repos carry Quantum Pack / Maker / QOS scaffolding (or are unmanaged); optionally open an opt-in onboarding PR. CLI mode, gh only.
argument-hint: [org|all] [--include-archived] [--include-forks] [--repos a,b,c]
model: sonnet
disable-model-invocation: true
---

## Instructions

A **supporting/operator** tool (not a daily lifecycle stage): audit **scaffolding coverage** across
a set of GitHub repos from real GitHub state, in the terminal. `gh` is the only source and the only
machinery (QP-R1, QP-R9). Detection is **multi-fingerprint** (QP-R11).

> **SAFETY (QP-R12): the org is READ-ONLY by default.** Phase 1 only reads. Phase 2 (onboarding) is
> outward-facing — describe the exact change and **confirm per repo** before any branch/commit/PR.
> Never automatic, never auto-merge.

**Inputs**
- `$1` = scope: `<org>`, `all`, or default = the current repo's org (`gh repo view --json owner`).
- `--include-archived`, `--include-forks` widen the default (active sources = non-fork, non-archived).
- `--repos a,b,c` audits an explicit list instead of enumerating.

### Phase 1 — Audit (read-only, always)

Token frugality (QP-R8): fetch mechanically, reason on compact data, never model-read raw repos.
When the set is large, fan out per-repo checks to a subagent that returns only compact verdict rows.

1. **Enumerate:** `gh repo list <org> --no-archived --source --limit 1000 --json name,nameWithOwner,isArchived,isFork` (adjust per flags; for `--repos`, use the given list).
2. **Classify each repo — multi-fingerprint (QP-R11).** Probe markers with
   `gh api repos/<owner>/<repo>/contents/<path>` (404 / non-zero exit ⇒ absent). Parse any JSON with
   **gh's built-in `--jq` over the raw body** — never a system `jq`/`base64`/`python` (not guaranteed
   present; only the jq embedded in `gh` is):
   - **QP** — `.claude/qp/` present AND `quantum-pack.json` parses with an enforcement level:
     `gh api repos/<o>/<r>/contents/.claude/qp/quantum-pack.json -H "Accept: application/vnd.github.raw" --jq '.enforcement.default // (.enforcement.levels|join(",")) // empty'`
     (verified in the sandbox: one call, no `base64`/system `jq` — only gh's embedded jq)
   - **Maker** — any of `.mvp-session.json`, `.maker/`, `docs/governance/`, `docs/state/STATUS.md`.
   - **QOS** — marker TBD (D13); probe once defined.
   - **Verdict:** list which of {QP, Maker, QOS} are present; **misconfigured** = a marker exists but
     its config is missing/unparseable (flagged distinctly); **unmanaged** = no marker of any product.
3. **Render:** a terminal table (repo · QP · Maker · QOS · enforcement · note) led by counts, plus a
   persisted report at `.claude/qp/reports/qp-coverage-<YYYY-MM-DD>.md` with the scope/flags used
   (create `reports/` if absent).

> **Validation note:** the parse mechanism is **fixed and verified** in the sandbox (gh raw +
> embedded `--jq`, no `base64`/system `jq`). Still confirm the *managed* verdict **end-to-end against
> a live QP-installed repo on GitHub** — the first org audit found 0 managed of 170, so the full
> managed→verdict path hasn't run on real data yet.

**Phase 1 done when** every repo has a multi-fingerprint verdict, the table prints, and the report
is written — misconfigured installs flagged distinctly.

### Phase 2 — Onboard (opt-in, never automatic; QP-R12)

For a chosen **unmanaged** repo, after the user confirms the exact change:
1. Create a branch (`qp/onboard`) off the default branch via `gh api`.
2. Commit the **minimal QP scaffold**: `.claude/qp/quantum-pack.json` (`enforcement.default="warn"`)
   + the QP marker dir + the one-line `CLAUDE.md` pointer.
3. `gh pr create` titled `Onboard <repo> to Quantum Pack`, body referencing this audit. **Stop** —
   leave the PR for human review. Never merge.

**Phase 2 done when** a confirmed unmanaged repo has an open, review-ready QP-install PR and nothing
destructive was done. Keep output tight; with `all`/many repos, summarize counts first.
