---
title: "COMPLIANCE MATRIX"
project: rag-shared
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03T20:16:46Z
product_id: rag-shared
project_id: rag-shared
file_kind: ComplianceMatrix
author: 
---

# Compliance Matrix — rag-shared
## Governance Rule Compliance

| Rule | Description | Status | Evidence |
|------|-------------|--------|----------|
| R-1.1 | No invented APIs | Enforced | Code review, guardrails |
| R-1.2 | No fabricated paths | Enforced | Code review, guardrails |
| R-2.1 | No behavior change in refactor | Enforced | Test suite, code review |
| R-3.1 | Read before write | Enforced | Guardrails engine |
| R-8.1 | No hardcoded secrets | Enforced | Pre-commit hook, code review |
| R-8.2 | No logged secrets | Enforced | Code review |
| R-8.3 | No committed secrets | Enforced | Pre-commit hook, .gitignore |
| R-8.4 | Sanitize user input | Enforced | Code review |
| R-10.2 | No push without instruction | Enforced | Guardrails engine |
| R-11.1 | Read governance files first | Enforced | Session protocol |
| R-11.3 | No self-approval | Enforced | Code review policy |

## Regulatory Compliance

TBD: Document applicable regulations (GDPR, SOC 2, HIPAA, PCI-DSS, etc.).

## Audit Schedule

| Audit Type | Frequency | Last Completed | Next Due |
|------------|-----------|----------------|----------|
| Dependency audit | Monthly | TBD | TBD |
| Security review | Quarterly | TBD | TBD |
| Compliance review | Annually | TBD | TBD |

## Evidence Collection

- Governance compliance verified by `mvp-governance` engine
- All changes tracked in version control
- Session lifecycle enforced by pre-commit hooks
