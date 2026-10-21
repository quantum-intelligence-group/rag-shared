// The Reconciliation Protocol: work that stops moving is purged, not held.
//
// A backlog that only grows is not a backlog, it is a pile, and a pile teaches everyone who looks at
// it that nothing in it will ever be done. This protocol puts a clock on items and purges what cannot
// move, so that what remains is credible.
//
// OWNERSHIP IS THE REPOSITORY, NOT A PERSON. An earlier design required every item to name an
// individual originator with a reachable channel. That is the wrong shape: people leave, agents are
// retired, and an item whose owner evaporated becomes unroutable through an administrative accident
// rather than through anything about the work. The repository owns the item; the Mission Control
// operator owns the repository. The unroutable case collapses to one condition, the repository is
// gone, and an item in a repository that no longer exists is purged without ceremony.
//
// PURGE IS NOT ARCHIVAL TO A SECOND QUEUE. An archive is a graveyard with better branding, and its
// existence teaches agents that purge is reversible by browsing, which restores the pile in a
// different location. The item leaves the work store; its RECORD stays, permanently.

export const OK = 'OK', REFUSED = 'REFUSED', NOT_MEASURED = 'NOT-MEASURED';

// Clock states. Only one of them is a waiting period.
export const NO_CLOCK   = 'no-clock';    // queued, not yet at the head: waiting its turn is legitimate
export const IMMEDIATE  = 'immediate';   // at the head and unclaimable: broken now, no waiting period
export const RUNNING    = 'running';     // claimed, then stopped moving
export const PAUSED     = 'paused';      // correction requested and undispatched: not the item's fault
export const UNKNOWN    = 'unknown';     // could not be determined; never treated as healthy

export const AGENT_BUDGET_MS = 24 * 60 * 60 * 1000;        // 24 hours
export const HUMAN_BUDGET_MS = 30 * 24 * 60 * 60 * 1000;   // 30 days

/** What the Correction Loop, Root Cause and Descent protocols require of an item that is to be worked. */
export const REQUIREMENTS = Object.freeze([
  { key: 'spec',       label: 'a spec stating behaviour under constraints', source: 'Correction Loop, step 3' },
  { key: 'acceptance', label: 'an executable acceptance criterion',         source: 'Correction Loop, step 3' },
  { key: 'scope',      label: 'a declared file scope',                      source: 'Correction Loop, step 4' },
  { key: 'diagnosis',  label: 'a diagnosis artifact',                       source: 'Root Cause Protocol', onlyIf: (i) => i.defectClass && i.pastOrderingPoint },
  { key: 'parent',     label: 'a depth and parent',                         source: 'Descent Protocol',     onlyIf: (i) => i.discovered },
]);

/**
 * TEST 1 — COMPLIANCE. Can this item satisfy the protocols as they now stand?
 * Most failures are REPAIRABLE, and reconciliation attempts the repair before it purges: an item that
 * can be brought into compliance is brought into compliance, and only what cannot be is purged. The
 * unrepairable cases are the ones where the information is gone.
 */
export function complianceTest(item) {
  if (item == null) return { state: NOT_MEASURED, missing: null, repairable: null };
  const missing = [];
  for (const r of REQUIREMENTS) {
    if (r.onlyIf && !r.onlyIf(item)) continue;
    if (!item[r.key]) missing.push({ key: r.key, label: r.label, source: r.source });
  }
  // Repairable unless the information needed to repair it is gone. A spec can be written; an
  // observation nobody recorded cannot be recovered.
  const repairable = missing.every((m) => m.key !== 'diagnosis' || item.reproducible !== false);
  return { state: missing.length ? REFUSED : OK, missing, repairable };
}

/**
 * TEST 2 — THE CLOCK. Three conditions, and only one is a waiting period.
 *
 * ACKNOWLEDGEMENT DOES NOT RESET IT, and comments are not movement. If saying something counted as
 * moving, the clock would measure attention rather than progress, and the items that attract the most
 * discussion are exactly the ones that move least.
 */
export function clockState(item, { now = Date.now() } = {}) {
  if (item == null) return { clock: UNKNOWN, why: 'item could not be read' };

  if (item.repositoryGone) {
    return { clock: IMMEDIATE, overdue: true, why: 'the repository that owned this item no longer exists; there is no owner and nothing to route to' };
  }
  if (item.correctionRequested && !item.correctionDispatched) {
    return { clock: PAUSED, overdue: false, why: 'a correction was requested and has not been dispatched; the item is not failing to move, it is waiting on the network' };
  }
  if (!item.claimed) {
    if (!item.atHead) {
      return { clock: NO_CLOCK, overdue: false, why: 'queued but not at the head of the claim order; waiting its turn is legitimate' };
    }
    if (item.claimFailed) {
      return { clock: IMMEDIATE, overdue: true, why: 'at the head of the claim order and cannot be claimed. It is broken now, and waiting adds nothing to a diagnosis one claim attempt already produced' };
    }
    return { clock: NO_CLOCK, overdue: false, why: 'at the head and claimable; no clock' };
  }
  // Claimed. Has it moved?
  if (item.lastMovement == null) {
    return { clock: UNKNOWN, overdue: false, why: 'claimed, but the last movement could not be read. Unknown is not healthy and must not be counted as moving' };
  }
  const budget = item.originKind === 'human' ? HUMAN_BUDGET_MS : AGENT_BUDGET_MS;
  const idle = now - item.lastMovement;
  return {
    clock: RUNNING, overdue: idle > budget, idleMs: idle, budgetMs: budget,
    why: idle > budget
      ? `claimed and has not moved for ${Math.round(idle / 3600000)}h against a ${Math.round(budget / 3600000)}h budget`
      : `claimed and moving within its ${Math.round(budget / 3600000)}h budget`,
  };
}

/** The permanent record a purge leaves. Nothing vanishes; anyone asking what happened gets an answer. */
export function purgeRecord(item, compliance, clock, { now = new Date() } = {}) {
  return {
    id: item.id, title: item.title ?? null, origin: item.origin ?? null,
    repository: item.repository ?? null,
    tests_failed: [
      ...(compliance.state === REFUSED ? [`compliance: missing ${compliance.missing.map((m) => m.key).join(', ')}`] : []),
      ...(clock.overdue ? [`clock: ${clock.why}`] : []),
    ],
    correction_requested: item.correctionRequested ?? false,
    date: now.toISOString().slice(0, 10),
    resubmission: null,   // filled in if it comes back, so the history stays connected
  };
}

/** Does this item purge now? Repair is attempted first; only what cannot be repaired is purged. */
export function verdict(item, { now = Date.now() } = {}) {
  const compliance = complianceTest(item);
  const clock = clockState(item, { now });
  if (compliance.state === NOT_MEASURED || clock.clock === UNKNOWN) {
    return { action: 'HOLD', compliance, clock, why: 'not measured, and an item that could not be read is never purged on that basis' };
  }
  if (clock.clock === PAUSED) return { action: 'HOLD', compliance, clock, why: clock.why };
  if (compliance.state === REFUSED && compliance.repairable) {
    return { action: 'REPAIR', compliance, clock, why: `repairable: ${compliance.missing.map((m) => m.label).join('; ')}` };
  }
  if (compliance.state === REFUSED || clock.overdue) {
    return { action: 'PURGE', compliance, clock, record: purgeRecord(item, compliance, clock), why: clock.overdue ? clock.why : 'cannot be brought into compliance; the information needed is gone' };
  }
  return { action: 'KEEP', compliance, clock, why: 'compliant and moving' };
}
