import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, OK, REFUSED, NOT_APPLICABLE, MAX_DEPTH } from './descent-gate.mjs';

const open = new Set(['B-11226', 'B-1000']);
const ev = (m, o = open) => evaluate(m, { openItems: o });

test('an ordinary commit with no trailers is assigned work, not a violation', () => {
  const r = ev('B-11226 fleet: do the thing');
  assert.equal(r.state, NOT_APPLICABLE);
});

test('depth 0 passes', () => {
  assert.equal(ev('B-11226 do the thing\n\nDepth: 0').state, OK);
});

test('depth 1 with a real open parent passes', () => {
  assert.equal(ev('B-11226 do the thing\n\nDepth: 1\nParent: B-1000\nScope: scripts/x.mjs').state, OK);
});

test('THE HARD STOP: depth 2 is refused', () => {
  const r = ev('B-11226 x\n\nDepth: 2\nParent: B-1000');
  assert.equal(r.state, REFUSED);
  assert.match(r.reasons.join(' '), /D2:.*exceeds the limit/);
  assert.match(r.reasons.join(' '), /CAPTURED, not worked/);
});

test('depth 7 is refused the same way — there is no budget to argue', () => {
  assert.equal(ev('B-11226 x\n\nDepth: 7\nParent: B-1000').state, REFUSED);
});

test('depth 1 with no parent is refused: a descent with no return point', () => {
  const r = ev('B-11226 x\n\nDepth: 1');
  assert.match(r.reasons.join(' '), /D4:.*names no Parent/);
});

test('a parent that is not open is refused', () => {
  const r = ev('B-11226 x\n\nDepth: 1\nParent: B-99999');
  assert.match(r.reasons.join(' '), /D7:.*not an open item/);
});

test('THREE STATES: an unreadable open-item set refuses, it does not pass', () => {
  const r = evaluate('B-11226 x\n\nDepth: 1\nParent: B-1000\nScope: scripts/x.mjs', { openItems: null });
  assert.equal(r.state, REFUSED);
  assert.match(r.reasons.join(' '), /D6:.*could not be read/);
  assert.match(r.reasons.join(' '), /not a passing one/);
});

test('a non-integer depth is refused rather than coerced', () => {
  for (const bad of ['one', '1.5', '-1', '1 (discovered)']) {
    assert.equal(ev(`B-11226 x\n\nDepth: ${bad}\nParent: B-1000`).state, REFUSED, bad);
  }
});

test('Parent at depth 0 is refused — depth 0 has no parent', () => {
  const r = ev('B-11226 x\n\nDepth: 0\nParent: B-1000');
  assert.match(r.reasons.join(' '), /D3:/);
});

test('SEPARATION: two item ids in one commit is refused', () => {
  const r = ev('B-11226 x, and also fixes B-1000\n\nDepth: 0');
  assert.match(r.reasons.join(' '), /D8:.*One item id per commit/);
});

test('Parent: does not count toward the one-id rule — naming the return point is the point', () => {
  assert.equal(ev('B-11226 x\n\nDepth: 1\nParent: B-1000\nScope: scripts/x.mjs').state, OK);
});

test('the limit is exactly 1, asserted against the constant', () => {
  assert.equal(MAX_DEPTH, 1);
  assert.equal(ev(`B-11226 x\n\nDepth: ${MAX_DEPTH}\nParent: B-1000\nScope: scripts/x.mjs`).state, OK);
  assert.equal(ev(`B-11226 x\n\nDepth: ${MAX_DEPTH + 1}\nParent: B-1000`).state, REFUSED);
});

test('a refusal always says what to do instead, never only what is wrong', () => {
  const r = ev('B-11226 x\n\nDepth: 3\nParent: B-1000');
  assert.match(r.reasons.join(' '), /capture|CAPTURED/i);
});

// ---------------------------------------------------------------------------------------------
// SEPARATION. The control the other two rest on: a depth-1 fix merged into the depth-0 diff is
// invisible to every gate, because the gates read the commit and the commit says it is the parent.
// ---------------------------------------------------------------------------------------------
test('SEPARATION: Depth 1 with no Scope is refused', () => {
  const r = ev('B-11226 x\n\nDepth: 1\nParent: B-1000');
  assert.equal(r.state, REFUSED);
  assert.match(r.reasons.join(' '), /D9:.*no Scope:/);
  assert.match(r.reasons.join(' '), /silently widens/);
});

test('a diff inside the declared scope passes', () => {
  const r = evaluate('B-11226 x\n\nDepth: 1\nParent: B-1000\nScope: scripts/fleet/', {
    openItems: open, changedPaths: ['scripts/fleet/a.mjs', 'scripts/fleet/b.mjs'] });
  assert.equal(r.state, OK);
});

test('a diff OUTSIDE the declared scope is refused, and the refusal names the paths', () => {
  const r = evaluate('B-11226 x\n\nDepth: 1\nParent: B-1000\nScope: scripts/fleet/', {
    openItems: open, changedPaths: ['scripts/fleet/a.mjs', 'docs/other.md'] });
  assert.equal(r.state, REFUSED);
  assert.match(r.reasons.join(' '), /D10:.*docs\/other\.md/);
});

test('the refusal offers both routes, because a refusal with no cheap way forward gets worked around', () => {
  const r = evaluate('B-11226 x\n\nDepth: 1\nParent: B-1000\nScope: a/', {
    openItems: open, changedPaths: ['b/x.mjs'] });
  assert.match(r.reasons.join(' '), /amend the scope/i);
  assert.match(r.reasons.join(' '), /split the commit/i);
});

test('an exact file path in Scope matches that file and not its prefix-siblings', () => {
  const ok = evaluate('x\n\nDepth: 1\nParent: B-1000\nScope: a/b.mjs', {
    openItems: open, changedPaths: ['a/b.mjs'] });
  assert.equal(ok.state, OK);
  const bad = evaluate('x\n\nDepth: 1\nParent: B-1000\nScope: a/b.mjs', {
    openItems: open, changedPaths: ['a/b.mjs.bak'] });
  assert.equal(bad.state, REFUSED, 'a/b.mjs must not cover a/b.mjs.bak');
});

test('THREE STATES: Scope declared but the diff unreadable REFUSES, it does not pass', () => {
  const r = evaluate('x\n\nDepth: 1\nParent: B-1000\nScope: a/', { openItems: open, changedPaths: null });
  assert.equal(r.state, REFUSED);
  assert.match(r.reasons.join(' '), /D11:.*An unread diff is not a diff that stayed in scope/);
});

test('Scope at depth 0 is allowed and still checked — separation is not a depth-1 idea', () => {
  const r = evaluate('x\n\nDepth: 0\nScope: a/', { openItems: open, changedPaths: ['b/x.mjs'] });
  assert.match(r.reasons.join(' '), /D10:/);
});
