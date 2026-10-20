---
name: qp-license
description: Add or check a Quantum Pack license key — validates a signed key and installs it (user-level for enterprise, repo-level for project scope). Portable across repos.
model: haiku
---

## Instructions

Manage the QP contract license key (D24). A key is a single string beginning `QPLIC1.`.

**Add a key** — `/qp-license <KEY>`:
1. Write the key to a temp file and **validate** it:
   `.claude/hooks/qp-verify-key.sh <tmpfile> "$PWD"`. If it reports invalid / expired /
   out-of-scope, tell the user why and **stop — do not install**.
2. On valid, install by the key's scope:
   - **enterprise** → user-level `~/.config/qp/license` (covers every repo on this machine — the
     portable case).
   - **repo / org scope** → repo-level `.claude/qp/license` (travels with the repo on clone;
     repo-level overrides user-level).
   Create parent dirs as needed; write the key string verbatim (no surrounding whitespace).
3. Report: licensee, scope, expiry, and where it was installed. The next session activates QP.

**Check status** — `/qp-license` with no argument: read the active key (repo-level, then
user-level), validate it, and report scope + expiry — or "no license key; running on the pre-GA
default." 

Token-frugal (QP-R8): never echo the full key back or dump files. Verification uses only the
shipped **public** trust anchor (`.claude/qp/keys/qp-allowed-signers`); the private signing key is
never involved here.
