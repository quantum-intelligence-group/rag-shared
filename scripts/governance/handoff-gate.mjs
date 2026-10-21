// The Handoff Protocol, at the session boundary.
//
// A handoff arrives as a document from someone who knew more about this item than you do, written by
// a session that did the work. Every instinct treats it as a foundation. It is a REPORT. Reports are
// read, weighed and checked; foundations are built on without looking.
//
// Two things make that distinction survivable, and both are mechanical.
//
// 1. PROVENANCE TAGGING. Every claim line carries one of four tags. The collapse this prevents is
//    specifically between [decided] and [proposed]: an agent proposes an approach, the operator says
//    "sounds good" or says nothing, and by the time it reaches a summary it is "we decided". Six weeks
//    later nobody can tell which it was. Four tags, not two, because [assumed] is the highest-value
//    one and it has nowhere else to live.
//
// 2. DERIVED STATE, NOT NARRATED STATE. The agent writes the reasoning; the MACHINE writes the state.
//    None of the derived block is typed by the agent, and so none of it can be wrong in the direction
//    the agent wishes. "Built, tested" stops being a possible summary.
//
// STALENESS IS DIVERGENCE, NOT AGE. A handoff written an hour ago on a since-rebased branch is stale.
// One written six weeks ago on an untouched module is not. The derived block carries a fingerprint and
// staleness is fingerprint mismatch. There is no second mechanism.

export const TAGS = Object.freeze(['decided', 'proposed', 'observed', 'assumed']);
export const TAG_RE = new RegExp(`\\[(${TAGS.join('|')})\\]`, 'i');
export const DERIVED_OPEN = '<!-- derived: machine-written, do not edit -->';
export const DERIVED_CLOSE = '<!-- /derived -->';

export const OK = 'OK', REFUSED = 'REFUSED', NOT_MEASURED = 'NOT-MEASURED';

/** Lines that carry no claim and therefore need no provenance. */
export function isProse(line) {
  const t = line.trim();
  if (t === '') return false;
  if (/^#{1,6}\s/.test(t)) return false;            // headings
  if (/^```/.test(t)) return false;                 // fence
  if (/^[-*_]{3,}$/.test(t)) return false;          // rule
  if (/^\|/.test(t)) return false;                  // table row
  if (/^>/.test(t)) return false;                   // quote
  if (/^<!--/.test(t)) return false;                // comment
  return true;
}

/**
 * PURE. Validate ONE handoff entry.
 * THREE STATES: `entry == null` means the entry could not be read, which is not the same as an entry
 * with no problems. A check that could not look has cleared nothing.
 */
export function evaluateEntry(entry, { derivedExpected = null } = {}) {
  if (entry == null) {
    return { state: NOT_MEASURED, reasons: ['H0: the handoff entry could not be read. Not measured is not passing.'] };
  }
  const lines = String(entry).split('\n');
  const reasons = [];

  // --- the derived block ---
  const oi = lines.findIndex((l) => l.includes(DERIVED_OPEN));
  const ci = lines.findIndex((l) => l.includes(DERIVED_CLOSE));
  if (oi === -1 || ci === -1 || ci < oi) {
    reasons.push('H1: no machine-written derived block. The agent writes the reasoning, the machine writes the state; '
      + 'without the derived block a handoff is a claim about a tree the writer is no longer looking at.');
  } else if (derivedExpected != null) {
    // Compare the FINGERPRINT, not the block text. The block also reports context that moves on its
    // own - working tree, diff size, timestamp - and comparing those verbatim made a handoff stale
    // the moment its own file was edited. The fingerprint is the divergence signal; the rest is
    // reporting.
    const fp = (t) => (/^fingerprint:\s*(\S+)\s*$/m.exec(String(t)) || [])[1] ?? null;
    const got = fp(lines.slice(oi + 1, ci).join('\n'));
    const want = fp(derivedExpected);
    if (got == null) {
      reasons.push('H2: the derived block carries no fingerprint, so staleness cannot be judged at all. Regenerate it.');
    } else if (want == null) {
      reasons.push('H2: the generator produced no fingerprint to compare against, so this was NOT checked.');
    } else if (got !== want) {
      reasons.push(`H2: the derived block's fingerprint (${got}) does not match the tree now (${want}). `
        + 'Item, depth, parent, branch, base or diagnosis verdict has moved since this was written. '
        + 'Staleness is divergence, not age: regenerate and reconcile before acting on it.');
    }
  }

  // --- provenance tags, outside the derived block and outside code fences ---
  let inFence = false, inDerived = false, untagged = 0, prevWasProse = false;
  const firstFew = [];
  lines.forEach((line, i) => {
    if (/^```/.test(line.trim())) { inFence = !inFence; return; }
    if (line.includes(DERIVED_OPEN)) { inDerived = true; return; }
    if (line.includes(DERIVED_CLOSE)) { inDerived = false; return; }
    if (inFence || inDerived) return;
    if (line.trim() === '') { prevWasProse = false; return; }
    if (!isProse(line)) { prevWasProse = false; return; }
    // Only the FIRST line of a paragraph carries the claim. Requiring a tag on every wrapped line
    // would mean re-tagging mid-sentence, which makes the tags noise and gets them stripped.
    if (prevWasProse) return;
    prevWasProse = true;
    if (!TAG_RE.test(line)) {
      untagged++;
      if (firstFew.length < 3) firstFew.push(`line ${i + 1}: "${line.trim().slice(0, 62)}"`);
    }
  });
  if (untagged > 0) {
    reasons.push(`H3: ${untagged} claim line(s) carry no provenance tag. Untagged prose is not a handoff, it is a note. `
      + `Tag each with one of ${TAGS.map((t) => `[${t}]`).join(' ')} — ${firstFew.join('; ')}`);
  }

  return { state: reasons.length ? REFUSED : OK, untagged, reasons };
}

/** The newest entry in a HANDOFF.md, which is the one this session wrote (file is newest-first). */
/**
 * PURE. Every entry in the file, newest first.
 *
 * ONE PARSER. `newestEntry` is this function's first element and nothing else splits the file, because
 * a second reader of one corpus is how two controls come to disagree about what an entry is.
 */
export function allEntries(text) {
  if (text == null) return null;
  const body = String(text).replace(/^---\n[\s\S]*?\n---\n/, '');   // strip frontmatter
  const marks = [...body.matchAll(/^##\s+.*$/gm)];
  return marks.map((m, i) => body.slice(m.index, i + 1 < marks.length ? marks[i + 1].index : body.length));
}

export function newestEntry(text) {
  const all = allEntries(text);
  return all == null || all.length === 0 ? null : all[0];
}

// ---------------------------------------------------------------------------------------------
// CLI: handoff-gate.mjs [--gate]
// Validates the NEWEST entry in docs/state/HANDOFF.md, which is the one this session wrote.
// Exit 0 passed · 1 refused · 2 could not run. Never invoked with `|| true`.
//
// Deliberately scoped to the newest entry. Every historical entry predates the protocol and would
// refuse; a gate that fails on day one for reasons nobody can act on is a gate that gets disabled.
// This binds what THIS session writes, which is the whole point of enforcing it on ourselves first.
// ---------------------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { derive, render } = await import('../state/handoff-derive.mjs');
  const REPO = process.env.QOS_REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

  let text = null;
  try { text = fs.readFileSync(path.join(REPO, 'docs/state/HANDOFF.md'), 'utf8'); } catch { text = null; }
  if (text == null) {
    console.error('handoff-gate (Handoff Protocol) — NOT MEASURED: docs/state/HANDOFF.md could not be read.');
    process.exit(2);
  }
  const entry = newestEntry(text);
  if (entry == null) {
    console.error('handoff-gate (Handoff Protocol) — REFUSED: HANDOFF.md carries no entry. A session that ends without one leaves the next session to reconstruct it.');
    process.exit(1);
  }

  // Compare the entry's derived block against what the generator produces NOW, minus the timestamp:
  // staleness is divergence, so only tree facts are compared.
  const fresh = derive(REPO);
  const { derived_at, ...treeFacts } = fresh;
  const expected = render({ ...treeFacts, derived_at: '<generated>' });
  const normalise = (s) => String(s).replace(/^derived_at:.*$/m, 'derived_at: <generated>');

  const oi = entry.indexOf(DERIVED_OPEN), ci = entry.indexOf(DERIVED_CLOSE);
  const present = oi !== -1 && ci > oi ? normalise(entry.slice(oi + DERIVED_OPEN.length, ci).trim()) : null;

  const r = evaluateEntry(entry, { derivedExpected: present == null ? null : render(fresh) });
  if (r.state === NOT_MEASURED) {
    console.error('handoff-gate (Handoff Protocol) — NOT MEASURED');
    for (const why of r.reasons) console.error(`  ? ${why}`);
    process.exit(2);
  }
  if (r.state === REFUSED) {
    console.error('handoff-gate (Handoff Protocol: a handoff is a report, not a foundation) — REFUSED');
    for (const why of r.reasons) console.error(`  ✖ ${why}`);
    console.error(`  Regenerate the derived block with: node scripts/state/handoff-derive.mjs`);
    process.exit(1);
  }
  console.error('handoff-gate (Handoff Protocol) — PASS: newest entry is tagged and its derived block matches the tree');
  process.exit(0);
}
