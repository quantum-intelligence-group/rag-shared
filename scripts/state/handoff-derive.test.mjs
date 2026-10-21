import test from 'node:test';
import assert from 'node:assert/strict';
import { derive, render, UNREADABLE } from './handoff-derive.mjs';

const at = new Date('2026-09-24T00:00:00Z');
const fakeGit = (map) => (repo, args) => {
  const key = args.join(' ');
  for (const [k, v] of Object.entries(map)) if (key.startsWith(k)) return v;
  return null;
};
const fsNone = { readFileSync() { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); } };

test('a failed git read is UNREADABLE, never blank and never a plausible default', () => {
  const f = derive('/r', { gitFn: () => null, fsys: fsNone, now: at });
  assert.equal(f.branch, UNREADABLE);
  assert.equal(f.head, UNREADABLE);
  assert.equal(f.item, UNREADABLE);
  assert.notEqual(f.working_tree, 'clean', 'an unread tree must NOT read as clean');
});

test('an unread working tree does not default to the flattering answer', () => {
  const f = derive('/r', { gitFn: fakeGit({ 'rev-parse --abbrev-ref': 'main' }), fsys: fsNone, now: at });
  assert.equal(f.working_tree, UNREADABLE);
});

test('a clean tree reads as clean, and a dirty one says how many', () => {
  const clean = derive('/r', { gitFn: fakeGit({ 'status --porcelain': '' }), fsys: fsNone, now: at });
  assert.equal(clean.working_tree, 'clean');
  const dirty = derive('/r', { gitFn: fakeGit({ 'status --porcelain': ' M a\n M b' }), fsys: fsNone, now: at });
  assert.match(dirty.working_tree, /2 uncommitted/);
});

test('item is taken from the branch or subject, not from the agent', () => {
  const f = derive('/r', { gitFn: fakeGit({ 'rev-parse --abbrev-ref': 'qos/human/B-4242-x' }), fsys: fsNone, now: at });
  assert.equal(f.item, 'B-4242');
});

test('depth and parent come from commit TRAILERS, not memory', () => {
  const f = derive('/r', { gitFn: fakeGit({ 'log -1 --no-merges --pretty=%B': 'x\n\nDepth: 1\nParent: B-1000\n' }), fsys: fsNone, now: at });
  assert.equal(f.depth, '1');
  assert.equal(f.parent, 'B-1000');
});

test('absent depth trailer means depth 0, which is assigned work', () => {
  const f = derive('/r', { gitFn: fakeGit({ 'log -1 --no-merges --pretty=%B': 'no trailers' }), fsys: fsNone, now: at });
  assert.equal(f.depth, '0');
  assert.equal(f.parent, 'none');
});

test('the diagnosis verdict is read from the artifact, not asserted', () => {
  const fsys = { readFileSync: () => JSON.stringify({ verdict: 'CORRELATE-ONLY' }) };
  const f = derive('/r', { gitFn: fakeGit({ 'rev-parse --abbrev-ref': 'x/B-99-y' }), fsys, now: at });
  assert.equal(f.verdict, 'CORRELATE-ONLY');
  assert.match(f.diagnosis, /B-99\.json/);
});

test('an open artifact reports null (open), not a verdict it does not have', () => {
  const fsys = { readFileSync: () => JSON.stringify({ verdict: null }) };
  const f = derive('/r', { gitFn: fakeGit({ 'rev-parse --abbrev-ref': 'x/B-99-y' }), fsys, now: at });
  assert.equal(f.verdict, 'null (open)');
});

test('THE FINGERPRINT EXCLUDES TIME: the same tree at two moments fingerprints identically', () => {
  const g = fakeGit({ 'rev-parse --abbrev-ref': 'main', 'status --porcelain': '' });
  const a = derive('/r', { gitFn: g, fsys: fsNone, now: new Date('2026-09-24T00:00:00Z') });
  const b = derive('/r', { gitFn: g, fsys: fsNone, now: new Date('2026-11-01T00:00:00Z') });
  assert.equal(a.fingerprint, b.fingerprint, 'age must not read as staleness');
  assert.notEqual(a.derived_at, b.derived_at);
});

test('a moved HEAD alone is not divergence — superseded deliberately, see the FINGERPRINTED note', () => {
  // This asserted the opposite until using the gate showed why it cannot: writing a handoff and then
  // committing it moves HEAD, so fingerprinting HEAD makes every handoff stale on arrival.
  const a = derive('/r', { gitFn: fakeGit({ 'rev-parse --short': 'aaa1111' }), fsys: fsNone, now: at });
  const b = derive('/r', { gitFn: fakeGit({ 'rev-parse --short': 'bbb2222' }), fsys: fsNone, now: at });
  assert.equal(a.fingerprint, b.fingerprint);
  assert.notEqual(a.head, b.head, 'head is still REPORTED, it just does not drive staleness');
});

test('render emits one key per line, parseable back', () => {
  const out = render({ a: '1', b: '2' });
  assert.equal(out, 'a: 1\nb: 2');
});

test('COMMITTING THE HANDOFF MUST NOT INVALIDATE IT: head and tree state are excluded', () => {
  const before = derive('/r', { gitFn: fakeGit({ 'rev-parse --short': 'aaa1111', 'status --porcelain': ' M f' }), fsys: fsNone, now: at });
  const after  = derive('/r', { gitFn: fakeGit({ 'rev-parse --short': 'bbb2222', 'status --porcelain': '' }), fsys: fsNone, now: at });
  assert.equal(before.fingerprint, after.fingerprint,
    'writing then committing changes head and cleans the tree; if that reads as stale the signal is noise');
});

test('B-11376: a different BASE does NOT read as divergence, and that is the ruling', () => {
  // This test asserted the opposite until 2026-10-20. `base` was fingerprinted, and `base`
  // necessarily changes the moment the entry is committed and its branch merges, so an entry passed
  // handoff-gate when written and failed from then on. Observed end to end in one session: PASS on
  // the branch, the pull request merged, and the same entry read stale immediately after.
  //
  // WHAT IS GIVEN UP, stated rather than hidden: a handoff genuinely written against a different
  // base no longer reads as divergent. That was a real signal. It was also indistinguishable from
  // the same handoff having simply landed, and a check that cannot tell CHANGED from LANDED reports
  // `different` always, which is as uninformative as reporting `same` always. The operator ruled to
  // narrow it (B-11376, A) rather than keep a signal nobody could act on.
  const a = derive('/r', { gitFn: fakeGit({ 'merge-base': 'aaaaaaaaaa' }) });
  const b = derive('/r', { gitFn: fakeGit({ 'merge-base': 'bbbbbbbbbb' }) });
  assert.equal(a.fingerprint, b.fingerprint, 'base must not move the fingerprint');
  // NON-VACUITY: the fingerprint still moves for the things that make a handoff wrong to act on,
  // so this is a narrowing and not a disabling.
  const other = derive('/r', { gitFn: fakeGit({ 'rev-parse --abbrev-ref': 'x/B-77-other' }) });
  assert.notEqual(a.fingerprint, other.fingerprint, 'a different ITEM must still diverge');
});

test('B-11376: a different BRANCH alone does not diverge, once the item is unchanged', () => {
  // `branch` described where the writer stood. Merging changes it with no change to the work, and
  // `item` is the field that carries what the handoff is ABOUT.
  const a = derive('/r', { gitFn: fakeGit({ 'rev-parse --abbrev-ref': 'qos/human/B-50-a' }) });
  const b = derive('/r', { gitFn: fakeGit({ 'rev-parse --abbrev-ref': 'qos/fleet/QOS/B-50-b' }) });
  assert.equal(a.fingerprint, b.fingerprint, 'two branches naming one item are one handoff');
});

test('a diagnosis reaching a verdict reads as divergence', () => {
  const g = fakeGit({ 'rev-parse --abbrev-ref': 'x/B-99-y' });
  const open_ = derive('/r', { gitFn: g, fsys: { readFileSync: () => '{"verdict":null}' }, now: at });
  const closed = derive('/r', { gitFn: g, fsys: { readFileSync: () => '{"verdict":"CAUSE-ESTABLISHED"}' }, now: at });
  assert.notEqual(open_.fingerprint, closed.fingerprint);
});

// ── B-11387: the trailer read must skip the synthetic merge commit CI checks out ────────────────
// On a pull_request event actions/checkout builds a merge ref, so HEAD is a merge commit GitHub
// wrote. It carries no Depth or Parent trailer, so depth read 0 and parent read none in CI while the
// authored commit said 1 and its parent. Both are fingerprinted, so H2 diverged on every run.
test('B-11387: depth and parent are read with --no-merges, so a merge ref cannot blank them', () => {
  const seen = [];
  const spy = (repo, args) => { seen.push(args.join(' ')); return args.includes('--pretty=%B') ? 'x\n\nDepth: 1\nParent: B-1000\n' : null; };
  const f = derive('/r', { gitFn: spy, fsys: fsNone, now: at });
  assert.ok(seen.some((c) => c.startsWith('log -1 --no-merges --pretty=%B')),
    'the trailer read must pass --no-merges, or a merge ref supplies a trailerless commit');
  assert.equal(f.depth, '1');
  assert.equal(f.parent, 'B-1000');
});

// ── B-11387: could-not-read and detached-head are different, and only one may use the environment ──
test('B-11387: GITHUB_HEAD_REF is consulted ONLY when git reports a detached head', () => {
  const prev = process.env.GITHUB_HEAD_REF;
  process.env.GITHUB_HEAD_REF = 'qos/human/B-9999-from-env';
  try {
    // git FAILED: must stay UNREADABLE, never a plausible default from the environment.
    const failed = derive('/r', { gitFn: () => null, fsys: fsNone, now: at });
    assert.equal(failed.branch, UNREADABLE, 'a failed read must not be filled in from the environment');
    // git SUCCEEDED and said HEAD: detached, so the environment restores the one input the merge ref removed.
    const detached = derive('/r', {
      gitFn: (repo, args) => (args.join(' ').startsWith('rev-parse --abbrev-ref') ? 'HEAD' : null),
      fsys: fsNone, now: at,
    });
    assert.equal(detached.branch, 'qos/human/B-9999-from-env');
    assert.equal(detached.item, 'B-9999', 'and item follows the restored branch');
  } finally {
    if (prev === undefined) delete process.env.GITHUB_HEAD_REF; else process.env.GITHUB_HEAD_REF = prev;
  }
});
