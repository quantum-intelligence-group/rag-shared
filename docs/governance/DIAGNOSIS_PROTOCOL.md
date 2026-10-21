---
title: "Diagnosis Protocol"
project: QOS
classification: QIG Confidential
file_kind: Protocol
---

# Diagnosis Protocol

**A hard-stop rule for causal claims, enforced at the commit boundary.**

## Why this exists

Agents assert causes they have correlated rather than established. The assertion is cheap, reads as
competent, and is wrong in the same way each time: one observation, one call site, the first plausible
link, no attempt to disprove it. Repeating the instruction to investigate properly does not fix it,
because an instruction addressed to judgement is a request, and a request is what an optimiser routes
around.

This protocol makes the search a precondition for the claim, enforced by refusal rather than by prompt.

## Scope

Every commit on a **defect-class** item, by any author, on any repository in the tree. Not scoped to
agents: authorship cannot be determined reliably at current attribution coverage, a rule that exempts
humans creates the obvious bypass, and this is correct practice for a person anyway. It binds fleet
workers, interactive sessions and orchestrator-delegated work identically, because all three land
through git.

Defect-class means any item whose purpose is to remove an observed wrong behaviour: a bug, a
regression, an incident follow-up, an investigation. Feature work, refactors, documentation and
dependency bumps are out of scope. Where the class is ambiguous, **the presence of a causal claim in
the commit message brings the item into scope regardless of its label.**

## The six steps, in a fixed order

The order is the enforcement mechanism. Each step's artifact must exist in an earlier commit than the
step depending on it, and git timestamps are what make backfilling detectable.

1. **Open the diagnosis before touching source.** A commit containing `docs/state/diagnosis/<ITEM>.json` and
   no source changes. Records the symptom, how it was observed, and the population: how many
   occurrences exist and how many were examined. An investigation that begins with an edit did not
   investigate, whatever it writes afterwards.
2. **Enumerate candidates before any verdict.** At least three, committed with `verdict: null` on every
   one. Listing three causes after you know the answer is trivial; listing them before you do is the work.
3. **Generate the census, do not write it.** A tool greps for every producer and consumer of the value
   or path named in the symptom and captures its output verbatim. The agent's summary of a pipeline is
   precisely where the single-call-site error lives.
4. **Probe each candidate and record the output.** Verdicts are `rejected`, `surviving` or
   `not-probed`. A candidate rejected by reasoning alone is `not-probed`.
5. **Name the falsification test, then run it.** State what observation would disprove the leading
   candidate, commit that statement, then run it and record the result.
6. **A/B/A, run by the harness.** Symptom reproduces without the fix, disappears with it, and returns
   when the fix is reverted on the same tree. The revert limb is the only field an agent cannot
   narrate.

Then the fix, as a **separate commit** referencing the diagnosis by hash.

## Verdicts

| Verdict | Means | Item ends at |
|---|---|---|
| `CAUSE-ESTABLISHED` | Every field satisfied, A/B/A complete with `reverted: reproduced` | `done` |
| `CORRELATE-ONLY` | A change removes the symptom; the causal chain is not established | `mitigated`, item stays open |
| `COULD-NOT-DETERMINE` | Investigation ran; no candidate survived or none could be probed | `investigated`, returns to queue with the artifact |

`CORRELATE-ONLY` and `COULD-NOT-DETERMINE` are legitimate outcomes, not failures. If the honest exits
are never used, the protocol has become the thing it was written to prevent.

## Two rules that matter more than they look

**`not-probed` must be a first-class verdict.** If the only disposals are `rejected` and `surviving`,
an agent that reasoned a candidate away will write `rejected` and invent an output.

**An empty `residual` is suspicious, not clean.** A cause that explains every observation on a
multi-symptom item is more often over-broad than complete. "It explains everything" is the signature of
the failure this protocol targets.

## Enforcement

`scripts/governance/diagnosis-gate.mjs`, at two invocation points. CI is the enforcement; the
pre-commit hook is the courtesy. Neither is ever invoked with `|| true`.

**Check 1, the vocabulary trap.** Refuses any commit whose message contains a causal claim without a
valid artifact. The word list is not the control: it is a forcing function that makes the claim
expensive in prose so it moves into the artifact where it can be checked.

**Check 2, closure.** Enforces the stage-transition table and every field rule.

Exit 2 blocks. An unreadable probe takes the conservative branch: a diagnosis gate that cannot see its
inputs has not cleared anything.

## The honest limit

This guarantees that a search of a specified shape happened, that the claim survived a stated attempt
to disprove it, and that a shallow investigation costs roughly what a real one costs. It does not
guarantee a true root cause. No protocol can. The measure of whether it works is **recurrence**, the
refuted-cause rate, not compliance, because the gate passing is what the agent is optimising for.

---

*Classification: QIG Confidential.*
