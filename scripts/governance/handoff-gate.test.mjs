import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEntry, newestEntry, isProse, TAGS, DERIVED_OPEN, DERIVED_CLOSE, OK, REFUSED, NOT_MEASURED } from './handoff-gate.mjs';

const derived = 'item: B-1\nbranch: main\nhead: abc123\nfingerprint: aaaa1111';
const block = `${DERIVED_OPEN}\n${derived}\n${DERIVED_CLOSE}`;
const good = `## Handoff, 2026-09-24\n\n${block}\n\n[observed] The suite passed, 21 of 21.\n[decided] We ship the guard.\n`;

test('a well-formed entry passes', () => {
  assert.equal(evaluateEntry(good, { derivedExpected: derived }).state, OK);
});

test('THE DEFECT: untagged prose is refused', () => {
  const r = evaluateEntry(`## H\n\n${block}\n\nWe fixed the thing and it works now.\n`, { derivedExpected: derived });
  assert.equal(r.state, REFUSED);
  assert.match(r.reasons.join(' '), /H3:.*no provenance tag/);
  assert.match(r.reasons.join(' '), /it is a note/);
});

test('all four tags are accepted, and [assumed] is one of them', () => {
  for (const t of TAGS) {
    const e = `## H\n\n${block}\n\n[${t}] a claim.\n`;
    assert.equal(evaluateEntry(e, { derivedExpected: derived }).state, OK, t);
  }
  assert.ok(TAGS.includes('assumed'), 'the highest-value tag must exist');
});

test('a missing derived block is refused', () => {
  const r = evaluateEntry('## H\n\n[observed] a claim.\n');
  assert.match(r.reasons.join(' '), /H1:.*no machine-written derived block/);
});

test('STALENESS IS DIVERGENCE: a different fingerprint is refused', () => {
  const r = evaluateEntry(good, { derivedExpected: 'item: B-1\nfingerprint: bbbb2222' });
  assert.match(r.reasons.join(' '), /H2:.*does not match the tree now/);
  assert.match(r.reasons.join(' '), /divergence, not age/);
});

test('CONTEXT MOVING IS NOT DIVERGENCE: same fingerprint, different reported context, passes', () => {
  // working_tree and diff move on their own; comparing the block verbatim made a handoff stale the
  // moment its own file was edited. Only the fingerprint decides.
  const r = evaluateEntry(good, { derivedExpected: 'item: B-1\nworking_tree: 9 uncommitted path(s)\nfingerprint: aaaa1111' });
  assert.equal(r.state, OK);
});

test('a derived block with NO fingerprint cannot be judged, and says so', () => {
  const noFp = good.replace('\nfingerprint: aaaa1111', '');
  const r = evaluateEntry(noFp, { derivedExpected: derived });
  assert.match(r.reasons.join(' '), /no fingerprint, so staleness cannot be judged/);
});

test('a wrapped claim needs a tag only on its first line', () => {
  const e = `## H\n\n${block}\n\n[observed] a claim that runs on\nacross a second line\nand a third.\n`;
  assert.equal(evaluateEntry(e, { derivedExpected: derived }).state, OK);
});

test('a NEW paragraph after a blank line needs its own tag', () => {
  const e = `## H\n\n${block}\n\n[observed] first claim.\n\nsecond claim with no tag.\n`;
  const r = evaluateEntry(e, { derivedExpected: derived });
  assert.equal(r.state, REFUSED);
  assert.match(r.reasons.join(' '), /H3:/);
});

test('the derived block itself is exempt from tagging — the machine wrote it', () => {
  assert.equal(evaluateEntry(good, { derivedExpected: derived }).untagged, 0);
});

test('code fences are exempt', () => {
  const e = `## H\n\n${block}\n\n[observed] output:\n\`\`\`\nsome untagged output\nmore of it\n\`\`\`\n`;
  assert.equal(evaluateEntry(e, { derivedExpected: derived }).state, OK);
});

test('headings, tables, rules and quotes need no tag', () => {
  const e = `## H\n\n${block}\n\n### sub\n\n| a | b |\n|---|---|\n\n---\n\n> quoted\n\n[decided] the claim.\n`;
  assert.equal(evaluateEntry(e, { derivedExpected: derived }).state, OK);
});

test('THREE STATES: an unreadable entry is NOT-MEASURED, not OK', () => {
  const r = evaluateEntry(null);
  assert.equal(r.state, NOT_MEASURED);
  assert.notEqual(r.state, OK);
});

test('the refusal names specific lines, so it is actionable', () => {
  const r = evaluateEntry(`## H\n\n${block}\n\nfirst untagged.\nsecond untagged.\n`, { derivedExpected: derived });
  assert.match(r.reasons.join(' '), /first untagged/);
});

test('newestEntry takes the first section and stops at the next', () => {
  const f = '---\ntitle: x\n---\n## newest\nA\n\n## older\nB\n';
  const e = newestEntry(f);
  assert.match(e, /newest/);
  assert.doesNotMatch(e, /older/);
});

test('newestEntry on a file with no entries returns null, not empty string', () => {
  assert.equal(newestEntry('---\ntitle: x\n---\nnothing here\n'), null);
});

test('isProse excludes structure but includes real claims', () => {
  assert.equal(isProse('## heading'), false);
  assert.equal(isProse('| a |'), false);
  assert.equal(isProse(''), false);
  assert.equal(isProse('a real claim'), true);
});
