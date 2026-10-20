// scripts/lib/cli-mode.mjs — visual signal for R-31 (deterministic-by-default).
//
// WHY: the framework's core rule (R-31) is "deterministic work never goes to an LLM; the model is the
// exception, not the engine." But on the CLI there is no way to SEE which kind of work just ran — a pure
// code path (a gate, a parse, a fixed procedure) looks the same as a paid model/API call. This makes the
// distinction visible: every deterministic step can announce itself in GREEN, every model/API call in
// MAGENTA. Reading the scrollback, you can tell at a glance how much was free/deterministic vs billed.
//
// Two kinds only (matches the operator ask): DET (deterministic) and API (model/API call).
//
// Output goes to STDERR by design, so a tool's real stdout (which a caller may pipe/parse — e.g.
// git-brief's summary) stays uncontaminated by the badge.
//
// Color is honored when appropriate and suppressed when not: NO_COLOR disables (https://no-color.org),
// FORCE_COLOR / CLI_MODE_COLOR=1 force on, otherwise it follows whether the stream is a TTY.

// ---- ANSI ----
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
};

// kind → presentation. Keep additive: add a kind here and it works everywhere.
export const KINDS = {
  det: { color: ANSI.green, label: 'DET', glyph: '●', word: 'deterministic' },
  api: { color: ANSI.magenta, label: 'API', glyph: '●', word: 'model/API call' },
};

// ---- pure cores (unit-tested) ----

// Decide whether to emit color. Pure: takes the env + a tty flag, returns a boolean.
//   NO_COLOR set (any value)        → false   (standard, overrides everything)
//   FORCE_COLOR / CLI_MODE_COLOR=1  → true
//   otherwise                       → isTTY
export function shouldColor(env = {}, isTTY = false) {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false; // present + non-empty disables (no-color.org)
  if (env.FORCE_COLOR === '1' || env.CLI_MODE_COLOR === '1') return true;
  return Boolean(isTTY);
}

// Build the badge prefix for a kind, e.g. "● DET". Pure.
export function badge(kind, { color = false } = {}) {
  const k = KINDS[kind];
  if (!k) throw new Error(`cli-mode: unknown kind "${kind}" (expected one of ${Object.keys(KINDS).join(', ')})`);
  const text = `${k.glyph} ${k.label}`;
  return color ? `${ANSI.bold}${k.color}${text}${ANSI.reset}` : text;
}

// Format a full line: "<badge> message". Pure — returns the string, prints nothing.
export function format(kind, msg = '', { color = false } = {}) {
  const b = badge(kind, { color });
  return msg ? `${b} ${msg}` : b;
}

// A one-line legend explaining the color code. Pure.
export function legend({ color = false } = {}) {
  return [
    'CLI mode legend:',
    `  ${badge('det', { color })}  ${KINDS.det.word} — pure code, no model, $0 (R-31)`,
    `  ${badge('api', { color })}  ${KINDS.api.word} — a model/API call was made (billed)`,
  ].join('\n');
}

// ---- side-effecting helpers (the ones tools actually call) ----

function emit(kind, msg) {
  const color = shouldColor(process.env, process.stderr.isTTY);
  process.stderr.write(format(kind, msg, { color }) + '\n');
}

// Announce a deterministic step (green). Call at the top of a deterministic op/gate.
export function det(msg) {
  emit('det', msg);
}

// Announce a model/API call (magenta). Call immediately before a gateway/model request.
export function api(msg) {
  emit('api', msg);
}

// Print the legend to stderr.
export function printLegend() {
  const color = shouldColor(process.env, process.stderr.isTTY);
  process.stderr.write(legend({ color }) + '\n');
}

// Run directly → show a self-demo of both colors + the legend.
if (import.meta.url === `file://${process.argv[1]}`) {
  printLegend();
  det('example: ran git-brief — summarized status/diff with no model');
  api('example: gateway call qwen3-coder-next:latest — generating a test file');
}
