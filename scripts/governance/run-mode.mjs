#!/usr/bin/env node
/**
 * MODE IS DECLARED, NEVER INFERRED.
 *
 * "It is an explicit input with no default, and a run that does not carry one refuses to start. The
 * same binary runs both ways - a CLI in your hands is attended, the same CLI invoked by a platform is
 * not - so inference is guaranteed to be wrong some of the time, and wrong in the worse direction: a
 * run that waits at 3 a.m. for an answer nobody will give reads as a hung process."
 *
 * THE FALLBACK IS ASYMMETRIC AND THE ASYMMETRY IS THE POINT. "If the check ever has to fall back, it
 * falls back to UNATTENDED. A defaulted decision is recorded, reviewable and reversible. A blocked
 * worker is seven hours of silence." So there is no code path anywhere in this file that produces
 * ATTENDED without an explicit declaration, and a test asserts that by construction rather than by
 * inspection.
 *
 * FLEET AND ORCHESTRATOR RUNS ARE UNATTENDED BY DEFINITION RATHER THAN BY CONFIGURATION, which means a
 * scheduled run DECLARING attended is a false declaration and is overridden rather than honoured. The
 * override is the one place a declaration does not win, and it only ever moves in the safe direction.
 *
 * TWO HALVES, EACH WHERE ITS EVIDENCE IS. The library is what a run calls at start. The ratchet checks
 * the job REGISTRY, a tracked file, at commit time: a scheduled job whose command carries no mode is
 * new debt. A run's own mode cannot be checked from a commit, and the registry cannot be checked from a
 * run.
 */
export const ATTENDED = 'attended', UNATTENDED = 'unattended';
export const MODES = Object.freeze([ATTENDED, UNATTENDED]);
export const OK = 'OK', REFUSED = 'REFUSED';

/** Invokers that are unattended by definition. Not configuration, and not overridable by a flag. */
export const ALWAYS_UNATTENDED = Object.freeze(['fleet', 'orchestrator', 'scheduler', 'cron', 'launchd', 'ci']);

/**
 * PURE. The explicit declaration, from argv or the environment, or null.
 * An unrecognised value is null rather than a guess: "--mode yes" declares nothing.
 */
export function declaredMode({ argv = [], env = {} } = {}) {
  const i = argv.indexOf('--mode');
  const raw = i !== -1 && argv[i + 1] ? argv[i + 1] : env.QOS_RUN_MODE;
  const v = String(raw ?? '').trim().toLowerCase();
  return MODES.includes(v) ? v : null;
}

/**
 * PURE. The mode this run may use, or a refusal.
 * @param invoker       what launched it, when known
 * @param mustNotRefuse true when the run has already started and something downstream needs an answer.
 *                      Then the fallback applies, and the fallback is UNATTENDED, always.
 */
export function resolveMode({ declared = null, invoker = null, mustNotRefuse = false } = {}) {
  const inv = String(invoker ?? '').toLowerCase();
  const byDefinition = ALWAYS_UNATTENDED.some((k) => inv.includes(k));
  if (byDefinition) {
    return {
      state: OK, mode: UNATTENDED, overrode: declared === ATTENDED,
      why: declared === ATTENDED
        ? `"${invoker}" is unattended by definition rather than by configuration, so a declaration of attended is a false declaration and is overridden. A run that waits for an answer nobody will give reads as a hung process.`
        : `"${invoker}" is unattended by definition`,
    };
  }
  if (declared === null) {
    if (mustNotRefuse) {
      return { state: OK, mode: UNATTENDED, fellBack: true,
        why: 'no mode was declared and this run cannot refuse, so it falls back to unattended. A defaulted decision is recorded, reviewable and reversible; a blocked worker is seven hours of silence.' };
    }
    return { state: REFUSED, mode: null,
      why: 'no run mode declared. Mode is an explicit input with no default: pass --mode attended|unattended or set QOS_RUN_MODE. The same binary runs both ways, so inference is guaranteed to be wrong some of the time and wrong in the worse direction.' };
  }
  return { state: OK, mode: declared, why: `declared ${declared}` };
}

/** PURE. Does a registered job's command carry a mode declaration? */
export function commandDeclares(command) {
  return /--mode\s+(attended|unattended)\b/i.test(String(command ?? ''));
}

/**
 * PURE. The registry ratchet: scheduled jobs whose command declares no mode.
 * Scheduled runs are unattended BY DEFINITION, so the declaration is not what makes them safe; it is
 * what makes the reader able to tell a deliberate unattended run from one nobody thought about.
 */
export function undeclaredJobs(jobs) {
  if (jobs == null) return null;
  return jobs.filter((j) => j && j.id && !j.retired && !commandDeclares(j.command)).map((j) => j.id).sort();
}

/** PURE. The lines printed for a resolution. */
export function render(r) {
  const L = [`run-mode (Correction Loop) — ${r.state}${r.mode ? `: ${r.mode}` : ''}`];
  L.push(`  ${r.why}`);
  if (r.overrode) L.push('  the declaration was overridden, and the override only ever moves toward unattended');
  if (r.fellBack) L.push('  this was a fallback, and the fallback is unattended by design');
  return L;
}

// ------------------------------------------------------------------------------------------------
// CLI
//   --gate-registry    refuse a scheduled job whose command declares no mode. Ratcheted.
//   --write-baseline   record today's undeclared set. Run once, deliberately.
//   --resolve          print the mode this invocation would use (takes --mode / --invoker)
// Exit 0 clear · 1 refused · 2 could not read.
// ------------------------------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const REPO = process.env.QOS_REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const BASELINE_REL = 'docs/governance/run-mode-baseline.json';
  const REG_REL = 'docs/operations/RECURRING_JOBS.json';
  const arg = (n) => { const i = process.argv.indexOf(n); return i === -1 ? null : process.argv[i + 1]; };

  if (process.argv.includes('--resolve')) {
    const r = resolveMode({ declared: declaredMode({ argv: process.argv, env: process.env }), invoker: arg('--invoker') });
    const out = render(r);
    if (r.state === REFUSED) { console.error(out.join('\n')); process.exit(1); }
    console.log(out.join('\n'));
    process.exit(0);
  }

  const regPath = path.join(REPO, REG_REL);
  // ABSENT AND UNREADABLE ARE DIFFERENT, and conflating them refused every commit in a tree with no
  // registry once already today, in mechanism-health. Not twice.
  if (!fs.existsSync(regPath)) {
    console.log(`run-mode (Correction Loop) — PASS: no ${REG_REL} in this tree, so there are no scheduled jobs to declare a mode.`);
    process.exit(0);
  }
  let jobs = null;
  try {
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    jobs = Array.isArray(reg) ? reg : (reg.jobs || Object.values(reg).find(Array.isArray) || null);
  } catch { jobs = null; }
  if (jobs == null) {
    console.error(`run-mode — NOT-MEASURED: ${REG_REL} exists and could not be read or parsed. A gate that could not look has cleared nothing.`);
    process.exit(2);
  }

  const undeclared = undeclaredJobs(jobs);
  if (process.argv.includes('--write-baseline')) {
    fs.writeFileSync(path.join(REPO, BASELINE_REL), `${JSON.stringify({
      note: 'Scheduled jobs whose command declares no run mode. Mode is declared, never inferred. '
        + 'APPEND NOTHING: a new job without a declaration is refused at commit time. This list may only shrink.',
      recorded: new Date().toISOString().slice(0, 10), undeclared,
    }, null, 2)}\n`);
    console.log(`run-mode — baseline written: ${undeclared.length} job(s) declaring no mode.`);
    process.exit(0);
  }

  let baseline = [];
  const basePath = path.join(REPO, BASELINE_REL);
  if (fs.existsSync(basePath)) {
    try { const b = JSON.parse(fs.readFileSync(basePath, 'utf8')); baseline = Array.isArray(b) ? b : (b.undeclared || []); }
    catch { console.error(`run-mode — NOT-MEASURED: ${BASELINE_REL} exists and could not be parsed.`); process.exit(2); }
  }
  const base = new Set(baseline);
  const added = undeclared.filter((id) => !base.has(id));
  if (added.length) {
    console.error(`run-mode (Correction Loop) — ✖ REFUSE: ${added.length} scheduled job(s) declare no run mode: ${added.join(', ')}.`);
    console.error('  Mode is an explicit input with no default. Add `--mode unattended` to the command: a scheduled');
    console.error('  run IS unattended by definition, and the declaration is what lets a reader tell a deliberate');
    console.error('  unattended run from one nobody thought about.');
    console.error(`  Existing debt is grandfathered in ${BASELINE_REL}; this refusal is for NEW jobs only.`);
    process.exit(1);
  }
  console.log(`run-mode (Correction Loop) — PASS: no new scheduled job without a declared mode (${undeclared.length} grandfathered).`);
  process.exit(0);
}
