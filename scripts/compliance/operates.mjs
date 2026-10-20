#!/usr/bin/env node
// QOS operation-check — the "paper-shield" detector (DETERMINISTIC, R-31: no LLM).
//
// WHY THIS EXISTS: scan.mjs certifies that governance/quality scaffolding is PRESENT (files exist).
// The red/blue analysis named the gap: presence ≠ operation — a repo can carry the scaffold and a green
// compliance verdict while its tests never run (enhance: 58 tests, no CI) or don't exist (the shells).
// That's the "paper shield" (QOS-STD-0207 §4 / QOS-STD-0204). This module verifies the quality control
// is NOT inert, additively — it does NOT modify scan.mjs. Wiring it into scan/CI is a follow-up.
//
// Verdicts: OPERATING (tests exist AND a CI workflow runs them) · PAPER-SHIELD (tests exist but no CI
// runs them) · NO-TESTS (nothing to run). `--gate` exits 1 on PAPER-SHIELD (fail-loud).
//
// Run: node scripts/compliance/operates.mjs <repoPath> [--gate]

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { det } from '../lib/cli-mode.mjs';

const SKIP_DIRS = new Set(['node_modules', '.git', 'target', 'dist', 'build', '.next', 'coverage', '.turbo', 'vendor']);
// recognized test runners in a CI workflow (the control that makes tests actually run)
const RUNNER_RE = /\b(vitest|jest|node\s+--test|mocha|cargo\s+test|go\s+test|pytest|python\s+-m\s+pytest|pnpm\s+(-\S+\s+)*test|npm\s+(run\s+)?test|yarn\s+test)\b/i;

// Pure: does a file path look like a test by naming convention (JS/TS/Go/Python)?
export function isTestPath(p) {
  const base = p.replace(/\\/g, '/');
  if (/\.(test|spec)\.(mjs|cjs|js|jsx|ts|tsx)$/.test(base)) return true;
  if (/(^|\/)__tests__\//.test(base)) return true;
  if (/_test\.go$/.test(base)) return true;
  if (/(^|\/)(test_[^/]+|[^/]+_test)\.py$/.test(base)) return true;
  return false;
}

// Pure: given a list of repo-relative file paths, is there a naming-convention test file?
export function detectTestsFromPaths(paths) {
  return paths.some(isTestPath);
}

// Pure: Rust needs content (there is no test-filename convention) — does any .rs text carry a test attr?
export function detectRustTests(rsTexts) {
  return rsTexts.some((t) => /#\[\s*(?:tokio::test|test)\s*\]|#\[\s*cfg\s*\(\s*test\s*\)\s*\]/.test(t));
}

// Pure: does any CI workflow text invoke a recognized test runner?
export function detectRunnerInCI(workflowTexts) {
  for (const t of workflowTexts) {
    const m = t.match(RUNNER_RE);
    if (m) return { found: true, runner: m[0].trim() };
  }
  return { found: false, runner: null };
}

// Pure: the verdict from the two booleans.
export function assess({ hasTests, ciRunsTests }) {
  if (!hasTests) return 'no-tests';
  return ciRunsTests ? 'operating' : 'paper-shield';
}

// ── Impure gatherers (kept out of the pure core so the core is unit-tested without disk) ────────────
function walk(root, { maxEntries = 20000 } = {}) {
  const files = [];
  const stack = [''];
  while (stack.length && files.length < maxEntries) {
    const rel = stack.pop();
    let entries;
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) stack.push(path.join(rel, e.name)); }
      else files.push(path.join(rel, e.name));
    }
  }
  return files;
}

function gather(repoPath) {
  const files = walk(repoPath);
  // B-1345 (v2 item 16+, fail-open site operates.mjs:84). AN UNREADABLE SOURCE FILE IS NOT A FILE WITH
  // NO TESTS IN IT. Both reads below fell back to '', so detectRustTests saw nothing, assess returned
  // `no-tests`, and `no-tests` is a disposition the family gate deliberately does not fail. A repo
  // whose sources could not be opened therefore scored the same as one that genuinely has no tests.
  //
  // The verdict is unchanged, because a non-failing disposition is the right default here. What
  // changes is that the count is carried out, so "no tests" and "we could not look" stop rendering as
  // the same reading.
  let unreadable = 0;
  const readOrEmpty = (f) => {
    try { return fs.readFileSync(path.join(repoPath, f), 'utf8'); }
    catch { unreadable += 1; return ''; }
  };
  const workflowTexts = files
    .filter((f) => /\.github\/workflows\/.+\.ya?ml$/.test(f.replace(/\\/g, '/')))
    .map(readOrEmpty);
  let rustHasTest = false;
  if (!detectTestsFromPaths(files)) {
    const rs = files.filter((f) => f.endsWith('.rs')).slice(0, 300);
    rustHasTest = detectRustTests(rs.map(readOrEmpty));
  }
  const hasTests = detectTestsFromPaths(files) || rustHasTest;
  const { found: ciRunsTests, runner } = detectRunnerInCI(workflowTexts);
  return { hasTests, ciRunsTests, runner, workflowCount: workflowTexts.length, unreadable };
}

// ── git-tree gatherer: read the COMMITTED tree at <ref>, not the working copy ────────────────────────
//
// WHY: the operation check is now a GATE (WS-6). The scaffold gate already certifies the git-tracked tree
// (origin/main) via scan.mjs --tracked, because members are routinely checked out on live fleet branches
// or sit behind origin/main — a working-tree read false-fails a member that is pristine on main. The
// operation check MUST read the same committed tree, or a member whose test-running CI has landed on main
// but not into its local checkout (e.g. enhance after its ci.yml PR merges) reads as a false paper-shield
// and, now that the check gates, fails the family gate spuriously. Mirrors scan.mjs's gitTreeDeps pattern.

// Default git runner — reads a repo's object DB (throws on a missing ref/path; callers treat that as empty).
export function defaultRunGit(repoDir, gitArgs) {
  return execFileSync('git', ['-C', repoDir, ...gitArgs], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024,
  });
}

// Same shape as gather(), but sourced from `git ls-tree`/`git cat-file` at <ref>. Pure given `runGit`
// (unit-tested with a simulated tree). A ref/repo that can't be read yields the all-empty verdict.
export function gatherFromGit(repoDir, ref = 'origin/main', runGit = defaultRunGit) {
  let files;
  try {
    files = runGit(repoDir, ['ls-tree', '-r', '--name-only', ref])
      .split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return { hasTests: false, ciRunsTests: false, runner: null, workflowCount: 0 };
  }
  const readAt = (f) => { try { return runGit(repoDir, ['cat-file', '-p', `${ref}:${f}`]); } catch { return ''; } };
  const workflowTexts = files
    .filter((f) => /\.github\/workflows\/.+\.ya?ml$/.test(f.replace(/\\/g, '/')))
    .map(readAt);
  let rustHasTest = false;
  if (!detectTestsFromPaths(files)) {
    rustHasTest = detectRustTests(files.filter((f) => f.endsWith('.rs')).slice(0, 300).map(readAt));
  }
  const hasTests = detectTestsFromPaths(files) || rustHasTest;
  const { found: ciRunsTests, runner } = detectRunnerInCI(workflowTexts);
  return { hasTests, ciRunsTests, runner, workflowCount: workflowTexts.length };
}

// Convenience wrapper: assess a repo directly, FULLY GUARDED (never throws) — for callers like scan.mjs.
// opts.ref (e.g. 'origin/main') reads the COMMITTED tree via git instead of the working copy; opts.runGit
// injects a git runner for tests. Returns { verdict, hasTests, ciRunsTests } or null if unreadable.
export function assessRepo(repoPath, opts = {}) {
  try {
    if (opts.ref) {
      const g = gatherFromGit(repoPath, opts.ref, opts.runGit);
      return { verdict: assess(g), hasTests: g.hasTests, ciRunsTests: g.ciRunsTests };
    }
    if (!fs.existsSync(repoPath)) return null;
    const g = gather(repoPath);
    return { verdict: assess(g), hasTests: g.hasTests, ciRunsTests: g.ciRunsTests };
  } catch {
    return null;
  }
}

export function main(argv) {
  const gate = argv.includes('--gate');
  const repoPath = argv.find((a, i) => i >= 2 && !a.startsWith('--')) || '.';
  det(`operates — deterministic paper-shield check on ${repoPath} (no model)`);
  const g = gather(repoPath);
  const verdict = assess(g);
  const label = { operating: '✅ OPERATING', 'paper-shield': '⚠ PAPER-SHIELD', 'no-tests': '○ NO-TESTS' }[verdict];
  console.log(`${label} — tests:${g.hasTests ? 'yes' : 'no'} · ci-runs-tests:${g.ciRunsTests ? `yes (${g.runner})` : 'no'} · workflows:${g.workflowCount}`);
  if (verdict === 'paper-shield') console.log('  tests exist but no CI runs them — the quality control is present but inert.');
  if (verdict === 'no-tests') console.log('  no tests to run — scaffold/CI would certify nothing (operator: invest / sunset / waive).');
  if (gate && verdict === 'paper-shield') { console.error('OPERATION GATE FAILED — paper-shield.'); return 1; }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv));
