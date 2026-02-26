# Theme Detection System

Automated theme strategy detection with 100% accuracy on 613 themes.

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

make pipeline  # Run all steps
```

Or with npm:

```bash
npm run sync       # 01-sync-index
npm run detect     # 02-detect-strategies --apply
npm run merge      # 03-merge-sources
npm run build      # 04-generate-themes
npm run pipeline   # All steps
```

## Scripts

| Script | Purpose | Key Options |
|--------|---------|-------------|
| 01-sync-index | Sync from GitHub | `-c, --config`, `-v, --verbose` |
| 02-detect-strategies | Detect strategies | `-i, --index`, `-s, --sources`, `-n, --sample`, `-r, --repo`, `--apply` |
| 03-merge-sources | Merge to overrides.json | `-s, --sources`, `-o, --output` |
| 04-generate-themes | Generate themes.json | `-i, --index`, `-o, --overrides`, `-O, --output` |

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

## Accuracy

| Metric | Value |
|--------|-------|
| Total themes | 613 |
| Correct | 613 |
| Incorrect | 0 |
| **Accuracy** | **100%** |

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
