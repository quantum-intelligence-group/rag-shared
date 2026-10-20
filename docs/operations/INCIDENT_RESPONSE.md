---
title: "INCIDENT RESPONSE"
project: rag-shared
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03T20:16:46Z
product_id: rag-shared
project_id: rag-shared
file_kind: IncidentResponse
author: 
---

# Incident Response — rag-shared
## Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| SEV-1 | Service down, data loss | 15 minutes | Production outage |
| SEV-2 | Major feature broken | 1 hour | Auth system failing |
| SEV-3 | Minor feature degraded | 4 hours | Slow page loads |
| SEV-4 | Cosmetic or minor issue | Next business day | UI alignment bug |

## Incident Lifecycle

1. **Detect** — Monitoring alert or user report
2. **Triage** — Classify severity, assign incident commander
3. **Respond** — Mitigate impact, communicate status
4. **Resolve** — Fix root cause or apply workaround
5. **Review** — Post-incident review within 48 hours

## Roles

| Role | Responsibility |
|------|---------------|
| Incident Commander | Coordinates response, makes decisions |
| Technical Lead | Investigates and implements fix |
| Communications | Updates stakeholders |

## Communication Templates

### Status Update
> **[SEV-X] Incident: [Title]**
> **Status:** Investigating / Identified / Monitoring / Resolved
> **Impact:** [Description of user impact]
> **Next update:** [Time]

## Post-Incident Review

- What happened and timeline
- Root cause analysis
- What went well
- What could be improved
- Action items with owners and deadlines
