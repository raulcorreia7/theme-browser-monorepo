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
make pipeline
make pipeline-testing
make verify
```

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
make version VERSION=0.4.0
# or preview it first
make version-dry VERSION=0.4.0
```

`make verify` is the main local preflight. It runs `verify-versioning`, registry tests, plugin verification, and registry validation. `make verify-versioning` is the focused metadata check when you only want release/version alignment.

## Docs

- [docs/automation.md](docs/automation.md) — scheduled runner and container deployment
- [docs/release.md](docs/release.md) — release flow and guarantees
- [packages/registry/README.md](packages/registry/README.md) — registry-local commands and outputs
- [docs/theme-detection.md](docs/theme-detection.md) — registry stage debugging guide
- [docs/theme-detection-heuristics.md](docs/theme-detection-heuristics.md) — detection heuristics and scoring details
- [packages/plugin/README.md](packages/plugin/README.md) — plugin usage
- [CHANGELOG.md](CHANGELOG.md) — monorepo changes
