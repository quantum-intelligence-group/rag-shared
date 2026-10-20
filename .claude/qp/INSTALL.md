# Installing Quantum Pack in nexusmig-rag-shared

This pack is already vendored under `.claude/qp` with its skills/hooks at the shared `.claude/` roots.
To make enforcement active (optional — the pack is advisory until wired):

1. **Point CLAUDE.md at the pack** — add a load-on-demand pointer:
   `> Quantum Pack active — see .claude/qp/RULES.md (load on demand).`
2. **Wire the hooks** in `.claude/settings.json` (SessionStart / pre-commit gates) — see the shared
   `.claude/hooks/qp-*.sh` scripts.
3. **License** (enterprise): install a signed key via the `qp-license` skill if enforcement should block.

Enforcement levels: `off` (silent) · `warn` (default — advisory) · `block` (incubation/strict).
No code changes are required to adopt the pack at the `warn` level; it is safe and additive.
