# The Reconciliation Protocol

> Work that stops moving is purged, not held.

**Status:** core implemented and tested, **report-only**. Purge is not applied automatically. See
"What is deliberately not automated" below.

A backlog that only grows is not a backlog, it is a pile, and a pile teaches everyone who looks at it
that nothing in it will ever be done. This protocol puts a clock on items and removes what cannot
move, so that what remains is credible.

## Ownership is the repository

An earlier design required every item to name an individual originator with a reachable channel. That
is the wrong shape. People leave, agents are retired, and an item whose owner has evaporated becomes
unroutable through an administrative accident rather than through anything about the work.

The repository owns the item. The Mission Control operator owns the repository. There is always an
owner as long as the repository exists, so the unroutable case collapses to one condition: the
repository is gone. An item in a repository that no longer exists is purged without ceremony.

This removes ownership as a problem rather than solving it. No per-item owner field to populate across
a backlog nobody remembers, no inheritance rules, no dead-channel handling.

## Test 1: compliance

Can this item satisfy the protocols as they now stand?

| Requirement | Source |
|---|---|
| A spec stating behaviour under constraints | Correction Loop, step 3 |
| An executable acceptance criterion | Correction Loop, step 3 |
| A declared file scope | Correction Loop, step 4 |
| A diagnosis artifact, if defect-class and past the ordering point | Root Cause Protocol |
| A depth and parent, if discovered work | Descent Protocol |

**Most failures here are repairable, and repair is attempted before purge.** A missing spec can be
written; a scope can be declared. Only what cannot be brought into compliance is purged, and the
unrepairable cases are the ones where the information is gone: an unreproducible defect nobody
diagnosed cannot be diagnosed now.

## Test 2: the clock

Three conditions, and only one of them is a waiting period.

| Condition | Treatment |
|---|---|
| Queued, not yet at the head of the claim order | No clock. Waiting its turn is legitimate |
| At the head, claim fails | **Immediate.** Route to correction now; no waiting period |
| Claimed, then stopped moving | 24 hours (agent) / 30 days (human) |
| Correction requested and undispatched | Paused |
| Correction dispatched | Clock resumes |

**Unclaimable at the head is immediate.** An item waiting in line could legitimately wait weeks, since
the fleet holds three per repository and the queue is long. An item that reaches the head and cannot be
claimed is broken now, and waiting adds nothing to a diagnosis that one claim attempt already produced.

**Acknowledgement does not reset the clock, and comments are not movement.** If saying something
counted as moving, the clock would measure attention rather than progress, and the items that attract
the most discussion are exactly the ones that move least.

**Unknown is never healthy.** An item whose last movement cannot be read is `UNKNOWN`, and `UNKNOWN`
is held, never purged and never counted as moving.

## Purge and return

**What purge means.** The item leaves the work store. Its record does not: id, title, origin,
repository, the tests it failed, the correction requested, and the date. That record is small,
permanent, and is what makes purge defensible. Nothing vanishes, and anyone asking what happened to an
item gets an answer.

**Purge is not archival to a second queue.** An archive is a graveyard with better branding, and its
existence teaches agents that purge is reversible by browsing, which restores the pile in a different
location.

**Return.** A human-originated item can come back by resubmission, protocol-compliant, if it still
matters. Resubmission is a new admission with the usual gates, and the purge record links forward to it
so the history stays connected. The resubmission requirement is the filter.

## What is deliberately not automated

Purge is destructive and irreversible by design, and this implementation **does not apply it**. It
computes the verdict and reports it. Wiring an automatic purge is an operator decision, because the
first run against a real backlog will name items that a person may want to look at before they leave
the work store.

That gap is stated rather than left implied. A protocol that says work is purged, shipped with nothing
that purges, would otherwise read as enforced.
