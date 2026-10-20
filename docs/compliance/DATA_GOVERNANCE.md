---
title: "DATA GOVERNANCE"
project: rag-shared
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03T20:16:46Z
product_id: rag-shared
project_id: rag-shared
file_kind: DataGovernance
author: 
---

# Data Governance — rag-shared
## Data Classification

| Level | Description | Handling |
|-------|-------------|---------|
| Public | No restrictions | Standard storage |
| Internal | Business-sensitive | Access controls |
| Confidential | PII, credentials, financial | Encrypted at rest and in transit |
| Restricted | Regulated data (HIPAA, PCI) | Full audit trail, strict access |

## Data Lifecycle

1. **Collection** — Collect only what is needed, with user consent where required
2. **Storage** — Encrypt confidential and restricted data at rest
3. **Processing** — Minimize exposure, use least-privilege access
4. **Retention** — Define retention periods per data category
5. **Deletion** — Securely delete when retention period expires

## PII Handling

- Never log PII (Rule R-8.2)
- Encrypt PII at rest (use mvp-crypto or equivalent)
- Mask PII in non-production environments
- Document all PII fields and their purposes

## Access Control

- Least-privilege access to all data stores
- Service accounts for automated access
- Audit log for data access events

## Retention Policy

| Data Type | Retention | Deletion Method |
|-----------|-----------|-----------------|
| User data | TBD | Secure wipe |
| Logs | TBD | Auto-expire |
| Backups | TBD | Rotate and destroy |
| Analytics | TBD | Anonymize after retention |
