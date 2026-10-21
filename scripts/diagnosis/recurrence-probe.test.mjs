import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probability, judgeRun, census, reproduceOwed, owedReport, REPRODUCE_REQUIRED_AT,
  RETURNED, CLEAN, NOT_PROBABLE, NOT_RUN } from './recurrence-probe.mjs';

const est = (o = {}) => ({ verdict: 'CAUSE-ESTABLISHED', symptom: { statement: 's' },
  aba: { reproduce: 'node --test x.test.mjs' }, ...o });

test('a CAUSE-ESTABLISHED artifact with a reproduce command and a symptom is re-probable', () => {
  const p = probability(est());
  assert.equal(p.state, 'probable');
  assert.equal(p.cmd, 'node --test x.test.mjs');
});

test('the two things a probe needs are named INDIVIDUALLY when missing', () => {
  assert.match(probability(est({ aba: {} })).why, /missing a reproduce command/);
  assert.match(probability(est({ symptom: {} })).why, /missing a symptom statement/);
  const both = probability(est({ aba: {}, symptom: {} }));
  assert.deepEqual(both.missing, ['a reproduce command (aba.reproduce)', 'a symptom statement (symptom.statement)']);
});

test('only CAUSE-ESTABLISHED closures are in scope, and the rest are SKIPPED not failed', () => {
  for (const v of ['CORRELATE-ONLY', 'COULD-NOT-DETERMINE']) {
    const p = probability(est({ verdict: v }));
    assert.equal(p.state, NOT_PROBABLE);
    assert.equal(p.skip, true, 'a correlate is not a closure that owes a re-run');
  }
});

test('A RETURNED SYMPTOM IS A REFUTED CAUSE, and it says the rejected candidates stay rejected', () => {
  const r = judgeRun({ ok: false, output: 'assertion failed' });
  assert.equal(r.state, RETURNED);
  assert.equal(r.proof, true);
  assert.match(r.why, /cause-refuted/);
  assert.match(r.why, /stay rejected/);
});

test('A CLEAN RUN IS WEAK POSITIVE, NEVER CONFIRMATION', () => {
  // "a symptom can stop reproducing because surrounding code changed rather than because the cause was fixed"
  const r = judgeRun({ ok: true });
  assert.equal(r.state, CLEAN);
  assert.equal(r.proof, false);
  assert.match(r.why, /WEAK POSITIVE, not confirmation/);
});

test('a probe that was not run is NOT-RUN, which is neither clean nor returned', () => {
  assert.equal(judgeRun({}).state, NOT_RUN);
  assert.equal(judgeRun({ ok: null }).state, NOT_RUN);
});

test('census: zero re-runnable closures says the refuted rate is a rate of NOTHING', () => {
  const c = census([{ file: 'a.json', item: 'a', artifact: est({ aba: {} }) }]);
  assert.equal(c.probable, 0);
  assert.equal(c.established, 1);
  assert.equal(c.coverage, 0);
  assert.match(c.why, /rate of nothing/);
});

test('census: an unreadable directory is unmeasured, never an empty clean set', () => {
  const c = census(null);
  assert.equal(c.measured, false);
});

test('census: no established closures at all is explicitly NOT a pass', () => {
  const c = census([{ file: 'a.json', item: 'a', artifact: { verdict: 'CORRELATE-ONLY' } }]);
  assert.equal(c.established, 0);
  assert.match(c.why, /Not a pass/);
});

test('the reproduce requirement is GRANDFATHERED before its date', () => {
  const before = reproduceOwed(est({ aba: {} }), { firstSeenIso: '2026-09-01T00:00:00Z' });
  assert.equal(before.owed, false);
  assert.match(before.why, /grandfathered/);
  const after = reproduceOwed(est({ aba: {} }), { firstSeenIso: '2026-12-01T00:00:00Z' });
  assert.equal(after.owed, true);
  assert.match(after.why, /can never be refuted by evidence/);
});

test('an artifact whose first-seen date cannot be read is UNMEASURED, not compliant', () => {
  const r = reproduceOwed(est({ aba: {} }), { firstSeenIso: null });
  assert.equal(r.owed, false);
  assert.equal(r.measured, false);
  assert.match(r.why, /rather than counted as compliant/);
});

test('owedReport separates owed from unmeasured and never conflates them', () => {
  const entries = [
    { file: 'new.json', item: 'new', artifact: est({ aba: {} }) },
    { file: 'old.json', item: 'old', artifact: est({ aba: {} }) },
    { file: 'dunno.json', item: 'dunno', artifact: est({ aba: {} }) },
    { file: 'fine.json', item: 'fine', artifact: est() },
  ];
  const seen = (f) => ({ 'new.json': '2026-12-01T00:00:00Z', 'old.json': '2026-01-01T00:00:00Z',
    'dunno.json': null, 'fine.json': '2026-12-01T00:00:00Z' }[f]);
  const r = owedReport(entries, { seen });
  assert.deepEqual(r.owed.map((x) => x.item), ['new']);
  assert.deepEqual(r.unmeasured.map((x) => x.item), ['dunno']);
});

test('the requirement date is in the future relative to the artifacts it grandfathers', () => {
  assert.ok(Date.parse(REPRODUCE_REQUIRED_AT) > Date.parse('2026-09-25T00:00:00Z'));
});
