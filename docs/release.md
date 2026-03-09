# Release Flow

## Goal

When you create a release from this workspace, it should fail early if the
repos, changelogs, or tags are out of sync.

## Preflight Checks

`make verify-versioning` and `scripts/release.sh` fail early if any of these drift:

- root and registry versions match
- plugin registry compatibility matches the registry major/minor line
- root and plugin changelogs contain the release entry
- root repo declares the nested repos in `.gitmodules`
- docs do not reference the removed legacy release script
- the target tag already exists locally or on the remote
- the workspace is not on `main` or `master`
- the root repo is not clean before the release starts

`make verify` is the main local preflight if you want metadata checks, registry verification, and plugin verification before releasing.

## Entry Points

Preferred root commands:

```bash
make release-dry VERSION=0.4.0
make release VERSION=0.4.0
```

When you need extra control, use the script directly:

```bash
bash ./scripts/release.sh --bump minor --dry-run
bash ./scripts/release.sh 0.4.0 --push --yes
```

Useful script-only options:

- `--bump <patch|minor|major>` computes the next version from `package.json`
- `--push` pushes commits and tags after the local release succeeds
- `--yes` skips the confirmation prompt
- `--skip-docs` skips changelog checks when docs were already validated elsewhere

## Release Updates

During release, `scripts/release.sh` also:

- checks for a clean git state
- checks that the target tag does not already exist
- updates `packages/registry/package.json`
- updates the plugin compatibility series in `packages/plugin/lua/theme-browser/registry/sync.lua`
- updates the root version and lockfile metadata
- runs package-local quality checks before tagging nested repos
- tags the registry repo, plugin repo, and root repo

## Recommended Flow

1. Update the root changelog entry in [CHANGELOG.md](../CHANGELOG.md).
2. Update the plugin changelog entry in [packages/plugin/CHANGELOG.md](../packages/plugin/CHANGELOG.md).
3. Run `make update-submodules` if you want the latest upstream plugin/registry state first.
4. Run `make verify`.
5. Run `make release-dry VERSION=X.Y.Z`.
6. Run `make release VERSION=X.Y.Z`.
7. If you used the script directly without `--push`, push commits and tags after review.

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
- attaches detached fresh-clone submodules to their configured branches
- fast-forwards each nested repo on its configured/current branch
- stages the updated submodule pointers in the root repo

## Related Docs

- Documentation index: [README.md](./README.md)
- Workflow model and source-of-truth direction: [workflows.md](./workflows.md)
- Registry-local commands and outputs: [packages/registry/README.md](../packages/registry/README.md)
- Detection stage debugging: [theme-detection.md](./theme-detection.md)
- Plugin usage and release asset behavior: [packages/plugin/README.md](../packages/plugin/README.md)
