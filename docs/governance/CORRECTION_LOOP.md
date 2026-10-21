# The Correction Loop

> Fix the system, not the instance. Portfolio-wide, provider-agnostic.
> Source: "The Correction Loop, fix the system, not the instance" (2026-09-23, W. Wilkins).
> Step 2 is governed by [DIAGNOSIS_PROTOCOL.md](DIAGNOSIS_PROTOCOL.md) and is NOT restated here:
> a second definition would fork against the 17 deployed copies.

## Why

An agent asked to fix something fixes the instance. It is faster, it is visible, it satisfies the
request as phrased, and every check it passes certifies that the instance is fixed. Nothing certifies
that the system can handle the next one. The cost asymmetry is structural, not a matter of diligence.

This protocol makes the system's ability to correct itself the unit of completion. An issue is not
closed when the fix merges. It is closed when the application has corrected an occurrence unattended,
and the loop runs again if it has not.

## The standard

No human intervention. Where a person must decide, the run is attended and the decision is theirs.
Where no person is present, every decision point has a recorded default, and the only escape is a
queue, never a wait.

## Two modes

| | Attended | Unattended |
|---|---|---|
| Who is present | A person, in a session, on any CLI | Nobody |
| At a decision point | The gate refuses; the person decides | The default applies; the call is recorded |
| Applies to | Interactive development work | Fleet, orchestrator, any scheduled run |

**Mode is declared, never inferred.** It is an explicit input with no default, and a run that does not
carry one refuses to start. The same binary runs both ways, so inference is guaranteed to be wrong some
of the time and wrong in the worse direction: a run that waits at 3 a.m. for an answer nobody will give
reads as a hung process. If the check ever has to fall back, it falls back to **unattended**, because a
defaulted decision is recorded, reviewable and reversible while a blocked worker is seven hours of
silence. Fleet and orchestrator runs are always unattended by definition, not by configuration.

## The loop

| Step | Produces | Not complete when |
|---|---|---|
| 1 Intake | A signature, matched against open findings | An issue is described in prose |
| 2 Root cause | A diagnosis artifact under the Root Cause Protocol | A correlate is asserted |
| 3 Classify | Bug or missing capability; app, fleet or orchestrator scope | The fork is skipped and a number is reported |
| 4 Implement | A capability with a caller the system invokes on its own | Tests pass and nothing calls it |
| 5 Watching | An observed unattended correction | The fix merged |
| 6 Closed | The loop exits for this class | |

Step 5 is the change that matters. Conventional closure is merge plus green checks. This loop closes on
evidence that the system corrected an occurrence with nobody watching. A capability can merge, pass
4,000 tests, be registered, and never fire. Both look identical to a conventional gate, and only
watching tells them apart.

## Step 1, Intake

Detection already exists; this step adds a single entry point, a machine-comparable signature, and
matching, so the same issue arriving twice increments a counter instead of opening a second finding.

```json
{ "detector": "pipeline-loop-detector",
  "failure_class": "item-reaches-building-never-delivers",
  "surface": "qos-umbrella",
  "locus": "scripts/fleet/test-gate.mjs",
  "observed": "skip",
  "expected": "allow|block",
  "first_seen": "2026-09-23T04:11:02Z" }
```

`failure_class` plus `locus` plus the observed/expected pair is what matching compares. One definition,
three consumers: intake matching, the Root Cause Protocol's recurrence probe, and step 5's
never-produced report.

**Bias to the false miss.** A false match buries a genuinely new defect inside someone else's count,
where it is invisible and uncounted. A false miss produces one extra finding, which is cheap and
visible. When the comparison is ambiguous, file separately.

**Pointer rows.** When a fleet-scoped or orchestrator-scoped finding surfaces inside an application,
that application carries a pointer row: finding id, recurrence count, mitigation in force. Pointer rows
cannot be assigned, worked or closed locally and they vanish when the owning finding closes. Without
them, one fleet defect appearing three times across six applications reads as six minor issues, none of
which reaches any threshold.

## Step 3, Classify

**The default reading of any issue is that a mechanism is required.** The measurement is the covering
note, never the deliverable.

| Evidence | Classification |
|---|---|
| The capability once worked and no longer does | Bug, restore the behaviour |
| A caller exists but fires on the wrong cadence or condition | Bug, in the wiring |
| The capability exists and nothing invokes it | Missing capability, build the caller |
| The behaviour has never existed | Missing capability, build both |

**Scope is set by where the thing that would fix it lives, not by where the symptom appeared.** A gate
that let the condition through is fleet-scoped even when the symptom is entirely inside one
application. The dangerous direction is fleet-level misread as app-level, and concentration makes it
worse: when most claimable work sits in one repository, a fleet defect presents as a defect in that
repository nearly every time. On reclassification the counter moves with the finding and does not
reset.

## Step 4, Implement

The unit of work is a caller inside the system that runs the fix unattended. A measurement, a query, a
one-off script or a report pasted back is not that work.

| # | Property | Without it |
|---|---|---|
| 1 | A named invoker with an explicit cadence, registered where the system reads its schedule | Nothing runs it |
| 2 | A dedupe key, so the datastore is the scheduler | Correct only while one replica is up |
| 3 | A health-target entry, so absence of output is a finding | A mechanism nothing enqueues cannot fail |
| 4 | A test asserting the registered set | The list stays accurate until someone forgets |

**The orphan check.** Static reachability from a root set of things the system runs on its own:
registered producers, bound event handlers, routes a shipped screen calls, the bootstrap path. Anything
exported and unreachable is an orphan and the commit is refused. **Tests and CLI entry points are not
roots, and that exclusion is the entire control**: admitting them makes the check pass everywhere and
certify nothing. Existing orphans ratchet. Analysis that cannot complete blocks.

**The caller declaration.** Every capability commit carries a trailer naming its invoker. Enforced by
`scripts/governance/correction-loop-gate.mjs` at the commit boundary:

```
Caller: scheduler:hourly("settlement-expiry")
Caller: events:on("document.ingested")
Caller: routes/engagements -> screens/EngagementCopy
Caller: none (diagnostic, expires 2026-10-23, FIND-415)
```

`Caller: none` is what "nothing, I did it" looks like written down, and it is greppable and countable.
A diagnostic is admitted with an expiry no more than 30 days out. An expiry rather than a quota,
because duration is the failure: a population of unwired scripts accumulates one defensible script at a
time.

The caller lands in the same commit as the capability. Where that collides with a diff-size cap, split
the capability, not the pair.

## Step 5, Watching

`watching`: the fix has merged and the finding is waiting for the system to correct an occurrence
unattended. It does not close on merge, on green checks, on registration, or on anyone's assessment.

| Classification | Closes on |
|---|---|
| Missing capability | The mechanism producing in production for the first time, a real run, not a smoke test |
| Bug | The signature failing to reproduce across the window, with the reproduce command run on a schedule |

For a bug, absence is weaker evidence than presence: a symptom can stop reproducing because surrounding
code changed. A clean window closes but does not prove, which is what the reopen path is for.

**First-run detection** is the cheapest instrument here and catches the most: record the first time each
mechanism actually produces, and report mechanisms that have never produced since registration. That is
the class static analysis cannot see, reachable, registered and dead.

**The window counts healthy time only.** It pauses while the fleet or orchestrator is degraded and
resumes on recovery, because a mechanism cannot demonstrate anything while the system that runs it is
down. Pauses are recorded events.

## Step 6, Exit or loop again

| Observation | Outcome |
|---|---|
| Autonomous correction observed in the window | Closed. Mitigation retired, pointer rows removed, attempts cleared |
| Window elapses with no correction | Return to **step 2**. Attempts increment; recurrence count and mitigation kept |
| Signature recurs after closure | Reopen at step 2, tagged `fix-refuted`, prior diagnosis marked REFUTED |

**Return to step 2, not step 4.** When a fix does not take, the failure is more often in the diagnosis
than in the implementation. The prior artifact carries forward with its rejected candidates intact, so
the next attempt narrows rather than restarts.

**Retiring the mitigation is deliberate and will feel unnecessary.** A mitigation left in place after
closure is indistinguishable from a fix that never worked, and the next occurrence would be absorbed
silently instead of reopening the finding. If removing it is genuinely too risky, the finding is not
closed; it is mitigated, and the age limit applies.

## The relief branch

Relief is a first-class path, because a protocol that refuses relief until the class is closed gets
abandoned on the first bad day. **Relief never closes a finding.**

| | Value | Effect |
|---|---|---|
| N | 5 recurrences | Stop relieving by hand; build an automatic stopgap through step 4 |
| M | 10 recurrences in 24h of healthy operation | Block new work touching this class |
| Age | 4 hours of healthy operation | An open mitigation escalates on age alone |

The age limit is the least obvious and the most important: a mitigation that absorbs every recurrence
removes the pressure that would have funded the fix. Nobody is uncomfortable, the finding ages quietly,
and the system never gains the capability.

Both M and the age limit count healthy time only, with two guards: a minimum continuous-healthy stretch
of one hour before a block can fire, so a recovery backlog cannot trigger M; and a wall-clock ceiling of
72 hours regardless of pauses, recorded separately when it fires.

**The signal to watch:** a rising stopgap count with a flat closure rate means relief is being automated
and causes are not being fixed.

## Unattended defaults

| Decision point | Unattended default |
|---|---|
| Signature match ambiguous | File separately, bias to the false miss |
| Bug or missing capability | Prior art: ever worked, bug; no caller ever existed, capability |
| Scope | The locus of the failing control, not where the symptom appeared |
| Diagnosis returns COULD-NOT-DETERMINE | Mitigate, count, increment attempts, leave open. Do not escalate on this alone |
| Diagnosis returns CORRELATE-ONLY | Proceed to step 3 with the relief branch engaged |
| Watching window elapses, no correction | Return to step 2; increment attempts |
| Mitigation passes its age limit | Raise priority within the scope; do not interrupt anyone |
| Frontier model returns a fix with no mechanism | Re-issue the request. Do not accept, do not ask |
| Stopgap needed at N recurrences | Build it through step 4, with an expiry |
| Mode not declared | Refuse to start. If a fallback is unavoidable, fall back to unattended |

**The floor.** Exactly one condition routes to a person, and it routes rather than waits: **5 attempts
on one class routes to the Needs You queue**, while the finding keeps its mitigation, keeps counting and
keeps its relief operating. Three conditions stop rather than route, and they are properties of the
fleet that this document does not relax: irreversible actions, spend caps, and anything touching the
system's own safety machinery.

**Every default is recorded as a decision**, carrying the decision point, the branch taken, the evidence
that selected it, and the mode. A default that fired on locus and a person who decided are different
facts with different reliability and must not look identical in the record. Review is a batch
retrospective read of the decision log, not a stream of approvals.

## The orchestrator

**Front one, the escalation is the symptom.** An escalation means the fleet could not handle something
on its own, so the issue is not the stuck item, it is why this class reached escalation at all. An
escalation that resolves an item without producing a fleet-level finding is incomplete. Default fix
target: the fleet.

**Front two, the frontier model does this too.** When the orchestrator escalates it is in the operator's
position, and the model will return the unstuck item the way a session returns a number. The
orchestrator is the caller, so it must refuse:

| The request must demand | Not |
|---|---|
| A diagnosis artifact meeting the Root Cause Protocol | An explanation |
| A fix target, bug or capability, and scope | A patch |
| A mechanism with a caller | A repaired instance |

A response without those is re-issued, not accepted and not referred to a person. Front two only works
if front one is true.

**Two constraints.** Cap the recursion: split the escalation budget explicitly, or the loop becomes the
pipeline. And the orchestrator's *decisions* mostly do not touch git, so the gates cannot catch them;
for that half the levers are the default and the metric, not a refusal. That is a real limit.

**The number that says it is working:** escalation rate by issue class, falling.

## The manifest

> **UNSPECIFIED IN THE SOURCE DOCUMENT.** The source cites "section 12" for the manifest and "section 13"
> for metrics, and neither section exists in it. The manifest is called "the entire per-app porting
> cost", so a rollout cannot proceed without one. The schema below is this repo's working definition,
> authored here so the rollout is not blocked, and it is the part most likely to need correcting.

Each application supplies `docs/governance/correction-loop-manifest.json`:

```json
{
  "app": "qos-umbrella",
  "scope_counter": "app",
  "schedulers":     ["docs/operations/RECURRING_JOBS.json"],
  "event_bindings": [],
  "entry_points":   ["os/agents/qos-autopilot.sh"],
  "roots":          ["scripts/capabilities/registry.json"],
  "thresholds": { "N_recurrences": 5, "M_in_24h": 10, "mitigation_age_h": 4, "attempts_to_needs_you": 5 },
  "watching_window_multiplier": 3,
  "health_targets": ["docs/operations/RECURRING_JOBS.json"]
}
```

`watching_window_multiplier` is a multiple of the mechanism's own cadence rather than a fixed duration,
because a fixed one is wrong for most cadences: an hourly producer's window is hours, a weekly sweep's
is weeks.

## What this does not do

It does not judge whether the fix is good, the cadence right, or the capability worth building. It
answers one question at every step, can the system do this without a person yet, and refuses to record
completion until the answer is observed rather than asserted.
