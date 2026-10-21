#!/usr/bin/env node
/**
 * CENSUS PROVENANCE — the census must be generated, not written.
 *
 * Rule 3 of the Root Cause Protocol: "Generate the census, do not write it. A tool greps for every
 * producer and consumer of the value or path named in the symptom and captures its output verbatim.
 * The agent's summary of a pipeline is precisely where the single-call-site error lives."
 *
 * `scripts/diagnosis/census.mjs` was built to produce that field and NOTHING EVER CALLED IT. Thirty-two
 * artifacts carry a `census` block and every one of them was typed by the agent whose work it is
 * evidence against. That is the Caller Protocol's case exactly: a capability with no caller is not
 * shipped, and a control nothing invokes enforces nothing.
 *
 * WHAT IS REFUSED, AND WHY IT IS THE SHAPE RATHER THAN THE TOOL. A census does not have to come from
 * census.mjs; an ad-hoc `git grep -c` is a perfectly good census if its output is captured. What it
 * may not be is a dictionary of bare numbers, because a number with no output behind it is a summary
 * of a count rather than the count. So the refusal is on shape: captured output must be present.
 *
 * WHERE REPRODUCTION IS BLOCKING AND WHERE IT IS NOT. When the artifact is being COMMITTED, the tree
 * it was generated from is the tree in front of us, so re-running census.mjs and comparing site sets
 * is exact and a mismatch is a real finding. Re-running later is not: the tree has moved and drift is
 * expected. Later runs therefore report and never refuse. A check that refuses on ordinary drift
 * would be withdrawn within a week, which is the same as never having built it.
 *
 * THREE STATES (R-14.4). An unreadable tree or an unreadable artifact is NOT-MEASURED and exits 2. It
 * is never a pass: "an unread tree is not a tree with no call sites" is the failure this whole file
 * exists to prevent, and it would be absurd to commit it here.
 *
 * DATE-SCOPED. Artifacts whose file was first committed before CENSUS_BINDS_FROM are reported and not
 * refused. Applying a new rule backwards is an outage, and there are thirty-two of them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { census, understated } from '../diagnosis/census.mjs';

export const REPO = process.env.QOS_REPO
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Nothing committed before this is refused. Thirty-two artifacts predate the rule. */
export const CENSUS_BINDS_FROM = process.env.CENSUS_BINDS_FROM || '2026-09-25T12:00:00Z';

export const PASS = 'PASS', REFUSE = 'REFUSE', GRANDFATHERED = 'GRANDFATHERED',
  NOT_MEASURED = 'NOT-MEASURED';

/**
 * PURE. Pull the tool invocation out of a `generated_by` line.
 * Returns null when the line does not name census.mjs, which is not an error: an ad-hoc census is
 * allowed, it just cannot be reproduced by this checker.
 */
export function parseGeneratedBy(line) {
  const s = String(line ?? '');
  if (!/scripts\/diagnosis\/census\.mjs/.test(s)) return null;
  const sym = /--symbol\s+(\S+)/.exec(s);
  const dir = /--dir\s+(\S+)/.exec(s);
  if (!sym) return null;
  return { symbol: sym[1], dir: dir ? dir[1] : 'scripts' };
}

/**
 * PURE. Does this census carry verbatim captured output, in either accepted shape?
 *   census.mjs shape : raw_output, a non-empty string
 *   ad-hoc shape     : commands[], each { cmd, output } with a non-empty output
 * A dictionary of numbers satisfies neither, deliberately.
 */
export function capturedOutput(c) {
  if (c == null || typeof c !== 'object') return { present: false, form: null };
  if (typeof c.raw_output === 'string' && c.raw_output.trim()) return { present: true, form: 'raw_output' };
  const cmds = Array.isArray(c.commands) ? c.commands : null;
  if (cmds && cmds.length && cmds.every((x) => x && String(x.cmd || '').trim() && String(x.output ?? '').trim())) {
    return { present: true, form: 'commands' };
  }
  if (cmds && cmds.length) {
    const bad = cmds.filter((x) => !x || !String(x.cmd || '').trim() || !String(x.output ?? '').trim()).length;
    return { present: false, form: 'commands', why: `${bad} of ${cmds.length} command entr(ies) carry no captured output` };
  }
  return { present: false, form: null };
}

/**
 * PURE. The refusals for one artifact. `openedAt` is when the artifact FILE first landed, not when
 * the diagnosis says it did; a field the artifact controls cannot decide whether the artifact is
 * grandfathered.
 */
export function provenanceRefusals(artifact, { openedAt = null, bindsFrom = CENSUS_BINDS_FROM } = {}) {
  if (artifact == null || typeof artifact !== 'object') {
    return { state: NOT_MEASURED, refusals: [], why: 'the artifact could not be read; an unreadable artifact is not a compliant one' };
  }
  // An artifact that predates the rule is reported, never refused.
  if (openedAt && new Date(openedAt).getTime() < new Date(bindsFrom).getTime()) {
    return { state: GRANDFATHERED, refusals: [], why: `first committed ${openedAt}, before the rule bound at ${bindsFrom}` };
  }
  const out = [];
  const c = artifact.census;
  if (c == null) {
    out.push('census is absent. Protocol rule 3 requires one, generated: '
      + '`node scripts/diagnosis/census.mjs --symbol <name> --dir scripts --json`.');
    return { state: REFUSE, refusals: out };
  }
  if (typeof c !== 'object' || Array.isArray(c)) {
    out.push('census is not an object; it must carry the tool output that produced it');
    return { state: REFUSE, refusals: out };
  }
  const provenance = String(c.generated_by || c.method || '').trim();
  if (!provenance) {
    out.push('census names nothing that produced it. Add `generated_by` (or `method`) naming the exact '
      + 'command run. A census whose origin is unstated is the agent\'s summary by default.');
  }
  const cap = capturedOutput(c);
  if (!cap.present) {
    out.push('census carries no captured output'
      + (cap.why ? ` (${cap.why})` : '')
      + '. A dictionary of numbers is a summary of a count, not the count. Either run '
      + '`scripts/diagnosis/census.mjs` (which writes `raw_output`), or record '
      + '`commands: [{ cmd, output }]` with each command\'s output captured verbatim.');
  }
  // A census over a tree it could not read is the failure it exists to prevent.
  if (c.files_read !== undefined && !(Number(c.files_read) > 0)) {
    out.push(`census reports files_read=${c.files_read}; an unread tree is not a tree with no call sites`);
  }
  return { state: out.length ? REFUSE : PASS, refusals: out, provenance, form: cap.form };
}

/**
 * PURE. Compare the artifact's census against a freshly generated one. Blocking ONLY at the commit
 * that writes the artifact, where the two are measured over the same tree.
 */
export function reproduction(artifactCensus, toolCensus) {
  if (toolCensus == null || !toolCensus.measured) {
    return { state: NOT_MEASURED, why: (toolCensus && toolCensus.why) || 'the census could not be regenerated' };
  }
  const u = understated(artifactCensus, toolCensus);
  if (!u.measured) return { state: NOT_MEASURED, why: u.why };
  if (u.understated) return { state: REFUSE, missing: u.missing, why: u.why };
  return { state: PASS, missing: [], why: null };
}

/**
 * PURE. The one verdict for an artifact, from both halves. Everything that labels, counts or exits
 * reads this, so the header, the per-artifact line and the exit code cannot disagree.
 * NOT-MEASURED outranks a pass: an unmeasured half is not a passing half.
 */
export function verdictOf(prov, repro) {
  if (prov.state === REFUSE || (repro && repro.state === REFUSE)) return REFUSE;
  if (prov.state === NOT_MEASURED || (repro && repro.state === NOT_MEASURED)) return NOT_MEASURED;
  if (prov.state === GRANDFATHERED) return GRANDFATHERED;
  return PASS;
}

/**
 * PURE. Render one artifact's result.
 *
 * THE LABEL COMES FROM THE SAME FUNCTION AS THE VERDICT. A first cut derived the tag from the
 * provenance alone, so an artifact whose provenance passed and whose REPRODUCTION refused printed
 * "pass" with a REFUSE line underneath it. A label that disagrees with the lines below it is worse
 * than no label, because the summary is the part that gets read.
 */
export function render(name, prov, repro) {
  const L = [];
  const tag = verdictOf(prov, repro) === PASS ? 'ok' : verdictOf(prov, repro).toLowerCase();
  L.push(`  ${name}: ${tag}${prov.why ? ` — ${prov.why}` : ''}`);
  for (const r of prov.refusals || []) L.push(`      REFUSE: ${r}`);
  if (repro && repro.state === REFUSE) L.push(`      REFUSE: ${repro.why}`);
  if (repro && repro.state === NOT_MEASURED) L.push(`      not-measured: ${repro.why}`);
  return L;
}

// ------------------------------------------------------------------------------------------------
// CLI
//   --staged   verify diagnosis artifacts staged for commit, against THIS tree. Blocking.
//   --all      report over every artifact on disk. Never blocking; drift is expected.
// Exit 0 clear · 1 refused (staged only) · 2 could not measure.
// ------------------------------------------------------------------------------------------------
function git(args) {
  const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf8', timeout: 20000 });
  if (r.error || r.status !== 0) return null;
  return r.stdout;
}

// ONE TRAVERSAL FOR EVERY ARTIFACT, NOT ONE PER ARTIFACT.
//
// This was `git log --all --diff-filter=A` called once per artifact. The `--all` is CORRECT and stays: without it,
// a squash-merging member shows only the merge commit, which also carries the fix, so the date read is the merge's
// rather than the authoring commit's. Measured on one ace artifact: 2026-09-25T18:12 against a true
// 2026-09-24T08:36, a 34 hour gap straddling the cutoff, affecting 19 of their 51.
//
// But `--all` walks EVERY REF, and this repository has thousands of branches. Per artifact across 92 artifacts the
// gate exceeded 600 seconds and did not finish, where it had taken seconds before. That is a regression I shipped
// into a REQUIRED CI check an hour earlier: the fix was right about the date and wrong about the cost, and the cost
// only showed when something tried to call the gate as an inline verifier.
//
// So the history is walked ONCE and indexed. `--name-only` with a date header per commit gives every add in one
// pass; keeping the EARLIEST date seen per path preserves the second half of the original fix, because a file
// added, removed and re-added must date from the first add rather than the most recent.
let FIRST_ADDED = null;

function buildFirstAddedIndex(runGit = git) {
  // PATH-LIMITED, and leaving that off is what made the single traversal slower than the per-artifact one it
  // replaced. Unscoped, \`--all\` walks every commit on every ref in a repository with thousands of branches.
  // Scoped to the directory these artifacts live in, git only visits commits that touched it.
  const out = runGit(["log", "--all", "--diff-filter=A", "--format=%x00%aI", "--name-only", "--", "docs/state/diagnosis"]);
  if (out === null || out === undefined) return null; // unreadable history is NOT an empty index
  const map = new Map();
  let date = null;
  for (const raw of String(out).split("\n")) {
    if (raw.startsWith("\u0000")) { date = raw.slice(1).trim() || null; continue; }
    const file = raw.trim();
    if (!file || !date) continue;
    const prior = map.get(file);
    // EARLIEST wins. git walks newest-first, so a later-seen entry is an OLDER commit and must replace it.
    if (prior === undefined || date < prior) map.set(file, date);
  }
  return map;
}

function firstCommitted(rel) {
  if (FIRST_ADDED === null) FIRST_ADDED = buildFirstAddedIndex();
  if (FIRST_ADDED === null) return null; // null = unknown, and the rule then binds, which is the strict direction
  return FIRST_ADDED.get(rel) || null; // null = never added = new, so the rule binds
}

function readTree(dir) {
  const files = {};
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try { entries = fs.readdirSync(path.join(REPO, d), { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) { if (!/node_modules|^\.git$/.test(e.name)) stack.push(rel); continue; }
      if (!/\.(mjs|js|ts|tsx|cjs)$/.test(e.name)) continue;
      try { files[rel] = fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch { /* counted by absence */ }
    }
  }
  return Object.keys(files).length ? files : null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const staged = process.argv.includes('--staged');
  const DIR = 'docs/state/diagnosis';
  let rels;
  if (staged) {
    const out = git(['diff', '--cached', '--name-only', '--diff-filter=ACM']);
    if (out === null) {
      console.error('census-provenance — NOT-MEASURED: the staged file list could not be read, so nothing is claimed');
      process.exit(2);
    }
    rels = out.split('\n').map((s) => s.trim()).filter((s) => s.startsWith(`${DIR}/`) && s.endsWith('.json'));
  } else {
    try { rels = fs.readdirSync(path.join(REPO, DIR)).filter((f) => f.endsWith('.json')).map((f) => `${DIR}/${f}`); } catch {
      console.error(`census-provenance — NOT-MEASURED: ${DIR} could not be read`);
      process.exit(2);
    }
  }
  if (!rels.length) {
    console.log(`census-provenance — PASS: no diagnosis artifact ${staged ? 'staged' : 'on disk'}`);
    process.exit(0);
  }

  const lines = [];
  let refused = 0, passed = 0, grandfathered = 0, unmeasured = 0;
  for (const rel of rels) {
    let art = null;
    try { art = JSON.parse(fs.readFileSync(path.join(REPO, rel), 'utf8')); } catch { art = null; }
    const prov = provenanceRefusals(art, { openedAt: firstCommitted(rel) });
    let repro = null;
    // Reproduce only at the commit that writes it, and only when the tool can be re-run.
    const inv = art && art.census ? parseGeneratedBy(art.census.generated_by) : null;
    if (staged && prov.state === PASS && inv) {
      const files = readTree(inv.dir);
      repro = reproduction(art.census, census(files, inv.symbol));
    }
    lines.push(...render(path.basename(rel), prov, repro));
    const v = verdictOf(prov, repro);
    if (v === REFUSE) refused++;
    else if (v === NOT_MEASURED) unmeasured++;
    else if (v === GRANDFATHERED) grandfathered++;
    else passed++;
  }
  const head = `census-provenance — ${refused ? 'REFUSE' : unmeasured ? 'NOT-MEASURED' : 'PASS'}: `
    + `${passed} generated, ${refused} hand-written, ${grandfathered} grandfathered, ${unmeasured} not-measured`
    + ` (of ${rels.length} artifact(s)${staged ? ' staged' : ''})`;
  const body = [head, ...lines].join('\n');
  if (refused && staged) { console.error(body); process.exit(1); }
  if (unmeasured && staged) { console.error(body); process.exit(2); }
  console.log(body);
  // A reporting run never blocks, however bad the reading. The number is the point, not the exit code.
  process.exit(0);
}
