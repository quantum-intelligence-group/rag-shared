#!/usr/bin/env node
// correction-loop-gate.mjs — B-11200. The Correction Loop's step-4 bar, at the commit boundary.
//
// THE PATTERN THIS EXISTS TO STOP. An agent asked to fix something fixes the instance. It is faster, it
// is visible, it satisfies the request as phrased, and every check it passes certifies that the instance
// is fixed. Nothing certifies that the system can now handle the next one. A capability can merge, pass
// 4,000 tests, be registered as a mechanism, and never fire.
//
// So step 4's unit of work is not the capability. It is A CALLER INSIDE THE SYSTEM THAT RUNS IT
// UNATTENDED. This gate checks the claim half of that: every capability commit carries a trailer naming
// its invoker. The static orphan check is the evidence half and lives in correction-loop-orphans.mjs;
// the trailer earns its own place by catching what reachability cannot (an invoker registered on the
// WRONG CADENCE) and by giving the honest answer "nothing calls it" a machine-readable form.
//
// `Caller: none` is what "nothing — I did it" looks like written down. It is deliberately ALLOWED, and
// deliberately greppable and countable, because a protocol with no honest exit gets routed around.
//
// PORTABILITY. This binds at the commit boundary, so it applies to whatever produced the work: any CLI,
// any model, any orchestrator. Per-application specifics come from the manifest, never from this file.
//
// THREE-STATE (R-14.4). A message that could not be read is UNREADABLE, which is neither a pass nor a
// violation. A gate that cannot see its subject has cleared nothing.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const REPO = process.env.QOS_REPO
  || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

// ── the trailer ──────────────────────────────────────────────────────────────────────────────────────
// Four accepted forms. Each names a DIFFERENT way the system invokes something on its own, and the set
// is closed on purpose: a free-text trailer would accept "Caller: the fleet" and certify nothing.
export const CALLER_FORMS = Object.freeze([
  { id: 'scheduler', re: /^scheduler:[a-z0-9_-]+\("[^"]+"\)$/i,
    example: 'scheduler:hourly("settlement-expiry")' },
  { id: 'events', re: /^events:on\("[^"]+"\)$/i,
    example: 'events:on("document.ingested")' },
  { id: 'route', re: /^\S+\s*->\s*\S+$/,
    example: 'routes/engagements -> screens/EngagementCopy' },
  { id: 'none', re: /^none\s*\(diagnostic,\s*expires\s*(\d{4}-\d{2}-\d{2}),\s*([A-Z]+-\d+)\)$/i,
    example: 'none (diagnostic, expires 2026-10-23, FIND-415)' },
]);

export const CALLER_RE = /^Caller:\s*(.+?)\s*$/m;

/** PURE. The trailer's raw value, or null when the message carries none. */
// B-11253. The diagnostic-claim guard binds from this date forward only. A rule applied backwards
// refuses work that could not have complied, which is the outage this session caused twice before
// learning it. Commits before this date are judged by the rules that existed when they were written.
export const DIAGNOSTIC_GUARD_FROM = '2026-09-25';

export function callerValue(message) {
  if (typeof message !== 'string') return null;
  const m = CALLER_RE.exec(message);
  return m ? m[1] : null;
}

export const VALID = 'VALID', MALFORMED = 'MALFORMED', EXPIRED = 'EXPIRED', ABSENT = 'ABSENT';

// B-11393. Two new states, and they are deliberately not one. UNRESOLVED means the resolver looked
// and the target does not exist, which the author can fix by naming something real. NOT-MEASURED
// means the resolver could not be consulted at all, which no edit to the trailer can fix. Folding
// them together is precisely what let a gate with no resolver report the same verdict as one with it.
export const UNRESOLVED = 'UNRESOLVED', NOT_MEASURED = 'NOT-MEASURED';

// The running file's OWN repository, never process.cwd(): this gate runs from hooks, from CI and from
// worktrees, and resolving a sibling script against the caller’s directory is how a tool reads the
// wrong tree.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * PURE. Classify a trailer value.
 *
 * `now` is injected rather than read, so an expiry verdict is reproducible and testable. A diagnostic
 * admitted with an expiry more than 30 days out is MALFORMED, not VALID: the limit is the control.
 * Duration is the failure mode — a population of unwired scripts accumulates one defensible script at a
 * time, and a quota would let that happen at a steady rate forever.
 */
// B-11393. The resolver lives in its own module because six other scripts use it. Loading it lazily
// and reporting null on failure is what lets the caller above distinguish "could not resolve" from
// "resolved to nothing", which are different verdicts and must not collapse into one.
//
// INJECTABLE for tests, and the default is the real thing: a test that stubs this by accident would
// be testing its own stub, which is the failure this whole item is about.
export function resolveOrNull(value, resolver = null) {
  try {
    const r = (resolver || defaultResolver)(value);
    if (!r || typeof r.ok !== 'boolean') return null;
    return r;
  } catch { return null; }
}

function defaultResolver(value) {
  const out = spawnSync(process.execPath,
    [path.join(REPO_ROOT, 'scripts/governance/caller-resolves.mjs'), '--gate', '--value', value],
    { encoding: 'utf8' });
  if (out.error || out.status === null) return null;          // could not run at all
  if (out.status === 2) return null;                           // NOT-MEASURED from the resolver itself
  const why = String(out.stderr || out.stdout || '').trim().split('\n')[0];
  return { ok: out.status === 0, why };
}

export function classifyCaller(value, { now = new Date(), maxDiagnosticDays = 30 } = {}) {
  if (value == null || String(value).trim() === '') return { state: ABSENT, form: null, why: 'no Caller trailer' };
  const v = String(value).trim();
  for (const f of CALLER_FORMS) {
    const m = f.re.exec(v);
    if (!m) continue;
    // SHAPE ONLY. B-11291 separated these layers deliberately: this function answers "is the trailer
    // well formed", and whether the name EXISTS is resolved one level up, in gateDecision. Collapsing
    // them here was my first attempt at B-11393 and a fixture refused it by name, correctly.
    if (f.id !== 'none') return { state: VALID, form: f.id, why: `names an invoker (${f.id})` };
    const expires = new Date(`${m[1]}T00:00:00Z`);
    if (Number.isNaN(expires.getTime())) {
      return { state: MALFORMED, form: 'none', why: `the expiry "${m[1]}" is not a date` };
    }
    const days = Math.ceil((expires.getTime() - now.getTime()) / 86400000);
    if (days < 0) {
      return { state: EXPIRED, form: 'none', finding: m[2], expires: m[1],
        why: `the diagnostic expired ${-days} day(s) ago; wire it or delete it` };
    }
    if (days > maxDiagnosticDays) {
      return { state: MALFORMED, form: 'none', finding: m[2], expires: m[1],
        why: `an expiry ${days} days out exceeds the ${maxDiagnosticDays}-day limit; duration is the failure this bounds` };
    }
    return { state: VALID, form: 'none', finding: m[2], expires: m[1],
      why: `admitted diagnostic, expires ${m[1]} (${days} day(s))` };
  }
  return { state: MALFORMED, form: null,
    why: `"${v.slice(0, 60)}" matches no accepted form. One of: ${CALLER_FORMS.map((f) => f.example).join(' | ')}` };
}

// ── which commits the bar applies to ─────────────────────────────────────────────────────────────────
// A capability is code the system could invoke. Docs, state and test-only commits are not capabilities,
// and demanding a caller of them would make the trailer a ritual, which is how a gate stops being read.
export const CODE_RE = /\.(mjs|js|cjs|ts|tsx|jsx|py|rs|go|rb|sh)$/i;

/**
 * PURE. B-11364. Does this commit ship a capability with NOTHING TO INVOKE IT?
 *
 * WHY THIS REPLACES THE PATH TEST. `stagesCapability` returns true for any non-test code file, so it
 * could not tell SHIPPING a capability from FIXING one. The gate's own comment above states the
 * intent as "code the system could invoke", which is a claim about what the code IS; the detector
 * tested which FILE changed. A member hit it on a bug fix and correctly refused to reword to pass,
 * because none of the four accepted forms was true of their commit.
 *
 * MY FIRST REPAIR WAS ALSO A PROXY AND THEY FALSIFIED IT. I proposed "a new code file, or an added
 * export". Their commit added two exports and was a REFACTOR: the capability already existed inline
 * and was extracted into a named helper, so nothing invocable after the commit was uninvocable
 * before. An added export is a reliable signal of new SURFACE, not of new CAPABILITY, and extraction
 * is exactly where those come apart.
 *
 * SO ASK THE CALL GRAPH, NOT THE DIFF. The protocol's concern is "a capability that ships without
 * something invoking it unattended is not shipped": the failure is a thing with NO CALLER. A new file
 * or added export that already has a call site in the tree has answered the question structurally,
 * and a trailer could add nothing `grep` has not already said better. A trailer is a claim a person
 * wrote; a call site is the thing itself.
 *
 * WHAT STILL NEEDS THE TRAILER, correctly: a new scheduled script, an event producer, a route
 * handler. All land with no in-tree caller because what invokes them is a clock, a bus or a router
 * OUTSIDE the call graph, which is precisely what the four forms describe.
 *
 * KNOWN FAILURE DIRECTION, stated rather than hidden: a dynamic caller (`import()` by computed name,
 * a handler registered by string key) has no literal call site and IS refused. That is the right way
 * to fail. When the structure cannot answer, the human asserts.
 *
 * @param {object} f  facts the caller resolves; every one unreadable-as-null, never false.
 */
export function shipsUncalledCapability({ newCodeFiles, addedExports, hasCallSite } = {}) {
  // UNREADABLE FAILS TOWARD "IS A CAPABILITY" (R-14.4). An exemption that fires when a field cannot
  // be read is an exemption anyone can claim by corrupting it, which is the reason already written
  // above `predatesProtocol`.
  if (newCodeFiles == null || addedExports == null) return null;
  const introduced = [...newCodeFiles, ...addedExports];
  if (!introduced.length) return false;              // nothing new: a fix or a refactor, not a ship
  if (hasCallSite == null) return null;              // could not read the call graph: not a pass
  // Any introduced symbol or file with NO call site is the case the trailer exists for.
  return introduced.some((name) => hasCallSite(name) !== true);
}

/** PURE. Does this staged path set contain a capability that something ought to invoke? */
export function stagesCapability(paths) {
  if (!Array.isArray(paths)) return null;            // could not be read: NOT "no"
  const code = paths.filter((p) => CODE_RE.test(String(p)));
  if (!code.length) return false;
  // A commit that only touches tests is not shipping a capability. Tests are explicitly NOT roots in the
  // orphan check for the same reason: admitting them makes the check pass everywhere and certify nothing.
  // The right-hand boundary accepts a HYPHEN as well as a dot or slash. Reported by the ace workstream: the pattern
  // required the character after "test" to be "." or "/", so `web/src/test-setup.ts` was not recognised as a test
  // file and a commit touching only the vitest setup was refused as a capability with no invoker. Their session did
  // the right thing and moved the stub rather than inventing a Caller, which is exactly the pressure this created:
  // a gate that misreads a test file pushes an author toward a false trailer to get past it.
  //
  // Checked against the words that merely CONTAIN "test": contest-results, latest-build, attestation and protest all
  // still fail to match, because the LEFT boundary already requires start-of-string or one of [./-] before it. Only
  // test-setup.ts and my-test-helper.ts change, and both are test files.
  const nonTest = code.filter((p) => !/(^|[./-])(test|spec)s?[./-]/i.test(String(p)) && !/\.(test|spec)\./i.test(String(p)));
  return nonTest.length > 0;
}

export const ADOPTED_AT = process.env.CORRECTION_LOOP_ADOPTED_AT || '2026-09-23T00:00:00Z';

/**
 * PURE. Work authored before adoption is exempt. An UNREADABLE date is JUDGED, never exempted: an
 * exemption that fires when a field cannot be read is an exemption anyone can claim by corrupting it.
 */
export function predatesProtocol(authorIso, adoptedAt = ADOPTED_AT) {
  const t = Date.parse(String(authorIso || ''));
  if (Number.isNaN(t)) return false;
  return t < Date.parse(adoptedAt);
}

export const PASS = 'PASS', REFUSE = 'REFUSE', UNREADABLE = 'UNREADABLE', NOT_APPLICABLE = 'NOT-APPLICABLE';

/**
 * PURE. The whole verdict, from facts the caller gathered. No I/O here, so every branch is testable.
 */
export function gateDecision({
  message, stagedPaths, authoredAt = null, now = new Date(), isMerge = false,
  // B-11364. Resolved by the caller from git; omitted entirely means "fall back to the path test",
  // which is what every existing caller and test does without changing a line.
  capabilityFacts = null,
  // B-11393. Carried through to classifyCaller so a caller can inject a resolver. The DEFAULT is the
  // real one: a test that stubs this by accident would be testing its own stub, which is the shape of
  // the defect this item fixed.
  resolver = null,
} = {}) {
  // B-11210. A MERGE COMMIT SHIPS NO CAPABILITY, AND REFUSING ONE BLOCKS EVERY MERGE.
  //
  // A merge combines work that was already judged commit by commit; its own file list is the union of
  // both sides, so demanding a Caller trailer of it asks the merger to declare an invoker for code they
  // did not write. `judgeRange` already excludes merges with --no-merges; the local hook did not, and the
  // first merge attempted after installing this gate was refused by it. Left unfixed that is 17 repos
  // unable to merge anything, which is the churn this protocol exists to end rather than cause.
  if (isMerge) return { state: NOT_APPLICABLE, why: 'a merge commit ships no capability of its own; its constituent commits were judged individually' };
  if (typeof message !== 'string') {
    return { state: UNREADABLE, why: 'the commit message could not be read, so the caller claim was never checked' };
  }
  // B-11364. THE PRECISE PREDICATE WHEN IT CAN BE RESOLVED, THE OLD ONE WHEN IT CANNOT.
  //
  // `shipsUncalledCapability` asks the call graph and is strictly better: it does not refuse a bug fix
  // or a refactor. But it needs facts a caller must resolve from git, and this gate is a REQUIRED check
  // in eight member repositories. If the resolver fails there, returning UNREADABLE would exit 1 and
  // stop every commit in that repo, which is an outage caused by a correctness improvement.
  //
  // So an unresolvable call graph falls back to `stagesCapability`, the path test. That is never LESS
  // strict than today, because the path test over-matches; it satisfies "unreadable fails toward is-a-
  // capability" by construction; and the worst case is the behaviour every member already has.
  const uncalled = shipsUncalledCapability(capabilityFacts || {});
  const staged = uncalled === null ? stagesCapability(stagedPaths) : uncalled;
  if (staged === null) {
    return { state: UNREADABLE, why: 'the staged path list could not be read, so whether this commit ships a capability is unknown' };
  }
  if (staged === false) {
    // A DIAGNOSTIC CLAIM ON A COMMIT THAT SHIPS NOTHING IS A CLAIM NOBODY MEANT (B-11253).
    //
    // The four accepted forms all describe something that INVOKES a capability. A commit changing only
    // CHANGELOG.md adds no capability, so none of the four is true of it, and the nearest one,
    // `none (diagnostic, expires ...)`, asserts that a temporary diagnostic exists and will be removed.
    // On 2026-09-24 that false assertion was written eight times in a single session, C2 then looked in
    // the register for eight diagnostics that were never diagnostics, and main went red for the whole
    // queue. The eight were registered because history is immutable; this is what stops the ninth.
    //
    // A closed set with no true option produces a false claim rather than a blank. Widening the set is
    // the operator's call on their own protocol. Refusing the claim that was never meant is not, and it
    // is the half that can be fixed here.
    // GRANDFATHERED, because a new refusal applied to existing history is an outage and this session has
    // caused that twice already. Commits written before the guard existed could not have known about it,
    // and two open branches carry exactly that shape: refusing them would block the queue for a rule
    // nobody had when they were authored. The eight already-registered claims are in the same position.
    const v = callerValue(message);
    const newEnough = !authoredAt || authoredAt >= DIAGNOSTIC_GUARD_FROM;
    if (newEnough && v && /^none\s*\(diagnostic/i.test(v.trim())) {
      return { state: REFUSE,
        why: 'this commit ships no capability and claims a diagnostic exemption anyway. The claim is '
          + 'permanent once written: C2 will require a register row for it in every future run, and the '
          + 'diagnostic it names does not exist. Remove the Caller: trailer. A documentation-only commit '
          + 'needs none, which is why this gate would otherwise not have asked you for one.' };
    }
    // B-11364. THE REASON MUST NAME WHICH PREDICATE ANSWERED. With the call graph resolved, a commit
    // CAN stage source and still ship no capability, so the old wording said "no non-test source
    // staged" about a commit that staged plenty. A verdict that is right for a reason it misstates is
    // how the next reader concludes the gate is broken and stops trusting it.
    return { state: NOT_APPLICABLE, why: uncalled === false
      ? 'everything this commit introduces already has a call site in the tree, so nothing ships uninvoked. A modification or a refactor is not a ship.'
      : 'no non-test source staged: this commit ships no capability' };
  }
  if (authoredAt && predatesProtocol(authoredAt)) {
    return { state: NOT_APPLICABLE, why: `authored ${authoredAt}, before the protocol was adopted (${ADOPTED_AT})` };
  }
  const c = classifyCaller(callerValue(message), { now });
  // B-11393. RESOLUTION HAPPENS HERE, not in classifyCaller, because shape and existence are separate
  // questions and this file had never asked the second one. The gate matched four regexes and passed
  // anything well formed, so a trailer naming a job that does not exist cleared the required context
  // called "a capability names its caller". The resolver existed, worked, and was called by six other
  // scripts; none of them was this gate.
  if (c.state === VALID) {
    const r = resolveOrNull(callerValue(message), resolver);
    // FAIL CLOSED when the resolver is absent. Fifteen members carry this gate and ZERO carry the
    // resolver, so degrading to shape checking would keep reporting the same check name while
    // enforcing something weaker, which is the condition this item exists to end (R-14.4).
    if (r === null) {
      return { state: UNREADABLE, caller: c,
        why: 'the trailer is well formed, but the resolver could not be loaded, so whether it names '
          + 'anything real is UNKNOWN. Install scripts/governance/caller-resolves.mjs alongside this '
          + 'gate, with a job registry for it to resolve against.' };
    }
    if (r.ok === false) return { state: REFUSE, caller: c, why: r.why };
    return { state: PASS, caller: c, why: `${c.why} that resolves` };
  }
  if (c.state === ABSENT) {
    return { state: REFUSE, caller: c,
      why: 'this commit ships a capability and names no invoker. Add a Caller: trailer naming what runs it '
        + 'unattended, or `Caller: none (diagnostic, expires <YYYY-MM-DD>, <FINDING-ID>)` if nothing does. '
        + 'A capability nothing calls is the failure the Correction Loop exists to stop.' };
  }
  return { state: REFUSE, caller: c, why: c.why };
}

// ── range mode, which is the half a commit hook cannot enforce ───────────────────────────────────────
//
// B-11209. A commit hook is fast local feedback and nothing more. `git commit --no-verify` walks past
// it, and `core.hooksPath` is LOCAL config that cannot be committed, so a fresh clone carries this file
// and runs it never. Measured across the members on 2026-09-23: six carried the diagnosis gate at HEAD
// with hooksPath unset, and its local half had therefore never run in any of them.
//
// This mode judges a RANGE, one commit at a time, so CI can refuse what the hook only suggests. Per
// commit, because `actions/checkout` on a pull_request checks out the MERGE commit, whose own message
// and file list belong to neither side.
/**
 * B-11415. THE FACTS BOTH PATHS NEED, COMPUTED FROM ONE PLACE.
 *
 * The pre-commit path computed capabilityFacts and used the CALL-GRAPH test; judgeRange passed none, so every
 * commit in a range fell back to `stagesCapability`, a PATH test whose own comment admits it over-matches.
 * The result was one check name reaching opposite verdicts: a commit that changes a single constant passed the
 * hook and was refused by CI as "ships a capability and names no invoker". Measured on a real commit that moved
 * WARP_WHEN_UNREAD from 1 to 0 plus three test fixtures: stagesCapability said true.
 *
 * That is the two-components-one-fact shape this programme keeps paying for, and the honest fix is to make the
 * range path ask the SAME question rather than to add fourteen false Caller trailers so the stricter half stops
 * complaining.
 *
 * `range` is the git diff selector: '--cached' for a pending commit, '<sha>~1..<sha>' for a landed one.
 * Returns null when anything cannot be read, which the caller must treat as "fall back", never as a pass.
 */
export function capabilityFactsFor(repo, range, { exec = null } = {}) {
  void repo;   // kept for call-site clarity; the injected runner already carries the cwd
  try {
    // The RUNNER IS INJECTED rather than imported. This file has no child_process import and should not grow
    // one: both callers already have a git runner bound to the right cwd, and injection is what makes this
    // testable without spawning git. No runner is a real answer, not an error: it returns null and the caller
    // falls back to the path test exactly as before.
    const run = exec;
    if (typeof run !== 'function') return null;
    const args = range === '--cached' ? ['--cached'] : [range];
    const newCodeFiles = run('diff', ...args, '--name-only', '--diff-filter=A')
      .split('\n').map((x) => x.trim()).filter(Boolean).filter((x) => CODE_RE.test(x));
    const diff = run('diff', ...args, '--unified=0');
    const addedExports = [...new Set(
      diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .flatMap((l) => [...l.matchAll(/export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)])
        .map((m) => m[1]),
    )];
    if (!newCodeFiles.length && !addedExports.length) return { newCodeFiles, addedExports, hasCallSite: () => true };
    const refs = (name) => {
      try {
        return run('grep', '-l', '--fixed-strings', '-e', name, '--', '*.mjs', '*.js', '*.ts', '*.tsx', '*.sh', '*.json')
          .split('\n').map((x) => x.trim()).filter(Boolean);
      } catch { return []; }
    };
    const hasCallSite = (nameOrPath) => {
      const base = String(nameOrPath).split('/').pop().replace(/\.[^.]+$/, '');
      const hits = refs(String(nameOrPath).includes('/') ? base : nameOrPath);
      return hits.some((f) => f !== nameOrPath);
    };
    return { newCodeFiles, addedExports, hasCallSite };
  } catch { return null; }
}

// B-11393. The options object exists so a caller can inject a resolver, as gateDecision does. It
// defaults to nothing, so every existing caller and CI invocation is unchanged and gets the REAL
// resolver, which is the point: the range mode is what CI runs, and CI must resolve.
export function judgeRange(commits, { resolver = null } = {}) {
  if (!Array.isArray(commits)) return null;
  const fellBack = [];
  const refusals = [];
  for (const c of commits) {
    // B-11415. ASK THE SAME QUESTION THE HOOK ASKS. Without this the range path fell back to the path test
    // and refused commits the hook had passed. `c.capabilityFacts` is accepted from the caller when supplied
    // (tests inject it), otherwise derived from the commit's own diff, and a null falls back exactly as before.
    const facts = c.capabilityFacts !== undefined
      ? c.capabilityFacts
      : (c.sha && c.exec ? capabilityFactsFor(null, `${c.sha}~1..${c.sha}`, { exec: c.exec }) : null);
    // B-11415 RESIDUAL, CLOSED HERE. A null means this commit was judged by the over-matching PATH test rather
    // than the call graph, which is the safe direction but a SILENT downgrade: a caller that forgets to inject a
    // runner gets the old behaviour and nothing says so. Counting it makes the degradation visible, because an
    // unreported fallback is how a check comes to measure something weaker than its name claims.
    if (facts === null) fellBack.push(c.sha || '(unknown sha)');
    const d = gateDecision({ message: c.message, stagedPaths: c.paths, authoredAt: c.authoredAt, capabilityFacts: facts, resolver });
    if (d.state === REFUSE || d.state === UNREADABLE) refusals.push({ sha: c.sha, state: d.state, why: d.why });
  }
  // NON-ENUMERABLE, because an enumerable property on the returned array breaks every assert.deepEqual against
  // it, and two existing tests caught that immediately. The historical return is an array callers index; a
  // diagnostic must ride alongside without changing what the value IS.
  Object.defineProperty(refusals, 'fellBack', { value: fellBack, enumerable: false, configurable: true });
  return refusals;
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────────
const isMain = (() => {
  try { return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href; } catch { return false; }
})();
if (isMain && process.argv.includes('--range')) {
  const { execFileSync } = await import('node:child_process');
  const range = process.argv[process.argv.indexOf('--range') + 1];
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let shas = null;
  try { shas = git('rev-list', '--no-merges', range).split('\n').filter(Boolean); } catch { shas = null; }
  if (shas === null) {
    console.error(`correction-loop --range: could not read ${range}, so nothing was judged. That is not a pass.`);
    process.exit(1);
  }
  const commits = shas.map((sha) => ({
    sha,
    // B-11415. Hand the range path the same runner the hook uses, so capabilityFactsFor can ask the call graph
    // instead of falling back to the over-matching path test. Without this, CI refused commits the hook passed.
    exec: git,
    message: (() => { try { return git('log', '-1', '--format=%B', sha); } catch { return null; } })(),
    paths: (() => { try { return git('show', '--name-only', '--format=', sha).split('\n').map((x) => x.trim()).filter(Boolean); } catch { return null; } })(),
    authoredAt: (() => { try { return git('log', '-1', '--format=%aI', sha).trim(); } catch { return null; } })(),
  }));
  const refusals = judgeRange(commits);
  // B-11415. SAY WHEN THE PRECISE TEST COULD NOT RUN. Falling back to the path test is the safe direction, but a
  // silent downgrade means the check reports the same name while measuring something weaker, which is the shape
  // this programme keeps finding. Printed as a note, never as a refusal: it is a gap in the reading.
  if (Array.isArray(refusals) && refusals.fellBack && refusals.fellBack.length) {
    process.stderr.write(`  note: ${refusals.fellBack.length} of ${commits.length} commit(s) judged by the `
      + `over-matching PATH test because the call graph could not be read for them. That is the stricter `
      + `direction, not a pass, but it is less precise than the hook: ${refusals.fellBack.slice(0, 5).join(", ")}\n`);
  }
  console.error(`correction-loop (step 4) — judged ${commits.length} commit(s) in ${range}`);
  for (const r of refusals) console.error(`  ✖ ${r.sha.slice(0, 9)} ${r.state}: ${r.why}`);
  if (refusals.length) {
    console.error('  accepted forms:');
    for (const f of CALLER_FORMS) console.error(`    Caller: ${f.example}`);
    console.error('  Protocol: docs/governance/CORRECTION_LOOP.md');
  }
  process.exit(refusals.length ? 1 : 0);
}
if (isMain) {
  const [, , msgFile] = process.argv;
  let message = null;
  try { message = msgFile ? fs.readFileSync(msgFile, 'utf8') : null; } catch { message = null; }
  let staged = null;
  let merging = false;
  try {
    const { execFileSync } = await import('node:child_process');
    staged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: REPO, encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter(Boolean);
    // MERGE_HEAD exists only while a merge is in progress, which is exactly when this hook runs for one.
    try { execFileSync('git', ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], { cwd: REPO, stdio: 'ignore' }); merging = true; } catch { merging = false; }
  } catch { staged = null; }
  // B-11364. RESOLVE THE CALL GRAPH FACTS, and degrade to null rather than throwing.
  //
  // Every failure here returns null for the facts, which makes gateDecision fall back to the path
  // test. That is the behaviour this gate has today, so a resolver that cannot run costs nothing and
  // cannot stop a commit it would otherwise have allowed.
  const capabilityFacts = await (async () => {
    try {
      const { execFileSync } = await import('node:child_process');
      const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      // Files ADDED by this commit, not merely touched.
      const newCodeFiles = git('diff', '--cached', '--name-only', '--diff-filter=A')
        .split('\n').map((x) => x.trim()).filter(Boolean).filter((x) => CODE_RE.test(x));
      // Exported symbols on ADDED lines. Deliberately syntactic rather than a parser: a parser that
      // cannot read one dialect would report "no exports" and silently exempt the commit.
      const diff = git('diff', '--cached', '--unified=0');
      const addedExports = [...new Set(
        diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'))
          .flatMap((l) => [...l.matchAll(/export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)]
            .map((m) => m[1])),
      )];
      if (!newCodeFiles.length && !addedExports.length) return { newCodeFiles, addedExports, hasCallSite: () => true };
      // A call site is any reference OUTSIDE the file that introduced it. Searching the worktree
      // rather than the index is deliberate: the caller may be staged in this same commit, which is
      // the refactor case this whole change exists to allow.
      const refs = (name) => {
        try {
          const out = git('grep', '-l', '--fixed-strings', '-e', name, '--', '*.mjs', '*.js', '*.ts', '*.tsx', '*.sh', '*.json');
          return out.split('\n').map((x) => x.trim()).filter(Boolean);
        } catch { return []; }   // git grep exits 1 on no match, which is a real answer
      };
      const hasCallSite = (nameOrPath) => {
        const base = String(nameOrPath).split('/').pop().replace(/\.[^.]+$/, '');
        const hits = refs(String(nameOrPath).includes('/') ? base : nameOrPath);
        return hits.some((f) => f !== nameOrPath);
      };
      return { newCodeFiles, addedExports, hasCallSite };
    } catch { return null; }
  })();
  const d = gateDecision({ message, stagedPaths: staged, isMerge: merging, capabilityFacts });
  const label = { [PASS]: '✓', [REFUSE]: '✖', [UNREADABLE]: '?', [NOT_APPLICABLE]: '·' }[d.state];
  console.error(`correction-loop (step 4: a capability needs a caller) — ${label} ${d.state}: ${d.why}`);
  if (d.state === REFUSE) {
    console.error('  accepted forms:');
    for (const f of CALLER_FORMS) console.error(`    Caller: ${f.example}`);
    console.error('  Protocol: docs/governance/CORRECTION_LOOP.md');
  }
  // UNREADABLE exits 1 too: a gate that could not look has cleared nothing (R-14.4).
  process.exit(d.state === REFUSE || d.state === UNREADABLE ? 1 : 0);
}
