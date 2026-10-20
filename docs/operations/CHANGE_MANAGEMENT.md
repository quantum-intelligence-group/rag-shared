---
title: "CHANGE MANAGEMENT"
project: nexusmig-rag-shared
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03T20:16:46Z
product_id: nexusmig-rag-shared
project_id: nexusmig-rag-shared
file_kind: ChangeManagement
author: 
---

# Change Management — nexusmig-rag-shared
## Change Classification

| Class | Description | Approval | Lead Time |
|-------|-------------|----------|-----------|
| Standard | Routine, pre-approved changes | Auto-approved | None |
| Normal | Changes requiring review | Peer review | 1 day |
| Emergency | Critical fixes for production issues | Post-hoc review | None (expedited) |

## Change Request Process

1. Document the change in a PR or ticket
2. Classify the change (standard / normal / emergency)
3. Obtain required approvals
4. Schedule implementation window
5. Implement and verify
6. Close change request with outcome

## Review Requirements

- All code changes require at least one peer review
- Infrastructure changes require ops team review
- Schema changes require data team review
- Security-sensitive changes require security review

## Communication

- Normal changes: announce in team channel before implementation
- Emergency changes: notify stakeholders immediately, document post-hoc
- Breaking changes: announce 1 sprint before implementation

## Audit Trail

- All changes tracked in version control (git)
- Decisions documented in `docs/state/DECISIONS.md`
- Changes logged in `docs/state/CHANGELOG.md`
