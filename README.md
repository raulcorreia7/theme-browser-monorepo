# theme-browser-monorepo

Workspace for the two upstream repos:

- `packages/plugin` → `theme-browser.nvim`
- `packages/registry` → `theme-browser-registry`

The root repo exists to make local development, release preparation, and cross-repo consistency checks simpler.
Root commands orchestrate multiple repos; package READMEs are the source of truth for package-local commands.
The canonical root interface is `make`.

## Clone

```bash
git clone --recurse-submodules https://github.com/raulcorreia7/theme-browser-monorepo.git
cd theme-browser-monorepo
pnpm install
```

## Main Workflows

Primary commands:

```bash
make refresh
make refresh-testing
make verify
```

Legacy `pnpm task:*` aliases still exist for older local scripts, but `make` remains the preferred root interface.

Focused checks:

```bash
make test
make validate
make test-plugin
```

Release helpers:

```bash
make verify-versioning
make install-hooks
make update-submodules
make docker-build
```

Release:

```bash
make release VERSION=0.4.0
# or preview it first
make release-dry VERSION=0.4.0
```

`make verify` is the main local preflight. It runs `verify-versioning`, registry tests, plugin verification, and registry validation against the current generated outputs. `make verify-versioning` is the focused metadata check when you only want release/version alignment.

## Docs

- [docs/README.md](docs/README.md) — guide/runbook index and freshness triggers
- [docs/automation.md](docs/automation.md) — scheduled runner and container deployment
- [docs/release.md](docs/release.md) — release flow, preflight checks, and script entry points
- [docs/workflows.md](docs/workflows.md) — release vs refresh workflow model
- [packages/registry/README.md](packages/registry/README.md) — registry-local commands, outputs, and debugging links
- [docs/theme-detection.md](docs/theme-detection.md) — registry stage debugging guide
- [docs/theme-detection-heuristics.md](docs/theme-detection-heuristics.md) — detection heuristics and scoring details
- [packages/plugin/README.md](packages/plugin/README.md) — plugin usage
- [CHANGELOG.md](CHANGELOG.md) — monorepo changes
