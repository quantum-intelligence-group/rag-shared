// The Descent Protocol's return half: the chain record.
//
// A DEPTH LIMIT WITHOUT A VERIFIED RETURN IS HALF A CONTROL. An agent that descends once, completes
// the depth-1 work perfectly, and never resumes the original task has not recursed. It has ABANDONED,
// and the outcome is the same: the assigned work did not ship.
//
// The chain is the unit and it closes on return. Opening one is a recorded event naming what is being
// left; closing it is a recorded event showing the return happened. Both are cheap and both are
// machine-checkable, which is the whole reason the protocol asks for them rather than for diligence.
//
// THE STACK MUST BE EXPLICIT. Before descending, the agent states what it is returning to: the depth-0
// item and the state it is in. Holding that only in context is the failure, because context is exactly
// what a long descent degrades, and an agent three hours into a discovered defect has no reliable
// memory of what it interrupted.
//
// The distinction worth instrumenting is not depth. It is the last two rows of the protocol's return
// table: an agent whose depth-1 work is still open has an OPEN chain, and an agent that drifted to
// unrelated depth-0 work without closing has ABANDONED one. Without a record those look identical to
// finishing.

export const OPEN = 'open', RETURNED = 'returned', ABANDONED = 'abandoned', ORPHANED = 'orphaned';
export const STATES = Object.freeze([OPEN, RETURNED, ABANDONED, ORPHANED]);
export const STORE_REL = 'docs/state/chains';

/** PURE. A chain opens by naming what is being left. */
export function openChain({ id, parent, parentState, locus, now = new Date() } = {}) {
  const missing = [];
  if (!id) missing.push('id');
  if (!parent) missing.push('parent (the depth-0 item being left)');
  if (!parentState || !String(parentState).trim()) {
    missing.push('parentState (the state it is in, so the return is verifiable by something other than recollection)');
  }
  if (missing.length) return { ok: false, why: `cannot open a chain without ${missing.join(', ')}` };
  return { ok: true, chain: {
    id, parent, parent_state: String(parentState).trim(), locus: locus ?? null,
    state: OPEN, opened_at: now.toISOString(), closed_at: null, outcome: null,
  } };
}

/**
 * PURE. Close a chain. The outcome matters more than the closing.
 *
 * `returned` and `abandoned` are BOTH clean closes in the protocol's table when the depth-1 work is
 * complete or deliberately given up with findings captured. What is not a return is depth-1 work left
 * open, and what is abandonment is drifting to unrelated depth-0 work without closing at all.
 */
export function closeChain(chain, { outcome, now = new Date() } = {}) {
  if (chain == null) return { ok: false, why: 'no chain to close; not measured is not closed' };
  if (chain.state !== OPEN) return { ok: false, why: `chain ${chain.id} is already ${chain.state}` };
  if (![RETURNED, ABANDONED, ORPHANED].includes(outcome)) {
    return { ok: false, why: `outcome must be one of ${[RETURNED, ABANDONED, ORPHANED].join(', ')}, got ${JSON.stringify(outcome)}` };
  }
  return { ok: true, chain: { ...chain, state: outcome, outcome, closed_at: now.toISOString() } };
}

/**
 * The measurement the protocol calls its headline: chains returned over chains opened.
 * More informative than the depth limit itself, because a fleet that never exceeds depth 1 but returns
 * on half its chains is losing assigned work at scale.
 *
 * THREE STATES. `chains === null` means the store could not be read, and that is not an empty store:
 * reporting 0 open chains because nothing could be read is the flattering answer to a question that
 * was never asked.
 */
export function report(chains, { now = Date.now() } = {}) {
  if (chains == null) return { measured: false, why: 'the chain store could not be read' };
  const open = chains.filter((c) => c && c.state === OPEN);
  const aged = open.map((c) => ({ ...c, ageHours: Math.floor((now - Date.parse(c.opened_at)) / 3600000) }))
    .filter((c) => Number.isFinite(c.ageHours))
    .sort((a, b) => b.ageHours - a.ageHours);
  const opened = chains.length;
  const returned = chains.filter((c) => c && c.state === RETURNED).length;
  return {
    measured: true, opened, returned,
    abandoned: chains.filter((c) => c && c.state === ABANDONED).length,
    orphaned: chains.filter((c) => c && c.state === ORPHANED).length,
    open: open.length,
    // null, not 1, when nothing has been opened. A ratio over zero is not a perfect score.
    returnRate: opened ? returned / opened : null,
    oldestOpenHours: aged.length ? aged[0].ageHours : null,
    aged,
  };
}
