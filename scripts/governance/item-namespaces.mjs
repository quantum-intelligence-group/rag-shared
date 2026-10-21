// item-namespaces.mjs, B-11746: The ONE list of backlog-item id prefixes the protocol gates recognise.
//
// The Descent, Handoff and Reconciliation gates are copied unedited into every family member. Each used
// to carry its own private prefix group, and none of them named the prefixes five members actually use
// (tower T, lodestar LS, qos-pulse PULSE, qos-health-intelligence QHI, qos-cost-intelligence QCI), so
// installed there they found no item in any commit and exited 0, which reads exactly like a clean pass.
// A member that numbers its items with a new prefix is added HERE, once, and every gate sees it.
//
// Deliberately NOT here: short prefixes that collide with ordinary tokens. `P-256` is an elliptic curve
// in operative's code and commit messages, so parallel's two `P-` items are not worth a gate that reads
// a curve name as a claimed item. A token that is not an item must stay invisible (B-11746 AC4).

export const ITEM_PREFIXES = Object.freeze([
  'B', 'BL', 'FLT', 'TA', 'WVR', // umbrella, ace and the fleet's own namespaces
  'T', 'LS', 'PULSE', 'QHI', 'QCI', // tower, lodestar, qos-pulse, health-intelligence, cost-intelligence
]);

// Longest first, so an alternation never stops at a shorter prefix that happens to start a longer one.
export const ITEM_PREFIX_SRC = `(?:${[...ITEM_PREFIXES].sort((a, b) => b.length - a.length).join('|')})`;
