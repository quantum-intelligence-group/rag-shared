import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endingOf, entryFor, record, ARCHIVE_DIR } from './abnormal-end-handoff.mjs';

const fields = { item: 'B-1', branch: 'x', head: 'abc', base: 'def', diff: '1 file', working_tree: 'clean' };

test('a clean exit needs NO abnormal record', () => {
  const e = endingOf({ code: 0 });
  assert.equal(e.kind, 'clean');
  assert.equal(record({ code: 0, fsys: { mkdirSync() { throw new Error('must not be called'); } } }).wrote, false);
});

test('a signal and a non-zero exit are different endings, and both are named', () => {
  assert.equal(endingOf({ signal: 'SIGKILL' }).kind, 'signal');
  assert.equal(endingOf({ signal: 'SIGKILL' }).detail, 'SIGKILL');
  assert.equal(endingOf({ code: 137 }).kind, 'exit');
  assert.equal(endingOf({ code: 137 }).detail, '137');
});

test('an unrecorded ending is UNKNOWN, never invented as a clean exit', () => {
  const e = endingOf({});
  assert.equal(e.kind, 'unknown');
  assert.match(e.why, /would turn every lost session into a clean close/);
});

test('the entry says it is NOT a handoff, and says the WHY and NEXT were never written by anyone', () => {
  const text = entryFor(fields, endingOf({ signal: 'SIGTERM' }), { now: new Date('2026-09-25T12:00:00Z') });
  assert.match(text, /ABNORMAL ENDING/);
  assert.match(text, /NOT a handoff/);
  assert.match(text, /never written, by anyone/);
  assert.match(text, /do not resume from it as though work was handed over/);
  // and it must NOT look like a normal entry a resume would inject as a handoff
  assert.ok(!/^## Handoff/m.test(text), 'it must not mimic the shape of a real handoff entry');
});

test('the derived block is embedded as ONE block, not one character per line', () => {
  // The first version spread render()'s STRING, which produced a file of the right name and size and
  // entirely unreadable. A length check would have passed; this asserts the content.
  const text = entryFor(fields, endingOf({ code: 1 }), { now: new Date('2026-09-25T12:00:00Z') });
  assert.match(text, /item: B-1/);
  assert.ok(!/^i$/m.test(text), 'a single-character line means the block was spread as characters');
});

test('a write failure REPORTS rather than throwing, because it runs inside an exit trap', () => {
  const r = record({ code: 9, fsys: { mkdirSync() { throw new Error('read-only'); }, writeFileSync() {} } });
  assert.equal(r.wrote, false);
  assert.match(r.why, /could not write|read-only/);
});

test('the archive directory is under docs/state, where the state logs live', () => {
  assert.equal(ARCHIVE_DIR, 'docs/state/abnormal-endings');
});
