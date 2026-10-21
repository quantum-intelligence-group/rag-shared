#!/usr/bin/env node
/**
 * THE ORDERING CHECK (Root Cause Protocol, rules 1 to 5).
 *
 * The protocol specifies this precisely rather than describing it, "because it is the part most likely to
 * be implemented loosely", and it was not implemented at all. The session that built the other six
 * protocols violated the ordering fourteen times: it fixed first and wrote the diagnosis afterwards, and
 * every other rule passed. Rule 5 is named in the document as the one doing the real work and the one most
 * likely to be dropped as inconvenient. It was dropped.
 *
 * The five, from the blueprint:
 *   1. D is the first commit adding the artifact. If D touches anything outside the diagnosis directory,
 *      the diagnosis was not opened before source was touched.
 *   2. No candidate carries a verdict in D. Verdicts appear later than D.
 *   3. falsification.planned and falsification.result must not arrive in the same commit.
 *   4. fix_commit must be a descendant of D, never D itself nor an ancestor.
 *   5. No source change on the branch earlier than D, for a defect-class item.
 *
 * RATCHETED, because every artifact written before this existed breaks rules 1 and 5 by construction, and
 * a rule applied backwards refuses work that could not have complied. That outage was caused twice in this
 * session before the lesson took.
 */
export const OK = 'OK', REFUSED = 'REFUSED', NOT_MEASURED = 'NOT-MEASURED';
export const ORDERING_BINDS_FROM = '2026-09-25T12:00:00Z';
export const DIAG_DIR = 'docs/state/diagnosis/';

/** PURE. Rule 1: the opening commit touches nothing but the diagnosis directory. */
export function rule1(openingPaths) {
  if (openingPaths == null) return { state: NOT_MEASURED, why: 'the opening commit\'s file list could not be read' };
  const outside = openingPaths.filter((p) => !p.startsWith(DIAG_DIR));
  return outside.length
    ? { state: REFUSED, why: `the opening commit also touches ${outside.slice(0, 3).join(', ')}. The diagnosis must be `
        + 'opened BEFORE source is touched, so the commit that opens it carries nothing else.' }
    : { state: OK };
}

/** PURE. Rule 2: no candidate carries a verdict in the opening commit. */
export function rule2(artifactAtOpen) {
  if (artifactAtOpen == null) return { state: NOT_MEASURED, why: 'the artifact as it stood at the opening commit could not be read' };
  const decided = (artifactAtOpen.candidates || []).filter((c) => c && c.verdict != null && c.verdict !== '');
  return decided.length
    ? { state: REFUSED, why: `${decided.length} candidate(s) already carry a verdict in the opening commit `
        + `(${decided.map((c) => c.id).join(', ')}). A candidate decided before it was probed is a conclusion `
        + 'wearing the shape of an investigation.' }
    : { state: OK };
}

/** PURE. Rule 3: the prediction and its result must not arrive together. */
export function rule3(commitsAddingPlanned, commitsAddingResult) {
  if (commitsAddingPlanned == null || commitsAddingResult == null) {
    return { state: NOT_MEASURED, why: 'could not read when the falsification fields appeared' };
  }
  const same = commitsAddingPlanned.filter((c) => commitsAddingResult.includes(c));
  return same.length
    ? { state: REFUSED, why: 'the falsification prediction and its result arrive in the same commit. Naming what '
        + 'would disprove the leader AFTER seeing the outcome is not a prediction, and this single step is what '
        + 'separates "the fix failed" from "there is a second cause".' }
    : { state: OK };
}

/** PURE. Rule 4: the fix is a descendant of the opening commit. */
export function rule4({ fixIsDescendant, fixEqualsOpening } = {}) {
  if (fixIsDescendant == null) return { state: NOT_MEASURED, why: 'ancestry between the fix and the opening commit could not be determined' };
  if (fixEqualsOpening) return { state: REFUSED, why: 'fix_commit names the opening commit itself, so the artifact and the fix landed together' };
  return fixIsDescendant ? { state: OK }
    : { state: REFUSED, why: 'fix_commit is not a descendant of the commit that opened the diagnosis, so the fix predates the investigation' };
}

/** PURE. Rule 5, the one that does the real work. */
export function rule5(sourceChangesBeforeOpening) {
  if (sourceChangesBeforeOpening == null) return { state: NOT_MEASURED, why: 'the branch\'s earlier commits could not be read' };
  return sourceChangesBeforeOpening.length
    ? { state: REFUSED, why: `${sourceChangesBeforeOpening.length} source change(s) on this branch predate the diagnosis `
        + `(${sourceChangesBeforeOpening.slice(0, 3).join(', ')}). Without this rule an agent fixes first, writes the `
        + 'diagnosis in a later commit, and rules 1 to 4 all pass.' }
    : { state: OK };
}

/** PURE. Roll the five into one verdict. NOT-MEASURED never becomes OK. */
/** Which ordering rules a declared retrofit is exempt from. Rules 1 and 4 are NOT here, on purpose. */
export const RETROFIT_EXEMPT = Object.freeze(['rule 2', 'rule 3', 'rule 5']);

/**
 * PURE. Is a retrofit declaration complete enough to act on?
 *
 * `retrofit: true` alone is a claim with no content. The reason is the part a reader needs and the part
 * the author has to commit to, so an incomplete declaration is worse than none: it would exempt three
 * rules on the strength of one boolean.
 */
export function retrofitDeclaration(artifact) {
  if (!artifact || artifact.retrofit !== true) return { declared: false };
  const reason = typeof artifact.ordering_violation === 'string' ? artifact.ordering_violation.trim() : '';
  if (!reason) {
    return { declared: true, complete: false,
      why: 'declares `retrofit: true` with no `ordering_violation` naming which ordering rules it breaks and why' };
  }
  return { declared: true, complete: true, reason };
}

export function judgeOrdering(results, { openedAt, artifact } = {}) {
  if (openedAt && openedAt < ORDERING_BINDS_FROM) {
    return { state: OK, grandfathered: true,
      why: `the diagnosis was opened ${openedAt}, before the ordering check existed (${ORDERING_BINDS_FROM}). `
        + 'Every artifact written before this breaks rules 1 and 5 by construction, and a rule applied backwards '
        + 'refuses work that could not have complied.' };
  }
  // P2-T2 / DEC-008. A DECLARED RETROFIT MAY BREAK RULES 2, 3 AND 5, AND NOT RULES 1 OR 4.
  //
  // WHY THE EXEMPTION HAS TO EXIST. ORDERING_BINDS_FROM grandfathers artifacts written before the check
  // existed. It does nothing for a defect that PREDATES the check and has no artifact yet: writing one
  // today breaks rule 5 by construction, because the fix is a source change that already happened. So
  // without a retrofit path, no pre-existing defect can ever receive a diagnosis, and requiring this
  // check would force admin merges to document old work. The exemption is what makes the check
  // requirable at all.
  //
  // WHY RULES 1 AND 4 STILL BIND. Rule 1 asks that the opening commit contain the artifact ALONE, and
  // rule 4 that the fix descend from it. A retrofit can honour both: commit the artifact by itself, and
  // have no fix in the range because the fix landed long ago, which rule 4 already treats as OK. Neither
  // is made impossible by the passage of time, so neither is exempted. Exempting a rule you could still
  // satisfy is how an exemption becomes a bypass.
  //
  // The exemption is RECORDED, not silent: every rule it waives is listed in the verdict, so a reader
  // sees what was not checked rather than a clean pass.
  const retro = retrofitDeclaration(artifact);
  if (retro.declared && !retro.complete) {
    return { state: REFUSED, failures: [`retrofit: ${retro.why}`] };
  }
  if (retro.declared && retro.complete) {
    const waived = [], live = {};
    for (const [k, r] of Object.entries(results)) {
      if (RETROFIT_EXEMPT.some((x) => k.startsWith(x)) && r.state === REFUSED) { waived.push(k); continue; }
      live[k] = r;
    }
    const stillRefused = Object.entries(live).filter(([, r]) => r.state === REFUSED);
    const stillUnmeasured = Object.entries(live).filter(([, r]) => r.state === NOT_MEASURED);
    if (stillRefused.length) {
      return { state: REFUSED, retrofit: true,
        failures: stillRefused.map(([k, r]) => `${k}: ${r.why}`)
          .concat([`(a declared retrofit waives ${RETROFIT_EXEMPT.join(', ')}; the rules above are not among them)`]) };
    }
    if (stillUnmeasured.length) {
      return { state: NOT_MEASURED, retrofit: true, failures: stillUnmeasured.map(([k, r]) => `${k}: ${r.why}`) };
    }
    return { state: OK, retrofit: true, waived, reason: retro.reason,
      why: `declared retrofit, waiving ${waived.length ? waived.join(', ') : 'nothing it needed to'}. `
        + `Reason given: ${retro.reason}. Its verdict is capped at CORRELATE-ONLY by aba-cap.` };
  }

  const refused = Object.entries(results).filter(([, r]) => r.state === REFUSED);
  const unmeasured = Object.entries(results).filter(([, r]) => r.state === NOT_MEASURED);
  if (refused.length) return { state: REFUSED, failures: refused.map(([k, r]) => `${k}: ${r.why}`) };
  if (unmeasured.length) return { state: NOT_MEASURED, failures: unmeasured.map(([k, r]) => `${k}: ${r.why}`) };
  return { state: OK };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI. Every input below comes from git, because the protocol says so in as many words: "Commit ordering |
// git | Timestamps are not writable by the thing being checked." Nothing here asks the artifact when it
// was written; it asks the repository.
// ─────────────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const { execFileSync } = await import('node:child_process');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const REPO = process.env.QOS_REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const range = process.argv[2] || 'origin/main...HEAD';
  const git = (...a) => { try { return execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', maxBuffer: 33554432 }).trim(); } catch { return null; } };

  // B-11329. NULL IS NOT EMPTY, and `|| ''` was collapsing them. `git()` returns null when git REFUSED the
  // range; the old `(... || '')` turned that into an empty sha list, which read as "nothing to judge" and
  // exited 0. So a range git could not resolve PASSED this gate in silence.
  //
  // The same defect was diagnosed and fixed one file away, in diagnosis-gate under B-11295, and the prevention
  // did not reach here. What made it bite rather than lurk is the interface: that sibling takes `--range X`
  // while this takes the range POSITIONALLY, so a caller using the sibling's form makes the literal string
  // `--range` the revision. I did it twice before noticing, and both times the gate reported a pass.
  //
  // Diagnosis: docs/state/diagnosis/B-11329.json (CORRELATE-ONLY; A/B/A with a real revert limb, capped by F10
  // because I both wrote the fix and chose the limbs).
  const shaText = git('rev-list', '--reverse', '--no-merges', range);
  if (shaText === null) {
    console.error(`diagnosis-ordering — NOT-MEASURED: could not read ${range}, so nothing was judged. That is not a pass.`);
    process.exit(2);
  }
  const shas = shaText.split('\n').filter(Boolean);
  if (!shas.length) { console.error('diagnosis-ordering — PASS: no commits in range'); process.exit(0); }

  // Which artifacts does this range open?
  const opened = new Map();          // item -> opening sha
  for (const sha of shas) {
    for (const p of (git('show', '--diff-filter=A', '--name-only', '--format=', sha) || '').split('\n')) {
      const m = /^docs\/state\/diagnosis\/(B-\d+)\.json$/.exec(p.trim());
      if (m && !opened.has(m[1])) opened.set(m[1], sha);
    }
  }
  if (!opened.size) { console.error('diagnosis-ordering — PASS: this range opens no diagnosis'); process.exit(0); }

  const lines = []; let worst = OK;
  for (const [item, D] of opened) {
    const openedAt = git('log', '-1', '--format=%aI', D);
    const openingPaths = (git('show', '--name-only', '--format=', D) || '').split('\n').map((s) => s.trim()).filter(Boolean);
    let atOpen = null;
    try { atOpen = JSON.parse(git('show', `${D}:docs/state/diagnosis/${item}.json`) || 'null'); } catch { atOpen = null; }

    // P2-T2. The artifact as it stands at the TIP of the range, which is where a retrofit declaration is
    // read from. Deliberately not `atOpen`: a retrofit is declared when the artifact is written, and
    // reading it from the opening commit would let an author add the declaration later, or remove it,
    // without the gate noticing either way. Unreadable is null, and null simply means no declaration,
    // which is the strict path rather than the lenient one.
    let current = null;
    try { current = JSON.parse(git('show', `HEAD:docs/state/diagnosis/${item}.json`) || 'null'); } catch { current = null; }

    const addedIn = (field) => shas.filter((s) => {
      const d = git('show', '--format=', '-U0', s, '--', `docs/state/diagnosis/${item}.json`) || '';
      return d.split('\n').some((l) => l.startsWith('+') && l.includes(`"${field}"`));
    });

    const fix = atOpen?.fix_commit || null;
    const anc = fix ? git('merge-base', '--is-ancestor', D, fix) !== null : null;

    const before = shas.slice(0, shas.indexOf(D)).filter((s) =>
      (git('show', '--name-only', '--format=', s) || '').split('\n')
        .some((p) => /\.(mjs|js|ts|rs|py|sh)$/.test(p.trim()) && !/\.test\./.test(p)));

    const r = judgeOrdering({
      'rule 1 (opened before source)': rule1(openingPaths),
      'rule 2 (no verdict at open)': rule2(atOpen),
      'rule 3 (prediction before result)': rule3(addedIn('planned'), addedIn('result')),
      'rule 4 (fix descends from the opening)': fix ? rule4({ fixIsDescendant: anc, fixEqualsOpening: fix === D }) : { state: OK },
      'rule 5 (no source change before it)': rule5(before),
      // P2-T2. THE ARTIFACT IS PASSED IN, or the retrofit exemption is unreachable in practice: it would
      // be a documented path that no invocation can ever take, which is the "wired and enforcing nothing"
      // shape in reverse. `atOpen` is the artifact as it stood at the OPENING commit; the declaration is
      // read from the CURRENT one, because a retrofit is declared when the artifact is written and must
      // not be inferable from a state the author could later edit away.
      }, { openedAt, artifact: current });

    if (r.state === REFUSED) worst = REFUSED;
    else if (r.state === NOT_MEASURED && worst === OK) worst = NOT_MEASURED;
    lines.push(`  ${r.state === OK ? (r.grandfathered ? '·' : '✓') : r.state === REFUSED ? '✖' : '?'} ${item}`
      + (r.grandfathered ? ' grandfathered' : '') + (r.failures ? '\n' + r.failures.map((f) => `      ${f}`).join('\n') : ''));
  }
  console.error(`diagnosis-ordering (Root Cause Protocol, rules 1-5) — ${worst}`);
  console.error(lines.join('\n'));
  process.exit(worst === REFUSED ? 1 : worst === NOT_MEASURED ? 2 : 0);
}
