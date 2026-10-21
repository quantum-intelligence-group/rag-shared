#!/usr/bin/env node
/**
 * THE STAGE TRANSITIONS — `mitigated` and `investigated`, without which the protocol does not work.
 *
 * "`mitigated` is a new stage and the protocol does not work without it. An agent that has genuinely
 * fixed a symptom without establishing why must be able to ship it. If `done` is the only exit, the
 * incentive is to write CAUSE-ESTABLISHED over a correlation, which is exactly the behaviour being
 * targeted."
 *
 * The board had neither stage, and the cost arrived the first time it mattered rather than in theory:
 * B-11270 closed CORRELATE-ONLY earlier today with nowhere to close TO, and stayed "In progress" with a
 * paragraph explaining why. Refusal fixture F11 had pinned the gap hours before as a placeholder. This
 * is the control that turns the placeholder into a refusal.
 *
 * THE TABLE, AS THE DOCUMENT WRITES IT:
 *   any → done          artifact, CAUSE-ESTABLISHED, field rules, fix_commit descends from the diagnosis
 *   any → mitigated     artifact, CORRELATE-ONLY, non-empty residual
 *   any → investigated  artifact, COULD-NOT-DETERMINE, at least 3 candidates carrying verdicts
 *   defect → done with CORRELATE-ONLY    refused; close as mitigated
 *   defect → done with no artifact       refused
 *
 * FORWARD-ONLY BY CONSTRUCTION, so it needs no grandfather date. It judges the items whose status line
 * CHANGED in the commit in front of it. The 741 items already marked Done are not re-opened, re-judged
 * or mentioned; a rule applied backwards is an outage, and the cheapest way to avoid one is a check
 * whose subject is a diff.
 *
 * IT DOES NOT INVENT DEFECT-CLASS. An item is in scope when it has a diagnosis artifact or declares
 * `**Found:** defect`. A feature item closing Done is not this control's business and is not touched.
 */
export const OK = 'OK', REFUSED = 'REFUSED', NOT_MEASURED = 'NOT-MEASURED', NOT_APPLICABLE = 'NOT-APPLICABLE';

export const DONE = 'done', MITIGATED = 'mitigated', INVESTIGATED = 'investigated';
/** The stages this control judges. Anything else is somebody else's business. */
export const JUDGED_STAGES = Object.freeze([DONE, MITIGATED, INVESTIGATED]);

/** PURE. Normalise a board status to a stage, or null when it is not one this control judges. */
export function stageOf(status) {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'done' || s === 'shipped' || s === 'closed') return DONE;
  if (s === 'mitigated') return MITIGATED;
  if (s === 'investigated') return INVESTIGATED;
  return null;
}

/** PURE. The `**Status:**` value in a backlog entry, or null. */
export function statusIn(entry) {
  const m = /\*\*Status:\*\*\s*([A-Za-z ]+?)\s*(?:·|\n|$)/.exec(String(entry ?? ''));
  return m ? m[1].trim() : null;
}

/** PURE. Is this item in scope? An artifact, or an explicit declaration. Nothing is inferred from prose. */
export function isDefectItem({ entry = '', artifact = null } = {}) {
  if (artifact != null) return true;
  return /\*\*Found:\*\*\s*defect\b/i.test(String(entry ?? ''));
}

/**
 * PURE. Judge one transition.
 *
 * @param stage     the stage the item is moving TO
 * @param artifact  the diagnosis artifact; `null` when ABSENT, `undefined` when it exists and could not
 *                  be read. THE PARAMETER HAS NO DEFAULT, deliberately. It had `= null`, and a JS
 *                  default fires on an explicit `undefined`, so the unreadable signal could never reach
 *                  this function: every corrupt artifact was judged as an absent one. It failed safe -
 *                  absent also refuses - but with the wrong state and a message saying "no diagnosis
 *                  artifact" about a file sitting right there. Omitting the key now reads as unreadable,
 *                  which is the conservative branch: you did not tell me, so I do not know.
 */
export function judgeTransition({ item = '?', stage, artifact, isDefect = false } = {}) {
  if (!JUDGED_STAGES.includes(stage)) {
    return { state: NOT_APPLICABLE, why: 'not a stage this control judges' };
  }
  if (artifact === undefined) {
    return { state: NOT_MEASURED, why: `${item}: its diagnosis artifact exists and could not be read, so the transition was not judged. A gate that could not look has cleared nothing.` };
  }
  if (stage === DONE) {
    if (!isDefect) return { state: NOT_APPLICABLE, why: `${item} is not defect-class` };
    if (artifact == null) {
      return { state: REFUSED, why: `${item} closes done with no diagnosis artifact. A defect closed without an investigation is the case this protocol exists for.` };
    }
    if (artifact.verdict === 'CORRELATE-ONLY') {
      return { state: REFUSED, why: `${item} closes done on a CORRELATE-ONLY verdict. Close it as MITIGATED and leave it open. `
        + 'If done is the only exit, the incentive is to write CAUSE-ESTABLISHED over a correlation, which is the behaviour being targeted.' };
    }
    if (artifact.verdict === 'COULD-NOT-DETERMINE') {
      return { state: REFUSED, why: `${item} closes done on COULD-NOT-DETERMINE. Close it as INVESTIGATED and return it to the queue with the artifact attached; an investigation that ran and found nothing is a successful investigation with a negative result.` };
    }
    if (artifact.verdict !== 'CAUSE-ESTABLISHED') {
      return { state: REFUSED, why: `${item} closes done with verdict "${artifact.verdict ?? 'none'}", which is not one of the three the protocol defines.` };
    }
    return { state: OK, why: `${item}: done on CAUSE-ESTABLISHED` };
  }
  if (stage === MITIGATED) {
    if (artifact == null) return { state: REFUSED, why: `${item} closes mitigated with no artifact; mitigated is a verdict, not a mood.` };
    if (artifact.verdict !== 'CORRELATE-ONLY') {
      return { state: REFUSED, why: `${item} closes mitigated on verdict "${artifact.verdict ?? 'none'}"; mitigated requires CORRELATE-ONLY.` };
    }
    if (!String(artifact.residual ?? '').trim()) {
      return { state: REFUSED, why: `${item} closes mitigated with an empty residual. The item stays OPEN, so what remains unknown is the whole content of the record.` };
    }
    return { state: OK, why: `${item}: mitigated on CORRELATE-ONLY with a residual` };
  }
  // investigated
  if (artifact == null) return { state: REFUSED, why: `${item} closes investigated with no artifact; the artifact IS the value of this exit.` };
  if (artifact.verdict !== 'COULD-NOT-DETERMINE') {
    return { state: REFUSED, why: `${item} closes investigated on verdict "${artifact.verdict ?? 'none'}"; investigated requires COULD-NOT-DETERMINE.` };
  }
  const withVerdicts = (Array.isArray(artifact.candidates) ? artifact.candidates : [])
    .filter((c) => c && c.verdict != null && c.verdict !== '');
  if (withVerdicts.length < 3) {
    return { state: REFUSED, why: `${item} closes investigated with ${withVerdicts.length} candidate(s) carrying a verdict; three are required. "No candidate survived" is only meaningful once three were probed.` };
  }
  return { state: OK, why: `${item}: investigated on COULD-NOT-DETERMINE with ${withVerdicts.length} probed candidates` };
}

/**
 * PURE. Heading line numbers, 1-based, from the backlog text.
 */
export function headingIndex(backlog) {
  if (backlog == null) return null;
  const out = [];
  String(backlog).split('\n').forEach((l, i) => {
    const m = /^###\s+([A-Z]+-\d+):/.exec(l);
    if (m) out.push({ line: i + 1, item: m[1] });
  });
  return out;
}

/**
 * PURE. Which items have a `**Status:**` line ADDED by this diff?
 *
 * THE HUNK HEADER DOES NOT NAME THE ITEM, and assuming it did is what made the first version report
 * "no item changed status" over a diff that plainly changed one. Git fills the `@@ ... @@` context with
 * the nearest preceding line its diff driver recognises as a function, which for this file is whatever
 * prose sits above the hunk. So the association is made from LINE NUMBERS against the file's own
 * headings instead, which is git's arithmetic and the file's own structure rather than a guess.
 */
export function itemsChangingStatus(diff, headings) {
  if (diff == null || headings == null) return null;
  const items = new Set();
  let line = 0;
  for (const raw of String(diff).split('\n')) {
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (h) { line = Number(h[1]); continue; }
    if (raw.startsWith('---') || raw.startsWith('+++')) continue;
    if (raw.startsWith('-')) continue;                       // removed: does not advance the new file
    if (raw.startsWith('+')) {
      if (/\*\*Status:\*\*/.test(raw)) {
        let owner = null;
        for (const e of headings) { if (e.line <= line) owner = e.item; else break; }
        if (owner) items.add(owner);
      }
      line++;
      continue;
    }
    line++;                                                  // context
  }
  return [...items];
}

/** PURE. Roll up. NOT-MEASURED never becomes OK. */
export function assess(results) {
  const rows = Object.entries(results);
  const bad = rows.filter(([, r]) => r.state === REFUSED);
  const unmeasured = rows.filter(([, r]) => r.state === NOT_MEASURED);
  if (bad.length) return { state: REFUSED, reasons: bad.map(([, r]) => r.why), rows: results };
  if (unmeasured.length) return { state: NOT_MEASURED, reasons: unmeasured.map(([, r]) => r.why), rows: results };
  return { state: OK, reasons: [], rows: results };
}

/** PURE. The lines printed. */
export function render(v, judgedCount = 0) {
  const L = [`stage-transitions (Root Cause Protocol) — ${v.state}: ${judgedCount} status change(s) in this commit.`];
  for (const r of v.reasons) L.push(`  ✖ ${r}`);
  return L;
}

// ------------------------------------------------------------------------------------------------
// CLI: stage-transitions.mjs [--gate]
// Judges the items whose `**Status:**` line CHANGED in the staged diff of docs/planning/BACKLOG.md.
// Exit 0 clear · 1 refused (--gate) · 2 could not read. Never `|| true`.
// ------------------------------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { spawnSync } = await import('node:child_process');
  const REPO = process.env.QOS_REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const BACKLOG = 'docs/planning/BACKLOG.md';
  const git = (...a) => {
    const r = spawnSync('git', a, { cwd: REPO, encoding: 'utf8', timeout: 60000, maxBuffer: 64 * 1024 * 1024 });
    return r.error || r.status !== 0 ? null : r.stdout;
  };

  // WHICH ITEMS CHANGED STATUS. `-U0` on the backlog gives added lines only; a `**Status:**` line among
  // them is a status this commit is asserting. The item id comes from the hunk header, which git fills
  // with the nearest preceding `###` heading, so the association is git's rather than a guess of mine.
  const diff = git('diff', '--cached', '-U0', '--', BACKLOG);
  if (diff === null) {
    console.error('stage-transitions — NOT-MEASURED: the staged backlog diff could not be read, so nothing is claimed.');
    process.exit(2);
  }
  // ABSENT AND UNREADABLE ARE DIFFERENT, and this is the THIRD gate in one day to get it wrong. A tree
  // with no backlog has no items whose status could have changed: a real zero, and every member repo
  // looks like this before the rollout. A backlog that EXISTS and will not read still exits 2.
  const backlogPath = path.join(REPO, BACKLOG);
  if (!fs.existsSync(backlogPath)) {
    console.log(`stage-transitions (Root Cause Protocol) — PASS: no ${BACKLOG} in this tree, so no item changed status.`);
    process.exit(0);
  }
  let backlogNow = null;
  try { backlogNow = fs.readFileSync(backlogPath, 'utf8'); } catch { backlogNow = null; }
  if (backlogNow === null) {
    console.error(`stage-transitions — NOT-MEASURED: ${BACKLOG} exists and could not be read.`);
    process.exit(2);
  }
  const changedList = itemsChangingStatus(diff, headingIndex(backlogNow));
  if (changedList == null) {
    console.error('stage-transitions — NOT-MEASURED: the diff could not be associated with items.');
    process.exit(2);
  }
  const changed = new Set(changedList);
  if (changed.size === 0) {
    console.log('stage-transitions (Root Cause Protocol) — PASS: no item changed status in this commit.');
    process.exit(0);
  }

  const backlog = backlogNow;

  const results = {};
  for (const item of changed) {
    const m = new RegExp(`^### ${item}:[\\s\\S]*?(?=\\n### |$(?![\\s\\S]))`, 'm').exec(backlog);
    const entry = m ? m[0] : '';
    const stage = stageOf(statusIn(entry));
    if (stage === null) { results[item] = { state: NOT_APPLICABLE, why: `${item}: status is not a judged stage` }; continue; }
    // ABSENT AND UNREADABLE ARE DIFFERENT: null means no investigation, undefined means one exists and
    // could not be read, and only the second is NOT-MEASURED.
    const rel = path.join(REPO, 'docs/state/diagnosis', `${item}.json`);
    let artifact = null;
    if (fs.existsSync(rel)) {
      try { artifact = JSON.parse(fs.readFileSync(rel, 'utf8')); } catch { artifact = undefined; }
    }
    results[item] = judgeTransition({ item, stage, artifact, isDefect: isDefectItem({ entry, artifact: artifact ?? null }) });
  }

  const v = assess(results);
  const lines = render(v, changed.size);
  if (v.state === NOT_MEASURED) { console.error(lines.join('\n')); process.exit(2); }
  if (v.state === REFUSED) { console.error(lines.join('\n')); process.exit(process.argv.includes('--gate') ? 1 : 0); }
  console.log(lines.join('\n'));
  process.exit(0);
}
