#!/usr/bin/env node
/**
 * DOES THE CALLER ACTUALLY EXIST? B-11291, closing caller fixture F13.
 *
 * The four accepted `Caller:` forms are deliberately narrow, and that half works: it stops
 * "Caller: the fleet" certifying nothing. What the fixture pinned is the other half:
 *
 *   "It does not stop a well-formed name for something that was never wired: nothing resolves
 *    `scheduler:hourly("...")` against the job registry, or the left side of an arrow against the tree."
 *
 * So `scheduler:hourly("a-job-that-does-not-exist")` passed, and so did an arrow naming two files that
 * are not in the tree. A trailer is a CLAIM about what invokes a capability, and a claim checked for
 * grammar and not for truth is the shape this whole protocol exists to refuse, one level up from the
 * capability it was meant to certify.
 *
 * WHAT IT RESOLVES AGAINST, all read from the tree rather than listed here:
 *
 *   scheduler:<cadence>("id")   the id must be a job in docs/operations/RECURRING_JOBS.json
 *   events:on("name")           a fault-detector id, OR a workflow trigger (push, schedule, ...), OR a
 *                               fault CLASS. Three sources because all three are real invokers here, and
 *                               a resolver that knew only detectors would refuse `events:on("push")`,
 *                               which is a correct trailer used by several commits in this repository.
 *   a -> b                      both sides resolve as paths, or as a file findable under scripts/ or
 *                               apps/. Routes and screens are named loosely by convention, so a match on
 *                               basename counts; the point is to catch a name that resolves to NOTHING.
 *   none (diagnostic, ...)      already checked by the diagnostics register (C2), not re-checked here.
 *
 * THREE-STATE, AND IT MATTERS MORE HERE THAN USUAL (R-14.4). If a source cannot be read, the answer is
 * NOT-MEASURED, never "does not exist". Refusing a trailer because a registry failed to parse would block
 * work for a reason that has nothing to do with the work, and that is how a control gets switched off.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = process.env.QOS_REPO || path.resolve(HERE, '../..');
export const RESOLVED = 'RESOLVED', UNRESOLVED = 'UNRESOLVED', NOT_MEASURED = 'NOT-MEASURED', NA = 'NOT-APPLICABLE';

/** Read the things a trailer can name. Any field null means that source could not be read. */
/**
 * PURE-ish. The hook and harness event names this repository actually has, DERIVED and never listed.
 *
 * B-11299 / C2. Two honest trailers on main were refused because no source could contain their names:
 * `events:on("commit-msg")` names a git hook and `events:on("SessionStart")` names a Claude Code
 * harness hook. Neither is a recurring job, a workflow trigger, or a fault detector, so loading every
 * existing source reached neither. That was proven rather than assumed: with all 153 detectors loaded,
 * both stayed UNRESOLVED while a real detector id moved to RESOLVED.
 *
 * DERIVED FROM THE REPOSITORY, not from a list in this file. A hardcoded set would be a fourth copy of
 * a fact this program has already watched go stale three times in one day. The git hooks are the files
 * git will actually run, and the harness events are the keys the settings file actually registers, so
 * a hook that is added or removed changes this set without anyone editing it.
 *
 * null, NOT an empty set, when neither source can be read. An empty set would make every hook trailer
 * a refusal on the strength of a directory nobody managed to list.
 */
export function hookNames({ repo = REPO, fsys = fs } = {}) {
  const out = new Set();
  let read = 0;
  try {
    for (const f of fsys.readdirSync(path.join(repo, 'scripts/governance/hooks'))) {
      if (!f.includes('.')) out.add(f);          // hook files carry no extension
    }
    read += 1;
  } catch { /* unreadable: counted by `read` staying put */ }
  for (const rel of ['.claude/settings.json', '.claude/settings.local.json']) {
    try {
      const j = JSON.parse(fsys.readFileSync(path.join(repo, rel), 'utf8'));
      for (const k of Object.keys(j.hooks || {})) out.add(k);
      read += 1;
    } catch { /* absent or unreadable */ }
  }
  return read === 0 ? null : out;
}

export async function sources({ repo = REPO, fsys = fs } = {}) {
  let jobs = null;
  try {
    const j = JSON.parse(fsys.readFileSync(path.join(repo, 'docs/operations/RECURRING_JOBS.json'), 'utf8'));
    jobs = new Set((Array.isArray(j) ? j : (j.jobs || [])).map((x) => x && x.id).filter(Boolean));
  } catch { jobs = null; }

  let triggers = null;
  try {
    const dir = path.join(repo, '.github/workflows');
    const found = new Set();
    for (const f of fsys.readdirSync(dir)) {
      if (!/\.ya?ml$/.test(f)) continue;
      const src = fsys.readFileSync(path.join(dir, f), 'utf8');
      // Deliberately a text scan and not a YAML parse: one malformed workflow must not blank the whole
      // trigger set and turn every events: trailer into an UNRESOLVED refusal.
      for (const m of src.matchAll(/^\s{2}(push|pull_request|schedule|workflow_dispatch|workflow_call|issues|release):/gm)) {
        found.add(m[1]);
      }
    }
    triggers = found;
  } catch { triggers = null; }

  // B-11299 / C1. THE DETECTOR SET AND THE HOOK NAMESPACE LOAD HERE, and before this they did not.
  // `sources()` returned {jobs, triggers} while its own documentation said an events: trailer may name
  // a fault detector, so every caller but the CLI got a resolver blind to all 153 of them. The CLI
  // happened to be correct because it called eventNames() separately, which is exactly the kind of
  // accident that makes a defect invisible: the one path anybody exercised worked.
  // ASYNC because eventNames dynamically imports the fault monitor. sources() has no callers
  // outside this module and its tests, so awaiting here costs nothing and removes the trap where
  // the only correct path was the one the CLI happened to take.
  let events = null;
  try { events = await eventNames({ repo }); } catch { events = null; }
  const hooks = hookNames({ repo, fsys });
  return { jobs, triggers, events, hooks };
}

/** Detector and fault-class names, loaded lazily because the module is large. */
export async function eventNames({ repo = REPO } = {}) {
  try {
    const m = await import(path.join(repo, 'scripts/copilot/fault-monitor.mjs'));
    const out = new Set();
    for (const d of m.DETECTORS || []) {
      if (d && d.id) out.add(d.id);
      if (d && d.class) out.add(String(d.class));
    }
    return out;
  } catch { return null; }
}

/** PURE. Does a path-ish name resolve to something in the tree? Basename match counts, by convention. */
export function pathResolves(name, { repo = REPO, fsys = fs } = {}) {
  const clean = String(name || '').trim();
  if (!clean) return false;
  if (fsys.existsSync(path.join(repo, clean))) return true;
  const base = clean.split('/').pop().replace(/\.(mjs|js|ts|tsx|jsx)$/, '');
  if (!base) return false;
  const stack = ['scripts', 'apps', 'services', 'os', 'src'];
  for (const root of stack) {
    const dir = path.join(repo, root);
    let entries;
    try { entries = fsys.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    const work = entries.map((e) => ({ dir, e }));
    while (work.length) {
      const { dir: d, e } = work.pop();
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (/node_modules|^\./.test(e.name)) continue;
        try { for (const c of fsys.readdirSync(full, { withFileTypes: true })) work.push({ dir: full, e: c }); }
        catch { /* unreadable subdir: fewer candidates, and the caller reports UNRESOLVED not NOT-MEASURED */ }
        continue;
      }
      if (e.name.replace(/\.(mjs|js|ts|tsx|jsx)$/, '') === base) return true;
    }
  }
  return false;
}

/** PURE-ish. Resolve one trailer value against the sources handed in. */
// NOT-SUPPLIED AND UNREADABLE ARE DIFFERENT, and collapsing them was a defect in the first version of
// this fix. A caller passing only {events, triggers} is saying "check these"; a caller passing
// `hooks: null` is saying "I tried and could not read it". The defaults are undefined so that only an
// EXPLICIT null counts as unread, and an existing caller that never heard of hooks is not told the
// answer is unknowable. Caught by a test that expected UNRESOLVED and got NOT-MEASURED.
export function resolve(value, { jobs, triggers, events, hooks, resolvePath = null } = {}) {
  const v = String(value || '').trim();
  if (!v) return { state: NOT_MEASURED, why: 'no Caller value to resolve' };

  const sched = v.match(/^scheduler:[a-z0-9_-]+\("([^"]+)"\)$/i);
  if (sched) {
    // `== null` catches undefined too, and that matters: making the parameter defaults undefined so
    // NOT-SUPPLIED could be told from UNREADABLE left this guard testing only `=== null`, so a caller
    // that omitted `jobs` fell through to `jobs.has(...)` and CRASHED instead of returning a verdict.
    // A gate that throws is worse than one that refuses, because a crash has no state at all.
    if (jobs == null) {
      return { state: NOT_MEASURED, why: 'the recurring-job registry was not read, so whether this job '
        + 'exists is unknown. Refusing a trailer because a registry failed to parse would block work for a '
        + 'reason that has nothing to do with the work.' };
    }
    return jobs.has(sched[1])
      ? { state: RESOLVED, why: `job "${sched[1]}" is registered` }
      : { state: UNRESOLVED, names: [sched[1]],
          why: `no registered job is called "${sched[1]}". A well-formed name for a producer that was never `
            + 'wired certifies nothing, which is the whole point of the trailer.' };
  }

  const ev = v.match(/^events:on\("([^"]+)"\)$/i);
  if (ev) {
    const name = ev[1];
    // FOUND IS FOUND, whichever source holds it. Checked before the guard below, because a name we can
    // see is resolved regardless of what else failed to load.
    if ((events && events.has(name)) || (triggers && triggers.has(name)) || (hooks && hooks.has(name))) {
      return { state: RESOLVED, why: `"${name}" is a known detector, workflow trigger, or hook event` };
    }
    // B-11299 / C3. A MISSING SOURCE IS NOT A REFUSAL. This required BOTH events and triggers to be
    // null, and triggers is a populated Set in every real invocation, so the branch could not fire: a
    // resolver that failed to load its detector list ACCUSED the commit instead of saying it could not
    // tell. Measured: events=null with triggers present returned UNRESOLVED. That is R-14.4 violated
    // inside the control whose job is judging whether a claim is true. Now ANY unread source that
    // could have held this name yields NOT-MEASURED, and the message names which one.
    const unread = [
      events === null ? 'the fault-detector list' : null,
      triggers === null ? 'the workflow triggers' : null,
      hooks === null ? 'the hook and harness events' : null,
    ].filter(Boolean);   // strictly null: undefined means the caller did not ask, which is not a failure
    if (unread.length) {
      return { state: NOT_MEASURED,
        why: `"${name}" was not found, but ${unread.join(' and ')} could not be read, so whether it exists is `
          + 'UNKNOWN rather than false. A source that did not load is not a name that does not exist.' };
    }
    return { state: UNRESOLVED, names: [name],
      why: `"${name}" is not a fault detector, a fault class, a workflow trigger, a git hook, or a harness `
        + 'event in this repository.' };
  }

  const arrow = v.match(/^(.+?)\s*->\s*(.+)$/);
  if (arrow) {
    const rp = resolvePath || ((n) => pathResolves(n));
    const left = rp(arrow[1].trim());
    const right = rp(arrow[2].trim());
    const missing = [!left && arrow[1].trim(), !right && arrow[2].trim()].filter(Boolean);
    return missing.length
      ? { state: UNRESOLVED, names: missing,
          why: `${missing.length === 2 ? 'neither side' : 'one side'} of the arrow resolves to anything in the `
            + `tree: ${missing.join(', ')}.` }
      : { state: RESOLVED, why: 'both sides of the arrow resolve' };
  }

  if (/^none\s*\(/i.test(v)) {
    return { state: NA, why: 'a diagnostic exemption, checked by the diagnostics register (C2) rather than here' };
  }
  return { state: NOT_MEASURED, why: `the value does not match any of the four accepted forms, which is the `
    + 'SHAPE check\'s job rather than this one\'s' };
}

export function render(v, value) {
  return [`caller-resolves — ${v.state}: ${value ? `"${value}" — ` : ''}${v.why}`];
}

if (import.meta.url === `file://${path.resolve(process.argv[1] || '')}`) {
  const i = process.argv.indexOf('--value');
  const value = i >= 0 ? process.argv[i + 1] : null;
  const s = await sources();
  const v = value ? resolve(value, s) : { state: NOT_MEASURED, why: 'no --value given' };
  console.log(render(v, value).join('\n'));
  process.exit(process.argv.includes('--gate')
    ? (v.state === UNRESOLVED ? 1 : (v.state === NOT_MEASURED ? 2 : 0)) : 0);
}
