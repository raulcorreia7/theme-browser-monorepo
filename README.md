# theme-browser-monorepo

Monorepo for the `theme-browser.nvim` plugin and the `theme-browser` registry
indexer.

## Quick Start

```bash
git clone --recurse-submodules https://github.com/raulcorreia7/theme-browser-monorepo.git
cd theme-browser-monorepo
just build
just verify
```

## Features

- One root workspace for cross-repo refresh, verification, and release work.
- A single Go CLI (`bin/tb`) plus root `just` recipes for operator flows.
- Nested package READMEs for package-local setup, commands, and troubleshooting.
- Runbooks for refresh automation, release coordination, and registry debugging.

## Installation

Prerequisites:

- Go 1.22+
- Git
- Neovim (for plugin verification)

Registry development also needs a GitHub token in
`packages/registry/.env` when commands hit the GitHub API.

## Usage

Build the workspace CLI once:

```bash
just build
```

Use the root `justfile` as the canonical workspace interface (`just --list` shows the recipes).

Common workflows:

```bash
just refresh
just refresh-testing
just verify
```

Focused checks:

```bash
just test
just validate
just test-plugin
just verify-versioning
```

Release flow:

```bash
just release-dry X.Y.Z
just release X.Y.Z
```

Automation helpers:

```bash
just install-hooks
just update-submodules
```

## Commands

| Command | Use it when |
|---------|-------------|
| `just build` | Build the `tb` CLI into `bin/tb` |
| `just refresh` | Regenerate registry artifacts and the bundled plugin registry |
| `just refresh-testing` | Run the refresh flow with isolated testing outputs |
| `just verify` | Run versioning checks, registry tests, plugin verification, and registry validation |
| `just test` | Run registry tests only |
| `just validate` | Validate generated registry output (`artifacts/themes.json`) |
| `just test-plugin` | Run plugin verification only |
| `just verify-versioning` | Check changelog, version, and compatibility alignment via `tb verify-versioning` |
| `just release-dry X.Y.Z` | Preview a coordinated release via `tb release --dry-run` |
| `just release X.Y.Z` | Bump versions and create release tags via `tb release` |
| `just update-submodules` | Fast-forward nested repos and stage new pointers via `tb update-submodules` |
| `just install-hooks` | Configure local git hooks via `tb install-hooks` |
| `just status` | Show git status of both nested repos |
| `just clean` | Remove generated artifacts and package build outputs |

Run `just --list` to print the same command surface.

## Architecture

```text
theme-browser-monorepo/
|- README.md                Root operator entry point
|- cmd/tb/                  Root workflow CLI (refresh, release, verification)
|- docs/                    Runbooks and product knowledge
`- packages/
   |- registry/             Theme discovery, generation, validation
   `- plugin/               Neovim plugin and bundled registry consumer
```

The root repo orchestrates shared workflows through `cmd/tb`. Package-specific
behavior, configuration, and deeper troubleshooting stay in each package.

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
- Use `docs/automation.md` for scheduled refresh operations with systemd.
- Use `docs/release.md` for coordinated versioning and tag flow.
- Use `packages/registry/README.md` and `packages/plugin/README.md` for
  package-local setup, commands, and troubleshooting.

## License

See the nested package repositories for their license files and release
metadata.
