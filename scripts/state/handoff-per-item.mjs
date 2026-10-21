#!/usr/bin/env node
/**
 * HANDOFFS ARE NOT ACCUMULATED — one per item, replaced each time.
 *
 * "A chain of six handoffs is a document nobody reads to the bottom of, and the older entries are
 * exactly the ones most likely to be stale and most likely to be quoted."
 *
 * MEASURED HERE BEFORE IT WAS BUILT: 15 entries, of which 5 name an item and 10 name nothing. No item
 * yet has two entries, so the rule is not currently broken - and nothing stopped it being broken, which
 * is a different fact and the reason this exists. Only the newest entry is injected at resume, so
 * entries 2 through 15 are carried, rotated and archived without ever being read.
 *
 * THE DEEPER GAP IS THE TEN WITH NO ITEM. "Replaced each time" is only possible if an entry says what it
 * is about; an entry naming no item cannot be superseded, because nothing can tell that a later entry is
 * its replacement. So the identity requirement is the load-bearing half, and the duplicate rule follows
 * from it.
 *
 * WHAT IT DOES NOT DO: it does not delete or rewrite an entry. The remedy for a second entry on an item
 * is for the author to FOLD the earlier one into it, carrying every `[decided]` line forward as the
 * protocol says, and that is a judgement a gate must not make. This refuses and names both entries.
 *
 * RATCHETED. The ten historical entries with no item predate the derived block and are grandfathered by
 * count: the file may not gain an eleventh. A rule applied backwards is an outage, and rewriting ten
 * archived handoffs to satisfy a rule written after them would be inventing provenance.
 */
import { allEntries } from '../governance/handoff-gate.mjs';

export const OK = 'OK', REFUSED = 'REFUSED', NOT_MEASURED = 'NOT-MEASURED';

/** How many item-less entries the file is allowed to carry. Measured 2026-09-25. May only fall. */
export const UNIDENTIFIED_BASELINE = 10;

/** PURE. The item an entry is about, from the machine-written derived block only. */
export function itemOf(entry) {
  const m = /^item:\s*([A-Za-z]+-\d+)\s*$/m.exec(String(entry ?? ''));
  return m ? m[1] : null;
}

/** PURE. The entry's heading, for naming it in a refusal. */
export function headingOf(entry) {
  const m = /^##\s+(.*)$/m.exec(String(entry ?? ''));
  return m ? m[1].trim() : '(untitled)';
}

/**
 * PURE. Group the file's entries by item.
 * THREE STATES: a file that could not be read is null, which is not a file with no entries.
 */
export function group(text) {
  const entries = allEntries(text);
  if (entries == null) return { state: NOT_MEASURED, why: 'docs/state/HANDOFF.md could not be read; an unread file is not an empty one' };
  const byItem = new Map();
  const unidentified = [];
  entries.forEach((e, i) => {
    const item = itemOf(e);
    if (!item) { unidentified.push({ index: i, heading: headingOf(e) }); return; }
    if (!byItem.has(item)) byItem.set(item, []);
    byItem.get(item).push({ index: i, heading: headingOf(e) });
  });
  return { state: OK, byItem, unidentified, total: entries.length };
}

/** PURE. The verdict. Duplicates refuse; item-less entries refuse only above the baseline. */
export function judge(g, { unidentifiedBaseline = UNIDENTIFIED_BASELINE } = {}) {
  if (g == null || g.state === NOT_MEASURED) {
    return { state: NOT_MEASURED, reasons: [], why: (g && g.why) || 'nothing was grouped' };
  }
  const reasons = [];
  for (const [item, entries] of g.byItem) {
    if (entries.length < 2) continue;
    reasons.push(`${item} has ${entries.length} handoff entries. One per item, replaced each time: fold the `
      + `older into the newer, carrying every [decided] line forward, and delete it. Entries: `
      + entries.map((e) => `"${e.heading}"`).join(' / '));
  }
  if (g.unidentified.length > unidentifiedBaseline) {
    const over = g.unidentified.length - unidentifiedBaseline;
    reasons.push(`${g.unidentified.length} entries name no item, ${over} more than the ${unidentifiedBaseline} `
      + 'grandfathered. An entry naming no item cannot be REPLACED, because nothing can tell that a later '
      + 'entry supersedes it, so the identity is what makes the rest of this rule possible. Newest without '
      + `an item: "${g.unidentified[0].heading}". Run node scripts/state/handoff-derive.mjs.`);
  }
  return { state: reasons.length ? REFUSED : OK, reasons,
    counts: { entries: g.total, items: g.byItem.size, unidentified: g.unidentified.length } };
}

/** PURE. The lines printed. The entry count is always shown: accumulation is the thing being watched. */
export function render(v) {
  if (v.state === NOT_MEASURED) {
    return [`handoff-per-item (Handoff Protocol) — NOT-MEASURED: ${v.why}. A file nobody could read is not a file that complies.`];
  }
  const c = v.counts;
  const L = [`handoff-per-item (Handoff Protocol) — ${v.state}: ${c.entries} entr(ies), ${c.items} item(s) named, `
    + `${c.unidentified} naming none. Only the newest is injected at resume; the rest are carried and not read.`];
  for (const r of v.reasons) L.push(`  ✖ ${r}`);
  return L;
}

// ------------------------------------------------------------------------------------------------
// CLI: handoff-per-item.mjs [--gate]
// Exit 0 clear · 1 refused (--gate only) · 2 could not read. Never `|| true`.
// ------------------------------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const REPO = process.env.QOS_REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const REL = 'docs/state/HANDOFF.md';
  let text = null;
  try { text = fs.readFileSync(path.join(REPO, REL), 'utf8'); }
  catch (e) {
    // ABSENT AND UNREADABLE ARE DIFFERENT. No handoff file is a repo that has not started keeping one,
    // which is every member repo before this lands; a file that exists and will not read is a finding.
    if (e && e.code === 'ENOENT') {
      console.log(`handoff-per-item (Handoff Protocol) — PASS: no ${REL} in this tree, so there are no entries to accumulate.`);
      process.exit(0);
    }
    console.error(`handoff-per-item — NOT-MEASURED: ${REL} exists and could not be read (${e?.code || e?.message}).`);
    process.exit(2);
  }
  const v = judge(group(text));
  const lines = render(v);
  if (v.state === NOT_MEASURED) { console.error(lines.join('\n')); process.exit(2); }
  if (v.state === REFUSED) {
    console.error(lines.join('\n'));
    process.exit(process.argv.includes('--gate') ? 1 : 0);
  }
  console.log(lines.join('\n'));
  process.exit(0);
}
