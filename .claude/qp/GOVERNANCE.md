# Quantum Pack — Governing Standard (generalized Maker ruleset)

> **Load on demand** (QP-R8): this is QP's full correctness/safety standard, consulted when QP
> governs a build or commit — not always-on context. It **complements** the QP discipline rules in
> `RULES.md` (QP-R1…R13). Adopted from the Maker Velocity Ruleset, **generalized to be
> stack-agnostic** so it applies to any project/language.
>
> **Enforcement seam (D29):** rules marked **[GATE]** are *mechanically* hard-blocked — at commit
> time by `qp-scan.sh` (secrets, `.env`, destructive DDL, stubs) and at command time by `qp-guard.sh`
> (force-push, destructive shell). Rules marked **[GUARD·warn]** are flagged at command time but not
> hard-blocked (e.g. push, self-merge — true detection needs the engine). All other rules are
> **agent-followed governance** — QP holds the agent to them and surfaces drift, but *full runtime
> evaluation/scoring* of every rule is the `mvp-governance` engine, the paid **Maker/QOS** layer.
>
> **Severity:** `block` (refuse), `warn` (advise, proceed), `info` (guidance). Mapped from Maker
> HardBlock/AuditedBlock→`block`, SoftBlock→`warn`, Advisory→`info`. Effective severity is capped by
> the configured `QP_ENFORCEMENT` level (`off`→info, `warn`→≤warn, `block`→full).

## Principles (the spirit — outcome over output)

- **P-1 Outcome before output** — deliver a working result, not narration or a plan.
- **P-2 Smallest viable change** — minimal edit that achieves the outcome; don't rewrite what works.
- **P-3 Verify, don't claim** — completion is proven by a passing check, not asserted. Show evidence.
- **P-4 Reuse before rebuild** — find and extend what exists before writing new code.
- **P-5 Protect what works** — never regress passing behavior; back up before a destructive act.
- **P-6 Keep the user in the loop** — surface decisions; confirm before irreversible/outward acts.
- **P-7 Close the loop** — finish: checks green, tree clean, lineage updated, work landed.

## Rules (generalized; IDs trace to the Maker ruleset)

**Hallucination control**
- R-1.1 No invented APIs/signatures/flags — verify existence before referencing. `block`
- R-1.2 No fabricated file paths/modules — verify they exist before referencing (behavioral). `block`
- R-1.3 Verify dependency versions against the registry; don't guess. `warn`
- R-1.4 Use exact error-message text from the code/runtime. `warn`
- R-1.5 Admit uncertainty rather than guessing. `info`

**Faithfulness during edits**
- R-2.1 A refactor must not change observable behavior (behavior change = separate commit). `block`
- R-2.2 No silent deletions of code/comments/config without confirmation. `warn`
- R-2.3 Edit in place; don't recreate-and-delete unless restructuring is requested. `warn`
- R-2.4 For changes >~20 lines, describe what changed and why. `info`
- R-2.5 Confirm destructive changes (delete files, drop data, remove features). `warn`
- R-2.6 Preserve the file's existing formatting conventions. `info`
- R-2.7 Remove imports/uses left orphaned by a deletion. `info`
- R-2.8 **[GATE]** Destructive patterns (`rm -rf`, `DROP TABLE`, `reset --hard`, force-push) need approval. `block`

**Codebase respect**
- R-3.1 Read the target + context before editing — never write blind. `block`
- R-3.2 Match existing naming, patterns, idioms. `info`
- R-3.3 Place code where similar code lives; respect module boundaries. `info`
- R-3.4 Call out config-file changes (build/dep/CI manifests) explicitly. `warn`
- R-3.5 Use existing utilities/types instead of duplicating them. `info`
- R-3.6 Understand unfamiliar code's purpose/invariants before changing it. `info`
- R-3.7 Update tests when changing tested code. `info`

**Defensive code discipline**
- R-4.1 No reflexive broad catch-all error handling; catch specific, recover specifically. `info`
- R-4.2 Correct and clear first; optimize only on measured bottlenecks. `info`
- R-4.3 Avoid global mutable state/singletons; pass state explicitly. `info`
- R-4.4 Fail explicitly — return/raise on contract failure; no silent partial/default results. `info`
- R-4.5 Validate input at system boundaries; trust internal calls. `info`
- R-4.6 Prefer the standard library over a dependency for simple tasks. `info`
- R-4.7 Name non-obvious literals as constants. `info`

**Testing honesty**
- R-5.1 Every test asserts something. `warn`
- R-5.2 Mock dependencies, never the system under test. `warn`
- R-5.3 Don't skip/disable tests without documenting why + a follow-up. `warn`

**Execution state**
- R-6.1 Distinguish *ran & verified* from *written but not run*. `warn`
- R-6.2 Mark stubs/workarounds/placeholders clearly and record them on the OutcomeThread. `warn`
- R-6.3 No mocks/hardcoded placeholder returns in production paths. `warn`

**Scope discipline**
- R-7.1 Make the smallest change that achieves the goal; don't bundle unrelated work. `warn`
- R-7.2 No unprompted boilerplate/scaffolding. `info`
- R-7.3 Scope larger than described → explain and confirm before proceeding. `warn`
- R-7.4 One logical concern per commit. `info`

**Security & secrets**
- R-8.1 **[GATE]** No hardcoded credentials/keys/tokens in code, config, or comments. `block`
- R-8.2 Never log/print/display secrets. `block`
- R-8.3 **[GATE]** Never commit `.env`/credential/key files. `block`
- R-8.4 Sanitize user input before use in queries/commands/rendered output. `block`

**Side effects & external state**
- R-9.1 No unprompted writes to filesystem/DB/external service. `warn`
- R-9.2 No unprompted network calls. `warn`
- R-9.3 Call out environment/OS/machine-dependent behavior. `info`

**Version-control hygiene**
- R-10.1 No commits without explicit instruction. `warn`
- R-10.2 **[GUARD·warn]** No push without explicit instruction. `warn`
- R-10.3 **[GATE]** No force-push without instruction + confirmed target branch. `block`
- R-10.4 Destructive git ops (`reset --hard`, `clean -f`, branch deletion) need approval. `warn`

**Approval & tool use**
- R-11.1 Read the project's CLAUDE.md (and QP rules) before changing anything. `block`
- R-11.2 Show shell commands before running consequential ones. `info`
- R-11.3 **[GUARD·warn]** No self-approval — never approve/merge your own PRs (best-effort flag). `warn`
- R-11.4 Don't invoke un-approved tools/processes without permission. `block`

**When stuck**
- R-12.1 After two failed attempts at the same problem, stop and escalate. `warn`
- R-12.2 Ask for clarification when scope is unclear rather than guessing. `info`

**Performance**
- R-13.1 No unbounded collections fed by external input without a size limit. `warn`
- R-13.2 List endpoints/queries support pagination. `info`
- R-13.3 No blocking I/O / heavy CPU on an async or UI thread; offload it. `warn`

**Observability**
- R-14.1 Structured logging with key-value context, not string interpolation. `info`
- R-14.2 Errors carry enough context (operation, input, state) to diagnose. `info`
- R-14.3 Don't silently swallow errors; log or justify. `warn`

**Dependencies**
- R-15.1 New dependency requires justification (why stdlib/existing won't do). `warn`
- R-15.2 Dependencies must use approved/compatible licenses; no GPL/AGPL/SSPL. `block`
- R-15.3 Prefer published-registry versions over git/path refs. `warn`

**Data & schema** *(applies when the project has a datastore)*
- R-16.1 Migrations forward-only/reversible; no destructive DDL without a documented plan. `block`
- R-16.2 New non-nullable columns ship a default or backfill. `warn`
- R-16.3 Keep all backing stores in parity (schema change applied to each). `warn`

**API design** *(applies when the project exposes an API)*
- R-17.1 Breaking public-API changes follow a deprecation path. `warn`
- R-17.2 Use a consistent error envelope `{ error: { code, message, detail } }`. `info`
- R-17.3 Boundary handlers return typed results/errors — never let an uncaught exception escape across the boundary. `info`

**Concurrency & safety**
- R-18.1 No panicking/uncaught error handling (unhandled exceptions, force-unwrapping nullables, bare `assert` for control flow) in production paths. `warn`
- R-18.2 Hold locks/critical sections for the minimum scope; copy data out before doing I/O. `info`

**LLM behavior** *(applies when the project calls an LLM)*
- R-19.1 Parse LLM output through typed deserialization, not raw string scraping. `info`
- R-19.2 Separate system instructions from user content; never interpolate user text into system prompts. `warn`

**Prompt / instruction compliance**
- R-20.1 Implementation matches the spec/brief exactly (architecture, naming, structure, behavior). `block`
- R-20.2 Create all N specified artifacts; don't merge/flatten a specified structure. `block`
- R-20.3 Document any forced deviation inline, referencing the spec + constraint. `warn`
- R-20.4 Execute numbered steps literally, in order; if a step looks wrong, stop and ask. `block`
- R-20.5 No unsolicited improvements beyond what the instruction requests. `warn`
- R-20.6 Resolve ambiguity by asking + presenting the interpretations, not by assuming. `warn`
- R-20.7 Report after each step: ref, action, files changed, expectation match. `warn`
- R-20.8 Before "done," map every change back to the instruction/criterion; revert untraced changes. `warn`
- R-20.9 For ≥5-step work, checkpoint alignment partway and before completion. `info`

**Delivery integrity**
- R-21.1 Verify each acceptance criterion against the implementation before shipping (PASS/PARTIAL/FAIL). `block`
- R-21.2 Every change traces to an idea/OutcomeThread; no drive-by scope creep. `warn`
- R-21.3 **[GATE]** A stub/placeholder/empty body MUST NOT be counted as complete. `block`
- R-21.4 Phased build exit gates are binding; don't advance past a failing gate. `warn`
- R-21.5 Don't start work with unsatisfied dependencies or unresolved decisions (no TBDs). `block`
- R-21.6 Every worked item has explicit, verifiable acceptance criteria. `block`

---

## Out of QP scope — the Maker/QOS moat (declared here, enforced/owned there)

These are **not** part of QP's standard; they are the differentiated paid layer:

- **Runtime enforcement engine** — `mvp-governance` drift evaluation, scoring, and full blocking of
  the non-`[GATE]` rules above. QP *follows* the rules; the engine *evaluates and enforces* them.
- **Session-continuity protocol** — STATUS / HANDOFF / resume + close protocol, the session
  compliance checklist, and backlog-status automation (Maker R-21.7/21.8/21.9).
- **Org governance & platform** — Version Service registration (R-28), release reports (R-26),
  user-manual generation (R-25), brand compliance (R-23), and document-taxonomy governance (R-24).

QP delivers the **correctness baseline**; Maker/QOS deliver **proof, continuity, and scale**.
