# Theme Strategy Detection Heuristics

## Strategy Definitions

| Strategy | Criteria | Minimal Load Code |
|----------|----------|-------------------|
| **setup** | Has `setup()` for config, `colorscheme` required | `require("x").setup({})` + `vim.cmd.colorscheme("x")` |
| **load** | Has explicit `.load()` function | `require("x").load()` |
| **colorscheme** | Just `:colorscheme name`, no setup/load | `vim.cmd.colorscheme("x")` |

## README Detection Patterns

### LOAD (score: 8)
```
require("module").load()
```

### SETUP (score: 6)
```
require("module").setup({...})
```

### COLORSCHEME (score: 4)
```
:colorscheme name
vim.cmd("colorscheme name")
vim.cmd('colorscheme name')
vim.cmd.colorscheme("name")
```

### VIMSCRIPT GLOBALS (score: 3)
```
let g:theme_option = value
```
(only when no `require()` present)

## Source Structure Signals

When README patterns fail, check file structure:

| Structure | Strategy | Score | Reason |
|-----------|----------|-------|--------|
| `colors/*.vim` only | colorscheme | 6 | Classic Vim colorscheme |
| `colors/*.lua` only | colorscheme | 5 | Lush.nvim or compiled theme |
| `lua/*/init.lua` + `colors/*.lua` | setup | 4 | Modern Neovim theme with config |
| `lua/*/init.lua` + `colors/*.vim` | colorscheme | 4 | Hybrid Vim/Lua theme |
| `lua/*/init.lua` only | setup | 2 | Module without colors/ |

## Tie-Breaking Rules

1. **load > setup** when both present (explicit `.load()` is distinctive)
2. **setup > colorscheme** when `setup()` exists (has config options)

## Exclusion Patterns

Non-theme repos to exclude:
- `*dotfiles*`, `*config*`, `*nvim-config*`
- `*.vimrc*`, `*/init.vim`
- No `colors/` directory AND no `lua/` theme module
- Theme generators (e.g., `lush.nvim`)

## Lessons Learned from Manual Verification

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

## Accuracy

After manual verification of 613 themes:
- **Correct**: 610 (99.5%)
- **Incorrect**: 3 (0.5%)

### Remaining Edge Cases

| Repo | Detected | Should Be | Issue |
|------|----------|-----------|-------|
| hyperb1iss/silkcircuit.nvim | colorscheme | setup | Has Lua module without colors/ |
| rktjmp/lush.nvim | colorscheme | setup | Theme generator, not theme |
| skylarmb/torchlight.nvim | colorscheme | setup | Has Lua module without colors/ |

These edge cases require manual review or repo-specific hints.
