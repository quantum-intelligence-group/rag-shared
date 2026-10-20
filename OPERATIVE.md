---
title: "OPERATIVE"
project: rag-shared
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03T20:16:46Z
product_id: rag-shared
project_id: rag-shared
file_kind: OperativeSpec
author: 
---

# Operative Specification — rag-shared
spec_version: 1.0.0

## Enforcement

| Field | Value |
|-------|-------|
| Mode | required |
| Ecosystem | production |
| Exempt Reason | — |

## Identity

| Field | Value |
|-------|-------|
| Owner Org | qig |
| Project ID | project |
| RTID | _(provisioned at deploy time)_ |

## Sidecar

| Field | Value |
|-------|-------|
| Image | operative-sidecar:v0.10.0 |
| mTLS Port | 3045 |
| Health Port | 3046 |
| Enforce | true |

## Certificate

| Field | Value |
|-------|-------|
| Algorithm | ECDSA P-256 |
| Validity | 90 days |
| CA Mode | self-signed (dev) / cert-manager (prod) |
| CN Format | rtid:v1:<uuid> |

## K8s Labels

```yaml
operative.qig.ai/enforce: required
operative.qig.ai/managed: "true"
```

## Namespace

| Field | Value |
|-------|-------|
| NetworkPolicy | Allow egress to Operative ports 3041, 8181, 3043, DNS 53 |
| Managed Label | operative.qig.ai/managed=true |

## Notes

Customize this file for project-specific Operative requirements. The `spec_version`
field is checked against the platform's current spec version at deploy time. If
outdated, a warning will be emitted — run `maker operative refresh` to update.

The enforcement mode in this file is for documentation only. The authoritative
enforcement mode is read from `.mvp-framework.toml` `[operative]` section or the
`OPERATIVE_ENFORCEMENT` environment variable.
