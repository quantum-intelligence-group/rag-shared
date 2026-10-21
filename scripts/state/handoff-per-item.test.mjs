import test from 'node:test';
import assert from 'node:assert/strict';
import { itemOf, headingOf, group, judge, render, OK, REFUSED, NOT_MEASURED, UNIDENTIFIED_BASELINE }
  from './handoff-per-item.mjs';
import { allEntries, DERIVED_OPEN, DERIVED_CLOSE } from '../governance/handoff-gate.mjs';

const entry = (title, item) => `## ${title}\n\n${DERIVED_OPEN}\n${item ? `item: ${item}\n` : ''}branch: x\n${DERIVED_CLOSE}\n\n[observed] a thing.\n`;
const file = (...es) => `---\ntitle: HANDOFF\n---\n${es.join('\n')}`;
const noItem = (n) => Array.from({ length: n }, (_, i) => entry(`untitled ${i}`, null));

test('ONE PARSER: allEntries is what newestEntry is the first of', () => {
  const es = allEntries(file(entry('a', 'B-1'), entry('b', 'B-2')));
  assert.equal(es.length, 2);
  assert.match(es[0], /## a/);
  assert.match(es[1], /## b/);
  assert.equal(allEntries(null), null, 'an unread file is null, not an empty list');
});

test('two entries for one item is refused, and the refusal names both', () => {
  const v = judge(group(file(entry('the second pass', 'B-1'), entry('the first pass', 'B-1'), ...noItem(1))));
  assert.equal(v.state, REFUSED);
  assert.match(v.reasons.join(' '), /B-1 has 2 handoff entries/);
  assert.match(v.reasons.join(' '), /the second pass/);
  assert.match(v.reasons.join(' '), /the first pass/);
  assert.match(v.reasons.join(' '), /carrying every \[decided\] line forward/);
});

test('THE GATE DOES NOT DECIDE THE MERGE: it refuses and names, it never rewrites', () => {
  // Folding two handoffs into one is a judgement about which decisions still hold. A gate that did it
  // would be authoring the record it exists to check.
  const v = judge(group(file(entry('a', 'B-1'), entry('b', 'B-1'))));
  assert.match(v.reasons.join(' '), /fold the older into the newer/);
  assert.ok(!('rewrite' in v), 'the verdict carries no edit');
});

test('one entry per item passes however many items there are', () => {
  const v = judge(group(file(entry('a', 'B-1'), entry('b', 'B-2'), entry('c', 'B-3'))));
  assert.equal(v.state, OK);
  assert.deepEqual(v.counts, { entries: 3, items: 3, unidentified: 0 });
});

test('THE LOAD-BEARING HALF: an entry naming no item cannot be replaced', () => {
  // Ten predate the derived block and are grandfathered; the eleventh is refused.
  assert.equal(judge(group(file(...noItem(UNIDENTIFIED_BASELINE)))).state, OK);
  const over = judge(group(file(...noItem(UNIDENTIFIED_BASELINE + 1))));
  assert.equal(over.state, REFUSED);
  assert.match(over.reasons.join(' '), /1 more than the 10 grandfathered/);
  assert.match(over.reasons.join(' '), /cannot be REPLACED/);
  assert.match(over.reasons.join(' '), /handoff-derive\.mjs/);
});

test('the baseline may be tightened and the refusal follows it', () => {
  const g = group(file(...noItem(3)));
  assert.equal(judge(g, { unidentifiedBaseline: 3 }).state, OK);
  assert.equal(judge(g, { unidentifiedBaseline: 2 }).state, REFUSED);
});

test('the item comes from the machine-written block, not from prose', () => {
  assert.equal(itemOf(`${DERIVED_OPEN}\nitem: B-77\n${DERIVED_CLOSE}`), 'B-77');
  // ANCHORED TO END OF LINE, and it matters: `item: B-77 is done` is prose that happens to start with
  // the field name. An identity that a sentence can accidentally supply is not an identity.
  assert.equal(itemOf('## Handoff for B-77\n\n[observed] item: B-77 is done'), null);
  assert.equal(itemOf('## Handoff\n\n[observed] we worked on B-77.'), null,
    'a mention in prose is not an identity');
  assert.equal(itemOf('## H\n\nitem: B-77'), 'B-77', 'the field on its own line is the identity');
  assert.equal(itemOf(null), null);
});

test('THREE STATES: an unread file is NOT-MEASURED, never compliant', () => {
  assert.equal(group(null).state, NOT_MEASURED);
  assert.equal(judge(group(null)).state, NOT_MEASURED);
  assert.equal(judge(null).state, NOT_MEASURED);
  assert.match(render(judge(null)).join(' '), /A file nobody could read is not a file that complies/);
});

test('the entry count is always printed, because accumulation is the thing being watched', () => {
  const out = render(judge(group(file(entry('a', 'B-1'), ...noItem(2))))).join('\n');
  assert.match(out, /3 entr\(ies\), 1 item\(s\) named, 2 naming none/);
  assert.match(out, /Only the newest is injected at resume; the rest are carried and not read/);
});

test('headingOf names an entry even when it has nothing else', () => {
  assert.equal(headingOf('## Handoff, 2026-09-25: the thing\n\nbody'), 'Handoff, 2026-09-25: the thing');
  assert.equal(headingOf('no heading at all'), '(untitled)');
});
