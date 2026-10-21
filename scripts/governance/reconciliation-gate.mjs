// The Reconciliation Protocol at the commit boundary: Test 1, compliance.
//
// WHY A HOOK AT ALL, WHEN THE PROTOCOL IS ABOUT PURGING. Reconciliation runs two tests over open work:
// can this item satisfy the protocols as they now stand, and is it moving? The second needs a clock, a
// work store and an ownership mapping this repository does not have yet. The FIRST is answerable right
// here, at the one moment the item is definitely being worked: its own commit.
//
// Checking it here is strictly cheaper than checking it later. An item that cannot satisfy the
// protocols is going to fail reconciliation eventually, and the difference between catching that now
// and catching it in a sweep is that now there is someone with the context to fix it. The protocol
// says most compliance failures are repairable and that reconciliation attempts the repair before it
// purges; the cheapest possible repair is the one made by the session that is already here.
//
// WHAT IT DOES NOT DO. It does not purge, it does not run a dormancy clock, and it does not judge
// whether work is worth keeping. The protocol is explicit that nothing may ask that question, because
// it has no defensible answer at the scale it has to be asked.

import { complianceTest, REQUIREMENTS, OK, REFUSED, NOT_MEASURED } from '../backlog/reconciliation.mjs';
import { ITEM_PREFIX_SRC } from './item-namespaces.mjs';

export { OK, REFUSED, NOT_MEASURED };

/** PURE. Read the fields Test 1 needs out of one backlog item's section. */
export function itemFacts(section) {
  if (section == null) return null;
  const t = String(section);
  return {
    spec: /\*\*(?:Scope|Owner)\:\*\*/.test(t) && t.replace(/^#.*$/m, '').trim().length > 120 ? true : false,
    acceptance: /\*\*Acceptance criteria\*\*/i.test(t),
    scope: /\*\*Scope:\*\*/.test(t),
    defectClass: /\*\*(?:Rules|Lane):\*\*/.test(t) && /defect|bug|fault|regression/i.test(t),
    pastOrderingPoint: false,       // the ordering rule is the diagnosis gate's question, not this one
    discovered: /^Depth:\s*1\b/m.test(t),
    parent: /\*\*Parent:\*\*|^Parent:/m.test(t),
    reproducible: true,
  };
}

/**
 * PURE. Evaluate one item.
 * THREE STATES: a section that could not be found is NOT an item that fails compliance. An item this
 * gate cannot read is one it has no business judging, and refusing on that basis would block commits
 * for a parsing failure rather than a defect.
 */
export function evaluateItem(section, { id = null } = {}) {
  if (section == null) {
    return { state: NOT_MEASURED, id,
      why: `the section for ${id ?? 'this item'} could not be read, so its compliance was not judged. `
        + 'An unread item is not a failing one.' };
  }
  const facts = itemFacts(section);
  const r = complianceTest(facts);
  if (r.state === OK) return { state: OK, id, missing: [] };
  return { state: REFUSED, id, missing: r.missing, repairable: r.repairable,
    why: `${id ?? 'this item'} cannot satisfy the protocols as they stand: missing `
      + `${r.missing.map((m) => m.label).join('; ')}. `
      + (r.repairable
        ? 'This is repairable, and repairing it now costs less than it will in a sweep, because you are the session with the context.'
        : 'The information needed to repair it is gone, which is the case reconciliation purges.') };
}

export const REQUIRED = REQUIREMENTS;

// ─────────────────────────────────────────────────────────────────────────────
// CLI — Reconciliation Test 1 at the commit boundary, as a RATCHET.
//
// THE NUMBER THAT DECIDED THIS SHAPE. Run across the whole backlog on 2026-09-24, Test 1 refuses
// 2150 of 2199 item sections (97.8%), essentially all for a missing executable acceptance criterion.
// A gate wired to block on that refuses every commit in the repository and is not a finding, it is
// an outage. That is the same failure as putting C3 in CI, where a correct check asked its question
// in a place that could not answer it (B-11241), and it was made once today already.
//
// So the gate judges only the item sections this commit ADDS. Pre-existing non-compliance is
// reported and not blocked, which is the ratchet idiom this repo already uses for guardrails and for
// the orphan baseline: existing debt is grandfathered, new debt is refused. The 2150 are the
// reconciliation SWEEP's work, and a sweep is a deliberate operator-run act with a correction-request
// path, not something a commit hook should do to a session that happened to touch the file.
// ─────────────────────────────────────────────────────────────────────────────

/** PURE. The item sections a diff ADDS, as {id, section}. Added lines only, '+' stripped. */
export function addedSections(diffText) {
  if (diffText == null) return null;                     // unreadable, not empty
  const added = String(diffText).split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .map((l) => l.slice(1)).join('\n');
  const out = [];
  for (const sec of added.split(/\n(?=###?\s)/)) {
    // EVERY ID NAMESPACE, AND WITHOUT THIS THE GATE JUDGED NONE OF 376 ITEMS HERE (B-11388).
    //
    // The matcher was /\bB-\d+\b/. This repository's control findings are FLT-nnn and the members use
    // their own prefixes, and `B-` followed by a word character does not match at a boundary. Counted
    // 2026-10-02: 92 FLT- headings in docs/planning/BACKLOG.md and 284 in docs/operations/CONTROL_BACKLOG.md
    // that this gate could never see. It was wired, it exited 0, and it was judging nothing, which is
    // the silent and FLATTERING failure: a clean verdict is indistinguishable from a compliant item.
    //
    // Alternation order matters: the longer prefixes must be tried first, or `B` wins on "BL-490" and
    // leaves a dangling "L".
    const id = (sec.match(new RegExp(`\\b${ITEM_PREFIX_SRC}-\\d+\\b`)) || [])[0];
    if (id && /^###?\s/.test(sec)) out.push({ id, section: sec });
  }
  return out;
}

/** PURE. The gate verdict for a set of added sections. */
export function gateVerdict(sections) {
  if (sections == null) {
    return { code: 2, state: NOT_MEASURED,
      lines: ['reconciliation-gate (Reconciliation Protocol, Test 1) — NOT-MEASURED: the staged diff '
        + 'could not be read, so no item was judged. A gate that could not look has cleared nothing.'] };
  }
  if (sections.length === 0) {
    return { code: 0, state: OK,
      lines: ['reconciliation-gate (Reconciliation Protocol, Test 1) — PASS: this commit adds no backlog item.'] };
  }
  const results = sections.map((s) => evaluateItem(s.section, { id: s.id }));
  const bad = results.filter((r) => r.state === REFUSED);
  if (bad.length === 0) {
    return { code: 0, state: OK,
      lines: [`reconciliation-gate (Reconciliation Protocol, Test 1) — PASS: ${results.length} new item(s), all compliant.`] };
  }
  return { code: 1, state: REFUSED,
    lines: ['reconciliation-gate (Reconciliation Protocol, Test 1) — ✖ REFUSE: '
      + `${bad.length} of ${results.length} new item(s) cannot satisfy the protocols as written.`,
      ...bad.map((r) => `  ✖ ${r.why}`),
      '  An item that cannot pass Test 1 is an item reconciliation will later purge. Fix it now, while',
      '  you are the session that still has the context, rather than filing work that is born expiring.',
      '  Protocol: docs/governance/RECONCILIATION_PROTOCOL.md'] };
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { execFileSync } = await import('node:child_process');
  let diff = null;
  try {
    diff = execFileSync('git', ['diff', '--cached', '-U0', '--', 'docs/planning/BACKLOG.md'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch { diff = null; }                                // UNREADABLE stays null, never ''
  const v = gateVerdict(addedSections(diff));
  console.error(v.lines.join('\n'));
  process.exit(v.code);
}
