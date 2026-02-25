# theme-browser-monorepo

Monorepo workspace for coordinated development across:

- `theme-browser.nvim` — Neovim plugin for browsing and applying colorschemes
- `theme-browser-registry-ts` — TypeScript theme registry indexer (primary)
- `theme-browser-registry` — Python indexer (deprecated)

This workspace keeps both projects as independent git repositories under one root for easier local workflows.

## Layout

```text
theme-browser-monorepo/
├── theme-browser.nvim/         # Neovim plugin
├── theme-browser-registry-ts/  # TypeScript indexer (primary)
└── theme-browser-registry/     # Python indexer (deprecated)
```

## Quick Commands

| Command | Description |
|---------|-------------|
| `make status` | Show git status for all repos |
| `make plugin-verify` | Run plugin lint + tests |
| `make registry-sync` | Sync themes once |
| `make registry-watch` | Sync themes continuously |
| `make registry-publish` | Sync and push to git |
| `make registry-export` | Export database to JSON |
| `make registry-test` | Run registry tests |
| `make registry-clean` | Clean registry artifacts |

## Registry Setup

The TypeScript registry indexes Neovim colorschemes from GitHub and produces `themes.json` for the plugin.

### Requirements

- Node.js >= 20
- GitHub token (for API access)

### Setup

```bash
# 1. Install dependencies
cd theme-browser-registry-ts
npm install

# 2. Configure GitHub token
cp .env.example .env
# Edit .env: GITHUB_TOKEN=ghp_your_token_here
source .env

# 3. Run indexer
cd theme-browser-registry-ts
npx tsx src/index.ts sync
```

### Getting a GitHub Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Generate new token with "Public repositories (read-only)" access
3. Copy token to `.env` file

Rate limits:
- Without token: ~60 requests/hour
- With token: ~5,000 requests/hour

### CI/CD

Automated daily updates via GitHub Actions (`.github/workflows/registry.yml`), publishing `themes.json` to GitHub Releases.

## Plugin Setup

See [theme-browser.nvim/README.md](theme-browser.nvim/README.md) for Neovim plugin installation and usage.

## Documentation

- [theme-browser-registry-ts/README.md](theme-browser-registry-ts/README.md) — Registry indexer details
- [theme-browser.nvim/README.md](theme-browser.nvim/README.md) — Plugin usage

## License

MIT
