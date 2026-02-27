# Release Automation

This repository already includes a release script: `scripts/release.sh`.

It coordinates release steps across three repositories:

- root monorepo
- `packages/plugin` sub-repo
- `packages/registry` sub-repo

## What the Script Automates

`scripts/release.sh` performs the following in order:

1. validates release inputs (`<version>` or `--bump`)
2. validates semver and branch state (`main`/`master`)
3. verifies clean git state in each repository
4. checks that the target tag does not already exist in root/plugin/registry
5. validates `CHANGELOG.md` entry (unless `--skip-docs`)
6. runs quality checks in sub-repos before tagging
7. bumps versions where applicable
8. commits, tags, and pushes each repository

## Usage

```bash
# explicit version
./scripts/release.sh 0.3.1

# auto-calculate next version from root package.json
./scripts/release.sh --bump patch
./scripts/release.sh --bump minor
./scripts/release.sh --bump major

# preview without changes
./scripts/release.sh --bump patch --dry-run

# skip changelog validation (not recommended)
./scripts/release.sh 0.3.1 --skip-docs
```

## Makefile Shortcuts

```bash
make release VERSION=0.3.1
make release-dry VERSION=0.3.1
```

## Notes

- Plugin is Lua-only and has no `package.json`; it is tagged at its current committed state.
- Root lockfile metadata is updated during release to keep version fields aligned.
- If a tag already exists in any repo, the script exits early with an error.
