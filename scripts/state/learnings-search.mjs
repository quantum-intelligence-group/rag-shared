#!/usr/bin/env node
/**
 * B-11730. A MEMBER-SIDE SHIM FOR learnings-search, WHICH FAILS LOUDLY RATHER THAN QUIETLY.
 *
 * 15 of the 17 QOS members have a CLAUDE.md that MANDATES running this script before editing any
 * file, and do not have it. Measured 2026-10-20: present in QOS and ace only. Found by the lodestar
 * session, who filed it as sev2 against QOS, then widened to the family here.
 *
 * THE MISSING FILE IS THE SMALLER HALF. The same paragraph in all 15 said "No match is a real
 * answer", which is true where the script exists and is a trap where it does not: node exits
 * MODULE_NOT_FOUND, nothing prints on stdout, and the instruction has ALREADY told the session that
 * nothing printed IS the answer. So every recorded prevention silently did not bind in 15 repos
 * while the session believed it had checked. An absent measurement defaulting to the flattering
 * answer, in an instruction file, pre-approved.
 *
 * The instruction is amended in the same change (operator ruled C on 2026-10-20: both halves,
 * instruction first, so the next copied paragraph is safe). This shim is the other half.
 *
 * IT PRINTS ITS FAILURE ON STDOUT, NOT ONLY STDERR, AND EXITS NON-ZERO. That is the whole design.
 * A session that pipes stdout and ignores stderr is the exact reader this has to reach, and a
 * wrapper that whispered on stderr would reproduce the defect one layer out.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/** Where the real implementation lives. Overridable so a non-standard layout is not a dead end. */
export function umbrellaCandidates(env = process.env) {
  // QOS_UMBRELLA_ONLY replaces the list entirely. Without it, the not-found path cannot be exercised
  // on a machine where /opt/apps/QOS exists, and a loud-failure wrapper whose loud failure has never
  // been observed is exactly the defect it was written to prevent. My first test of this file could
  // not have detected a silent pass; it reported exit 0 because it found the real script and ran it.
  if (env.QOS_UMBRELLA_ONLY) return [env.QOS_UMBRELLA_ONLY];
  return [
    env.QOS_UMBRELLA && path.join(env.QOS_UMBRELLA, 'scripts/state/learnings-search.mjs'),
    '/opt/apps/QOS/scripts/state/learnings-search.mjs',
    path.resolve(process.cwd(), '../QOS/scripts/state/learnings-search.mjs'),
  ].filter(Boolean);
}

/** PURE. Pick the first candidate that exists, or null. Null is NOT-FOUND, never a silent pass. */
export function resolveReal(candidates, exists = existsSync) {
  for (const c of candidates) { try { if (exists(c)) return c; } catch { /* unreadable is not found */ } }
  return null;
}

export const NOT_FOUND_MESSAGE =
  'learnings-search COULD NOT RUN: the umbrella checkout was not found, so NO retrieval happened.\n'
  + 'This is NOT a no-match. Do not proceed as though no recorded prevention applies.\n'
  + 'Set QOS_UMBRELLA to the QOS checkout, or run this from a tree beside it.\n'
  + 'Looked in:\n';

if (import.meta.url === `file://${process.argv[1]}`) {
  const real = resolveReal(umbrellaCandidates());
  if (!real) {
    // stdout, deliberately: the failing reader is the one that only reads stdout.
    process.stdout.write(NOT_FOUND_MESSAGE + umbrellaCandidates().map((c) => `  ${c}\n`).join(''));
    process.exit(2);                       // 2, not 1: could-not-run is not the same as found-nothing
  }
  const r = spawnSync(process.execPath, [real, ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(r.status === null ? 2 : r.status);
}
