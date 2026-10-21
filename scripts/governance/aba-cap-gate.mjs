#!/usr/bin/env node
/**
 * A/B/A VERDICT CAP (Root Cause Protocol, F10) — commit-msg gate.
 *
 * An artifact may not claim CAUSE-ESTABLISHED on an A/B/A the committing agent produced itself. Inside
 * one worker the agent and the runner are the same principal, so a locally minted result is the agent's
 * own account of its own work, and that is precisely the field the protocol says it does not get to
 * author.
 *
 * A CAP, NOT A REQUIREMENT, and the number is why. On 2026-09-24, 11 of the 15 committed artifacts
 * claim CAUSE-ESTABLISHED and NOT ONE carries a trusted A/B/A. Demanding one outright would mean no
 * diagnosis closes as a cause until CI has run the limbs, stranding every open investigation. The cap
 * strands nobody: CORRELATE-ONLY closing as mitigated is legitimate and the protocol says so. What is
 * withdrawn is the ability to assert causation from narrated text.
 *
 * A RATCHET, for the same reason the reconciliation gate is one. It judges the artifacts this commit
 * ADDS OR MODIFIES, read from the staged tree. The eleven already on the board are the sweep's business.
 */
import { execFileSync } from 'node:child_process';
import { capVerdict } from '../diagnosis/aba.mjs';

/** PURE. The diagnosis artifact paths a name-status diff adds or modifies. */
export function touchedArtifacts(nameStatus) {
  if (nameStatus == null) return null;                       // unreadable, not empty
  const out = [];
  for (const line of String(nameStatus).split('\n')) {
    const [status, ...rest] = line.split('\t');
    const p = rest[rest.length - 1];
    if (!p || !/^[AM]/.test(status)) continue;
    if (/^docs\/state\/diagnosis\/.+\.json$/.test(p)) out.push(p);
  }
  return [...new Set(out)];
}

/** PURE. The gate verdict for a set of {path, artifact} pairs. */
export function gateVerdict(entries) {
  if (entries == null) {
    return { code: 2, lines: ['aba-cap (Root Cause Protocol, F10) — NOT-MEASURED: the staged diff could '
      + 'not be read, so no artifact was judged. A gate that could not look has cleared nothing.'] };
  }
  if (entries.length === 0) {
    return { code: 0, lines: ['aba-cap (Root Cause Protocol, F10) — PASS: this commit touches no diagnosis artifact.'] };
  }
  const bad = [], unread = [];
  for (const e of entries) {
    const r = capVerdict(e.artifact);
    if (r.measured === false) unread.push({ ...e, why: r.why });
    else if (!r.ok) bad.push({ ...e, ...r });
  }
  if (unread.length) {
    return { code: 2, lines: ['aba-cap (Root Cause Protocol, F10) — NOT-MEASURED:',
      ...unread.map((u) => `  ? ${u.path}: ${u.why}`),
      '  An artifact that could not be judged has not been cleared.'] };
  }
  if (!bad.length) {
    return { code: 0, lines: [`aba-cap (Root Cause Protocol, F10) — PASS: ${entries.length} artifact(s), every causal claim corroborated or not made.`] };
  }
  return { code: 1, lines: ['aba-cap (Root Cause Protocol, F10) — ✖ REFUSE: a causal claim rests on the agent\'s own account.',
    ...bad.map((b) => `  ✖ ${b.path}: ${b.why}`),
    `  Set "verdict" to ${bad[0].cap}, or produce the A/B/A on a runner the worker has no shell on.`,
    '  CORRELATE-ONLY closing as mitigated is legitimate and is not a downgrade in candour.',
    '  Protocol: docs/governance/DIAGNOSIS_PROTOCOL.md'] };
}

/**
 * PURE. Is this commit a MERGE, and if so which artifacts did its author actually write?
 *
 * WHY THIS EXEMPTION EXISTS, and why it is narrow. The gate reads `git diff --cached`, which during a
 * merge contains every file the merge brings in from the other branch. So a branch merging main was
 * judged as though its author had written all of main: a commit was refused today for a CAUSE-ESTABLISHED
 * verdict a different session wrote weeks earlier, which sits on main where this gate passes because
 * "this commit touches no diagnosis artifact". The same file, judged or not judged depending on who is
 * standing next to it.
 *
 * That blocked seventeen pull requests from being brought current, because the only way to update them
 * locally is to merge main, and the merge could not be committed.
 *
 * THE EXEMPTION IS NOT "SKIP MERGES". A merge author DOES write content: conflict resolutions are theirs,
 * and a resolution could introduce exactly the unsupported causal claim this gate is for. So the rule is
 * that during a merge the gate judges only artifacts whose staged content differs from BOTH parents. A
 * file taken unchanged from either side was not authored here and is the other commit's business; a file
 * that matches neither side was written by the merger and is judged as normal.
 *
 * Returns null when the merge state cannot be read, and null means "judge everything", because a gate
 * that fails open on an unreadable state is not a gate (R-14.4: unreadable is not empty).
 */
export function mergeAuthored(paths, readBlob) {
  if (!Array.isArray(paths) || paths.length === 0) return paths;
  let heads;
  try { heads = readBlob('MERGE_HEADS'); } catch { return null; }
  if (heads === null) return paths;            // not a merge: judge everything, unchanged behaviour
  if (!heads.length) return null;              // a merge with no readable parents: judge everything
  const authored = [];
  for (const path of paths) {
    let staged;
    try { staged = readBlob(`:${path}`); } catch { return null; }
    if (staged === null) { authored.push(path); continue; }
    let fromAParent = false;
    for (const h of heads) {
      let side = null;
      try { side = readBlob(`${h}:${path}`); } catch { side = null; }
      if (side !== null && side === staged) { fromAParent = true; break; }
    }
    if (!fromAParent) authored.push(path);
  }
  return authored;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('node:fs');
  let ns = null;
  try { ns = execFileSync('git', ['diff', '--cached', '--name-status'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }); }
  catch { ns = null; }
  let paths = touchedArtifacts(ns);
  // MERGE COMMITS: judge only what the merger actually wrote. See mergeAuthored above.
  if (paths !== null && paths.length) {
    const readBlob = (spec) => {
      if (spec === 'MERGE_HEADS') {
        // Present only during a merge. Absent is the normal case and means "not a merge".
        let txt;
        try { txt = fs.readFileSync('.git/MERGE_HEAD', 'utf8'); }
        catch {
          try { txt = execFileSync('git', ['rev-parse', '--git-path', 'MERGE_HEAD'], { encoding: 'utf8' }).trim(); txt = fs.readFileSync(txt, 'utf8'); }
          catch { return null; }
        }
        const list = txt.split('\n').map((l) => l.trim()).filter(Boolean);
        let head = null;
        try { head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { head = null; }
        return head ? [head, ...list] : list;
      }
      try { return execFileSync('git', ['show', spec], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }); }
      catch { return null; }
    };
    const narrowed = mergeAuthored(paths, readBlob);
    if (narrowed === null) {
      // Unreadable merge state: judge everything rather than waving the commit through.
      // An exemption that cannot verify its own precondition is not an exemption.
    } else if (narrowed.length !== paths.length) {
      const skipped = paths.length - narrowed.length;
      console.log(`aba-cap: merge commit — ${skipped} artifact(s) taken unchanged from a parent are not judged here; ${narrowed.length} authored in this merge are.`);
      paths = narrowed;
    }
  }
  let entries = null;
  if (paths !== null) {
    entries = [];
    for (const p of paths) {
      // Read the STAGED content, not the worktree: the commit is what is being judged.
      let artifact = null;
      try { artifact = JSON.parse(execFileSync('git', ['show', `:${p}`], { encoding: 'utf8' })); }
      catch { try { artifact = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { artifact = 'UNREADABLE'; } }
      entries.push({ path: p, artifact });
    }
  }
  const v = gateVerdict(entries);
  console.error(v.lines.join('\n'));
  process.exit(v.code);
}
