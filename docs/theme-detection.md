# Theme Detection System

Automated theme strategy detection with curated overrides and safety exclusions.

## Architecture

```
packages/registry/
├── artifacts/
│   ├── index.json         # Raw theme inventory (synced from GitHub)
│   ├── themes.json        # Final output for plugin consumption
│   └── manifest.json      # Build metadata
├── sources/               # Editable source files
│   ├── setup.json        # Themes with setup() config
│   ├── load.json         # Themes with .load() function
│   ├── colorscheme.json  # Simple colorscheme themes
│   ├── builtin.json      # Neovim built-in themes
│   └── hints.json        # Manual overrides for edge cases
├── excluded.json         # Non-theme repos (dotfiles, configs)
└── overrides.json        # Generated (do not edit)
```

## Pipeline

```bash
make sync      # 01: Sync themes from GitHub → artifacts/index.json
make detect    # 02: Detect strategies → sources/*.json
make merge     # 03: Merge sources → overrides.json
make build     # 04: Generate final themes.json
make validate  # Validate strategy and quality constraints

make pipeline  # Run all steps (sync → detect → merge → build)
```

Or with pnpm (includes bundle step):

```bash
pnpm task:sync      # 01-sync
pnpm task:detect    # 02-detect --apply
pnpm task:merge     # 03-merge
pnpm task:build     # 04-build
pnpm task:bundle    # 05-bundle (plugin registry)
pnpm task:validate  # Validate output
pnpm task:pipeline  # All steps
```

## Tasks

| Task File | Purpose | Key Options |
|-----------|---------|-------------|
| tasks/01-sync.ts | Sync from GitHub | `-c, --config`, `-v, --verbose` |
| tasks/02-detect.ts | Detect strategies | `-i, --index`, `-s, --sources`, `-n, --sample`, `-r, --repo`, `--apply` |
| tasks/03-merge.ts | Merge to overrides.json | `-s, --sources`, `-o, --output` |
| tasks/04-build.ts | Generate themes.json | `-i, --index`, `-o, --overrides`, `-O, --output` |
| tasks/05-bundle.ts | Bundle plugin registry | `-o, --output` |
| tasks/06-manifest.ts | Generate manifest.json | |
| tasks/07-top-themes.ts | Generate top 50 list | |

## Strategy Definitions

| Strategy | Loading Method |
|----------|----------------|
| setup | `require("theme").setup({})` + `vim.cmd.colorscheme("theme")` |
| load | `require("theme").load()` |
| colorscheme | `vim.cmd.colorscheme("theme")` |

## Detection Methods

### README Detection (Primary)

| Pattern | Strategy | Score |
|---------|----------|-------|
| `require("x").load()` | load | 8 |
| `require("x").setup({...})` | setup | 6 |
| `:colorscheme x` | colorscheme | 4 |
| `vim.cmd.colorscheme("x")` | colorscheme | 4 |
| `let g:theme_option = value` | colorscheme | 3 |

### Source Structure (Fallback)

| Structure | Strategy | Score | Reason |
|-----------|----------|-------|--------|
| `colors/*.vim` only | colorscheme | 6 | Classic Vim colorscheme |
| `colors/*.lua` only | colorscheme | 5 | Lush.nvim or compiled theme |
| `lua/*/init.lua` + `colors/*.lua` | setup | 4 | Modern Neovim theme with config |
| `lua/*/init.lua` + `colors/*.vim` | colorscheme | 4 | Hybrid Vim/Lua theme |
| `lua/*/init.lua` only | setup | 2 | Module without colors/ |

### Tie-Breaking Rules

1. **load > setup** when both present (explicit `.load()` is distinctive)
2. **setup > colorscheme** when `setup()` exists (has config options)

### Manual Hints

For repos that defy automatic detection, edit `sources/hints.json`:

```json
{
  "description": "Manual strategy overrides",
  "hints": [
    {
      "repo": "rktjmp/lush.nvim",
      "strategy": "setup",
      "reason": "Theme generator framework, not a theme"
    }
  ]
}
```

## Exclusion Patterns

Non-theme repos to exclude:
- `*dotfiles*`, `*config*`, `*nvim-config*`
- `*.vimrc*`, `*/init.vim`
- No `colors/` directory AND no `lua/` theme module
- Theme generators (e.g., `lush.nvim`)
- Themes with side effects outside Neovim runtime (for example writing `~/.config/*`)

Exclusions are enforced in two layers:
- `config.json` → `discovery.excludeRepos` (discovery-time hard exclusion)
- `excluded.json` (curated deny-list for visibility/auditing)

## Accuracy

| Metric | Value |
|--------|-------|
| Detection quality | High confidence + manual hints |
| Strategy fallback | README patterns → source structure |
| Safety filter | Excluded repos never enter final bundle |

Count semantics:
- `themes` means top-level theme records
- `variants` means nested variant options under those themes
- They are different dimensions, so they are not summed as `themes + variants`

### Edge Cases (Manual Hints Required)

| Repo | Detected | Should Be | Issue |
|------|----------|-----------|-------|
| hyperb1iss/silkcircuit.nvim | colorscheme | setup | Has Lua module without colors/ |
| rktjmp/lush.nvim | colorscheme | setup | Theme generator, not theme |
| skylarmb/torchlight.nvim | colorscheme | setup | Has Lua module without colors/ |

## Detection Algorithm

```
1. Parse README for patterns → score each strategy
2. If confidence < 0.9:
   a. Fetch repo tree
   b. Check file structure
   c. Add structure-based signals
3. Apply tie-breaking rules
4. Return strategy with highest score (only if confidence >= 0.9)
```
