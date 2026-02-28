# theme-browser-monorepo

Monorepo workspace for coordinated development across:

- `packages/plugin` — Neovim plugin for browsing and applying colorschemes
- `packages/registry` — TypeScript theme registry indexer

This workspace keeps both projects as independent git repositories under one root for easier local workflows.

## Layout

```text
theme-browser-monorepo/
├── packages/
│   ├── plugin/     # Neovim plugin (theme-browser.nvim)
│   └── registry/   # TypeScript theme indexer
├── docs/           # Documentation
└── scripts/        # Release and utility scripts
```

## Quick Commands

| Command | Description |
|---------|-------------|
| `make pipeline` | Run full pipeline (sync → detect → merge → build) |
| `make sync` | Step 01: Sync themes from GitHub |
| `make detect` | Step 02: Detect loading strategies |
| `make merge` | Step 03: Merge sources |
| `make build` | Step 04: Generate themes.json |
| `make validate` | Validate registry output |
| `make test` | Run registry tests |
| `make clean` | Clean all artifacts |
| `pnpm task:bundle` | Step 05: Bundle top themes for plugin |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format with Prettier |
| `pnpm typecheck` | Type check TypeScript |
| `pnpm test:plugin` | Run plugin tests |

## Registry Setup

The TypeScript registry indexes Neovim colorschemes from GitHub and produces `themes.json` for the plugin.

### Requirements

- Node.js >= 20
- GitHub token (for API access)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure GitHub token
cp packages/registry/.env.example packages/registry/.env
# Edit .env: GITHUB_TOKEN=ghp_your_token_here
source packages/registry/.env

# 3. Run indexer
make sync
```

### Getting a GitHub Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Generate new token with "Public repositories (read-only)" access
3. Copy token to `.env` file

Rate limits:
- Without token: ~60 requests/hour
- With token: ~5,000 requests/hour

## Plugin Setup

See [packages/plugin/README.md](packages/plugin/README.md) for Neovim plugin installation and usage.

## Release

```bash
# Explicit version (updates versions, tags, pushes all repos)
./scripts/release.sh 0.3.0

# Dry run to see what would happen
./scripts/release.sh 0.3.0 --dry-run

# Auto-bump from current root version
./scripts/release.sh --bump patch
./scripts/release.sh --bump minor --dry-run
```

Release notes:
- `scripts/release.sh` validates `CHANGELOG.md` before release by default
- It checks whether the target tag already exists in root, plugin, or registry before doing work
- `--bump patch|minor|major` calculates the next version automatically
- Tag/release workflows in plugin and registry are idempotent (safe on reruns)
- Use the latest `vX.Y.Z` tag as the current stability baseline

Full release guide: [docs/release.md](docs/release.md)

## Documentation

- [packages/registry/README.md](packages/registry/README.md) — Registry indexer details
- [packages/plugin/README.md](packages/plugin/README.md) — Plugin usage
- [docs/release.md](docs/release.md) — Release automation and version bumping
- [CHANGELOG.md](CHANGELOG.md) — Version history

## License

MIT
