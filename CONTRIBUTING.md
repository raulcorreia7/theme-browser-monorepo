# Contributing to theme-browser-monorepo

This repo orchestrates two nested packages:

- `packages/plugin` — the `theme-browser.nvim` plugin (submodule of `raulcorreia7/theme-browser.nvim`)
- `packages/registry` — the `@theme-browser/registry` indexer (submodule of `raulcorreia7/theme-browser-registry`)

Code changes to a package go to that package's own repository. This repo
changes when root workflows, docs, scripts, ops files, or submodule pointers
change.

## Prerequisites

- Git
- Node.js 20+
- pnpm 10+
- Neovim (only for plugin verification)

## Setup

```bash
git clone --recurse-submodules https://github.com/raulcorreia7/theme-browser-monorepo.git
cd theme-browser-monorepo
pnpm install
make install-hooks        # optional: versioning check on every push
```

Commands that hit the GitHub API need a token in `packages/registry/.env`
(see `ops/examples/registry-refresh.env.example`). Root workflows do not read
a root `.env` file.

## Make your change

1. Fork the repo and create a branch from `master`.
2. Make the change. Keep registry data refreshes and version bumps separate
   (see `docs/workflows.md`).
3. Verify before pushing:

```bash
make verify               # versioning checks + registry tests + plugin verification + validation
```

Focused checks while iterating:

```bash
make test                 # registry tests only
make validate             # validate generated registry output
make test-plugin          # plugin verification only
make verify-versioning    # version/changelog alignment only
```

4. If you changed a nested package, commit and push inside
   `packages/<name>/` to that package's repository first, then stage the
   updated submodule pointer here (`make update-submodules` fast-forwards and
   stages pointers).
5. Push your branch and open a pull request against `master` in this repo.

## Regenerating registry data

```bash
make refresh              # regenerate artifacts and the bundled plugin registry
make refresh-testing      # same flow with isolated testing outputs
```

Do not hand-edit files under `artifacts/` or the plugin's bundled
`lua/theme-browser/data/registry.json`; regenerate them.

## Releases

Releases are coordinated by maintainers with `make release-dry VERSION=X.Y.Z`
and `make release VERSION=X.Y.Z`. Do not bump versions or create tags in a
contribution PR.

## Docs

Read `docs/README.md` for the documentation map; `docs/release.md` and
`docs/automation.md` cover the release and refresh runbooks.
