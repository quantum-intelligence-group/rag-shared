---
title: "ESCALATION POLICY"
project: nexusmig-rag-shared
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03T20:16:46Z
product_id: nexusmig-rag-shared
project_id: nexusmig-rag-shared
file_kind: EscalationPolicy
author: 
---

# Escalation Policy — nexusmig-rag-shared
## Escalation Triggers

| Trigger | Action |
|---------|--------|
| Blocked for > 4 hours | Escalate to tech lead |
| Blocked for > 1 day | Escalate to engineering manager |
| Security incident | Escalate immediately to security lead |
| Data breach | Escalate immediately to CTO + legal |
| Production outage (SEV-1) | Page on-call, escalate per incident response |

## Escalation Levels

| Level | Role | Response Time |
|-------|------|---------------|
| L1 | Team lead / Senior engineer | 30 minutes |
| L2 | Engineering manager | 1 hour |
| L3 | CTO / VP Engineering | 2 hours |

## Technical Escalation

1. Document what you've tried and what failed
2. Provide reproduction steps or error logs
3. Tag the appropriate escalation contact
4. Update the issue/ticket with escalation status

## Decision Escalation

When a technical decision has broader impact:

1. Document options with trade-offs in DECISIONS.md
2. If no consensus after 1 day, escalate to tech lead
3. If architectural impact, escalate to architecture review
4. Document final decision and rationale
