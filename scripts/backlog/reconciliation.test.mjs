import test from 'node:test';
import assert from 'node:assert/strict';
import { complianceTest, clockState, verdict, purgeRecord,
  NO_CLOCK, IMMEDIATE, RUNNING, PAUSED, UNKNOWN,
  AGENT_BUDGET_MS, HUMAN_BUDGET_MS, OK, REFUSED, NOT_MEASURED } from './reconciliation.mjs';

const NOW = Date.parse('2026-09-24T12:00:00Z');
const ago = (ms) => NOW - ms;
const full = (over = {}) => ({ id: 'B-1', spec: 'x', acceptance: 'y', scope: 'z', claimed: true, lastMovement: NOW, ...over });

// ---- Test 1: compliance ----
test('a fully specified item is compliant', () => {
  assert.equal(complianceTest(full()).state, OK);
});

test('a missing spec is a compliance failure, and it is repairable', () => {
  const r = complianceTest(full({ spec: null }));
  assert.equal(r.state, REFUSED);
  assert.equal(r.repairable, true, 'a spec can be written');
});

test('a diagnosis is required only for defect-class items past the ordering point', () => {
  assert.equal(complianceTest(full({ defectClass: true, pastOrderingPoint: false })).state, OK);
  assert.equal(complianceTest(full({ defectClass: true, pastOrderingPoint: true })).state, REFUSED);
});

test('depth and parent are required only for discovered work', () => {
  assert.equal(complianceTest(full({ discovered: false })).state, OK);
  assert.equal(complianceTest(full({ discovered: true })).state, REFUSED);
});

test('an unreproducible defect with no diagnosis is UNREPAIRABLE — the information is gone', () => {
  const r = complianceTest(full({ defectClass: true, pastOrderingPoint: true, reproducible: false }));
  assert.equal(r.repairable, false);
});

test('THREE STATES: a null item is NOT-MEASURED, not compliant', () => {
  assert.equal(complianceTest(null).state, NOT_MEASURED);
});

// ---- Test 2: the clock ----
test('queued but not at the head runs NO clock — waiting its turn is legitimate', () => {
  const c = clockState(full({ claimed: false, atHead: false }), { now: NOW });
  assert.equal(c.clock, NO_CLOCK);
  assert.equal(c.overdue, false);
});

test('AT THE HEAD AND UNCLAIMABLE IS IMMEDIATE — no waiting period', () => {
  const c = clockState(full({ claimed: false, atHead: true, claimFailed: true }), { now: NOW });
  assert.equal(c.clock, IMMEDIATE);
  assert.equal(c.overdue, true);
  assert.match(c.why, /broken now/);
});

test('an agent item idle past 24h is overdue', () => {
  const c = clockState(full({ lastMovement: ago(AGENT_BUDGET_MS + 3600000) }), { now: NOW });
  assert.equal(c.clock, RUNNING);
  assert.equal(c.overdue, true);
});

test('an agent item inside 24h is not overdue', () => {
  assert.equal(clockState(full({ lastMovement: ago(AGENT_BUDGET_MS - 3600000) }), { now: NOW }).overdue, false);
});

test('a human item gets 30 days, not 24 hours', () => {
  const at5d = full({ originKind: 'human', lastMovement: ago(5 * 86400000) });
  assert.equal(clockState(at5d, { now: NOW }).overdue, false);
  const at31d = full({ originKind: 'human', lastMovement: ago(31 * 86400000) });
  assert.equal(clockState(at31d, { now: NOW }).overdue, true);
  assert.equal(HUMAN_BUDGET_MS / AGENT_BUDGET_MS, 30);
});

test('an undispatched correction PAUSES the clock — not the item\'s fault', () => {
  const c = clockState(full({ correctionRequested: true, correctionDispatched: false,
    lastMovement: ago(10 * AGENT_BUDGET_MS) }), { now: NOW });
  assert.equal(c.clock, PAUSED);
  assert.equal(c.overdue, false);
});

test('a DISPATCHED correction resumes the clock', () => {
  const c = clockState(full({ correctionRequested: true, correctionDispatched: true,
    lastMovement: ago(10 * AGENT_BUDGET_MS) }), { now: NOW });
  assert.equal(c.clock, RUNNING);
  assert.equal(c.overdue, true);
});

test('a vanished repository is immediate — ownership is the repository', () => {
  assert.equal(clockState(full({ repositoryGone: true }), { now: NOW }).clock, IMMEDIATE);
});

test('an unreadable last movement is UNKNOWN and is never counted as moving', () => {
  const c = clockState(full({ lastMovement: null }), { now: NOW });
  assert.equal(c.clock, UNKNOWN);
  assert.notEqual(c.clock, RUNNING);
});

// ---- the verdict ----
test('compliant and moving is KEEP', () => {
  assert.equal(verdict(full(), { now: NOW }).action, 'KEEP');
});

test('REPAIR BEFORE PURGE: a repairable gap repairs, it does not purge', () => {
  const v = verdict(full({ spec: null }), { now: NOW });
  assert.equal(v.action, 'REPAIR');
});

test('an unrepairable item purges', () => {
  const v = verdict(full({ defectClass: true, pastOrderingPoint: true, reproducible: false }), { now: NOW });
  assert.equal(v.action, 'PURGE');
});

test('an overdue but compliant item purges on the clock', () => {
  const v = verdict(full({ lastMovement: ago(AGENT_BUDGET_MS * 3) }), { now: NOW });
  assert.equal(v.action, 'PURGE');
});

test('NOT-MEASURED never purges — an item that could not be read is held', () => {
  assert.equal(verdict(full({ lastMovement: null }), { now: NOW }).action, 'HOLD');
});

test('a paused item is held however long it has sat', () => {
  const v = verdict(full({ correctionRequested: true, correctionDispatched: false,
    lastMovement: ago(100 * AGENT_BUDGET_MS) }), { now: NOW });
  assert.equal(v.action, 'HOLD');
});

// ---- the record ----
test('the purge record keeps what makes purge defensible', () => {
  const item = full({ lastMovement: ago(AGENT_BUDGET_MS * 3), title: 'a thing', origin: 'fleet', repository: 'QOS' });
  const v = verdict(item, { now: NOW });
  for (const k of ['id', 'title', 'origin', 'repository', 'tests_failed', 'date']) {
    assert.ok(k in v.record, `record must carry ${k}`);
  }
  assert.ok(v.record.tests_failed.length > 0, 'the record must say WHY');
});

test('the record leaves a slot for a resubmission, so history stays connected', () => {
  const r = purgeRecord(full(), { state: OK, missing: [] }, { overdue: true, why: 'x' });
  assert.ok('resubmission' in r);
});
