#!/usr/bin/env node
/**
 * UNDECLARED DESCENT (Descent Protocol) — the blind spot, closed.
 *
 * The descent gate enforces that a DECLARED descent is well formed, and says plainly in its own comment
 * that "an agent that descends and writes no Depth: trailer looks exactly like one doing assigned work".
 * That was treated as a permanent limit. It is not.
 *
 * MEASURED 2026-09-24, on the session that wrote the gate: 16 commits after it began enforcing, ZERO
 * carrying Depth: or Parent:, and NINE items allocated inside eighty minutes, each spawned by a finding
 * while working the previous one. A chain about ten deep against a limit of one, entirely invisible,
 * because every link was filed as fresh top-level work.
 *
 * THE SIGNAL THE GATE WAS MISSING IS NOT IN THE MESSAGE. It is in the id.
 *
 * An item whose allocation record was created AFTER the session started was not assigned to the session;
 * the session invented it. That is discovered work by definition, whatever the commit says. So the
 * protocol becomes checkable: discovered work declares `Depth:` and names its `Parent:`, or it is
 * undeclared descent and is refused.
 *
 * WHY THIS MATTERS MORE THAN THE COUNT. Undeclared descent is what turns one fix into a ten-deep chain,
 * and that chain is what produced the rebase storm the same session then blamed on the protocols. The
 * limit of one exists to stop exactly that, and it cannot stop anything it cannot see.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ITEM_PREFIX_SRC } from './item-namespaces.mjs';

export const OK = 'OK', REFUSED = 'REFUSED', NOT_MEASURED = 'NOT-MEASURED';
/**
 * THE SUBJECT LINE'S LEADING ID, not the first id anywhere in the message.
 *
 * Caught by the conformance report on a real fleet commit: `chore(queue): publish 1 status flip(s)` whose
 * BODY mentioned B-1221, judged as though B-1221 were its subject. Naming another item in prose is not
 * claiming to be that item, and this repository has tripped the same wire before on the delivery ratchet.
 * A commit whose subject carries no id is not item-scoped and is not judged here.
 */
// Every family namespace, not `B-` alone (B-11746): with `B-` alone this gate judged nothing in ace (`BL-`)
// or in the five members whose items are T-, LS-, PULSE-, QHI- and QCI-.
export const ITEM_RE = new RegExp(`^\\s*(${ITEM_PREFIX_SRC}-\\d+)\\b`);
export const DEPTH_RE = /^Depth:\s*(.+?)\s*$/m;
export const PARENT_RE = /^Parent:\s*(.+?)\s*$/m;
/**
 * An id minted mid-session is USUALLY discovered work, and is not always. An operator can assign new work
 * in the middle of a session, and that work needs a new id like anything else. Without a way to say so,
 * this check refuses a legitimate assignment and becomes the thing it was built to prevent: a correct
 * rule that refuses work which could not have complied.
 *
 * Found by the gate refusing its OWN first declaration. The remedy is not to relax the rule but to give
 * the true case a way to be stated, and to require it be stated rather than inferred: `Assigned:` must
 * name a source, so nobody can claim it by writing nothing.
 */
export const ASSIGNED_RE = /^Assigned:\s*(\S.*?)\s*$/m;

/**
 * PURE. Is this commit undeclared descent?
 *
 * THREE STATES, and the middle one carries the weight. An item with NO allocation timestamp is not
 * assumed innocent: it is NOT-MEASURED, because "we could not tell when this id was minted" is a
 * different claim from "this id predates the session", and defaulting the first to the second is the
 * flattering answer that would let every descent through on a read failure.
 */
export function judge({ message, onMain } = {}) {
  if (typeof message !== 'string') {
    return { state: NOT_MEASURED, why: 'the commit message could not be read' };
  }
  const item = (ITEM_RE.exec(message) || [])[1] || null;
  if (!item) return { state: OK, why: 'no item id in the message: nothing to judge as descent' };
  // NOT A TIMESTAMP, AND THE FIRST VERSION'S FAILURE IS THE REASON.
  //
  // It compared the allocation time against the session's `started_at`, and the pre-commit hook creates a
  // DRAFT session when none is live. Measured: id minted 23:30:00, draft session stamped 23:33:38, three
  // minutes later. Every discovered item therefore "predates the session" and the gate passes everything,
  // forever. It would have shipped to sixteen repositories enforcing nothing, which is the exact shape of
  // "a control that is wired and enforces nothing" this repo has recorded four times.
  //
  // The durable question is not when, it is WHERE. An allocation record that is not yet on origin/main is
  // an id this line of work minted; one that is already there was minted before and handed over. A branch
  // cannot backdate that, and no hook resets it.
  if (onMain === undefined || onMain === null) {
    return { state: NOT_MEASURED, item,
      why: `whether ${item}'s allocation record is already on origin/main could not be determined, so a `
        + 'freshly minted id cannot be told from an inherited one. Unknown is not "it was assigned".' };
  }
  if (onMain === true) {
    return { state: OK, item, why: `${item}'s allocation record is already on origin/main: inherited work` };
  }
  const assigned = ASSIGNED_RE.exec(message);
  if (assigned) {
    return { state: OK, item, assigned: assigned[1],
      why: `${item} was minted this session and is declared assigned by ${assigned[1]}, not discovered` };
  }
  const declared = DEPTH_RE.exec(message);
  const parent = PARENT_RE.exec(message);
  if (declared && parent) {
    return { state: OK, item, declared: declared[1],
      why: `${item} was minted this session and the descent is declared` };
  }
  return { state: REFUSED, item,
    why: `${item} was allocated during this session, so it is work this session discovered rather than `
      + 'work it was given, and the commit declares no descent. Add `Depth: 1` and `Parent: <the item you '
      + 'were working when you found this>`, or `Assigned: <who gave it to you>` if this is new work you '
      + 'were handed rather than found. Nine items were minted in '
      + 'eighty minutes on 2026-09-24 with no declaration, a chain ten deep against a limit of one, and '
      + 'the limit could not bind because nothing could see the chain.' };
}

/** IMPURE. Is this item's allocation record already on origin/main? null when it cannot be determined. */
export function allocationOnMain(item, { repo, run } = {}) {
  const exec = run || ((args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] }));
  try {
    exec(['cat-file', '-e', `origin/main:docs/planning/id-allocations/${item}.json`]);
    return true;
  } catch (e) {
    // A missing OBJECT is a real answer; a git that could not run is not.
    if (e && typeof e.status === 'number') return false;
    return null;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const REPO = process.env.QOS_REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  let message = null;
  try { message = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null; } catch { message = null; }
  const item = (ITEM_RE.exec(String(message ?? '')) || [])[1];
  const onMain = item ? allocationOnMain(item, { repo: REPO }) : true;
  const r = judge({ message, onMain });
  const mark = { [OK]: '\u2713', [REFUSED]: '\u2716', [NOT_MEASURED]: '?' }[r.state];
  console.error(`undeclared-descent (Descent Protocol) — ${mark} ${r.state}: ${r.why}`);
  process.exit(r.state === REFUSED ? 1 : r.state === NOT_MEASURED ? 2 : 0);
}
