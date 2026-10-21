#!/usr/bin/env node
// diagnosis-gate.mjs — B-11179. A hard-stop rule for causal claims, enforced at the commit boundary.
//
// WHY THIS EXISTS, and it is not a hypothetical. On 2026-09-22 a session chasing why filed work never
// reached the fleet asserted four different root causes in one afternoon. Every one was a correlation
// and the evidence refuted each in turn: the delivery end (the branches were historical, none from
// that day), the autoscaler's belief (it computed the number correctly and logged a different one),
// seven orphaned claims (two carried live pull requests, and reaping as diagnosed would have abandoned
// real work), and machinery polluting the backlog (removing all 77 such rows left 92 against a
// threshold of 25).
//
// The actual mechanism had been written down 24 days earlier, in the header of a file that session
// asserted did not exist. A tool-generated census of producers and consumers would have found it in
// one command. That is the single-call-site error this gate exists to make expensive.
//
// THE CONTROL IS NOT THE WORD LIST. The vocabulary below is a forcing function: it makes a causal
// claim expensive in prose so the claim moves into an artifact where its evidence can be checked.
// Expect the list to need extension, treat additions as routine, and do not try to make it exhaustive.
//
// EXIT 2 BLOCKS. An unreadable probe takes the conservative branch, per this tree's own doctrine
// everywhere else: a gate that cannot see its inputs has not cleared anything.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Three is the cap: a judgement about altitude rather than arithmetic (Root Cause Protocol).
export const MAX_SURVIVING = 3;

export const REPO = process.env.QOS_REPO
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Causal-claim vocabulary. Case-insensitive. A forcing function, not an exhaustive list. */
export const CLAIM_VOCAB = [
  'root cause', 'the real problem', 'the actual problem', 'the issue is', 'the real issue',
  'found it', 'this is why', 'turns out', 'the culprit', 'caused by',
];

// B-11200. NAMING THE PROTOCOL IS NOT CLAIMING A CAUSE.
//
// "root cause" is in the vocabulary, and "Root Cause Protocol" is the name of the document this gate
// enforces. So every commit that cited the protocol by name asserted a cause as far as the gate was
// concerned, and was refused for having no diagnosis artifact. That lands hardest on the commits most
// likely to be correct: the ones deploying or referencing the protocol across the 17 member repos.
//
// A vocabulary match inside a proper noun is a false positive, and a gate whose false positives fire on
// its own rollout teaches people to bypass it (LEARNINGS: fix the gate, not the prose).
// B-11257 extends the same reasoning one step. The protocol's name is exempt, and so are the names of the
// things the protocol produces: a report ROW, a CHECK, a GATE, a CONFORMANCE result. Writing "Root Cause 13
// complied 0 violated" names a column in a report; it asserts nothing about why anything happened. The
// original exemption recognised the principle and listed only the document title, so every commit
// describing the CHECK was refused for having no artifact, which is the same false positive one word over.
//
// Kept deliberately narrow: only "root cause" immediately followed by a word naming an artefact of the
// protocol. "the root cause was a stale cache" still matches the vocabulary and still demands an artifact,
// which is the entire point of the check.
export const CLAIM_EXEMPT = [/root cause (protocol|check|gate|conformance|row|verdict|violation)s?/i];

// B-11553. THE SAME FALSE POSITIVE, ONE WORD OVER AGAIN, and the exemption above already records why
// this class matters: a gate whose false positives fire on its own rollout teaches people to bypass it.
//
// The list above exempts the protocol's name followed by a word naming one of its artefacts. It does not
// exempt the bare two-word name used as a proper noun in a sentence, which is how anything WRITTEN ABOUT
// the protocols reads: "28 instances, every one of them Root Cause or Correction Loop" asserts nothing
// about why anything happened, and was refused for having no diagnosis artifact. An item about a
// protocol could not mention the protocol.
//
// THE SIGNAL IS CAPITALISATION, and claimIn was throwing it away by lowercasing before testing. Both
// words capitalised is a proper noun: "Root Cause" is the protocol, "root cause" is a claim. A real
// assertion survives untouched in either of the forms people actually write it, because neither is
// capitalised that way:
//
//     "the root cause was a stale cache"   lowercase mid-sentence, still matches
//     "Root cause: a stale cache"          sentence case, second word lowercase, still matches
//
// Kept to the two protocol names that collide with the vocabulary, for the same reason the list above is
// narrow: an exemption is a hole, and a hole should be the shape of the thing it lets through.
// NOT followed by a digit, which preserves a deliberate prior choice rather than overriding it. An
// existing test pins `claimIn('Root Cause 13 complied')` as NOT exempt, calling that phrasing ambiguous.
// The source comment two paragraphs up reads the same string the other way, as naming a report column.
// Those two disagree, and that disagreement is worth its own look rather than a silent resolution by
// whoever edits last: this change leaves the pinned behaviour exactly as it was.
export const PROPER_NOUN_EXEMPT = [/\bRoot Cause\b(?!\s*\d)/g, /\bCorrection Loop\b(?!\s*\d)/g];

/** PURE: does this message assert a cause? Returns the matched phrase, or null. */
export function claimIn(message) {
  // B-11553: blank the capitalised proper nouns BEFORE lowercasing, because lowercasing is what destroys
  // the only signal that distinguishes the protocol's name from a claim about a cause.
  let raw = String(message || '');
  for (const re of PROPER_NOUN_EXEMPT) raw = raw.replace(re, ' ');
  let t = raw.toLowerCase();
  // Blank the proper-noun uses FIRST, so a message that only names the protocol carries no claim, while
  // one that also asserts a cause still matches on the assertion.
  for (const re of CLAIM_EXEMPT) t = t.replace(new RegExp(re.source, 'gi'), ' ');
  for (const v of CLAIM_VOCAB) if (t.includes(v)) return v;
  return null;
}

/**
 * PURE: is this item defect-class? Two independent signals, because a label alone is gameable and the
 * spec is explicit that a causal claim drags an item into scope regardless of how it is labelled.
 */
/**
 * `WIDE_SCOPE_AT` scopes the SCOPABILITY check below, and deliberately no longer scopes the defect-word
 * scan. B-11291.
 *
 * WHAT WAS TRIED AND REVERTED, THE SAME NIGHT, recorded because the reasoning is the useful part. A peer
 * session audited its own three commits, found all three had passed, and traced it partly to this scan
 * reading only the first line. So it was widened to the whole message, date-scoped.
 *
 * It was the wrong fix, on two counts, and its own gate caught it within the hour.
 *
 *   IT DOES NOT FIX THE REPORTED CASE. Those commit bodies asserted causes in words outside CLAIM_VOCAB
 *   and contained no defect word either, so they matched neither before the widening nor after. Measured
 *   directly rather than assumed.
 *
 *   AND IT MISFIRES BADLY. `fault` is an ordinary noun here: fault-monitor, fault-ledger, fault class,
 *   fault detector, 1,096 occurrences under scripts/. Widening the scan to message bodies makes almost
 *   any commit discussing the fault loop defect-class and owing a diagnosis artifact. The word list was
 *   calibrated against SUBJECT lines, where `fault` is a signal, and it does not survive the move.
 *
 * The gate refused a commit of mine for saying "the fault detectors", which is the control working. The
 * fix for a gate that is wrong is the gate, never rewording the prose until it passes, and reverting is
 * the honest form of that here. What remains from the same work and DOES address the report: `prBody()`
 * reads the pull request body, which the protocol names and nothing read, and `scopability()` reports a
 * code commit naming no item as a measurement gap instead of a pass. The second is the real finding,
 * because scope is the item and all three of the peer's commits named none.
 */
export const WIDE_SCOPE_AT = process.env.DIAGNOSIS_WIDE_SCOPE_AT || '2026-09-26T00:00:00Z';

const DEFECT_WORDS = /\b(bug|defect|regression|incident|investigat|fault|broken|fails?|failure)\b/i;

export function isDefectClass({ message = '', label = '' } = {}) {
  if (claimIn(message)) return true;                       // the claim itself brings it into scope
  // SUBJECT ONLY, and see the note above for why the whole-message version was reverted the same night.
  return DEFECT_WORDS.test(`${label} ${String(message).split('\n', 1)[0]}`);
}


/** THREE STATES. An artifact that cannot be READ is never an artifact that is ABSENT. */
export const PRESENT = 'PRESENT', ABSENT = 'ABSENT', UNREADABLE = 'UNREADABLE';

export function artifactState(itemId, { repo = REPO, readFile = fs.readFileSync } = {}) {
  if (!itemId) return { state: ABSENT, why: 'no item id to look one up by' };
  const p = path.join(repo, 'docs', 'state', 'diagnosis', `${itemId}.json`);
  let raw;
  try { raw = readFile(p, 'utf8'); }
  catch (e) {
    if (e && e.code === 'ENOENT') return { state: ABSENT, why: `no ${path.relative(repo, p)}` };
    return { state: UNREADABLE, why: `${path.relative(repo, p)} could not be read: ${String(e.message).slice(0, 60)}` };
  }
  try { return { state: PRESENT, artifact: JSON.parse(raw), path: p }; }
  catch (e) { return { state: UNREADABLE, why: `${path.relative(repo, p)} is not parseable JSON: ${String(e.message).slice(0, 60)}` }; }
}

/**
 * PURE: the field rules that can be checked without git. Returns a list of refusal reasons.
 * Deliberately NOT a truth check — the spec is explicit that agent-written text is checkable for
 * presence and internal consistency only, and the gate should not pretend otherwise.
 */
export function fieldRefusals(a) {
  const out = [];
  if (!a || typeof a !== 'object') return ['artifact is not an object'];
  const sym = a.symptom || {};
  if (!Number.isInteger(sym.occurrences_found) || !Number.isInteger(sym.occurrences_examined)) {
    out.push('symptom.occurrences_found / occurrences_examined must both be integers');
  } else if (sym.occurrences_found < sym.occurrences_examined) {
    out.push(`symptom.occurrences_found (${sym.occurrences_found}) < occurrences_examined (${sym.occurrences_examined})`);
  }
  const cands = Array.isArray(a.candidates) ? a.candidates : [];
  if (cands.length < 3) out.push(`candidates: ${cands.length} listed, at least 3 required`);
  // ONE TO THREE MAY SURVIVE, NOT EXACTLY ONE.
  //
  // This gate previously refused a second surviving candidate. The protocol supersedes that, and the
  // reason is the point rather than a relaxation: some defects genuinely have more than one
  // contributing cause, and forcing one creates pressure in precisely the direction the Root Cause
  // Protocol exists to remove. An agent facing two real contributors had to either pick arbitrarily
  // or fail the gate, and PICKING ARBITRARILY IS THE BEHAVIOUR BEING TARGETED.
  //
  // Three is a cap about ALTITUDE, not arithmetic. A diagnosis with four or more surviving causes is
  // usually being conducted at the wrong level: the real finding is the structural condition that
  // produced all four, and the correct move is to raise the question rather than enumerate further.
  //
  // Enumerating at least three candidates is unchanged. What changed is what may SURVIVE.
  const surviving = cands.filter((c) => c && c.verdict === 'surviving');
  if (surviving.length > MAX_SURVIVING) {
    out.push(`${surviving.length} candidates marked surviving; at most ${MAX_SURVIVING} may survive at close. `
      + 'Four or more usually means the diagnosis is at the wrong altitude - the real finding is the '
      + 'structural condition that produced them. Raise the question rather than enumerate further.');
  }
  // Each surviving candidate carries its own A/B/A, plus a joint revert where more than one survives.
  // Without this, two survivors and one A/B/A reads as established while half the claim is unevidenced.
  if (surviving.length > 1) {
    const set = Array.isArray(a.surviving_set) ? a.surviving_set : null;
    if (set === null) {
      out.push('more than one candidate survives but surviving_set is absent; it must name the surviving ids');
    } else {
      const ids = surviving.map((c) => c.id).filter(Boolean);
      const missing = ids.filter((id) => !set.includes(id));
      if (missing.length) out.push(`surviving_set omits surviving candidate(s): ${missing.join(', ')}`);
    }
    if (typeof a.joint !== 'boolean') {
      out.push('more than one candidate survives but `joint` is not set; state whether they are jointly '
        + 'necessary (true) or independently sufficient (false) - the A/B/A pattern differs and the '
        + 'verdict means different things');
    }
  }
  for (const c of cands) {
    // A rejected verdict with no captured output is reasoning, not a probe. The spec requires it be
    // downgraded to not-probed rather than accepted, because giving an honest landing place is what
    // keeps the other verdicts meaningful.
    if (c && c.verdict === 'rejected' && !String(c.probe_output || '').trim()) {
      out.push(`candidate ${c.id || '?'} is "rejected" with no probe_output — downgrade it to not-probed`);
    }
  }
  if (a.verdict === 'CAUSE-ESTABLISHED') {
    const aba = a.aba || {};
    for (const limb of ['without_fix', 'with_fix', 'reverted']) {
      if (!aba[limb]) out.push(`verdict is CAUSE-ESTABLISHED but aba.${limb} is missing — a causal claim with no causal evidence`);
    }
    if (aba.reverted && aba.reverted !== 'reproduced') {
      out.push(`verdict is CAUSE-ESTABLISHED but aba.reverted is "${aba.reverted}" — the revert limb is what distinguishes cause from correlation`);
    }
    if (!String((a.falsification || {}).result || '').trim()) {
      out.push('verdict is CAUSE-ESTABLISHED but falsification.result is empty');
    }
  }
  if (a.residual === undefined || a.residual === null || String(a.residual) === '') {
    out.push('residual is required and non-empty (it may be the string "none")');
  }
  return out;
}

/** PURE: the whole commit-time decision, so it is testable without git or a filesystem. */
export function gateDecision({ message, label = '', itemId = null, artifact = null } = {}) {
  // B-11207. SCOPE IS THE ITEM, NOT THE WORDING. Diagnosis: docs/state/diagnosis/B-11207.json.
  //
  // This returned exit 0 the moment the message carried no phrase from CLAIM_VOCAB, so the protocol's
  // stated scope, "every commit on a defect-class item", was never enforced. The gate could be satisfied
  // by a thesaurus, and was: the session that deployed this to 17 member repos was refused three times
  // and cleared every one by rewording, never by producing an artifact.
  //
  // `isDefectClass` already implemented the rule and was called by NOTHING but its own test. A control
  // that exists, passes its tests and never fires is the exact shape this programme keeps rediscovering.
  //
  // MEASURED, and it is why the verdict is CAUSE-ESTABLISHED rather than a correlate: gateDecision
  // returned exit 0 "no causal claim in the message" while isDefectClass, on the SAME message and label,
  // returned true. A/B/A on the real module, revert limb included, is recorded in the diagnosis.
  const claim = claimIn(message);
  const defect = isDefectClass({ message, label });
  if (!claim && !defect) return { exit: 0, why: 'not defect-class, and no causal claim in the message' };
  // The two paths say DIFFERENT things, because "you asserted a cause" and "this is defect-class work"
  // are different facts and a reader who is refused deserves the one that applies. The old text
  // interpolated `claim` unconditionally, which printed asserts a cause ("null") on the defect path.
  const because = claim
    ? `the message asserts a cause ("${claim}")`
    : 'this is defect-class work (R-2: every commit on a defect-class item is in scope, however it is worded)';
  if (!itemId) {
    return { exit: 1, why: `${because} but names no item, so no diagnosis artifact can be found for it` };
  }
  if (!artifact) return { exit: 1, why: `${because} and ${itemId} has no diagnosis artifact` };
  if (artifact.state === UNREADABLE) return { exit: 2, why: `diagnosis artifact for ${itemId} is unreadable: ${artifact.why}` };
  if (artifact.state === ABSENT) return { exit: 1, why: `${because} and ${itemId} has no diagnosis artifact (${artifact.why})` };
  const bad = fieldRefusals(artifact.artifact);
  if (bad.length) return { exit: 1, why: `the message asserts a cause ("${claim}") and ${itemId}'s artifact fails ${bad.length} field rule(s)`, detail: bad };
  return { exit: 0, why: `causal claim backed by a valid diagnosis artifact for ${itemId}` };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────
// `--commit-msg <file>` is the pre-commit / commit-msg form. `--range <ref>` is the CI form.
// Both exit: 0 clear, 1 refused, 2 could-not-read.

function gitOrNull(...args) {
  try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}

/** PURE: pull an item id out of a branch name or a message subject. */

// ── ADMISSION DATE: A RULE CANNOT BIND A COMMIT WRITTEN BEFORE IT EXISTED ─────────────────────────
//
// The CI half judges every commit in a pull request's range, including ones authored long before this
// gate was adopted. Measured 2026-09-23, within an hour of the rollout: pull request #5047, opened
// 2026-09-17, was refused because a commit from that day says "found it" with no diagnosis artifact.
// There was no protocol to comply with when it was written, and no artifact could have existed.
//
// Left alone this is not a gate, it is a freeze: every pull request older than the rollout becomes
// permanently unmergeable for failing a rule that postdates it, and the only ways out are rewriting
// history or waiving the gate. Both are worse than the defect.
//
// So commits AUTHORED before the adoption instant are reported and not judged. Author date, not commit
// date, because a rebase rewrites the latter: judging on commit date would make a rebase retroactively
// subject a commit to a rule it predates, which is the same unfairness one step removed. That is not
// hypothetical here -- these pull requests are being rebased right now to clear an unrelated conflict.
export const ADOPTED_AT = process.env.DIAGNOSIS_ADOPTED_AT || '2026-09-23T00:00:00Z';

/**
 * PURE. Can this commit be judged by this gate at all?
 *
 * B-11291. A peer session audited its own commits, found the gate had passed them, and traced it to the
 * vocabulary. That was half of it. The other half is that ALL THREE named no backlog item, and scope is
 * the item (B-11207), so there was nothing to scope on and the gate exited 0. "Checked and clear" and
 * "nothing to check against" produced the same output.
 *
 * This is why the diagnosis gate cannot be deployed to a member repository on its own: without the R-21.2
 * delivery gate forcing an item onto every code commit, most commits are unscopable and the diagnosis
 * gate reports a clean board over them. In this repository R-21.2 already refuses code with no item, so
 * an unscopable code commit here is rare and worth a refusal; in a member without it, the first run will
 * name many, and that count IS the finding.
 *
 * A commit touching only tests, docs or state is not unscopable, it is simply out of scope, and the two
 * must not be conflated: reporting documentation commits as a measurement gap would bury the real ones.
 */
/**
 * The pull request body, when this gate is running inside one. Returns null when there is none to read,
 * and that is a different answer from an empty body.
 *
 * B-11291. The protocol says a causal claim in the "message or PR body" brings the work into scope, and
 * nothing read the PR body. So the whole trap could be sidestepped by keeping commit messages thin and
 * putting the explanation in the pull request description, which is where explanations usually go.
 *
 * THREE-STATE. An event payload that exists and cannot be parsed returns undefined, not null: "there is
 * no pull request" and "there is one and I could not read it" must not be the same answer, because the
 * second is a measurement gap and the first is not.
 */
export function prBody({ env = process.env, readFile = fs.readFileSync } = {}) {
  const explicit = env.DIAGNOSIS_PR_BODY;
  if (typeof explicit === 'string') return explicit;
  const p = env.GITHUB_EVENT_PATH;
  if (!p) return null;
  try {
    const ev = JSON.parse(readFile(p, 'utf8'));
    if (!ev || !ev.pull_request) return null;
    return typeof ev.pull_request.body === 'string' ? ev.pull_request.body : '';
  } catch { return undefined; }
}

export function scopability({ itemId = null, files = null } = {}) {
  if (files === null) {
    return { scopable: false, measured: false,
      why: 'the changed files could not be read, so whether this commit needed an item is unknown' };
  }
  const source = files.filter((f) => /^(scripts|src|services|apps|os|packages)\//.test(f)
    && !/\.test\.|\.spec\.|__tests__|\/fixtures\//.test(f));
  if (!source.length) return { scopable: true, measured: true, why: 'no non-test source changed: out of scope, not unmeasured' };
  if (itemId) return { scopable: true, measured: true, why: `scoped to ${itemId}` };
  return { scopable: false, measured: true, files: source,
    why: `${source.length} non-test source file(s) changed and the commit names no backlog item, so there is `
      + 'no item to judge defect-class against. This is NOT a pass: it is a measurement gap, and it is the '
      + 'shape that let three commits through in a member repository that has no delivery gate.' };
}

/** PURE. Is this commit subject to the protocol at all? */
export function predatesProtocol(authorIso, adoptedAt = ADOPTED_AT) {
  const t = Date.parse(authorIso || '');
  const a = Date.parse(adoptedAt);
  if (!Number.isFinite(t) || !Number.isFinite(a)) return false;   // unreadable date -> JUDGE it, never exempt
  return t < a;
}

export function itemIdFrom({ branch = '', message = '' } = {}) {
  const b = String(branch).match(/\/([A-Z]+-\d+)(?:-|$)/);
  if (b) return b[1];
  const m = String(message).split('\n', 1)[0].match(/\b([A-Z]+-\d+)\b/);
  return m ? m[1] : null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const msgIdx = args.indexOf('--commit-msg');
  let message = '';
  if (msgIdx >= 0) {
    const f = args[msgIdx + 1];
    try { message = fs.readFileSync(f, 'utf8'); }
    catch (e) {
      // Exit 2, deliberately. The message is the INPUT to every check below; unreadable means the
      // gate scanned nothing, and reporting that as clear is the failure this tree keeps finding.
      console.error(`✖ diagnosis-gate: could not read the commit message at ${f} — ${String(e.message).slice(0, 80)}`);
      console.error('  An unreadable input is not a clean one. Exit 2 blocks.');
      process.exit(2);
    }
  } else {
    const range = args.includes('--range') ? args[args.indexOf('--range') + 1] : null;

    // A RANGE IS JUDGED PER COMMIT, NEVER AS ONE BLOB.
    //
    // The first version concatenated every message in the range and resolved ONE item id from the
    // first line of the result. Under `on: pull_request`, actions/checkout checks out the MERGE
    // commit, so `git log` leads with "Merge <sha> into <sha>" -- a subject carrying no id. The
    // whole range then resolved to no item and every causal claim in it was refused, with a valid
    // artifact sitting in the tree. Observed on this gate's own PR (QOS #5647, 2026-09-23).
    //
    // Concatenation was wrong for a second reason that outlives the merge-commit case: two commits
    // in one range can legitimately belong to two different items, and a single id cannot be right
    // for both. Judging each commit against its own id is the only reading that is not a guess.
    if (range) {
      // ── A RANGE THAT CANNOT BE READ IS NOT AN EMPTY RANGE (B-11295) ──────────────────────────────
      //
      // This path had exactly one bug and it was the worst kind: it PASSED. The gate appended `..HEAD`
      // to whatever --range received, so a caller handing it a full `A..B` range produced the invalid
      // revspec `A..B..HEAD`; git fatalled, gitOrNull returned null, `?? ''` made that an empty commit
      // list, and an empty list was reported as "nothing to judge" with exit 0. Measured on origin/main
      // at d1f07ab8f: `git rev-list --no-merges HEAD~6..HEAD` listed 8 commits and this gate, given the
      // identical range, judged none of them and passed.
      //
      // BOTH FORMS ARE ACCEPTED, because the contract genuinely diverges between sibling gates and it
      // diverges IN CI: correction-loop.yml passes "$BASE..HEAD" while diagnosis-gate.yml passes
      // "$BASE". Neither documented which it wanted. A bare ref still gets `..HEAD` appended, which is
      // the live CI invocation and must not change; an argument already naming a range is passed
      // through. Guessing on the caller's behalf is what produced the invalid revspec.
      const revspec = range.includes('..') ? range : `${range}..HEAD`;
      const listed = gitOrNull('rev-list', '--no-merges', revspec);
      if (listed === null) {
        // NOT-MEASURED, and exit 2 rather than 1: the commits may be perfectly fine. What is missing is
        // the ability to look at them. correction-loop-gate.mjs:216 has said this since it shipped
        // ("so nothing was judged. That is not a pass."); this gate said it for the pull request body
        // at :294 and for the --commit-msg file at :349, and not here. Two input paths of three.
        console.error(`? diagnosis-gate: --range ${range} could not be read as ${revspec}, so nothing was`);
        console.error('  judged. That is not a pass. An unreadable range and an empty one are different answers.');
        process.exit(2);
      }
      const shas = listed.split('\n').filter(Boolean);
      if (!shas.length) {
        // An EMPTY range is not a pass and not a failure: there is nothing to judge. Saying so is
        // the difference between "checked and clear" and "never looked". This branch is now only
        // reachable when git SUCCEEDED and returned nothing, which is the only case it ever meant.
        console.log('✓ diagnosis-gate: no non-merge commits in range — nothing to judge');
        process.exit(0);
      }
      const branchName = gitOrNull('rev-parse', '--abbrev-ref', 'HEAD') || '';
      let worst = 0;
      let exempt = 0;
      const unscopable = [];
      // THE PULL REQUEST BODY IS PART OF THE MESSAGE, which the protocol says and nothing read. A thin
      // commit subject with the causal claim in the description sidestepped the gate entirely.
      const body = prBody();
      let bodyClaim = null;
      if (body === undefined) {
        console.error('? diagnosis-gate: a pull request event exists and its body could not be parsed, so a');
        console.error('  causal claim there cannot be ruled out. An unread body is not an absent one.');
        worst = Math.max(worst, 2);
      } else if (body) {
        bodyClaim = claimIn(body);
        if (bodyClaim) {
          console.log(`  the pull request body asserts a cause ("${bodyClaim}"), so every commit in this range`);
          console.log('  is in scope regardless of its own wording.');
        }
      }
      for (const sha of shas) {
        // NULL IS PASSED THROUGH, NOT COERCED. predatesProtocol treats an unreadable date as
        // judge-it-never-exempt (:328), so null is already the safe reading here and the `?? ''` was
        // only hiding that it relied on it. Checked rather than assumed while fixing B-11295: this
        // site was the one of the four that was NOT a defect.
        const authored = gitOrNull('log', '-1', '--format=%aI', sha);
        if (predatesProtocol(authored)) { exempt += 1; continue; }
        // AN UNREADABLE MESSAGE IS NOT A MESSAGE WITHOUT A CLAIM (B-11295). Coerced to '', it carried no
        // causal claim, and no claim is what compliance looks like from here.
        const msgRaw = gitOrNull('log', '-1', '--format=%B', sha);
        if (msgRaw === null) {
          console.error(`? diagnosis-gate: the commit message at ${sha.slice(0, 9)} could not be read, so a`);
          console.error('  causal claim in it cannot be ruled out. An unread message is not an absent one.');
          worst = Math.max(worst, 2);
          continue;
        }
        const msg = msgRaw;
        const id = itemIdFrom({ branch: branchName, message: msg });
        // Scopability is judged BEFORE the verdict, because an unscopable commit is not a clear one. Only
        // from the widening date, so this cannot refuse branches written before the rule existed.
        if (!predatesProtocol(authored, WIDE_SCOPE_AT)) {
          const raw = gitOrNull('show', '--name-only', '--format=', sha);
          const sc = scopability({ itemId: id, files: raw === null ? null : raw.split('\n').filter(Boolean) });
          if (!sc.scopable) unscopable.push({ sha: sha.slice(0, 9), why: sc.why });
        }
        const a = id ? artifactState(id) : null;
        const dd = gateDecision({ message: bodyClaim ? `${msg}\n${body}` : msg, label: branchName,
          itemId: id, artifact: a });
        if (dd.exit !== 0) {
          console.error(`✖ diagnosis-gate (${dd.exit === 2 ? 'could-not-read' : 'refused'}) at ${sha.slice(0, 9)}: ${dd.why}`);
          if (dd.detail) for (const x of dd.detail) console.error(`    • ${x}`);
          worst = Math.max(worst, dd.exit);
        } else if (claimIn(msg)) {
          console.log(`✓ ${sha.slice(0, 9)}: ${dd.why}`);
        }
      }
      // The exempt count is PRINTED, never silent. A gate that quietly skips most of its input while
      // reporting success is the shape this whole protocol exists to refuse.
      const judged = shas.length - exempt;
      const note = exempt ? ` (${exempt} predate the protocol, adopted ${ADOPTED_AT}, and were not judged)` : '';
      // UNSCOPABLE COMMITS ARE REPORTED WHETHER OR NOT ANYTHING WAS REFUSED, and they set exit 2 on their
      // own. "Checked and clear" and "had nothing to check against" were the same output until now, which
      // is how three commits passed in a repository with no delivery gate. Exit 2 is could-not-determine,
      // not refused: the commits may be perfectly fine, and what is missing is the item that would let
      // this gate say so.
      if (unscopable.length) {
        console.error('');
        console.error(`? diagnosis-gate: ${unscopable.length} of ${judged} judged commit(s) are UNSCOPABLE — non-test`);
        console.error('  source changed and no backlog item is named, so defect-class cannot be established.');
        for (const u of unscopable.slice(0, 10)) console.error(`    ? ${u.sha}: ${u.why}`);
        if (unscopable.length > 10) console.error(`    ? … and ${unscopable.length - 10} more`);
        console.error('  This gate scopes on the ITEM, so it needs the R-21.2 delivery gate to be scopable at');
        console.error('  all. A repository carrying this gate WITHOUT that one reports a clean board over most');
        console.error('  of its commits. If this count is high on a first run, that is the finding.');
        worst = Math.max(worst, 2);
      }
      if (worst === 0) { console.log(`✓ diagnosis-gate: ${judged} commit(s) judged, none asserts an unbacked cause${note}`); process.exit(0); }
      console.error('');
      console.error('  A causal claim needs a diagnosis artifact: docs/state/diagnosis/<ITEM>.json');
      console.error('  Full protocol: docs/governance/DIAGNOSIS_PROTOCOL.md');
      process.exit(worst);
    }
    // Same coercion, same consequence as the range path (B-11295): with no --commit-msg file this reads
    // HEAD, and if that read fails an empty message asserts no cause and the gate exits 0 having judged
    // nothing. The --commit-msg FILE path at :349 already refuses an unreadable input; this fallback did not.
    const headMsg = gitOrNull('log', '-1', '--format=%B');
    if (headMsg === null) {
      console.error("? diagnosis-gate: HEAD's commit message could not be read, so nothing was judged.");
      console.error('  That is not a pass.');
      process.exit(2);
    }
    message = headMsg;
  }

  const branch = gitOrNull('rev-parse', '--abbrev-ref', 'HEAD') || '';
  const itemId = itemIdFrom({ branch, message });
  const art = itemId ? artifactState(itemId) : null;
  const d = gateDecision({ message, label: branch, itemId, artifact: art });

  if (d.exit === 0) {
    if (claimIn(message)) console.log(`✓ diagnosis-gate: ${d.why}`);
    process.exit(0);
  }
  console.error(`✖ diagnosis-gate (${d.exit === 2 ? 'could-not-read' : 'refused'}): ${d.why}`);
  if (d.detail) for (const x of d.detail) console.error(`    • ${x}`);
  console.error('');
  console.error('  A causal claim needs a diagnosis artifact: docs/state/diagnosis/<ITEM>.json');
  console.error('  Open it BEFORE touching source, list 3+ candidates with no verdicts, generate the');
  console.error('  census with a tool, name what would disprove your leader before testing it, and run');
  console.error('  A/B/A for the revert limb. CORRELATE-ONLY closes as mitigated, and that is legitimate.');
  console.error('  Full protocol: docs/governance/DIAGNOSIS_PROTOCOL.md');
  process.exit(d.exit);
}
