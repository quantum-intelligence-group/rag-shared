// The Root Cause Protocol's census: generated, never summarised.
//
// THE FAILURE THIS REPLACES IS SPECIFIC. An agent's summary of a pipeline is exactly where the
// single-call-site error lives: the claim that one reader is at fault when four exist. A machine
// produced list removes that failure by construction, and the protocol's refusal fixture F8 is
// precisely this case - a census naming one consumer where the tool found four.
//
// WHY THE AGENT MUST NOT WRITE IT. This is one of the two fields in the diagnosis artifact the
// producer cannot author, and the Independence Protocol names it as the artifact's S5 anchor. An
// artifact of pure self-report can be produced by an agent that did none of the work; one anchored by
// a machine-written field cannot, because the anchor either matches the claims or contradicts them.
//
// WHAT IT IS NOT. It is not a call graph and it does not resolve dynamic dispatch. It answers one
// narrow question mechanically - which files WRITE this symbol and which files READ it - and a narrow
// question answered reliably is worth more here than a broad one answered plausibly.

export const PRODUCER = 'producer', CONSUMER = 'consumer';

/**
 * PURE. Classify each occurrence of `symbol` in one file's text.
 *
 * A PRODUCER assigns, declares, exports or returns the symbol. A CONSUMER reads it. A line that does
 * both counts as both, deliberately: `const x = detectEcosystem(y)` produces `x` and consumes
 * `detectEcosystem`, and collapsing that to one role is how a census starts lying about direction.
 */
export function classifyLine(line, symbol) {
  const t = String(line ?? '');
  if (!t.includes(symbol)) return null;
  // A comment is not a call site. Reading prose as code is how a scanner invents findings.
  if (/^\s*(\/\/|\*|#)/.test(t)) return null;
  const esc = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const produces = new RegExp(
    `(^|[^\\w$])(?:const|let|var|function|class)\\s+${esc}\\b`
    + `|\\bexport\\s+(?:const|let|var|function|class|default)?\\s*${esc}\\b`
    + `|\\b${esc}\\s*[:=][^=]`
    + `|\\breturn\\s+${esc}\\b`,
  ).test(t);
  // A DECLARATION IS NOT A CALL SITE. `export function detectEcosystem(x) {` matched the call pattern
  // `symbol\s*\(` on its own parameter list, so every function was counted as its own first consumer
  // and the reader count came out one too high on every symbol. A census that over-counts readers is
  // as useless as one that under-counts: the whole value is that the number is right.
  const declaresCallable = new RegExp(
    `\\b(?:function|class)\\s+${esc}\\s*\\(`
    + `|\\bexport\\s+(?:default\\s+)?(?:async\\s+)?function\\s+${esc}\\s*\\(`,
  ).test(t);
  const consumes = !declaresCallable && new RegExp(
    `\\b${esc}\\s*\\(`
    + `|\\b${esc}\\s*\\.`
    + `|[([,]\\s*${esc}\\b`
    + `|\\b(?:from|import)\\b[^\\n]*\\b${esc}\\b`,
  ).test(t);
  if (produces && consumes) return [PRODUCER, CONSUMER];
  if (produces) return [PRODUCER];
  if (consumes) return [CONSUMER];
  // Present but unclassifiable. Reported as a consumer rather than dropped: a site the tool could not
  // classify is still a site, and silently discarding it is how a census under-counts readers - which
  // is the exact error the census exists to prevent.
  return [CONSUMER];
}

/**
 * PURE. Build the census from a { file -> text } map.
 * THREE STATES: `files === null` means the tree could not be read, which is not a tree with no hits.
 */
export function census(files, symbol) {
  if (files == null) {
    return { measured: false, why: 'the source tree could not be read; an unread tree is not a tree with no call sites' };
  }
  if (!symbol || !String(symbol).trim()) {
    return { measured: false, why: 'no symbol given; a census of nothing is not an empty census' };
  }
  const producers = [], consumers = [], raw = [];
  for (const [file, text] of Object.entries(files)) {
    const lines = String(text ?? '').split('\n');
    lines.forEach((line, i) => {
      const roles = classifyLine(line, symbol);
      if (!roles) return;
      const site = `${file}:${i + 1}`;
      if (roles.includes(PRODUCER)) producers.push(site);
      if (roles.includes(CONSUMER)) consumers.push(site);
      raw.push(`${site}: ${line.trim().slice(0, 160)}`);
    });
  }
  return { measured: true, symbol, producers: producers.sort(), consumers: consumers.sort(),
    raw_output: raw.join('\n') };
}

/**
 * The check the protocol's F8 fixture describes: does the artifact's census list FEWER entries than
 * the tool's own raw output contains? That is the single-call-site error, caught mechanically.
 */
export function understated(artifactCensus, toolCensus) {
  if (artifactCensus == null || toolCensus == null || !toolCensus.measured) {
    return { measured: false, why: 'one side of the comparison is missing; nothing is claimed' };
  }
  const listed = new Set([...(artifactCensus.consumers || []), ...(artifactCensus.producers || [])]);
  const found = [...toolCensus.consumers, ...toolCensus.producers];
  const missing = found.filter((s) => !listed.has(s));
  return { measured: true, missing,
    understated: missing.length > 0,
    why: missing.length
      ? `the artifact lists ${listed.size} site(s) where the tool found ${new Set(found).size}. `
        + `Missing: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}. `
        + 'Naming one reader when four exist is the error this census exists to prevent.'
      : null };
}

// ---------------------------------------------------------------------------------------------
// CLI: census.mjs --symbol <name> [--dir scripts] [--json]
//
// Writes the producer/consumer sets and the verbatim raw output. The agent supplies the SYMBOL and
// nothing else: the protocol is explicit that this field is produced by the harness, not summarised
// by the thing being judged.
// Exit 0 measured · 2 could not run. It never exits 1, because a census makes no judgement - it
// reports what is there, and the judging happens in the gate that reads it.
// ---------------------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const REPO = process.env.QOS_REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
  const symbol = arg('--symbol', null);
  if (!symbol) {
    console.error('census: usage: census.mjs --symbol <name> [--dir scripts]');
    process.exit(2);
  }
  const root = arg('--dir', 'scripts');

  const files = {};
  const stack = [root];
  let readFailures = 0;
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try { entries = fs.readdirSync(path.join(REPO, d), { withFileTypes: true }); } catch { readFailures++; continue; }
    for (const e of entries) {
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) { if (!/node_modules|^\.git$/.test(e.name)) stack.push(rel); continue; }
      if (!/\.(mjs|js|ts|tsx|cjs)$/.test(e.name)) continue;
      try { files[rel] = fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch { readFailures++; }
    }
  }
  if (Object.keys(files).length === 0) {
    console.error(`census: no source files read under ${root}; an unread tree is not a tree with no call sites`);
    process.exit(2);
  }

  const r = census(files, symbol);
  if (!r.measured) { console.error(`census: ${r.why}`); process.exit(2); }

  const out = {
    generated_by: `scripts/diagnosis/census.mjs --symbol ${symbol} --dir ${root}`,
    generated_at: new Date().toISOString(),
    symbol,
    producers: r.producers,
    consumers: r.consumers,
    files_read: Object.keys(files).length,
    // Reported, not swallowed. A census over a tree it could only partly read is a weaker census, and
    // the artifact should say so rather than present the count as complete.
    read_failures: readFailures,
    raw_output: r.raw_output,
  };
  if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}
