import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateItem, itemFacts, OK, REFUSED, NOT_MEASURED, gateVerdict, addedSections } from './reconciliation-gate.mjs';

const full = `### B-1: a real item

**Sprint:** Sprint 5 · **Priority:** HIGH · **Status:** In Progress · **Found:** 2026-09-24, a probe
**Owner:** QOS kernel · **Rules:** R-14.4 · **Scope:** \`scripts/x.mjs\`
**Lane:** DECIDE

Body text long enough to constitute a specification of the behaviour under constraints, describing what
the item changes and why, rather than a title with a status line attached to it.

**Acceptance criteria**

1. It does the thing.
`;

test('a fully specified item passes Test 1', () => {
  assert.equal(evaluateItem(full, { id: 'B-1' }).state, OK);
});

test('an item with no acceptance criteria is refused, and told it is repairable', () => {
  const r = evaluateItem(full.replace(/\*\*Acceptance criteria\*\*[\s\S]*$/, ''), { id: 'B-1' });
  assert.equal(r.state, REFUSED);
  assert.match(r.why, /acceptance criterion/);
  assert.match(r.why, /repairing it now costs less/);
});

test('an item with no declared scope is refused', () => {
  const r = evaluateItem(full.replace('**Scope:** `scripts/x.mjs`', ''), { id: 'B-1' });
  assert.equal(r.state, REFUSED);
  assert.match(r.missing.map((m) => m.key).join(','), /scope/);
});

test('THREE STATES: an unreadable section is NOT-MEASURED, never a failure', () => {
  // An item this gate cannot read is one it has no business judging. Refusing on that basis would
  // block a commit for a parsing failure rather than a defect.
  const r = evaluateItem(null, { id: 'B-9' });
  assert.equal(r.state, NOT_MEASURED);
  assert.match(r.why, /An unread item is not a failing one/);
});

test('the refusal names WHICH requirements are missing, not just that some are', () => {
  const bare = '### B-2: bare\n\n**Status:** Ready\n';
  const r = evaluateItem(bare, { id: 'B-2' });
  assert.ok(r.missing.length >= 2);
  assert.ok(r.missing.every((m) => m.label && m.source), 'each gap cites the protocol that requires it');
});

test('itemFacts reads the fields Test 1 needs', () => {
  const f = itemFacts(full);
  assert.equal(f.acceptance, true);
  assert.equal(f.scope, true);
});

test('itemFacts on null returns null rather than an object of falsehoods', () => {
  assert.equal(itemFacts(null), null);
});

test('a title with a status line is not a spec', () => {
  const thin = '### B-3: thin\n\n**Owner:** x · **Scope:** `a.mjs`\n\n**Acceptance criteria**\n\n1. x\n';
  assert.equal(itemFacts(thin).spec, false, 'a spec states behaviour under constraints, not a heading');
});

// ── the ratchet ──────────────────────────────────────────────────────────────

test('an unreadable diff is NOT-MEASURED and exits 2, never a pass', () => {
  const v = gateVerdict(addedSections(null));
  assert.equal(v.code, 2);
  assert.match(v.lines[0], /NOT-MEASURED/);
});

test('a commit touching no backlog item passes', () => {
  const v = gateVerdict(addedSections('diff --git a/x b/x\n+unrelated\n'));
  assert.equal(v.code, 0);
});

test('a NEW item missing an acceptance criterion is refused', () => {
  const diff = ['+### B-99999 something', '+', '+**Scope:** scripts/x.mjs',
    '+' + 'body '.repeat(40)].join('\n');
  const v = gateVerdict(addedSections(diff));
  assert.equal(v.code, 1);
  assert.match(v.lines.join('\n'), /B-99999/);
  assert.match(v.lines.join('\n'), /acceptance criterion/);
});

test('a NEW item that is compliant passes', () => {
  const diff = ['+### B-99998 something', '+', '+**Scope:** scripts/x.mjs',
    '+**Acceptance criteria**: the gate exits 1 on a new non-compliant item',
    '+' + 'body '.repeat(40)].join('\n');
  const v = gateVerdict(addedSections(diff));
  assert.equal(v.code, 0, v.lines.join('\n'));
});

test('a pre-existing non-compliant item is NOT refused: only ADDED lines are judged', () => {
  // The whole point of the ratchet. 2150 of 2199 live items fail Test 1; a gate that read the file
  // rather than the diff would refuse every commit in the repository.
  const diff = ['--- a/docs/planning/BACKLOG.md', '+++ b/docs/planning/BACKLOG.md',
    ' ### B-1 legacy item with no acceptance criterion', '+a line added to unrelated prose'].join('\n');
  const v = gateVerdict(addedSections(diff));
  assert.equal(v.code, 0);
});

test('a context line beginning with a header is not read as an added section', () => {
  const v = gateVerdict(addedSections(' ### B-77 context only, unchanged\n'));
  assert.equal(v.code, 0);
});

// ── B-11388: the gate judged only one id namespace, and was blind to 376 items here ──────────────
// The matcher was /\bB-\d+\b/. This repository's control findings are FLT-nnn and the members use
// their own prefixes, and `B-` followed by a word character does not match at a boundary. Counted
// 2026-10-02: 92 FLT- headings in docs/planning/BACKLOG.md and 284 in CONTROL_BACKLOG.md that this
// gate could never see. It was wired, it exited 0, and it judged none of them. The failure was
// silent AND flattering: a clean verdict is indistinguishable from a compliant item.
//
// Driven through addedSections(), the real entry point, rather than by scraping the regex out of the
// source. A first draft of this test did scrape it, and broke on the non-capturing group in the fix.
// A test that reads its subject's source passes when the source merely LOOKS right.
const diffOf = (heading) => ['+++ b/docs/planning/BACKLOG.md', `+${heading}`, '+', '+**Status:** Open'].join('\n');

test('B-11388: every id namespace this programme uses is judged, not just B-', () => {
  assert.equal(addedSections(diffOf('### B-11388: a product item'))[0]?.id, 'B-11388');
  assert.equal(addedSections(diffOf('### FLT-492: a control finding'))[0]?.id, 'FLT-492',
    'an FLT- heading must be judged; 376 of them live in this repository');
  assert.equal(addedSections(diffOf('### BL-490: a member item'))[0]?.id, 'BL-490',
    'a member namespace must be judged, since this gate ships to every member');
});

test('B-11388: the longer prefixes are tried first, or B wins and leaves a dangling letter', () => {
  assert.equal(addedSections(diffOf('### BL-490: x'))[0]?.id, 'BL-490',
    'must not match "B-490" out of "BL-490"');
});
