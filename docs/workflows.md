# Workflows

## Goal

Keep `refresh` and `release` as separate workflows, with one release input and the monorepo acting only as orchestrator.

## Target Model

```mermaid
flowchart TD
  A[VERSION=X.Y.Z<br/>single release input] --> B[orchestrator scripts]
  B --> C[root metadata]
  B --> D[registry version]
  B --> E[plugin compatibility]
  B --> F[changelog checks]
  B --> G[tags]
```

The monorepo does not own release metadata.
It only propagates one explicit release input.

## Workflow Split

```mermaid
flowchart LR
  A[refresh] --> B[regenerate registry data]
  B --> C[verify]
  C --> D[commit data changes]
  D --> E[push]

  F[release] --> G[VERSION=X.Y.Z]
  G --> H[verify clean state]
  H --> I[update derived version fields]
  I --> J[commit and tag]
  J --> K[push]
```

`refresh` is data-only.
`release` is version/tag-only.

## Refresh

Use refresh when:

- upstream repos changed
- stars changed
- detection improved
- bundled plugin fallback needs a new snapshot

Refresh should:

1. run pipeline
2. run verify
3. commit changed artifacts
4. update root submodule pointers
5. push

Refresh should not:

- bump versions
- edit changelogs
- create tags

## Release

Use release when:

- plugin behavior changes
- registry schema/output contract changes
- compatibility changes
- you intentionally want a tagged stable version

Release should:

1. choose `VERSION=X.Y.Z`
2. verify changelog entries
3. derive all version fields from that one input
4. commit downstream repos
5. update root submodule pointers
6. tag and push

## Suggested Release Input

```bash
make version VERSION=0.4.3
```

From that single input, derive:

- root version
- registry version
- plugin compatibility series
- release tags

## Why This Is Cleaner

```mermaid
flowchart TD
  A[weekly data drift] --> B[refresh]
  C[code or contract change] --> D[release]
```

This prevents:

- noisy release bumps for star-count changes
- manual version edits in multiple repos
- confusion about whether new data means a new release
