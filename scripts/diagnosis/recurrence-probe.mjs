#!/usr/bin/env node
/**
 * ROOT CAUSE PROTOCOL, SECTION 8 — THE RECURRENCE PROBE. B-11291.
 *
 * "Without this section the protocol is a compliance regime that measures its own paperwork." The
 * refuted-cause rate was built and reports 0% over 11 established closures, flagging itself SUSPICIOUS
 * with the right instruction: "Either the protocol is working or the recurrence probes are too weak to
 * detect returns. Check the second before believing the first."
 *
 * MEASURED 2026-09-25, and it settles that question. Of the 11 CAUSE-ESTABLISHED artifacts:
 *
 *     carry a reproduce command      0 of 11
 *     carry a symptom statement      3 of 11
 *     carry any candidate probe      6 of 11
 *
 * So the rate is not zero because causes were right. It is zero because NOTHING IS RE-RUNNABLE. The probe
 * had nothing to probe, and a rate computed over an empty probe set is a rate of nothing.
 *
 * THIS TOOL THEREFORE HAS TWO JOBS AND THE FIRST IS THE IMPORTANT ONE.
 *
 *   1. Report how many established closures are RE-PROBABLE at all. That number, not the refuted rate,
 *      is what says whether section 8 exists. It is printed first and always.
 *   2. Re-run the reproduce commands that exist, and reopen anything whose symptom returned.
 *
 * EXECUTION IS OPT-IN. Re-running a command recorded in a JSON file is arbitrary code execution from
 * data, and this tool is scheduled. Default is a dry report naming exactly what it WOULD run; `--run`
 * executes. A scheduled caller that wants the probe passes it deliberately.
 *
 * A CLEAN RUN IS WEAK POSITIVE EVIDENCE, NEVER CONFIRMATION, because the document says so and the reason
 * is real: "a symptom can stop reproducing because surrounding code changed rather than because the cause
 * was fixed."
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = process.env.QOS_REPO || path.resolve(HERE, '../..');
export const DIAGNOSIS_DIR = 'docs/state/diagnosis';

export const RETURNED = 'RETURNED', CLEAN = 'CLEAN', NOT_PROBABLE = 'NOT-PROBABLE', NOT_RUN = 'NOT-RUN';

/**
 * The date from which a CAUSE-ESTABLISHED artifact must carry a reproduce command.
 *
 * Grandfathering the existing 11 deliberately: requiring it retroactively would refuse artifacts written
 * before the requirement existed, and the whole point of section 8 is what happens NEXT. A rule applied
 * backwards is an outage.
 */
export const REPRODUCE_REQUIRED_AT = process.env.RECURRENCE_REQUIRED_AT || '2026-09-26T00:00:00Z';

/** PURE. Can this artifact be re-probed, and if not, precisely what is missing? */
export function probability(artifact) {
  if (!artifact || typeof artifact !== 'object') {
    return { state: NOT_PROBABLE, why: 'the artifact could not be read' };
  }
  if (artifact.verdict !== 'CAUSE-ESTABLISHED') {
    return { state: NOT_PROBABLE, skip: true,
      why: `verdict is ${artifact.verdict ?? '(none)'}; section 8 re-runs CAUSE-ESTABLISHED closures only` };
  }
  const aba = (artifact.aba && typeof artifact.aba === 'object') ? artifact.aba : {};
  const cmd = aba.reproduce || aba.reproduce_cmd || artifact.reproduce || null;
  const symptom = artifact.symptom && artifact.symptom.statement;
  const missing = [];
  if (!cmd) missing.push('a reproduce command (aba.reproduce)');
  if (!symptom) missing.push('a symptom statement (symptom.statement)');
  if (missing.length) {
    return { state: NOT_PROBABLE, missing,
      why: `closed on an established cause and cannot be re-run: missing ${missing.join(' and ')}. `
        + 'A closure nothing can re-probe contributes to a refuted-cause rate of zero without any evidence '
        + 'that the cause was right.' };
  }
  return { state: 'probable', cmd, symptom, why: `re-runnable: ${cmd}` };
}

/** PURE. Judge one probe result. A clean run is WEAK, and says so. */
export function judgeRun({ ok = null, output = '' } = {}) {
  if (ok === null) return { state: NOT_RUN, why: 'the reproduce command was not run' };
  if (ok === false) {
    return { state: RETURNED, proof: true,
      why: 'the reproduce command FAILED, so the symptom returned after the item closed on an established '
        + 'cause. Reopen tagged cause-refuted: the surviving candidate was wrong, and the rejected ones in '
        + 'the artifact stay rejected so the next diagnosis does not re-walk them.',
      excerpt: String(output).slice(0, 300) };
  }
  return { state: CLEAN, proof: false,
    why: 'the reproduce command passed. WEAK POSITIVE, not confirmation: a symptom can stop reproducing '
      + 'because surrounding code changed rather than because the cause was fixed.' };
}

/** Read every artifact. Returns null when the directory cannot be read: NOT-MEASURED, never an empty set. */
export function readArtifacts(dir = path.join(REPO, DIAGNOSIS_DIR), { fsys = fs } = {}) {
  let names;
  try { names = fsys.readdirSync(dir); } catch { return null; }
  const out = [];
  for (const n of names) {
    if (!n.endsWith('.json')) continue;
    let parsed = null;
    try { parsed = JSON.parse(fsys.readFileSync(path.join(dir, n), 'utf8')); } catch { parsed = null; }
    out.push({ file: n, item: n.replace(/\.json$/, ''), artifact: parsed });
  }
  return out;
}

/** PURE. The census, which is this tool's primary output. */
export function census(entries) {
  if (entries === null) {
    return { measured: false, why: 'the diagnosis directory could not be read, so nothing was counted' };
  }
  const established = entries.filter((e) => e.artifact && e.artifact.verdict === 'CAUSE-ESTABLISHED');
  const judged = established.map((e) => ({ ...e, p: probability(e.artifact) }));
  const probable = judged.filter((x) => x.p.state === 'probable');
  const unprobable = judged.filter((x) => x.p.state === NOT_PROBABLE);
  return {
    measured: true, established: established.length,
    probable: probable.length, unprobable: unprobable.length,
    coverage: established.length ? probable.length / established.length : null,
    rows: judged,
    why: established.length === 0
      ? 'no CAUSE-ESTABLISHED closures yet, so there is nothing for section 8 to re-run. Not a pass.'
      : (probable.length === 0
        ? `NONE of ${established.length} established closure(s) is re-runnable. The refuted-cause rate over `
          + 'this set is a rate of nothing, and reading it as "the protocol is working" is the specific '
          + 'mistake the rate tool warns about.'
        : `${probable.length} of ${established.length} established closure(s) can be re-run.`),
  };
}

/** PURE. Must this artifact carry a reproduce command yet? Grandfathered before the date. */
export function reproduceOwed(artifact, { firstSeenIso = null, at = REPRODUCE_REQUIRED_AT } = {}) {
  if (!artifact || artifact.verdict !== 'CAUSE-ESTABLISHED') return { owed: false, why: 'not an established cause' };
  const t = Date.parse(firstSeenIso || '');
  if (!Number.isFinite(t)) {
    return { owed: false, measured: false,
      why: 'the artifact\'s first-seen date could not be read, so whether it predates the requirement is '
        + 'unknown. Not owed, and recorded as unmeasured rather than counted as compliant.' };
  }
  if (t < Date.parse(at)) return { owed: false, why: `predates the requirement (${at}), grandfathered` };
  const aba = (artifact.aba && typeof artifact.aba === 'object') ? artifact.aba : {};
  const has = !!(aba.reproduce || aba.reproduce_cmd || artifact.reproduce);
  return { owed: !has, why: has ? 'carries a reproduce command' :
    'CAUSE-ESTABLISHED and carries no reproduce command, so section 8 can never re-run it and its closure '
    + 'can never be refuted by evidence' };
}

export function render(c, results = []) {
  const L = [];
  if (!c.measured) { L.push(`recurrence-probe (Root Cause, section 8) — NOT-MEASURED: ${c.why}`); return L; }
  const pct = c.coverage === null ? 'n/a' : `${Math.round(c.coverage * 100)}%`;
  L.push(`recurrence-probe (Root Cause, section 8) — RE-PROBABLE COVERAGE ${pct}: ${c.why}`);
  L.push(`  ${c.established} established · ${c.probable} re-runnable · ${c.unprobable} not`);
  for (const r of c.rows.filter((x) => x.p.state === NOT_PROBABLE && !x.p.skip)) {
    L.push(`  ✖ ${r.item}: ${r.p.why}`);
  }
  for (const r of results) L.push(`  ${r.state === RETURNED ? '✖' : '✓'} ${r.item}: ${r.state} — ${r.why}`);
  if (c.probable === 0 && c.established > 0) {
    L.push('  Coverage, not the refuted rate, is the number that says whether section 8 exists. A rate');
    L.push('  computed over an empty probe set is a rate of nothing.');
  }
  return L;
}

/** When git first recorded this artifact. Returns null when it cannot be read, never a plausible date. */
export function firstSeen(file, { repo = REPO, run = null } = {}) {
  const exec = run || ((args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }));
  try {
    const out = exec(['log', '--diff-filter=A', '--format=%aI', '-1', '--', `${DIAGNOSIS_DIR}/${file}`]).trim();
    return out || null;
  } catch { return null; }
}

/**
 * PURE. The forward-looking half, and the reason the probe will not stay at 0% coverage.
 *
 * Without this, every future CAUSE-ESTABLISHED artifact joins the 11 that cannot be re-run, and section 8
 * remains a measurement of nothing no matter how good the diagnoses are. Grandfathered before the date,
 * because requiring it retroactively would refuse artifacts written before the requirement existed.
 */
export function owedReport(entries, { at = REPRODUCE_REQUIRED_AT, seen = firstSeen } = {}) {
  if (entries === null) return { measured: false, owed: [], unmeasured: [], why: 'artifacts unreadable' };
  const owed = []; const unmeasured = [];
  for (const e of entries) {
    if (!e.artifact || e.artifact.verdict !== 'CAUSE-ESTABLISHED') continue;
    const r = reproduceOwed(e.artifact, { firstSeenIso: seen(e.file), at });
    if (r.measured === false) unmeasured.push({ item: e.item, why: r.why });
    else if (r.owed) owed.push({ item: e.item, why: r.why });
  }
  return { measured: true, owed, unmeasured,
    why: owed.length
      ? `${owed.length} artifact(s) closed CAUSE-ESTABLISHED on or after ${at} with no reproduce command`
      : `every CAUSE-ESTABLISHED artifact on or after ${at} carries a reproduce command` };
}

if (import.meta.url === `file://${path.resolve(process.argv[1] || '')}`) {
  const run = process.argv.includes('--run');
  const gating = process.argv.includes('--gate');
  const entries = readArtifacts();
  const c = census(entries);
  const results = [];
  if (run && c.measured) {
    for (const r of c.rows.filter((x) => x.p.state === 'probable')) {
      let ok = null; let output = '';
      try { output = execFileSync('bash', ['-lc', r.p.cmd], { cwd: REPO, encoding: 'utf8', timeout: 120000 }); ok = true; }
      catch (e) { ok = false; output = `${e.stdout || ''}${e.stderr || ''}`; }
      results.push({ item: r.item, ...judgeRun({ ok, output }) });
    }
  } else if (c.measured && c.probable > 0) {
    for (const r of c.rows.filter((x) => x.p.state === 'probable')) {
      results.push({ item: r.item, state: NOT_RUN, why: `would run: ${r.p.cmd} (pass --run to execute)` });
    }
  }
  console.log(render(c, results).join('\n'));
  // THE FORWARD-LOOKING HALF. Without it the coverage number can only ever get worse.
  const owed = owedReport(entries);
  if (owed.measured && owed.owed.length) {
    console.log('');
    console.log(`  ✖ ${owed.why}:`);
    for (const o of owed.owed) console.log(`      ${o.item}`);
    console.log('  A cause established with nothing to re-run cannot be refuted by evidence, so section 8');
    console.log(`  never sees it. Add aba.reproduce. Artifacts first committed before ${REPRODUCE_REQUIRED_AT}`);
    console.log('  are grandfathered: requiring it backwards would refuse work written before the rule.');
  }
  if (owed.measured && owed.unmeasured.length) {
    console.log(`  ? ${owed.unmeasured.length} artifact(s) whose first-commit date could not be read, so`);
    console.log('    whether they are grandfathered is unknown. Recorded, not counted as compliant.');
  }
  const returned = results.filter((r) => r.state === RETURNED).length;
  // exit 1 only for a symptom that actually came back. Zero coverage is exit 2: it is a measurement gap,
  // and it is the state this repository is in today.
  const owedFail = owed.measured && owed.owed.length ? 1 : 0;
  process.exit(gating
    ? (returned || owedFail ? 1 : (c.measured && c.probable === 0 && c.established > 0 ? 2 : 0))
    : 0);
}
