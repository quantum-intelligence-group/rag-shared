import test from 'node:test';
import assert from 'node:assert/strict';
import { openChain, closeChain, report, OPEN, RETURNED, ABANDONED, ORPHANED, STATES } from './chain-record.mjs';

const at = new Date('2026-09-24T12:00:00Z');
const ok = () => openChain({ id: 'c1', parent: 'B-1000', parentState: 'tests written, not run', locus: 'scripts/x.mjs', now: at }).chain;

test('a chain opens by naming what is being left', () => {
  const r = openChain({ id: 'c1', parent: 'B-1000', parentState: 'mid-refactor', now: at });
  assert.equal(r.ok, true);
  assert.equal(r.chain.state, OPEN);
  assert.equal(r.chain.parent, 'B-1000');
});

test('THE STACK MUST BE EXPLICIT: no parentState, no chain', () => {
  const r = openChain({ id: 'c1', parent: 'B-1000', now: at });
  assert.equal(r.ok, false);
  assert.match(r.why, /parentState/);
  assert.match(r.why, /other than recollection/);
});

test('a chain with no parent cannot be opened — an orphan chain cannot be returned from', () => {
  assert.equal(openChain({ id: 'c1', parentState: 'x', now: at }).ok, false);
});

test('closing records the outcome, not merely the closing', () => {
  const r = closeChain(ok(), { outcome: RETURNED, now: at });
  assert.equal(r.ok, true);
  assert.equal(r.chain.state, RETURNED);
  assert.ok(r.chain.closed_at);
});

test('abandonment is a first-class outcome, because it must be distinguishable from finishing', () => {
  assert.equal(closeChain(ok(), { outcome: ABANDONED, now: at }).chain.state, ABANDONED);
});

test('orphaned is available for a chain whose depth-0 item no longer exists', () => {
  assert.equal(closeChain(ok(), { outcome: ORPHANED, now: at }).chain.state, ORPHANED);
});

test('an invalid outcome is refused rather than stored', () => {
  const r = closeChain(ok(), { outcome: 'finished', now: at });
  assert.equal(r.ok, false);
  assert.match(r.why, /outcome must be one of/);
});

test('a chain cannot be closed twice', () => {
  const closed = closeChain(ok(), { outcome: RETURNED, now: at }).chain;
  assert.equal(closeChain(closed, { outcome: ABANDONED, now: at }).ok, false);
});

test('THREE STATES: closing a null chain is refused, not treated as closed', () => {
  const r = closeChain(null, { outcome: RETURNED });
  assert.equal(r.ok, false);
  assert.match(r.why, /not measured is not closed/);
});

// ---- the headline measurement ----
test('THE HEADLINE: chains returned over chains opened', () => {
  const mk = (id, state) => ({ id, state, opened_at: at.toISOString() });
  const r = report([mk('a', RETURNED), mk('b', RETURNED), mk('c', OPEN), mk('d', ABANDONED)], { now: at.getTime() });
  assert.equal(r.opened, 4);
  assert.equal(r.returned, 2);
  assert.equal(r.returnRate, 0.5, 'below 1 means assigned work is being abandoned');
});

test('an empty store returns null, not a perfect score', () => {
  const r = report([], { now: at.getTime() });
  assert.equal(r.returnRate, null, 'a ratio over zero is not 100%');
});

test('THREE STATES: an unreadable store is not-measured, and reports no counts', () => {
  const r = report(null);
  assert.equal(r.measured, false);
  assert.equal(r.open, undefined);
});

test('open chain AGE is reported — a chain open a long time is a descent that became the task', () => {
  const old = { id: 'a', state: OPEN, opened_at: new Date(at.getTime() - 40 * 3600000).toISOString() };
  const r = report([old], { now: at.getTime() });
  assert.equal(r.oldestOpenHours, 40);
  assert.equal(r.aged[0].id, 'a');
});

test('the four states are exactly open, returned, abandoned, orphaned', () => {
  assert.deepEqual(STATES, ['open', 'returned', 'abandoned', 'orphaned']);
});
