# Release Flow

## Goal

When you create a release from this workspace, the release should fail early if the repos are out of sync.

## Preflight Checks

`make verify-versioning` and `scripts/version.sh` fail early if any of these drift:

- root and registry versions match
- plugin registry compatibility matches the registry major/minor line
- root and plugin changelogs contain the release entry
- root repo declares the nested repos in `.gitmodules`
- docs do not reference the removed legacy release script

`make verify` is the main local preflight if you want metadata checks, registry verification, and plugin verification before releasing.

## Release Updates

During release, `scripts/version.sh` also:

- checks for a clean git state
- checks that the target tag does not already exist
- updates `packages/registry/package.json`
- updates the plugin compatibility series in `packages/plugin/lua/theme-browser/registry/sync.lua`
- updates the root version and lockfile metadata
- tags the registry repo, plugin repo, and root repo

## Recommended Flow

1. Update the root changelog entry in [CHANGELOG.md](../CHANGELOG.md).
2. Update the plugin changelog entry in [packages/plugin/CHANGELOG.md](../packages/plugin/CHANGELOG.md).
3. Run `make verify`.
4. Run `make update-submodules` if you want the latest upstream plugin/registry state first.
5. Run `make version-dry VERSION=X.Y.Z`.
6. Run `make version VERSION=X.Y.Z`.

## Hooks

Install local hooks once:

```bash
make install-hooks
```

That configures a `pre-push` hook which runs the same versioning verification before pushing.

## Updating Nested Repos

Use:

```bash
make update-submodules
```

That script:

- syncs `.gitmodules`
- initializes missing submodules
- requires clean nested repos
- fast-forwards each nested repo on its current branch
- stages the updated submodule pointers in the root repo

## Related Docs

- Workflow model and source-of-truth direction: [workflows.md](./workflows.md)
- Registry-local commands and outputs: [packages/registry/README.md](../packages/registry/README.md)
- Detection stage debugging: [theme-detection.md](./theme-detection.md)
- Plugin usage and release asset behavior: [packages/plugin/README.md](../packages/plugin/README.md)
