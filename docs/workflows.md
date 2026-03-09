# Workflows

Keep refresh and release separate.

`refresh` is data maintenance. `release` is version and tag management.

## Workflow Split

| Workflow | Trigger | Changes allowed | Must not do |
|----------|---------|-----------------|-------------|
| `refresh` | Upstream repo drift, star changes, detection improvements, bundled registry refresh | Registry artifacts, bundled plugin registry, submodule pointers | Bump versions, edit changelogs, create tags |
| `release` | Plugin behavior change, registry contract change, compatibility change, intentional stable cut | Version metadata, compatibility series, tags, release commits | Smuggle in unrelated data churn |

## Refresh

Use refresh when you want the latest registry data without creating a new tagged
release.

Expected flow:

1. run `make refresh`
2. run `make verify`
3. commit changed data in nested repos if needed
4. stage and commit root submodule pointers
5. push

## Release

Use release when the plugin or registry needs a new coordinated stable version.

Expected flow:

1. choose `VERSION=X.Y.Z`
2. verify changelog entries
3. derive root version, registry version, and plugin compatibility from that one input
4. run quality checks
5. commit and tag nested repos
6. commit and tag the root repo
7. push

## Source Of Truth

Release metadata is driven from one explicit version input:

```bash
make release VERSION=X.Y.Z
```

That one value propagates to:

- root version
- registry package version
- plugin compatibility series
- matching git tags

## Why The Split Exists

This keeps weekly data drift out of the release process and keeps versioning
intentional.

Without this split, it becomes hard to tell whether a new commit reflects:

- fresh registry data,
- a real user-facing plugin change,
- or a compatibility boundary that deserves a tagged release.
