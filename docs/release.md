# Release Flow

Use this runbook when you are preparing a coordinated plugin + registry release.

## Goal

Fail early if versions, changelogs, compatibility metadata, tags, or repo state
drift before a release is tagged.

## Main Entry Points

Preferred root commands:

```bash
make release-dry VERSION=X.Y.Z
make release VERSION=X.Y.Z
```

Direct script usage when you need extra control:

```bash
bash ./scripts/release.sh --bump minor --dry-run
bash ./scripts/release.sh X.Y.Z --push --yes
```

Useful script flags:

| Flag | Purpose |
|------|---------|
| `--bump <patch|minor|major>` | Calculate the next version from the root `package.json` |
| `--dry-run` | Show the full release plan without changing files or tags |
| `--push` | Push commits and tags after local release steps succeed |
| `--yes` | Skip the confirmation prompt |
| `--skip-docs` | Skip changelog checks when they were already verified elsewhere |

## Preflight Checks

`make verify-versioning` and `scripts/release.sh` fail if any of these drift:

- root and registry package versions differ
- plugin compatibility series does not match the registry major/minor series
- root or plugin changelog is missing the target version entry
- docs still reference the removed legacy release script
- root `.gitmodules` is missing plugin or registry entries
- target tag already exists locally or on the remote
- the workspace is not on `main` or `master`
- the root repo is not clean before the release starts

Use `make verify` when you also want registry tests, plugin verification, and
registry validation before tagging.

## What The Release Updates

During a real release, `scripts/release.sh`:

1. validates release metadata and changelogs
2. updates `packages/registry/package.json`
3. updates plugin compatibility in `packages/plugin/lua/theme-browser/registry/sync.lua`
4. updates the root `package.json`
5. updates `package-lock.json` if it exists
6. runs package-local quality checks before tagging nested repos
7. creates matching tags in the registry repo, plugin repo, and root repo

## Recommended Flow

1. Update `CHANGELOG.md` with the new version entry.
2. Update `packages/plugin/CHANGELOG.md` with the same version entry.
3. Run `make update-submodules` if you want the latest upstream submodule state.
4. Run `make verify`.
5. Run `make release-dry VERSION=X.Y.Z`.
6. Run `make release VERSION=X.Y.Z`.
7. Push commits and tags if you did not use `--push`.

## Hooks

Install local hooks once:

```bash
make install-hooks
```

That sets up a `pre-push` hook that reruns the same versioning verification.

## Updating Nested Repos First

Use:

```bash
make update-submodules
```

That helper:

- syncs `.gitmodules`
- initializes missing submodules
- requires clean nested repos
- attaches detached fresh-clone submodules to their configured branches
- fast-forwards each nested repo on its configured or detected branch
- stages updated submodule pointers in the root repo

## Related Docs

- `README.md` - root command surface
- `workflows.md` - refresh vs release boundary
- `../packages/registry/README.md` - registry package verification and outputs
- `../packages/plugin/README.md` - plugin package overview
