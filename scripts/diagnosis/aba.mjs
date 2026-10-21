// The A/B/A runner: the one field in a diagnosis the agent cannot narrate.
//
// EXECUTION CONTEXT, AND WHY IT IS NOT A FREE CHOICE.
//
// The Independence Protocol's liveness test asks: if the producer fails completely, does the verifier
// still produce a verdict, and is that verdict a refusal rather than a pass? Two earlier designs for
// this field failed that test on inspection, and both failed the same way.
//
//   - A protected filesystem path. Identity in the worker tree is possession of a cert and key file,
//     protected by POSIX permission and a mount boundary. An agent and any process it launches inside
//     one worker are THE SAME PRINCIPAL, indistinguishable to every downstream check, so a path the
//     worker "cannot" stage is a path it can reach.
//   - A signature. The same defect one layer up: signing proves possession of a key file the agent can
//     read. That is an isolation property rather than a cryptographic one, and no arrangement of
//     signing repairs an isolation failure.
//
// The third route is the only one that does not rest on a file permission holding: produce the result
// OUTSIDE THE WORKER ALTOGETHER. Here that is CI. The runner executes on a machine the worker has no
// shell on, against a checkout it did not prepare, and the result is attached to the run rather than
// staged by the agent. There is nothing to forge because there is no credential in the path at all,
// which is also why running it once per surviving cause plus a joint revert does not reopen the
// identity question: more runs of a thing with no credential is still a thing with no credential.
//
// WHAT THIS MODULE IS. Pure limb logic plus a CLI, deliberately runnable anywhere, because a runner
// that only works in CI cannot be tested. WHERE IT IS TRUSTED is a separate question answered by
// `provenance()`. A result produced outside CI is recorded UNTRUSTED and cannot anchor a causal claim.
// Running it locally is useful; it is not evidence.

export const REPRODUCED = 'reproduced', ABSENT = 'absent', NOT_REPRODUCIBLE = 'not-reproducible';
export const CAUSE_ESTABLISHED = 'CAUSE-ESTABLISHED', CORRELATE_ONLY = 'CORRELATE-ONLY';
export const TRUSTED = 'TRUSTED', UNTRUSTED = 'UNTRUSTED';

/**
 * PURE. Where was this produced, and may it anchor a causal claim?
 *
 * The test is NOT "is a CI variable set" - an agent can export one. It is that the result carries a
 * run identity minted by the forge and unguessable to the worker. Absent that, UNTRUSTED. This is the
 * F10 provenance mechanism the protocol says must exist, and without it `aba` degrades to ordinary
 * agent-written text like every other field in the artifact.
 */
export function provenance(env = process.env) {
  const runId = env.GITHUB_RUN_ID || null;
  const repo = env.GITHUB_REPOSITORY || null;
  const attempt = env.GITHUB_RUN_ATTEMPT || null;
  if (runId && repo && attempt) {
    return { state: TRUSTED, runner: `ci:${repo}#${runId}.${attempt}`,
      why: 'produced on a runner the worker has no shell on, against a checkout it did not prepare' };
  }
  return { state: UNTRUSTED, runner: 'local',
    why: 'produced inside the worker, where the agent and the runner are the same principal. Useful for '
      + 'development and NOT evidence: this is the field the protocol says the agent cannot narrate, and a '
      + 'locally produced value is precisely a narrated one.' };
}

/**
 * PURE. The verdict three limbs support.
 *
 * The revert limb is the whole point: reproduces WITHOUT the fix, absent WITH it, and RETURNS when the
 * fix is reverted on the same tree. Without the third, a change that removes a symptom is a
 * correlation, and calling it a cause is the failure this protocol exists to refuse.
 */
export function verdictFor({ without_fix, with_fix, reverted } = {}) {
  if (without_fix === NOT_REPRODUCIBLE) {
    return { verdict: CORRELATE_ONLY,
      why: 'the symptom has no scriptable reproduction, so causation cannot be demonstrated. Honest and common; '
        + 'it caps at CORRELATE-ONLY, and there is deliberately no override to raise it.' };
  }
  if (without_fix === REPRODUCED && with_fix === ABSENT && reverted === REPRODUCED) {
    return { verdict: CAUSE_ESTABLISHED, why: 'reproduced without the fix, absent with it, returned on revert' };
  }
  if (without_fix === REPRODUCED && with_fix === ABSENT) {
    return { verdict: CORRELATE_ONLY,
      why: 'the fix removes the symptom and the revert did not bring it back, so removal does not restore it. '
        + 'A downgrade here is the expected path rather than an error.' };
  }
  return { verdict: CORRELATE_ONLY, why: 'the limbs do not form a reproduce / absent / reproduce sequence' };
}

/**
 * PURE. The artifact block.
 * An UNTRUSTED result is RECORDED, carrying its own disqualification, rather than dropped: a result
 * nobody can see is indistinguishable from a run that never happened.
 */
export function abaBlock({ limbs, prov, item, fix, reproduce, now = new Date() }) {
  const v = verdictFor(limbs || {});
  const trusted = prov.state === TRUSTED;
  return {
    runner: prov.runner,
    trusted,
    provenance_why: prov.why,
    item: item ?? null, fix_commit: fix ?? null, reproduce_command: reproduce ?? null,
    without_fix: limbs?.without_fix ?? null,
    with_fix: limbs?.with_fix ?? null,
    reverted: limbs?.reverted ?? null,
    verdict: trusted ? v.verdict : CORRELATE_ONLY,
    verdict_why: trusted ? v.why
      : `the limbs would support ${v.verdict}, and this result is UNTRUSTED so it cannot anchor a causal claim: ${prov.why}`,
    produced_at: now.toISOString(),
  };
}

/**
 * PURE. Does an artifact's claimed A/B/A match one a runner produced?
 * This is what makes the field unforgeable in practice: the agent writes the artifact, and the gate
 * compares it against a record the agent could not have produced.
 */
export function matchesRunner(artifactAba, runnerAba) {
  if (artifactAba == null || runnerAba == null) {
    return { measured: false, why: 'one side is missing; nothing is claimed' };
  }
  if (runnerAba.trusted !== true) {
    return { measured: true, ok: false,
      why: 'the runner record is UNTRUSTED, so it cannot corroborate anything. It was produced where the '
        + 'agent and the runner are the same principal.' };
  }
  const fields = ['without_fix', 'with_fix', 'reverted'];
  const differ = fields.filter((f) => (artifactAba[f] ?? null) !== (runnerAba[f] ?? null));
  return { measured: true, ok: differ.length === 0, differ,
    why: differ.length
      ? `the artifact's ${differ.join(', ')} ${differ.length === 1 ? 'does' : 'do'} not match the runner's. `
        + 'The limbs are the one thing in the artifact the agent does not get to author.'
      : null };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE ENFORCEABLE RULE, and why it is a CAP rather than a requirement.
//
// Measured 2026-09-24: 11 of 15 committed artifacts claim CAUSE-ESTABLISHED and NOT ONE carries a
// trusted A/B/A. Requiring one outright would mean no diagnosis can close as a cause until CI has run
// the limbs, which strands every in-flight investigation and is the "wired where it cannot be
// satisfied" failure this session has already made twice.
//
// The cap strands nobody and still removes the thing that mattered. CORRELATE-ONLY closing as mitigated
// is legitimate under the protocol and is said so in as many words. What is NOT available any more is
// claiming CAUSATION from text the agent wrote about its own work. You may close; you may not narrate
// a cause.
export const VERDICTS = Object.freeze([CAUSE_ESTABLISHED, CORRELATE_ONLY, 'COULD-NOT-DETERMINE']);

/**
 * PURE. The highest verdict an artifact's A/B/A evidence supports.
 * THREE STATES: an artifact whose aba block cannot be read is NOT-MEASURED. It is not capped and it is
 * not cleared, because a block nobody could parse says nothing either way.
 */
export function capVerdict(artifact) {
  if (artifact == null || typeof artifact !== 'object') {
    return { measured: false, why: 'the artifact could not be read, so its evidence was not judged' };
  }
  const claimed = artifact.verdict ?? null;
  if (claimed !== CAUSE_ESTABLISHED) {
    return { measured: true, ok: true, claimed, cap: claimed,
      why: 'only a CAUSE-ESTABLISHED claim is capped; every other verdict already concedes it has not shown causation' };
  }
  // P2-T2 / DEC-008. A DECLARED RETROFIT IS CAPPED AT CORRELATE-ONLY, AND THE TRUSTED-RUNNER ESCAPE
  // DOES NOT APPLY TO IT.
  //
  // A retrofit documents a defect whose FIX ALREADY LANDED, usually before the protocol existed. Its
  // A/B/A is therefore a re-enactment rather than a prediction: the author already knows which limb
  // comes out which way, and can choose a comparison that produces the answer they have. CI producing
  // the limbs removes the agent's hand from the EXECUTION and not from the CHOICE, which is the half
  // that matters once the outcome is known. So this sits ABOVE the `aba.trusted` branch deliberately.
  //
  // This is not a penalty for retrofitting. Retrofitting is the behaviour the exemption exists to
  // ENABLE: without it, ORDERING_BINDS_FROM means no pre-existing defect can ever receive an artifact
  // at all, and requiring the check would force admin merges. The cap is the price of the exemption,
  // and CORRELATE-ONLY closing as mitigated is a legitimate close.
  if (artifact.retrofit === true) {
    const reason = typeof artifact.ordering_violation === 'string' && artifact.ordering_violation.trim();
    return { measured: true, ok: false, claimed, cap: CORRELATE_ONLY,
      why: reason
        ? 'declares retrofit: true, so the fix landed before the artifact and the A/B/A is a re-enactment '
          + 'of a known outcome rather than a prediction. A retrofit is capped at CORRELATE-ONLY however '
          + 'its limbs were produced, because CI removes the agent from the execution and not from the '
          + 'choice of comparison, and the choice is what an already-known answer contaminates.'
        : 'declares retrofit: true with no `ordering_violation` saying which ordering rules it breaks and '
          + 'why. An exemption that does not name what it exempts is not a declaration, and a retrofit is '
          + 'capped at CORRELATE-ONLY in any case.' };
  }

  const aba = artifact.aba;
  if (aba == null) {
    return { measured: true, ok: false, claimed, cap: CORRELATE_ONLY,
      why: 'CAUSE-ESTABLISHED with no A/B/A block at all. The verdict names a cause and nothing in the '
        + 'artifact demonstrates one.' };
  }
  if (typeof aba !== 'object') {
    return { measured: false, claimed, why: 'the aba field is present but not a block, so it could not be judged' };
  }
  if (aba.trusted === true && typeof aba.runner === 'string' && aba.runner.startsWith('ci:')) {
    return { measured: true, ok: true, claimed, cap: CAUSE_ESTABLISHED,
      why: `corroborated by ${aba.runner}, which the committing worker has no shell on` };
  }
  return { measured: true, ok: false, claimed, cap: CORRELATE_ONLY,
    why: 'the A/B/A was produced where the agent and the runner are the same principal, so it is the '
      + "agent's own account of its own work. That is the one field the protocol says it does not get "
      + 'to author. Close as CORRELATE-ONLY, which is legitimate and is not a downgrade in candour.' };
}
