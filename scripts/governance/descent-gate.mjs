// The Descent Protocol, at the commit boundary.
//
// Discovered work is governed work, and it goes ONE level deep. An agent working an assigned item
// (depth 0) may descend once into something it discovers (depth 1). It may never descend from there.
// Depth 2 is captured, not worked.
//
// WHY A HARD STOP RATHER THAN A BUDGET. The limit is the one control in the protocol that is not a
// judgment call, and that is deliberate: every other rule can be reasoned about in the moment, and an
// agent three levels down reasoning about whether this one is worth it has already lost the thread it
// was sent to pull. So the gate does not weigh value. It refuses.
//
// WHAT THIS GATE CAN AND CANNOT SEE. It reads the commit message. An agent that descends and writes
// no Depth: trailer is indistinguishable here from one doing assigned work, and that is stated in the
// protocol as a behavioural limit rather than papered over. What the gate does enforce is that a
import { ITEM_PREFIX_SRC } from './item-namespaces.mjs';

// DECLARED descent is well-formed: bounded, parented to real open work, and scoped to one item.

export const DEPTH_RE  = /^Depth:\s*(.+?)\s*$/m;
export const PARENT_RE = /^Parent:\s*(.+?)\s*$/m;
export const SCOPE_RE  = /^Scope:\s*(.+?)\s*$/m;
// Not exported with /g: a shared global regex carries lastIndex between calls, which makes results
// depend on call order. Callers build their own with `itemIds()`.
export const ITEM_SRC = `\\b${ITEM_PREFIX_SRC}-\\d{2,6}\\b`;
export const itemIds = (text) => String(text ?? '').match(new RegExp(ITEM_SRC, 'g')) || [];

export const MAX_DEPTH = 1;

export const OK = 'OK', REFUSED = 'REFUSED', NOT_APPLICABLE = 'NOT-APPLICABLE';

/**
 * PURE. `openItems` is the set of item ids currently open; pass null when it could not be read.
 * THREE STATES: a parent that cannot be checked is NOT the same as a parent that is absent. An
 * unreadable backlog must not silently license every Parent: value, so it refuses with a reason
 * naming the unread source rather than passing.
 */
export function evaluate(message, { openItems = null, changedPaths = undefined } = {}) {
  const msg = String(message ?? '');
  const reasons = [];

  const dm = DEPTH_RE.exec(msg);
  const pm = PARENT_RE.exec(msg);

  if (!dm && !pm) return { state: NOT_APPLICABLE, depth: null, reasons: [],
    why: 'no Depth: or Parent: trailer — treated as assigned work at depth 0' };

  let depth = null;
  if (dm) {
    const raw = dm[1];
    if (!/^\d+$/.test(raw)) {
      reasons.push(`D1: Depth must be a single non-negative integer, got "${raw}". Depth is one integer on the work record and it is the only thing distinguishing discovered work from assigned work.`);
    } else {
      depth = Number(raw);
      if (depth > MAX_DEPTH) {
        reasons.push(`D2: Depth ${depth} exceeds the limit of ${MAX_DEPTH}. Something discovered while working depth 1 is CAPTURED, not worked — capture it with \`node scripts/backlog/capture.mjs --locus <path> \"<what you saw>\"\` and return to the depth-${MAX_DEPTH} item. This is a hard stop, not a budget.`);
      }
    }
  }

  if (pm && depth === 0) {
    reasons.push('D3: Parent: is declared at Depth: 0. Depth 0 is assigned work and has no parent; if this was discovered while working something else, its depth is 1.');
  }

  if (depth === 1) {
    if (!pm) {
      reasons.push('D4: Depth 1 declares discovered work but names no Parent:. A descent without a recorded return point is an abandonment — state the depth-0 item you are returning to.');
    } else {
      const parent = pm[1].trim();
      const ids = itemIds(parent);
      if (ids.length !== 1) {
        reasons.push(`D5: Parent: must name exactly one item id, got ${ids.length} in "${parent}".`);
      } else if (openItems === null) {
        reasons.push(`D6: Parent: names ${ids[0]} but the open-item set could not be read, so this cannot be checked. An unread source is not a passing one.`);
      } else if (!openItems.has(ids[0])) {
        reasons.push(`D7: Parent: names ${ids[0]}, which is not an open item. The stack must be explicit and real — you cannot return to something that is not there.`);
      }
    }
  }

  // Separation: one item id per commit. The subject line carries the item this commit delivers;
  // Parent: is excluded because naming what you will return to is the point of the trailer.
  const body = msg.replace(PARENT_RE, '');
  const subjectIds = [...new Set(itemIds(body))];
  if (subjectIds.length > 1) {
    reasons.push(`D8: this commit names ${subjectIds.length} item ids (${subjectIds.join(', ')}). One item id per commit: work that serves two items is two commits, or the second is a descent and carries its own Depth:.`);
  }

  // SEPARATION, AND IT IS THE CONTROL THE OTHER TWO REST ON.
  //
  // A depth-1 fix merged into the depth-0 diff is invisible to every gate in the system no matter how
  // well it complies, because the gates read the commit and the commit says it is the parent task. The
  // Correction Loop already flags a diff touching paths outside an item's declared scope, and that check
  // fails SILENTLY when two items share one commit: the union of two scopes covers everything either one
  // touches. So separation is not hygiene, it is the precondition for the existing control to work.
  const sm = SCOPE_RE.exec(msg);
  if (depth === 1 && !sm) {
    reasons.push('D9: Depth 1 declares no Scope:. Discovered work lands against its own declared file '
      + 'scope, or the parent item\'s scope silently widens to cover it and the drift check stops seeing anything.');
  }
  if (sm && Array.isArray(changedPaths)) {
    const declared = sm[1].split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
    const outside = changedPaths.filter((f) => !declared.some((d) => f === d || f.startsWith(d.replace(/\/*$/, '/'))));
    if (outside.length) {
      reasons.push(`D10: ${outside.length} changed path(s) fall outside the declared Scope: `
        + `${outside.slice(0, 3).join(', ')}${outside.length > 3 ? ', …' : ''}. `
        + 'Either amend the scope, if those paths genuinely serve this specification, or split the commit, '
        + 'if they serve a different intention. Amending is often right; a RISING amendment rate is the signal.');
    }
  } else if (sm && changedPaths === null) {
    reasons.push('D11: Scope: is declared but the changed-path list could not be read, so nothing was '
      + 'compared. An unread diff is not a diff that stayed in scope.');
  }

  return { state: reasons.length ? REFUSED : OK, depth, parent: pm ? pm[1].trim() : null,
    scope: sm ? sm[1].trim() : null, reasons };
}

// ---------------------------------------------------------------------------------------------
// CLI: descent-gate.mjs <commit-msg-file>
// Exit 0 passed · 1 refused (each reason named) · 2 the check could not run.
// Never invoked with `|| true`: a gate that could not look has cleared nothing (R-14.4).
// ---------------------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const file = process.argv[2];
  if (!file) { console.error('descent-gate: usage: descent-gate.mjs <commit-msg-file>'); process.exit(2); }

  let message;
  try { message = fs.readFileSync(file, 'utf8'); }
  catch (e) { console.error(`descent-gate: could not read ${file} (${e?.code || e?.message})`); process.exit(2); }

  // Open items, read from the backlog. Unreadable stays NULL so `evaluate` can refuse rather than pass.
  const REPO = process.env.QOS_REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  let openItems = null;
  try {
    const text = fs.readFileSync(path.join(REPO, 'docs/planning/BACKLOG.md'), 'utf8');
    openItems = new Set();
    for (const m of text.matchAll(new RegExp(`^###\\s+(${ITEM_PREFIX_SRC}-\\d{2,6}):[^\\n]*\\n([\\s\\S]{0,400}?)(?=\\n###|\\n##|$)`, 'gm'))) {
      if (!/\*\*Status:\*\*\s*(Done|Retired|Archived|Cancelled|Closed)/i.test(m[2])) openItems.add(m[1]);
    }
  } catch { openItems = null; }

  // THE STAGED PATHS, so the scope rule compares against a real diff rather than nothing. Unreadable
  // stays null, and `evaluate` refuses on null rather than passing: an unread diff is not a diff that
  // stayed in scope, which is the same doctrine as exit 2 blocking everywhere else.
  let changedPaths = null;
  try {
    const cp = await import('node:child_process');
    const out = cp.execFileSync('git', ['-C', REPO, 'diff', '--cached', '--name-only'],
      { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'ignore'] });
    changedPaths = String(out).split('\n').map((x) => x.trim()).filter(Boolean);
  } catch { changedPaths = null; }

  const r = evaluate(message, { openItems, changedPaths });
  if (r.state === REFUSED) {
    console.error('descent-gate (the Descent Protocol: discovered work goes ONE level deep) — REFUSED');
    for (const why of r.reasons) console.error(`  ✖ ${why}`);
    console.error('  Depth: 0 assigned · Depth: 1 discovered, with Parent: naming the item you return to · deeper is captured, not worked.');
    process.exit(1);
  }
  // OPEN THE CHAIN HERE, because this is the only moment the information exists. The commit declares
  // what is being left and the state it is in; a minute later that lives only in a context window,
  // which is exactly what a long descent degrades.
  //
  // Written on a PASSING depth-1 commit only. Recording a chain for a commit that was refused would
  // populate the store with descents that never happened, and the return rate is the headline metric -
  // a denominator inflated by refusals would make the fleet look worse than it is and the number
  // useless either way.
  if (r.state === OK && r.depth === 1 && r.parent) {
    try {
      const { openChain, STORE_REL } = await import('./chain-record.mjs');
      const c = openChain({ id: `${r.parent}-${Date.now().toString(36)}`, parent: r.parent,
        parentState: r.scope ? `scope ${r.scope}` : 'state not stated', locus: r.scope });
      if (c.ok) {
        const dir = path.join(REPO, STORE_REL);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${c.chain.id}.json`), `${JSON.stringify(c.chain, null, 2)}\n`);
      }
    } catch { /* the record is bookkeeping; losing it must never convert a PASS into a refusal */ }
  }

  const label = r.state === 'NOT-APPLICABLE' ? 'NOT-APPLICABLE: no Depth:/Parent: trailer (assigned work, depth 0)'
    : `PASS: depth ${r.depth}${r.parent ? ` under ${r.parent}` : ''}`;
  console.error(`descent-gate (Descent Protocol) — ${label}`);
  process.exit(0);
}
