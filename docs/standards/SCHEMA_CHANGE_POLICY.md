---
title: "SCHEMA CHANGE POLICY"
project: nexusmig-rag-shared
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03T20:16:46Z
product_id: nexusmig-rag-shared
project_id: nexusmig-rag-shared
file_kind: SchemaChangePolicy
author: 
---

# Schema Change Policy — nexusmig-rag-shared
## Principles

- All schema changes must be backward-compatible or have a migration path
- Schema changes require review by at least one other team member
- Never drop columns or tables in production without a deprecation period

## Migration Process

1. Write migration script (forward and rollback)
2. Test migration on a copy of production data
3. Review migration with team
4. Apply to staging, validate
5. Apply to production during maintenance window (if destructive)

## Naming Conventions

- Tables: `snake_case`, plural (e.g., `user_accounts`)
- Columns: `snake_case` (e.g., `created_at`, `is_active`)
- Indexes: `idx_<table>_<column>` (e.g., `idx_users_email`)
- Migrations: sequential numbering with description (e.g., `003_add_user_roles.sql`)

## Backward Compatibility

| Change Type | Compatible? | Process |
|-------------|-------------|---------|
| Add column (nullable) | Yes | Standard migration |
| Add column (NOT NULL) | No | Add nullable, backfill, then add constraint |
| Drop column | No | Deprecate, stop reading, then drop |
| Rename column | No | Add new, migrate data, drop old |
| Add table | Yes | Standard migration |
| Drop table | No | Remove all references first, then drop |

## Rollback

- Every migration must have a corresponding rollback script
- Test rollback before applying migration to production
- Keep rollback scripts for at least 3 releases
