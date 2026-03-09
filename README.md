# theme-browser-monorepo

Monorepo for the `theme-browser.nvim` plugin and the `@theme-browser/registry`
indexer.

## Quick Start

```bash
git clone --recurse-submodules https://github.com/raulcorreia7/theme-browser-monorepo.git
cd theme-browser-monorepo
pnpm install
make verify
```

## Features

- One root workspace for cross-repo refresh, verification, and release work.
- Root `make` targets for the common operator flows.
- Nested package READMEs for package-local setup, commands, and troubleshooting.
- Runbooks for refresh automation, release coordination, and registry debugging.

## Installation

Prerequisites:

- Node.js 20+
- pnpm 10+
- Git
- Neovim (for plugin verification)

Registry development also needs a GitHub token in
`packages/registry/.env` when commands hit the GitHub API.

## Usage

Use the root `Makefile` as the canonical workspace interface.

Common workflows:

```bash
make refresh
make refresh-testing
make verify
```

Focused checks:

```bash
make test
make validate
make test-plugin
make verify-versioning
```

Release flow:

```bash
make release-dry VERSION=X.Y.Z
make release VERSION=X.Y.Z
```

Automation helpers:

```bash
make install-hooks
make update-submodules
# optional image build helper
bash ./scripts/build-registry-dockerfile.sh
bash ./scripts/run-registry-docker.sh --dry-run
```

## Commands

| Command | Use it when |
|---------|-------------|
| `make refresh` | Regenerate registry artifacts and the bundled plugin registry |
| `make refresh-testing` | Run the refresh flow with isolated testing outputs |
| `make verify` | Run versioning checks, registry tests, plugin verification, and registry validation |
| `make test` | Run registry tests only |
| `make validate` | Validate generated registry output |
| `make test-plugin` | Run plugin verification only |
| `make verify-versioning` | Check changelog, version, and compatibility alignment |
| `make release-dry VERSION=X.Y.Z` | Preview a coordinated release |
| `make release VERSION=X.Y.Z` | Bump versions and create release tags |
| `make update-submodules` | Fast-forward nested repos and stage new pointers |
| `bash ./scripts/build-registry-dockerfile.sh` | Build the optional refresh runner image |
| `bash ./scripts/run-registry-docker.sh` | Run the optional refresh runner image |
| `make clean` | Remove generated artifacts and package build outputs |

Run `make help` to print the same command surface from the CLI.

## Architecture

```text
theme-browser-monorepo/
|- README.md                Root operator entry point
|- docs/                    Runbooks and product knowledge
|- scripts/                 Root workflow scripts
`- packages/
   |- registry/             Theme discovery, generation, validation
   `- plugin/               Neovim plugin and bundled registry consumer
```

The root repo orchestrates shared workflows. Package-specific behavior,
configuration, and deeper troubleshooting stay in each package.

## Configuration

- Root workflows do not use a root `.env` file.
- Registry runtime configuration lives in `packages/registry/config/registry.json`.
- Registry secrets and local API credentials belong in
  `packages/registry/.env`.
- Plugin user configuration is documented in
  `packages/plugin/docs/configuration.md`.

## Docs

- Start with `docs/README.md` for the current documentation map, review
  priority, and freshness rules.
- Use `docs/automation.md` for scheduled refresh operations and Docker helper
  usage.
- Use `docs/release.md` for coordinated versioning and tag flow.
- Use `packages/registry/README.md` and `packages/plugin/README.md` for
  package-local setup, commands, and troubleshooting.

## License

See the nested package repositories for their license files and release
metadata.
