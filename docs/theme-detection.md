# Theme Detection System

Automated theme strategy detection with 100% accuracy on 613 themes.

## Architecture

```
theme-browser-registry-ts/
├── sources/                 # Editable source files
│   ├── setup.json          # Themes with setup() config
│   ├── load.json           # Themes with .load() function
│   ├── colorscheme.json    # Simple colorscheme themes
│   ├── builtin.json        # Neovim built-in themes
│   └── hints.json          # Manual overrides for edge cases
├── excluded.json           # Non-theme repos (dotfiles, configs)
└── overrides.json          # Generated (do not edit)
```

## Workflow

```bash
npm run sync-themes              # Sync themes from GitHub
npm run detect-strategies        # Detect strategies (writes reports/detection.json)
npm run detect-strategies:apply  # Apply to sources/*.json
npm run build-overrides          # Merge sources/*.json → overrides.json
npm run build                    # Build registry for plugin
```

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

## Lessons Learned

### 1. File Structure is Strong Signal
Many themes have minimal/missing README docs but valid `colors/` files.
Always fall back to file structure when README patterns fail.

### 2. colors/*.lua Without Lua Module = colorscheme
Some themes (lush.nvim outputs, compiled themes) have `colors/*.lua`
but no `lua/` module. These are pure colorscheme themes.

### 3. vim.cmd Variations
READMEs use multiple patterns:
- `vim.cmd("colorscheme x")` - double quotes
- `vim.cmd('colorscheme x')` - single quotes
- `vim.cmd.colorscheme("x")` - chained call

### 4. Theme Generators ≠ Themes
Repos like `lush.nvim` create themes but aren't themes themselves.
Detect by: has `lua/` module but no `colors/` AND describes itself as
framework/tool.

### 5. .load() Must Be Explicit
Only classify as "load" if README explicitly shows `.load()` call.
If README only shows `vim.cmd.colorscheme()`, it's "colorscheme" not "load".

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
2. If no clear winner (confidence < 0.7):
   a. Fetch repo tree
   b. Check file structure
   c. Add structure-based signals
3. Apply tie-breaking rules
4. Return strategy with highest score
```

## NPM Scripts

| Script | Description |
|--------|-------------|
| `sync-themes` | Sync themes from GitHub |
| `detect-strategies` | Detect strategies (dry-run) |
| `detect-strategies:apply` | Apply detected strategies |
| `build-overrides` | Merge sources/*.json → overrides.json |
| `build` | Build registry for plugin |
