---
title: "RELEASE PROCESS"
project: rag-shared
classification: high
created: 2026-06-03T20:16:46Z
updated: 2026-06-03T20:16:46Z
product_id: rag-shared
project_id: rag-shared
file_kind: ReleaseProcess
author: 
---

# Release Process — rag-shared
## Versioning

Follow Semantic Versioning (SemVer): MAJOR.MINOR.PATCH.

## Pre-Release Checklist

- [ ] All tests pass
- [ ] No known critical bugs
- [ ] CHANGELOG updated
- [ ] Version numbers bumped
- [ ] Documentation current

## Release Steps

1. Create release branch from main
2. Run full test suite
3. Update version numbers
4. Update CHANGELOG
5. Create tag
6. Build release artifacts
7. Publish

## Hotfix Process

1. Branch from release tag
2. Fix the issue
3. Create PATCH release
4. Cherry-pick fix to main
