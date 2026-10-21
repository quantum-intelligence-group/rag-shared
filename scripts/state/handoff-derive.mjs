// The derived block of a handoff. The agent writes the reasoning; THIS writes the state.
//
// Nothing here is typed by the agent, so nothing here can be wrong in the direction the agent wishes.
// "Built, tested" stops being a possible summary once the branch, the head commit, the diff size and
// the diagnosis verdict are all read off the tree instead of recalled.
//
// The block carries a FINGERPRINT. Staleness is fingerprint mismatch, not age: a handoff written an
// hour ago on a since-rebased branch is stale; one written six weeks ago on an untouched module is not.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ITEM_PREFIX_SRC } from '../governance/item-namespaces.mjs';

export const UNREADABLE = 'UNREADABLE';   // never blank, never a plausible-looking default

function git(repo, args, { exec = execFileSync } = {}) {
  try {
    return String(exec('git', ['-C', repo, ...args], { encoding: 'utf8', timeout: 30000, maxBuffer: 64 * 1024 * 1024 })).trim();
  } catch { return null; }
}

/** PURE given its readers. Every field is either a real reading or the literal UNREADABLE. */
export function derive(repo, { gitFn = git, fsys = fs, now = new Date() } = {}) {
  // B-11387. THE BRANCH NAME IS NOT AVAILABLE IN THE PLACE THIS GATE IS ENFORCED, and because `item`
  // is derived from it, the gate could not pass in CI at all.
  //
  // `actions/checkout` builds a DETACHED merge ref for a pull request, so `rev-parse --abbrev-ref HEAD`
  // returns the literal "HEAD". `item` is then matched against `${branch} ${subject}`, the branch half
  // contributes nothing, and the SUBJECT wins instead. That does not yield UNREADABLE, which would at
  // least be honest. It yields a DIFFERENT, real-looking item: the last commit's id rather than the
  // branch's. Measured on one commit, e835d7b38, 2026-10-02: on the branch `item` is B-11380; detached
  // it is B-11376. `item` is fingerprinted, so the fingerprint diverges and H2 refuses, every time,
  // for every pull request, while the same commit passes locally.
  //
  // This is B-11376's defect one layer down. That fix removed `branch` and `base` from the fingerprint
  // because they move when an entry merges. `item` was left in, correctly, since a handoff naming a
  // different item IS wrong to act on. What was missed is that `item` is DERIVED FROM the branch, so
  // excluding the branch from the fingerprint did not stop the branch from deciding the answer.
  //
  // GITHUB_HEAD_REF is what Actions sets to the pull request's source branch, so reading it restores
  // the one input the detached checkout removed. It is read ONLY when git says the head is detached,
  // so it can never override a real branch in a normal checkout.
  // A FAILED READ IS UNREADABLE, AND THE FIRST DRAFT OF THIS FIX BROKE THAT. It fell back to
  // GITHUB_HEAD_REF whenever the branch was not a usable name, which lumped "git could not answer"
  // (null) together with "git answered HEAD" (detached). In CI, where GITHUB_HEAD_REF is always set on
  // a pull_request event, an unreadable branch then came back as a real-looking branch name. That is a
  // plausible default standing in for a missing measurement, which is the thing this module exists to
  // refuse, and an existing test caught it rather than a reviewer.
  //
  // So the two cases are separated: null stays UNREADABLE, and only the literal 'HEAD', which is git
  // SUCCEEDING and reporting a detached head, consults the environment.
  const rawBranch = gitFn(repo, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = (rawBranch === null || rawBranch === undefined)
    ? UNREADABLE
    : (rawBranch === 'HEAD' ? (process.env.GITHUB_HEAD_REF || rawBranch) : rawBranch);
  const head = gitFn(repo, ['rev-parse', '--short', 'HEAD']) ?? UNREADABLE;
  const base = gitFn(repo, ['merge-base', 'HEAD', 'origin/main']) ?? UNREADABLE;
  const stat = base !== UNREADABLE ? gitFn(repo, ['diff', '--shortstat', `${base}..HEAD`]) : null;
  const files = base !== UNREADABLE ? gitFn(repo, ['diff', '--name-only', `${base}..HEAD`]) : null;
  const dirty = gitFn(repo, ['status', '--porcelain']);
  // --no-merges for the same reason as `body` below: `item` falls back to the subject, and a merge
  // commit's subject is "Merge <sha> into <sha>", which names no item.
  const subject = gitFn(repo, ['log', '-1', '--no-merges', '--pretty=%s']) ?? UNREADABLE;

  const itemMatch = new RegExp(`\\b(${ITEM_PREFIX_SRC}-\\d{2,6})\\b`).exec(`${branch} ${subject}`);
  const item = itemMatch ? itemMatch[1] : UNREADABLE;

  // Depth and parent come from the last commit's trailers, not from the agent's memory of them.
  //
  // `--no-merges` IS LOAD-BEARING, AND ITS ABSENCE WAS THE SECOND HALF OF B-11387. On a pull_request
  // event actions/checkout builds a MERGE ref, so HEAD is a synthetic merge commit that GitHub wrote.
  // It carries no Depth: and no Parent: trailers, because no author wrote it. `depth` therefore read 0
  // and `parent` read none in CI while the real commit said 1 and B-11380, and both are fingerprinted,
  // so H2 diverged even after `item` was fixed. Measured on 8fa259e39: locally 3340cf9927ede0d2,
  // in CI c6b3314bed3b18e6, which is the fingerprint of a DIFFERENT, older state.
  //
  // Skipping merges makes the read identical in both places: locally there is no merge commit to skip,
  // and in CI it reaches the commit the author actually wrote. Same reasoning as GITHUB_HEAD_REF above,
  // one field along. This is the third instance of one class: a fingerprinted field whose value depends
  // on HOW the tree was checked out rather than on what the tree contains.
  const body = gitFn(repo, ['log', '-1', '--no-merges', '--pretty=%B']) ?? '';
  const depth = (/^Depth:\s*(\d+)\s*$/m.exec(body) || [])[1] ?? '0';
  const parent = (/^Parent:\s*(\S+)\s*$/m.exec(body) || [])[1] ?? 'none';

  // Diagnosis artifact and its verdict, read from the file rather than recalled.
  let diagnosis = 'none', verdict = 'n/a';
  if (item !== UNREADABLE) {
    const p = path.join(repo, 'docs/state/diagnosis', `${item}.json`);
    try {
      const d = JSON.parse(fsys.readFileSync(p, 'utf8'));
      diagnosis = `docs/state/diagnosis/${item}.json`;
      verdict = d?.verdict ?? 'null (open)';
    } catch { /* no artifact: 'none' is a real answer */ }
  }

  const fields = {
    item, depth, parent, branch, head,
    base: base === UNREADABLE ? UNREADABLE : base.slice(0, 9),
    diff: stat ? stat.replace(/\s+/g, ' ').trim() : (base === UNREADABLE ? UNREADABLE : 'no change'),
    files_changed: files == null ? UNREADABLE : String(files.split('\n').filter(Boolean).length),
    working_tree: dirty == null ? UNREADABLE : (dirty.trim() === '' ? 'clean' : `${dirty.split('\n').filter(Boolean).length} uncommitted path(s)`),
    diagnosis, verdict,
    derived_at: now.toISOString(),
  };

  // WHAT THE FINGERPRINT COVERS, AND WHY IT IS NOT EVERYTHING.
  //
  // The protocol fingerprints the base commit, the artifact state and the stage. Not the head, and not
  // the working tree. That looked like an omission until this was used: writing the handoff and then
  // committing it CHANGES the head and cleans the tree, so a fingerprint over those fields can never
  // match by the time anyone reads it. Every handoff would read as stale, the signal would be noise,
  // and the check would be turned off.
  //
  // So head, diff, files_changed, working_tree and derived_at are reported as CONTEXT and excluded
  // from the fingerprint. What is fingerprinted is what would make the handoff WRONG to act on: a
  // different item, a diagnosis that has since reached a verdict, or a different place in the
  // descent. That is divergence. The rest is just time passing.
  //
  // B-11376, operator ruled 2026-10-20: `branch` and `base` are OUT, for the same reason `head` and
  // `working_tree` already were. Both describe WHERE THE WRITER WAS STANDING, and both necessarily
  // change the moment the entry is committed and its branch merges. An entry therefore passed
  // `handoff-gate` when it was written and failed from then on. Observed end to end in one session:
  // PASS on the branch, the pull request merged, and the same entry read stale immediately after.
  //
  // A fingerprint that cannot match after the thing it describes has landed does not distinguish a
  // CHANGED handoff from a LANDED one, so nothing can be built on it. That is the same defect class
  // as `head`: a check that always says `different` is as uninformative as one that always says
  // `same`.
  //
  // THE COMMENT ABOVE AT B-11376's FOLLOW-ON SAID THIS WAS ALREADY DONE. It was not. The narrowing
  // was described in prose while `FINGERPRINTED` still listed both fields, so the follow-on fix for
  // `item` was built on a premise its own file contradicted. Checked before this edit rather than
  // read: `grep "'branch', 'base'"` matched line 119.
  //
  // `item` STAYS IN, correctly: a handoff naming a different item IS wrong to act on. The B-11380
  // detached-checkout problem is about `item` being DERIVED from the branch, which is a separate
  // defect fixed separately and is not an argument for fingerprinting the branch itself.
  const FINGERPRINTED = ['item', 'depth', 'parent', 'diagnosis', 'verdict'];
  const material = FINGERPRINTED.map((k) => `${k}=${fields[k]}`).join('\n');
  fields.fingerprint = crypto.createHash('sha256').update(material).digest('hex').slice(0, 16);
  return fields;
}

export function render(fields) {
  return Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { fileURLToPath } = await import('node:url');
  const REPO = process.env.QOS_REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  // B-11404/AC4. THIS SCRIPT PRINTS; IT HAS NEVER WRITTEN ANYTHING. It used to accept any flag and exit 0,
  // so `--write` read as a success while doing nothing, and a session believed the derived block had been
  // inserted on that basis. handoff-gate's own remedy text names this command, which is why the silence
  // mattered: following the instruction appeared to work and changed no bytes. Refusing the flag is the
  // fix; writing the file is session-close's job, and it now asks for the block rather than being told
  // to run this by hand.
  const unknown = process.argv.slice(2).filter((x) => x.startsWith('-'));
  if (unknown.length) {
    process.stderr.write(`handoff-derive: this command only PRINTS the derived block; it writes nothing.\n`
      + `  refused flag(s): ${unknown.join(' ')}\n`
      + `  to write a HANDOFF entry: node scripts/fleet/session-close.mjs --write\n`);
    process.exit(2);
  }
  console.log(render(derive(REPO)));
}
