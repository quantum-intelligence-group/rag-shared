#!/usr/bin/env node
/**
 * HANDOFF PROTOCOL — the handoff nobody writes when a session does not end cleanly. B-11291.
 *
 * The close gate checks that a handoff exists, which covers the case where a session reaches its own
 * close. It cannot cover the case that matters most: a session killed, reaped, OOMed, timed out or
 * disconnected writes nothing, and the next session resumes from an entry describing work two sessions
 * back. The blueprint recorded this as PARTIAL with the reason "no run wrapper writes it on an abnormal
 * ending", and this is that wrapper's payload.
 *
 * WHAT IT REFUSES TO DO, and this is the whole design. It does NOT write a normal handoff entry. An
 * abnormal ending is not a handoff, it is the ABSENCE of one, and a record that looks like a clean close
 * is worse than no record: the next session reads it, believes the work was handed over, and does not go
 * looking. So the entry it writes is explicitly marked, carries the signal or exit code that ended the
 * session, and says in its own text that the judgement lines were never written by anyone.
 *
 * THE DERIVED BLOCK IS STILL WORTH HAVING. `handoff-derive.mjs` produces item, branch, head, base, diff
 * and working-tree state from the repository itself, with no model and no session cooperation, so it is
 * available precisely when the session is gone. What is lost in an abnormal ending is the WHY and the
 * NEXT, which only the session knew, and the entry says so rather than leaving blanks that read as
 * "nothing to report".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { derive, render } from './handoff-derive.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = process.env.QOS_REPO || path.resolve(HERE, '../..');
export const ARCHIVE_DIR = 'docs/state/abnormal-endings';

/** PURE. How did this session end? Named, never guessed, and "unknown" is a real answer. */
export function endingOf({ signal = null, code = null } = {}) {
  if (signal) return { kind: 'signal', detail: String(signal), why: `killed by ${signal}` };
  if (code === 0) return { kind: 'clean', detail: '0', why: 'exited 0: this is a CLEAN ending and needs no abnormal record' };
  if (Number.isInteger(code)) return { kind: 'exit', detail: String(code), why: `exited ${code} without running the close protocol` };
  return { kind: 'unknown', detail: 'unknown',
    why: 'the session ended and neither a signal nor an exit code was recorded. Unknown is recorded as '
      + 'unknown: inventing "exited 0" here would turn every lost session into a clean close.' };
}

/**
 * PURE. The entry text. Deliberately NOT the shape of a normal handoff entry.
 *
 * It carries the derived block, which is machine-written and trustworthy, and it states the two things
 * that are missing rather than leaving them as empty fields. `_???_` is what the close engine leaves for a
 * human to fill; here there is nobody to fill it, and pretending otherwise is the failure.
 */
export function entryFor(fields, ending, { now = new Date() } = {}) {
  const iso = now.toISOString();
  return [
    `## ABNORMAL ENDING, ${iso.slice(0, 10)}: no handoff was written by the session`,
    '',
    '<!-- abnormal: machine-written after the session ended. NOT a handoff. -->',
    `ending: ${ending.kind}:${ending.detail}`,
    `recorded_at: ${iso}`,
    `why: ${ending.why}`,
    '<!-- /abnormal -->',
    '',
    // `render` returns a STRING, not an array of lines. Spreading it split the derived block into one
    // character per line, which is exactly the shape a first run would have shipped unnoticed: the file
    // existed, had the right name and the right size, and was unreadable.
    render(fields),
    '',
    '[observed] This entry exists because the session ended without running the close protocol. Everything',
    'above the line is DERIVED from the repository, so it is as reliable as any other derived block.',
    '',
    '[missing] The WHY and the NEXT were never written, by anyone. They are not blank because there was',
    'nothing to report; they are blank because the session that knew them is gone. Do not read this entry',
    'as a handoff, and do not resume from it as though work was handed over: verify the state yourself',
    'against the branch and the diff named above before continuing it.',
    '',
  ].join('\n');
}

/** Write the record. Returns what it did, and never throws into a shell trap. */
export function record({ signal = null, code = null, repo = REPO, now = new Date(), fsys = fs } = {}) {
  const ending = endingOf({ signal, code });
  if (ending.kind === 'clean') return { wrote: false, ending, why: ending.why };
  let fields;
  try { fields = derive(repo, { now }); }
  catch (e) { return { wrote: false, ending, why: `could not derive the block: ${String(e.message).slice(0, 120)}` }; }
  const dir = path.join(repo, ARCHIVE_DIR);
  const file = path.join(dir, `${now.toISOString().replace(/[:.]/g, '-')}.md`);
  try {
    fsys.mkdirSync(dir, { recursive: true });
    fsys.writeFileSync(file, entryFor(fields, ending, { now }));
  } catch (e) {
    // A trap handler that throws loses the exit code it was meant to preserve, so this reports and returns.
    return { wrote: false, ending, why: `could not write ${file}: ${String(e.message).slice(0, 120)}` };
  }
  return { wrote: true, ending, file, why: `recorded an abnormal ending (${ending.kind}:${ending.detail})` };
}

if (import.meta.url === `file://${path.resolve(process.argv[1] || '')}`) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
  const sig = arg('--signal');
  const codeArg = arg('--code');
  const r = record({ signal: sig, code: codeArg === null ? null : Number(codeArg) });
  console.log(`abnormal-end-handoff: ${r.wrote ? 'WROTE' : 'no record'} — ${r.why}`);
  if (r.file) console.log(`  ${path.relative(REPO, r.file)}`);
  // Always 0: this runs inside an exit trap and must not replace the exit code it was called to preserve.
  process.exit(0);
}
