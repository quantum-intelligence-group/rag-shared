import test from 'node:test';
import assert from 'node:assert/strict';
import { judge, allocationOnMain, OK, REFUSED, NOT_MEASURED } from './undeclared-descent.mjs';

const FRESH = { onMain: false };   // allocation record not yet on origin/main
const INHERITED = { onMain: true };

test('THE CASE THIS EXISTS FOR: an id minted this session with no Depth: is refused', () => {
  // Real data. B-11251 was allocated at 16:53 during the session that wrote the descent gate, and its
  // commit declared nothing. Nine items were minted like that inside eighty minutes.
  const r = judge({ message: 'B-11251 governance: a CI step runs on its own\n', onMain: false });
  assert.equal(r.state, REFUSED);
  assert.equal(r.item, 'B-11251');
  assert.match(r.why, /discovered rather than/);
  assert.match(r.why, /Depth: 1/);
});

test('the same commit with Depth: and Parent: passes', () => {
  const r = judge({ message: 'B-11251 fix\n\nDepth: 1\nParent: B-11236\n', onMain: false });
  assert.equal(r.state, OK);
});

test('Depth: WITHOUT Parent: does not count as declared', () => {
  // A depth with no parent names no chain, and a chain is the thing the limit bounds.
  const r = judge({ message: 'B-11251 fix\n\nDepth: 1\n', onMain: false });
  assert.equal(r.state, REFUSED);
});

test('an id that predates the session is assigned work, not descent', () => {
  assert.equal(judge({ message: 'B-10500 fix\n', onMain: true }).state, OK);
});

test('no allocation record means older than the scheme: 3646 records go back to 2026-08-17', () => {
  // And a NEW heading with no record is already hard-blocked by alloc-id --gate-staged, so this is not
  // a bypass: you cannot file an item without a record and then claim the id is ancient.
  assert.equal(judge({ message: 'B-99999 fix\n', onMain: true }).state, OK);
});

// ── three states: the middle one is where a weaker check would fail open ─────

test('an UNREADABLE allocation record is NOT-MEASURED, never "it was assigned"', () => {
  const r = judge({ message: 'B-99999 fix\n', onMain: undefined });
  assert.equal(r.state, NOT_MEASURED);
  assert.match(r.why, /Unknown is not/);
});

test('no session start is NOT-MEASURED: an unmeasured window clears nothing', () => {
  const r = judge({ message: 'B-11251 fix\n', onMain: null });
  assert.equal(r.state, NOT_MEASURED);
});

test('an unreadable message is NOT-MEASURED', () => {
  assert.equal(judge({ message: null, onMain: false }).state, NOT_MEASURED);
});

test('a commit naming no item is not judged as descent', () => {
  assert.equal(judge({ message: 'chore: tidy\n', onMain: true }).state, OK);
});

// ── the reader ───────────────────────────────────────────────────────────────

test('allocationOnMain: a missing object is a real answer, a broken git is not', () => {
  const missing = () => { const e = new Error('no'); e.status = 1; throw e; };
  assert.equal(allocationOnMain('B-1', { repo: '/x', run: missing }), false, 'not on main = freshly minted');
  assert.equal(allocationOnMain('B-1', { repo: '/x', run: () => '' }), true);
  const broken = () => { throw new Error('git not found'); };   // no .status: git never ran
  assert.equal(allocationOnMain('B-1', { repo: '/x', run: broken }), null, 'a git that could not run is NOT "absent"');
});
