# Release Automation

This repository includes scripts for versioning and releasing:

- `scripts/version.sh` - Bump versions, create tags, and optionally push
- `scripts/pipeline.sh` - Run full monorepo pipeline and sync registry to plugin

## version.sh

Coordinates versioning across three repositories:

- root monorepo
- `packages/plugin` sub-repo
- `packages/registry` sub-repo

### What the Script Does

`scripts/version.sh` performs the following in order:

1. validates release inputs (`<version>` or `--bump`)
2. validates semver and branch state (`main`/`master`)
3. verifies clean git state in each repository
4. checks that the target tag does not already exist in root/plugin/registry
5. validates `CHANGELOG.md` entry (unless `--skip-docs`)
6. runs quality checks in sub-repos before tagging
7. bumps versions where applicable
8. commits and tags each repository
9. pushes commits and tags (only with `--push`)

### Usage

```bash
# explicit version (local only)
./scripts/version.sh 0.4.0

# auto-calculate next version from root package.json
./scripts/version.sh --bump patch
./scripts/version.sh --bump minor
./scripts/version.sh --bump major

# preview without changes
./scripts/version.sh --bump minor --dry-run

# push to remotes after versioning
./scripts/version.sh --bump minor --push

# full release with auto-confirm
./scripts/version.sh --bump minor --push --yes

# skip changelog validation (not recommended)
./scripts/version.sh 0.4.0 --skip-docs
```

### Makefile Shortcuts

```bash
make version VERSION=0.4.0
make version-dry VERSION=0.4.0
```

## pipeline.sh

Runs the full monorepo pipeline and syncs registry data to the plugin:

1. Runs the registry pipeline (sync → detect → merge → build → bundle → validate)
2. Bundles `registry.json` to `packages/plugin/lua/theme-browser/data/`
3. Optionally commits the plugin submodule pointer if changed

### Usage

```bash
# run full pipeline
./scripts/pipeline.sh

# force refresh (ignore cache)
./scripts/pipeline.sh --force

# commit plugin submodule pointer after pipeline
./scripts/pipeline.sh --commit

# testing mode (isolated outputs)
./scripts/pipeline.sh --testing
```

### Makefile Shortcuts

```bash
make pipeline
```

## Notes

- Plugin is Lua-only and has no `package.json`; it is tagged at its current committed state.
- Root lockfile metadata is updated during versioning to keep version fields aligned.
- If a tag already exists in any repo, the script exits early with an error.
- Versioning is local by default; use `--push` to push to remotes.
