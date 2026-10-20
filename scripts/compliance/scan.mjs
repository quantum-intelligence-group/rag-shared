#!/usr/bin/env node
// QOS framework-compliance scanner.
//
// WHY: the operator needs every QOS member repo at 100% on two governance scaffolds —
//   - Maker compliance  = Maker artifacts present ÷ the canonical Maker scaffold (maker-scaffold.json,
//     derived from QIG-Maker-Standards: root governance trio + .mvp-framework + the 9 docs categories).
//   - QP compliance      = Quantum-Pack artifacts present ÷ the 8-artifact pack scaffold, measured at the
//     repo's BEST pack root (the candidate root with the most QP artifacts).
// This scanner measures it deterministically (no network at scan time — reads the committed manifest) so
// the "Framework Compliance & Completion" report is reproducible and the scaffolding phase has a precise
// missing-artifact list per repo. Pure functions are unit-tested in scan.test.mjs.
//
// USAGE:
//   node scripts/compliance/scan.mjs <repoDir> [<repoDir> ...]   # scan specific repo dirs
//   node scripts/compliance/scan.mjs --members                   # scan the 14 canonical QOS members
//   node scripts/compliance/scan.mjs --members --json            # machine-readable
//   node scripts/compliance/scan.mjs --members --report out.md   # write a markdown report
//   node scripts/compliance/scan.mjs --members --gate            # MANDATORY GATE: exit 1 if any member <100%
//   node scripts/compliance/scan.mjs --members --tracked --gate  # GATE against the git-TRACKED tree (origin/main)
//   node scripts/compliance/scan.mjs --members --ref <gitref>    # certify a specific ref (implies --tracked)
//
// --tracked / --ref read each member's COMMITTED tree (default origin/main, fetched first unless --no-fetch)
// instead of the working tree — so a member that is pristine on main never false-fails just because its
// checkout sits on a live fleet branch. This is the mode the session protocol (CLAUDE.md Step 10) uses.
//
// Exit code: 0 in measurement mode (the report carries the verdict). With --gate it is FAIL-CLOSED
// (R-30.1): exit 1 unless every scanned member is at 100% (zero Maker AND zero QP artifacts missing).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assessRepo } from './operates.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = process.env.SCAFFOLD_MANIFEST || path.join(__dirname, 'maker-scaffold.json');
// scripts/compliance/ -> repo root. Derived from this module's location, never a hardcoded /opt/ literal
// (LEARNINGS #84 / R-22.1, which the guardrails gate enforces on any committed '/opt/' string).
const REPO_ROOT_DIR = path.dirname(path.dirname(__dirname));
const APPS_ROOT = process.env.APPS_ROOT || '/opt/apps';

// The 15 canonical QOS members (umbrella + 14) — the AUTHORITATIVE set from docs/standards/PROGRAM_SCOPE.md.
// Keys are the on-disk dir names under /opt/apps. (PROGRAM_SCOPE.md names operative as `operative-src`
// and maker as `maker-platform` locally.) This list MUST equal the PROGRAM_SCOPE member table — a missing
// member is a hole in the mandatory compliance gate (R-30.1). `llm-gateway` was previously omitted.
// 2026-07-14 (operator): the LLM Gateway member was migrated `llm-gateway` -> `llm-gateway-multi-tenant`
// (the new repo/checkout under /opt/apps/llm-gateway-multi-tenant carries the governance scaffold on
// origin/main; the old /opt/apps/llm-gateway is a stray non-git stub). The member dir name below tracks
// the live repo so the gate certifies the real tree, not the stub.
// 2026-07-11 (operator): idea-capture / QIG-I-Tasks / librarian / QIG-RIC-CRM / QIG-RIC-Content-Mgmt /
// QIG-I-Roadmap are SEPARATE products, NOT QOS — removed so the mandatory compliance gate no longer scores
// non-QOS repos. Matches operations-portal server/program-scope.mjs QOS_SUBSYSTEMS and PROGRAM_SCOPE.md.
// 2026-07-15 (operator): `ace` (Document Integrity) is a PROGRAM_SCOPE member scaffolded to 100% (ace #120)
// and added so the gate covers it. (quantum-packs is NOT a PROGRAM_SCOPE member and stays out.)
// 2026-07-16 (operator): QIG-I-Ideation (Stage 1) + QIG-I-Outcome-Planner (Stage 2) re-scoped IN as the
// idea-to-outcome pipeline front — both scaffolded to 100% on origin/main (#48, #12) before landing here.
// This reverses the 2026-07-11 de-scoping of QIG-I-Ideation.
// The list is overridable so a SECOND product family (Vantage) can run this gate against its own
// members without forking the engine (B-1168). Unset — which is every QOS run — yields exactly the
// twelve members below, so QOS behaviour is unchanged.
export const QOS_CANONICAL_MEMBERS = [
  'QOS', 'operative-src', 'llm-gateway-multi-tenant', 'lodestar', 'operations-portal', 'visualize',
  'enhance', 'maker-platform', 'ace', 'QIG-I-Ideation', 'QIG-I-Outcome-Planner',
  // 2026-10-17 (QOS Product Family cleanup, Q-01). `nextgen-nexus` REMOVED: it is not in the
  // authority, os/agents/reachable.json -> reachableRepos, which this list is now checked against
  // by scripts/compliance/member-list-parity.mjs. `quantum-packs` ADDED: it IS in the authority and
  // was absent here, so a member of the program went unscanned by the mandatory gate, which is the
  // same hole qos-pulse left in 2026-08-08 and reported as full coverage.
  //
  // Added in the SAME sequence as every member above: made green FIRST, then listed. Two things
  // had to be true before this line could land. B-11615 taught the tracked-tree reader to resolve
  // the ref per clone, because quantum-packs is on `master` and the reader asked every clone for
  // `origin/main`, so the member read as "repo not found on disk". And its docs/user-guide does not
  // exist at all, so it is listed in docs/governance/user-manual-baseline.json: the product is
  // under a standing decommissioning instruction, and authoring a user manual for it is an
  // operator decision rather than a side effect of a membership correction. The baseline is DEBT
  // and may only shrink; the gate still fails on every other artifact.
  'quantum-packs',
  // 2026-08-08: `qos-pulse` sat in PROGRAM_SCOPE.md, projects.json and the feeder's PROGRAM_MEMBERS
  // while missing from THIS list. The gate reported "12 scanned, 12 fully compliant" the whole time,
  // which reads as full coverage and was not. Scaffolded to 100% before being added here, so adding
  // it did not red the family gate.
  'qos-pulse',
  // 2026-08-13: `qos-health-intelligence` and `qos-cost-intelligence` scoped in by the operator. Both
  // measured 1/42 (2.4%) when the directive landed, so both were scaffolded to 100% FIRST (qhi PR #18,
  // qci PR #2) and only then added here, keeping this fail-closed gate green through the change. Same
  // sequence as qos-pulse above, for the same reason.
  'qos-health-intelligence', 'qos-cost-intelligence',
  // 2026-09-04: `tower` scoped in by the operator. It measured 0/42 when the directive landed, so it
  // was scaffolded to 100% and pushed FIRST and only then added here, keeping this fail-closed gate
  // green through the change. Same sequence as qos-pulse and the two intelligence platforms above.
  'tower',
  // 2026-09-05: `parallel` scoped in by the operator. It measured 42/42 ALREADY, but its
  // docs/user-guide/manual.html was the scaffold stub at 1316 characters against the 1500 this
  // gate requires, and the single-repo scan does not check that. The manual was made substantive
  // and pushed FIRST (parallel PR #1) and only then added here, keeping this fail-closed gate green
  // through the change. Same sequence as tower and qos-pulse above, for the same reason.
  'parallel',
];

/// Pure: the member repo ids named by the PROGRAM_SCOPE table, which is the authority.
///
/// The list above stays a literal because this gate must run without reading the umbrella's docs: it
/// scans other repos, sometimes from a worktree or another family entirely. But keeping the two in
/// step by comment ("this list MUST equal the PROGRAM_SCOPE member table") is a prevention that
/// depends on someone remembering, and it has already failed once. The parity test uses this parser,
/// so the next member added to the table is a RED TEST rather than a silently uncounted repo.
export function membersFromProgramScope(markdown) {
  return String(markdown)
    .split('\n')
    // A member row is: | Subsystem | `repo` | Layer |. The backticked cell is the repo id.
    .map((line) => /^\|[^|]+\|\s*`([^`]+)`[^|]*\|/.exec(line))
    .filter(Boolean)
    // The umbrella is written as `QOS` (umbrella); it is a member of its own gate.
    .map((m) => m[1].trim());
}
export const CANONICAL_MEMBERS = (process.env.COMPLIANCE_MEMBERS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
if (CANONICAL_MEMBERS.length === 0) CANONICAL_MEMBERS.push(...QOS_CANONICAL_MEMBERS);

export function loadManifest(manifestPath = MANIFEST_PATH) {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

// --- tracked-tree reader (R-30.1): certify the git-TRACKED merged tree, not the working tree ---
//
// WHY: the gate scans on-disk files. In practice each member repo is checked out on a live fleet branch
// (or is dirty), so a member that is PRISTINE on origin/main reads as non-compliant — a false fail every
// session. (The disk-vs-tracked-tree flaw recorded in the B-961 HANDOFF.) The fix mirrors how
// program-backlog.mjs reads origin/main: scan the committed, merged tree. The pure scoring functions
// already take an injectable `deps`, so a git-backed reader slots in with no change to the scoring logic.

// Default git runner — reads from a repo's object DB. Throws (non-zero exit) when a ref/path is absent;
// the predicates' try/catch turns that into "missing", exactly like a failed statSync.
export function defaultRunGit(repoDir, gitArgs) {
  return execFileSync('git', ['-C', repoDir, ...gitArgs], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024,
  });
}

// Best-effort refresh of the remote-tracking ref before reading it (avoids the stale-remote-tracking trap,
// LEARNINGS #72). Silent on failure — a write-gated/offline repo falls back to whatever the ref resolves
// to locally, which is still the tracked tree, not the dirty working copy.
export function fetchRef(repoDir, ref, runGit = defaultRunGit) {
  const m = String(ref).match(/^([^/]+)\/(.+)$/);
  try {
    if (m) runGit(repoDir, ['fetch', '--quiet', m[1], m[2]]);
    else runGit(repoDir, ['fetch', '--quiet']);
  } catch { /* offline / no remote / write-gated — read whatever resolves locally */ }
}

// Which ref should the tracked-tree reader use in THIS clone? (B-11615)
//
// The reader was given one ref name for every member, `origin/main`. Sixteen of the seventeen authority
// members resolve it. `quantum-packs` has `master` as its default branch, so every `git cat-file` against
// it threw, the repo-root statSync threw with them, and `scanRepo` returned `exists: false`. The family
// gate then printed "repo not found on disk" for a readable clone of 33 entries that scores 42/42 when
// the same scan reads the working tree. A member the reader could not READ was reported in the words
// used for a member that is not THERE, which is the two-state collapse R-14.4 forbids.
//
// Three states, kept apart:
//   { ref, resolved: 'requested' }  the asked-for ref exists here
//   { ref, resolved: 'default' }    it does not, and origin/HEAD names the branch that does
//   { ref: null, reason }           neither resolves, so this clone genuinely cannot be certified
//
// An EXPLICIT --ref or COMPLIANCE_REF is honoured verbatim and never falls back: an explicit ref is a
// request, and quietly reading a different tree than the one asked for would make the gate's verdict
// about an unknown subject. Only the built-in default resolves per repo.
//
// Pure given an injected `runGit`.
export function resolveTrackedRef(repoDir, requestedRef, { explicit = false, runGit = defaultRunGit } = {}) {
  const resolves = (r) => {
    try { runGit(repoDir, ['cat-file', '-t', `${r}^{tree}`]); return true; } catch { return false; }
  };
  if (resolves(requestedRef)) return { ref: requestedRef, resolved: 'requested' };
  if (explicit) {
    return { ref: null, reason: `ref ${requestedRef} does not resolve in this clone (asked for explicitly, not substituted)` };
  }
  let head = null;
  try { head = runGit(repoDir, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).trim(); } catch { head = null; }
  if (head && head !== requestedRef && resolves(head)) return { ref: head, resolved: 'default' };
  return { ref: null, reason: `neither ${requestedRef} nor origin/HEAD resolves in this clone` };
}

// An fs-like reader backed by a git TREE at `ref` for one repo. Implements the subset scanRepo uses
// (statSync / readFileSync / readdirSync) so every pure scorer reads origin/main instead of disk.
// Pure given an injected `runGit` (unit-tested with a simulated tree).
export function gitTreeDeps(repoDir, ref = 'origin/main', runGit = defaultRunGit) {
  const rel = (p) => {
    const r = path.relative(repoDir, p);
    return r === '' ? '' : r.split(path.sep).join('/');
  };
  return {
    statSync(p) {
      const r = rel(p);
      const spec = r === '' ? `${ref}^{tree}` : `${ref}:${r}`;
      const type = runGit(repoDir, ['cat-file', '-t', spec]).trim(); // 'blob' | 'tree'; throws if absent
      return { isFile: () => type === 'blob', isDirectory: () => type === 'tree' };
    },
    readFileSync(p) {
      return runGit(repoDir, ['cat-file', '-p', `${ref}:${rel(p)}`]);
    },
    readdirSync(p) {
      const r = rel(p);
      const out = runGit(repoDir, ['ls-tree', '--name-only', r === '' ? `${ref}:` : `${ref}:${r}`]);
      return out.split('\n').map((s) => s.trim()).filter(Boolean).map((s) => s.split('/').pop());
    },
  };
}

// --- pure existence predicates (injectable fs for tests) ---

export function fileExists(repoDir, rel, deps = fs) {
  try { return deps.statSync(path.join(repoDir, rel)).isFile(); } catch { return false; }
}

export function dirExists(repoDir, rel, deps = fs) {
  try { return deps.statSync(path.join(repoDir, rel)).isDirectory(); } catch { return false; }
}

// ── User Manual (R-25.1) ─────────────────────────────────────────────────────────────────────────
// B-1178. Two things this gets right that the first attempt did not.
//
// (1) It reads through the injected `deps`, never `fs` directly and never a stat SIZE. The first
//     version tested `stat.size > 0`, but in --tracked/--ref mode `deps` is gitTreeDeps, whose
//     statSync returns only { isFile, isDirectory } and no `size`. `undefined > 0` is false, so the
//     check failed EVERY member, including the four that genuinely carry a manual, and --tracked is
//     the merge-blocking CI form (R-30.3). Reading content works identically on disk and in a git tree.
//
// (2) It asserts SUBSTANCE, not mere existence. A gate satisfied by an 11-line placeholder ("This is
//     the user manual for QOS.") certifies nothing, and manufactures exactly the paper-shield this
//     same file fails repos for elsewhere. Thresholds are measured, not guessed, against every real
//     manual in the program plus the placeholder that prompted this:
//       llm-gateway-multi-tenant  text=32639  sections=80
//       maker-platform            text=36543  sections=47
//       QIG-I-Outcome-Planner     text= 8757  sections=18
//       ace                       text= 6560  sections=11
//       the placeholder           text=  110  sections= 0
//     The smallest REAL manual clears both floors by >4x, so they separate substance from stub without
//     dictating section names. That matters: R-25.3's template is Advisory, and `ace` carries a real
//     manual under its own headings ("Introduction", "Quick start", ...). Asserting literal R-25.3
//     titles would fail a genuine document, which is a false failure the gate must not produce.
export const USER_MANUAL_PATH = 'docs/user-guide/manual.html';
export const MANUAL_MIN_TEXT = 1500;
export const MANUAL_MIN_SECTIONS = 4;

/** Pure: visible text length + section count for an HTML manual. */
export function manualShape(html) {
  const body = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const text = body.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const sections = (body.match(/<h[2-4][\s>]/gi) || []).length;
  return { textLength: text.length, sections };
}

/** Assess a repo's user manual through the injected deps (disk OR git tree). Never throws. */
export function assessUserManual(repoDir, deps = fs) {
  if (!fileExists(repoDir, USER_MANUAL_PATH, deps)) {
    return { present: false, substantive: false, reason: 'user manual missing', textLength: 0, sections: 0 };
  }
  let html = '';
  try { html = String(deps.readFileSync(path.join(repoDir, USER_MANUAL_PATH), 'utf8')); }
  catch { return { present: true, substantive: false, reason: 'user manual unreadable', textLength: 0, sections: 0 }; }
  const { textLength, sections } = manualShape(html);
  const short = textLength < MANUAL_MIN_TEXT;
  const thin = sections < MANUAL_MIN_SECTIONS;
  if (short || thin) {
    const bits = [];
    if (short) bits.push(`${textLength} chars of text, want >= ${MANUAL_MIN_TEXT}`);
    if (thin) bits.push(`${sections} section heading(s), want >= ${MANUAL_MIN_SECTIONS}`);
    return { present: true, substantive: false, reason: `user manual is a stub (${bits.join('; ')})`, textLength, sections };
  }
  return { present: true, substantive: true, reason: null, textLength, sections };
}

// The ratchet, same shape as docs/governance/acl-key-baseline.json (B-1129) and guardrails-baseline.json
// (B-970): pre-existing debt is grandfathered so the fail-closed gate does not go red program-wide the
// day it is switched on, and anything NEW still fails. Eight of twelve members have no manual today;
// blocking all of them at once would stop every member's CI until eight documents exist, which is the
// born-broken gate of LEARNINGS #103.
export const USER_MANUAL_BASELINE_PATH = 'docs/governance/user-manual-baseline.json';

export function loadUserManualBaseline(repoRoot = REPO_ROOT_DIR, deps = fs) {
  try {
    const raw = deps.readFileSync(path.join(repoRoot, USER_MANUAL_BASELINE_PATH), 'utf8');
    return new Set(JSON.parse(raw).members || []);
  } catch { return new Set(); }
}

/**
 * Pure. Split manual findings into what blocks and what is grandfathered, and report debt that SHRANK
 * so the baseline can be tightened. Without that last part a baseline quietly becomes permanent, which
 * is the risk of grandfathering at all — copied deliberately from acl-key-baseline's behaviour.
 */
export function partitionManuals(results, baseline) {
  const blocking = [];
  const grandfathered = [];
  for (const r of results) {
    if (!r.userManual || r.userManual.substantive) continue;
    (baseline.has(r.name) ? grandfathered : blocking).push({ name: r.name, reason: r.userManual.reason });
  }
  const failing = new Set(results.filter((r) => r.userManual && !r.userManual.substantive).map((r) => r.name));
  // Only a member that was actually SCANNED can be declared fixed. Absence from `results` means it was
  // not looked at (a subset scan), which is not evidence the debt is gone — reporting it as fixed would
  // invite someone to delete a live baseline entry. Unscanned is UNVERIFIED, never clean (LEARNINGS #111).
  const scanned = new Set(results.map((r) => r.name));
  const fixed = [...baseline].filter((m) => scanned.has(m) && !failing.has(m));
  return { blocking, grandfathered, fixed };
}

// A Maker artifact is present if its path (or any alias) exists as a file.
export function makerArtifactPresent(repoDir, artifact, deps = fs) {
  const candidates = [artifact.path, ...(artifact.aliases || [])];
  return candidates.some((rel) => fileExists(repoDir, rel, deps) || dirExists(repoDir, rel, deps));
}

// Score the Maker scaffold for one repo.
export function scoreMaker(repoDir, manifest, deps = fs) {
  const artifacts = manifest.maker.artifacts;
  const present = [];
  const missing = [];
  for (const a of artifacts) {
    (makerArtifactPresent(repoDir, a, deps) ? present : missing).push(a.path);
  }
  return {
    total: artifacts.length,
    present: present.length,
    missing,
    pct: artifacts.length ? Math.round((present.length / artifacts.length) * 1000) / 10 : 0,
  };
}

function presentAt(base, artifact, deps) {
  return artifact.type === 'dir' ? dirExists(base, artifact.path, deps) : fileExists(base, artifact.path, deps);
}

// Count only the packRoot-located QP artifacts present at a single candidate pack root.
export function scoreQpAtRoot(repoDir, root, manifest, deps = fs) {
  const base = root === '.' ? repoDir : path.join(repoDir, root);
  const packRootArtifacts = manifest.quantumPack.artifacts.filter((a) => (a.loc || 'packRoot') === 'packRoot');
  const present = [];
  const missing = [];
  for (const a of packRootArtifacts) {
    (presentAt(base, a, deps) ? present : missing).push(a.path);
  }
  return { root, present, missing, count: present.length };
}

// Choose the BEST pack root for packRoot artifacts, score shared (.claude) artifacts separately, combine.
export function scoreQp(repoDir, manifest, deps = fs) {
  const candidates = manifest.quantumPack.packRootCandidates;
  let best = null;
  for (const root of candidates) {
    const s = scoreQpAtRoot(repoDir, root, manifest, deps);
    if (!best || s.count > best.count) best = s;
  }
  // Shared (.claude-level) artifacts — skills/, hooks/.
  const sharedRoot = manifest.quantumPack.sharedRoot || '.claude';
  const sharedBase = path.join(repoDir, sharedRoot);
  const sharedArtifacts = manifest.quantumPack.artifacts.filter((a) => a.loc === 'claudeShared');
  const sharedPresent = [];
  const sharedMissing = [];
  for (const a of sharedArtifacts) {
    (presentAt(sharedBase, a, deps) ? sharedPresent : sharedMissing).push(`${sharedRoot}/${a.path}`);
  }
  const total = manifest.quantumPack.artifacts.length;
  const present = best.count + sharedPresent.length;
  const missing = [...best.missing, ...sharedMissing];
  return {
    total,
    bestRoot: best.root,
    present,
    missing,
    pct: total ? Math.round((present / total) * 1000) / 10 : 0,
  };
}

// The canonical BACKLOG template (QIG-Maker-Standards) ships PLACEHOLDER example items. A scaffolded
// backlog that still contains only these is an unpopulated STUB — and because the dashboard reads these
// files for the program metric, a stub feeds it FAKE items (worse than empty). Normalized lowercase.
export const BACKLOG_PLACEHOLDER_TITLES = new Set([
  'set up ci/cd pipeline',
  'add test coverage for critical paths',
  'document architecture and data flow',
  'define product requirements',
  'evaluate and document framework dependencies',
  'set up ci/cd',
].map((s) => s.toLowerCase()));

// Extract backlog item titles from BACKLOG text — heading items (`### B-NNN: Title`) and `| B-NNN | Title |`
// table rows. Title-only; used to tell a real backlog from the unmodified template.
export function backlogItemTitles(md) {
  const titles = [];
  for (const line of String(md || '').split('\n')) {
    const h = line.match(/^#{2,6}\s*[A-Za-z]{1,6}-[0-9][\w.]*\s*[:\-—]\s*(.+)$/);
    if (h) { titles.push(h[1].trim()); continue; }
    const t = line.trim();
    if (t.startsWith('|')) {
      const cells = t.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.length >= 2 && /^[A-Za-z]{1,6}-\d+$/i.test(cells[0]) && cells[1] && !/^-+$/.test(cells[1])) titles.push(cells[1]);
    }
  }
  return titles;
}

// Data-bearing content check (R-30.1, beyond file PRESENCE): the dashboard reads the backlog for the
// program metric, so the backlog must carry at least one REAL item — not only template placeholders, and
// not absent. Reads docs/planning/BACKLOG.md + any docs/planning/build/*.md decomposition.
export function scoreBacklogContent(repoDir, deps = fs) {
  let md = '';
  for (const rel of ['docs/planning/BACKLOG.md', 'BACKLOG.md']) {
    if (fileExists(repoDir, rel, deps)) { try { md += deps.readFileSync(path.join(repoDir, rel), 'utf8') + '\n'; } catch { /* */ } }
  }
  const buildDir = path.join(repoDir, 'docs/planning/build');
  try {
    if (deps.statSync(buildDir).isDirectory()) {
      for (const e of deps.readdirSync(buildDir)) { if (e.endsWith('.md')) { try { md += deps.readFileSync(path.join(buildDir, e), 'utf8') + '\n'; } catch { /* */ } } }
    }
  } catch { /* no decomposition dir */ }
  const titles = backlogItemTitles(md);
  const real = titles.filter((t) => !BACKLOG_PLACEHOLDER_TITLES.has(t.toLowerCase()));
  const present = !!md.trim();
  // ok = has a backlog with at least one real (non-placeholder) item.
  return { present, items: titles.length, realItems: real.length, isStub: present && titles.length > 0 && real.length === 0, ok: present && real.length > 0 };
}

// Full per-repo result.
export function scanRepo(repoDir, manifest, deps = fs) {
  const name = path.basename(repoDir);
  let exists = false;
  try { exists = deps.statSync(repoDir).isDirectory(); } catch { exists = false; }
  if (!exists) {
    return { name, repoDir, exists: false, maker: null, qp: null, backlog: null };
  }
  return {
    name,
    repoDir,
    exists: true,
    maker: scoreMaker(repoDir, manifest, deps),
    qp: scoreQp(repoDir, manifest, deps),
    backlog: scoreBacklogContent(repoDir, deps),
    userManual: assessUserManual(repoDir, deps),
  };
}

// --- report rendering (pure) ---

export function renderReport(results, manifest) {
  const lines = [];
  lines.push('# Framework Compliance & Completion — QOS members');
  lines.push('');
  lines.push(`> Maker scaffold: **${manifest.maker.artifacts.length} artifacts** from \`${manifest.maker.source}@${manifest.maker.source_sha.slice(0, 7)}\` · QP scaffold: **${manifest.quantumPack.artifacts.length} artifacts**.`);
  lines.push(`> ${manifest.maker.note}`);
  lines.push('');
  lines.push('| Repo | Maker | QP (best root) | Maker missing | QP missing |');
  lines.push('|------|------:|------:|--------------:|-----------:|');
  for (const r of results) {
    if (!r.exists) {
      lines.push(`| ${r.name} | — | — | _(${r.unreadable ? `repo could not be read: ${r.unreadable}` : 'repo not found on disk'})_ | — |`);
      continue;
    }
    const qpRoot = r.qp.present > 0 ? ` \`${r.qp.bestRoot}\`` : '';
    lines.push(`| ${r.name} | ${r.maker.present}/${r.maker.total} (${r.maker.pct}%) | ${r.qp.present}/${r.qp.total} (${r.qp.pct}%)${qpRoot} | ${r.maker.missing.length} | ${r.qp.missing.length} |`);
  }
  lines.push('');
  // Per-repo missing detail
  for (const r of results) {
    if (!r.exists) continue;
    if (r.maker.missing.length === 0 && r.qp.missing.length === 0) continue;
    lines.push(`## ${r.name}`);
    if (r.maker.missing.length) {
      lines.push(`- **Maker missing (${r.maker.missing.length}):** ${r.maker.missing.join(', ')}`);
    }
    if (r.qp.missing.length) {
      lines.push(`- **QP missing (${r.qp.missing.length}, best root \`${r.qp.bestRoot}\`):** ${r.qp.missing.join(', ')}`);
    }
    lines.push('');
  }
  // Operation advisory (present only when the operation-check ran) — informational, NOT part of the R-30 %.
  const withOp = results.filter((r) => r.exists && r.operation);
  if (withOp.length) {
    lines.push('## Operation check (is the quality control inert?)');
    lines.push('');
    lines.push('| Repo | Operation | tests | ci-runs-tests |');
    lines.push('|------|-----------|-------|---------------|');
    for (const r of withOp) {
      const o = r.operation;
      const label = { operating: '✅ operating', 'paper-shield': '⚠ paper-shield', 'no-tests': '○ no-tests' }[o.verdict] || o.verdict;
      lines.push(`| ${r.name} | ${label} | ${o.hasTests ? 'yes' : 'no'} | ${o.ciRunsTests ? 'yes' : 'no'} |`);
    }
    lines.push('');
    lines.push('> `paper-shield` = tests exist but no CI runs them — this now FAILS the family gate (WS-6): an inert quality control is not compliant. `no-tests` = nothing to run (operator disposition: invest / sunset / waive) and does not auto-fail. Fix a paper-shield by adding a test-running CI.');
    lines.push('');
  }
  return lines.join('\n');
}

// MAKER SUPERSEDES QP (operator directive 2026-07-19, B-969): Quantum Pack artifacts are still MEASURED
// and reported, but they no longer decide compliance. Maker governs every active QIG repo and the pack
// defers to it, so requiring the deferring pack's artifacts in order to certify a Maker repo was
// backwards. It was also the blocker on removing QP surfaces at all: while QP counted, deleting the
// qp-* skills would have turned the fail-closed R-30.1 gate red in every member repo simultaneously.
export function summarize(results) {
  const found = results.filter((r) => r.exists);
  const fullyCompliant = found.filter((r) => r.maker.missing.length === 0).length;
  const makerArtifactsMissing = found.reduce((n, r) => n + r.maker.missing.length, 0);
  const qpArtifactsMissing = found.reduce((n, r) => n + r.qp.missing.length, 0);
  return { scanned: found.length, fullyCompliant, makerArtifactsMissing, qpArtifactsMissing };
}

// MANDATORY COMPLIANCE GATE (R-30.1). A member PASSES only at 100% — zero missing Maker AND zero missing
// QP artifacts. A member dir that is MISSING ON DISK fails (you cannot certify what you cannot read).
// Pure: returns the verdict + the offenders so the CLI can fail-closed and print an actionable list.
//
// WS-6 operation gate: when the operation verdict is present on a result (populated in --members /
// --operations mode), a `paper-shield` (tests exist but no CI runs them — an INERT quality control)
// FAILS the gate. This is the "presence -> operation" tightening: a complete scaffold whose tests never
// run is no longer counted compliant. Only `paper-shield` fails; `no-tests` is an operator disposition
// (invest / sunset / waive), not an automatic gate failure. Results without r.operation (the single-repo
// pre-push / per-repo CI path, which never computes it) are unaffected — the operation gate bites only in
// the family (--members) gate.
export function gateVerdict(results, baseline = new Set()) {
  const offenders = results.map((r) => {
    // B-11615: "I could not read it" and "it is not there" are different states and must not share a
    // sentence. A clone whose ref would not resolve used to be reported as absent.
    if (!r.exists) return { name: r.name, reason: r.unreadable ? `repo could not be read: ${r.unreadable}` : 'repo not found on disk', missing: null };
    // Maker artifacts only (B-969). QP artifacts are reported but do not gate — see summarize() above.
    const missing = r.maker?.missing.length || 0;
    const reasons = [];
    if (missing > 0) reasons.push(`${missing} Maker artifact(s) missing`);
    // Data-bearing content (R-30.1): a backlog that is absent, empty, or still the unmodified template
    // would feed the program metric fake/zero items — pristine means REAL data, not just file presence.
    if (r.backlog && !r.backlog.ok) reasons.push(r.backlog.isStub ? 'backlog is an unpopulated template stub' : 'backlog absent or has no real items');
    // Operation check (WS-6): a paper-shield's quality control is present but inert — fail it.
    if (r.operation && r.operation.verdict === 'paper-shield') reasons.push('tests present but no CI runs them (paper-shield)');
    // User manual (R-25.1), RATCHETED (B-1178): a member listed in the baseline is grandfathered so
    // switching this on does not red every member at once; anything NEW still fails. Passing an empty
    // baseline (the default) makes this behave as a plain check, which is what the unit tests use.
    if (r.userManual && !r.userManual.substantive && !baseline.has(r.name)) reasons.push(r.userManual.reason);
    return reasons.length ? { name: r.name, reason: reasons.join('; '), missing } : null;
  }).filter(Boolean);
  return { pass: offenders.length === 0, scanned: results.length, offenders };
}

// --- CLI ---

function main(argv) {
  const args = argv.slice(2);
  const manifest = loadManifest();
  const asJson = args.includes('--json');
  const reportIdx = args.indexOf('--report');
  const reportPath = reportIdx >= 0 ? args[reportIdx + 1] : null;

  // Tracked-tree mode (R-30.1): certify the committed merged tree, not the working tree.
  const refIdx = args.indexOf('--ref');
  const ref = refIdx >= 0 ? args[refIdx + 1] : (process.env.COMPLIANCE_REF || 'origin/main');
  const refExplicit = refIdx >= 0 || !!process.env.COMPLIANCE_REF;
  const tracked = args.includes('--tracked') || refIdx >= 0;
  const noFetch = args.includes('--no-fetch');

  let repoDirs;
  if (args.includes('--members')) {
    repoDirs = CANONICAL_MEMBERS.map((m) => path.join(APPS_ROOT, m));
  } else {
    repoDirs = args.filter((a) => !a.startsWith('--') && a !== reportPath && a !== ref);
  }
  if (repoDirs.length === 0) {
    console.error('usage: node scripts/compliance/scan.mjs <repoDir>... | --members [--tracked|--ref <gitref>] [--no-fetch] [--json] [--report out.md] [--gate]');
    process.exit(2);
  }

  const refNotes = [];
  const results = repoDirs.map((d) => {
    const dir = path.resolve(d);
    // Tracked mode reads the committed tree via git; fall back to disk if the dir isn't a git repo.
    if (tracked && fs.existsSync(path.join(dir, '.git'))) {
      if (!noFetch) fetchRef(dir, ref);
      // B-11615: resolve the ref IN THIS CLONE. A member whose default branch is not the requested one
      // used to read as absent; now it is read at its own default and the substitution is announced.
      const picked = resolveTrackedRef(dir, ref, { explicit: refExplicit });
      if (picked.ref === null) {
        refNotes.push(`${path.basename(dir)}: UNREADABLE at ${ref} (${picked.reason})`);
        return { name: path.basename(dir), repoDir: dir, exists: false, unreadable: picked.reason, maker: null, qp: null, backlog: null };
      }
      if (picked.resolved === 'default') refNotes.push(`${path.basename(dir)}: read at ${picked.ref} (its default branch; ${ref} does not exist here)`);
      return { ...scanRepo(dir, manifest, gitTreeDeps(dir, picked.ref)), refRead: picked.ref };
    }
    return scanRepo(dir, manifest);
  });
  for (const n of refNotes) console.error(`scan: ${n}`);
  const summary = summarize(results);

  // Advisory operation-check (paper-shield): ADDITIVE and never part of the R-30 gate — gateVerdict and
  // summarize ignore r.operation entirely, so a paper-shield member cannot fail the presence gate. Runs
  // only for the family report (--members) or when explicitly asked (--operations), keeping the hot
  // single-repo --gate path (pre-push) unchanged. assessRepo is fully guarded (never throws).
  if (args.includes('--members') || args.includes('--operations')) {
    // In --tracked/--ref mode the operation check reads the COMMITTED tree at <ref> (like the scaffold
    // check), not the working copy — else a member whose test-running CI landed on main but not into its
    // local checkout false-fails as a paper-shield now that the check gates (WS-6).
    for (const r of results) if (r.exists) r.operation = assessRepo(r.repoDir, tracked ? { ref } : {});
  }

  if (reportPath) {
    fs.writeFileSync(reportPath, renderReport(results, manifest));
    console.error(`report written: ${reportPath}`);
  }
  if (asJson) {
    console.log(JSON.stringify({ summary, results }, null, 2));
  } else {
    console.log(renderReport(results, manifest));
    console.log(`\nSummary: ${summary.scanned} scanned · ${summary.fullyCompliant} fully compliant · ${summary.makerArtifactsMissing} Maker artifacts missing · ${summary.qpArtifactsMissing} QP artifacts missing.`);
  }

  // MANDATORY GATE (R-30.1): fail-closed when not every member is pristine.
  // --update-baseline grandfathers today's manual debt so the ratchet starts from reality. Mirrors
  // acl-gate.mjs --update-baseline (B-1129); regenerate rather than hand-editing the JSON.
  if (args.includes('--update-baseline')) {
    const failing = results.filter((r) => r.userManual && !r.userManual.substantive);
    const out = {
      _comment: 'Ratchet baseline for the R-25.1 user-manual check (B-1178). Members here have no real '
        + 'manual TODAY and are grandfathered so the fail-closed R-30.1 gate does not red the whole '
        + 'program at once; a member NOT listed here still fails. This is DEBT, not an exemption: write '
        + 'the manual, then re-run to shrink the list. Regenerate: node scripts/compliance/scan.mjs '
        + '--members --update-baseline',
      _generated: new Date().toISOString().slice(0, 10),
      total: failing.length,
      members: failing.map((r) => r.name).sort(),
    };
    fs.mkdirSync(path.join(REPO_ROOT_DIR, path.dirname(USER_MANUAL_BASELINE_PATH)), { recursive: true });
    fs.writeFileSync(path.join(REPO_ROOT_DIR, USER_MANUAL_BASELINE_PATH), `${JSON.stringify(out, null, 2)}\n`);
    console.log(`scan: wrote ${USER_MANUAL_BASELINE_PATH} with ${failing.length} grandfathered member(s).`);
    for (const r of failing) console.log(`      ${r.name} — ${r.userManual.reason}`);
    process.exit(0);
  }

  if (args.includes('--gate')) {
    const manualBaseline = loadUserManualBaseline();
    const manuals = partitionManuals(results, manualBaseline);
    if (manuals.grandfathered.length) {
      console.error(`\nuser manual: ${manuals.grandfathered.length} known gap(s) grandfathered by ${USER_MANUAL_BASELINE_PATH}`
        + ' (pre-existing debt, not blocking; a member NOT baselined still fails).');
    }
    // The nag, copied from acl-key-baseline's behaviour: a baseline that only ever grows is an
    // exemption in disguise. Say so the moment the debt shrinks, with the command that locks the gain.
    if (manuals.fixed.length) {
      console.error(`  ${manuals.fixed.length} baselined member(s) now HAVE a real manual — tighten the baseline:`);
      for (const m of manuals.fixed) console.error(`      ${m}`);
      console.error('      run: node scripts/compliance/scan.mjs --members --update-baseline');
    }
    const verdict = gateVerdict(results, manualBaseline);
    const against = tracked ? ` (git-tracked tree: ${ref})` : ' (working tree)';
    if (verdict.pass) {
      console.error(`\n✓ FRAMEWORK COMPLIANCE GATE: PASS — all ${verdict.scanned} member(s) at 100%${against}.`);
    } else {
      console.error(`\n✗ FRAMEWORK COMPLIANCE GATE: FAILED (R-30.1)${against} — ${verdict.offenders.length}/${verdict.scanned} member(s) non-compliant:`);
      for (const o of verdict.offenders) console.error(`  - ${o.name}: ${o.reason}`);
      console.error(`\nRemediate with the additive scaffolder, then re-run the gate. Compliance is mandatory; this is fail-closed.`);
      process.exit(1);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv);
}
