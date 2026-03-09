# Theme Detection Heuristics

Lower-level reference for how detection infers strategy and when curated hints are needed.

## Strategy Definitions

| Strategy | Loading Method |
|----------|----------------|
| setup | `require("theme").setup({})` + `vim.cmd.colorscheme("theme")` |
| load | `require("theme").load()` |
| colorscheme | `vim.cmd.colorscheme("theme")` |

## Detection Methods

### README Detection

| Pattern | Strategy | Score |
|---------|----------|-------|
| `require("x").load()` | load | 8 |
| `require("x").setup({...})` | setup | 6 |
| `:colorscheme x` | colorscheme | 4 |
| `vim.cmd.colorscheme("x")` | colorscheme | 4 |
| `let g:theme_option = value` | colorscheme | 3 |

### Source Structure Fallback

| Structure | Strategy | Score | Reason |
|-----------|----------|-------|--------|
| `colors/*.vim` only | colorscheme | 6 | Classic Vim colorscheme |
| `colors/*.lua` only | colorscheme | 5 | Lush.nvim or compiled theme |
| `lua/*/init.lua` + `colors/*.lua` | setup | 4 | Modern Neovim theme with config |
| `lua/*/init.lua` + `colors/*.vim` | colorscheme | 4 | Hybrid Vim/Lua theme |
| `lua/*/init.lua` only | setup | 2 | Module without colors/ |

## Tie-Breaking

1. `load` beats `setup` when both are present.
2. `setup` beats `colorscheme` when `setup()` exists.

## Common Manual Hint Cases

| Repo | Detected | Should Be | Issue |
|------|----------|-----------|-------|
| hyperb1iss/silkcircuit.nvim | colorscheme | setup | Has Lua module without colors/ |
| rktjmp/lush.nvim | colorscheme | setup | Theme generator, not a theme |
| skylarmb/torchlight.nvim | colorscheme | setup | Has Lua module without colors/ |

## Exclusion Patterns

Non-theme repos to exclude:

- `*dotfiles*`, `*config*`, `*nvim-config*`
- `*.vimrc*`, `*/init.vim`
- No `colors/` directory and no `lua/` theme module
- Theme generators such as `lush.nvim`
- Themes with side effects outside Neovim runtime

## Detection Algorithm

```text
1. Parse README for strategy signals.
2. If confidence is too low, inspect source structure.
3. Apply tie-breaking rules.
4. Fall back to curated hints when needed.
```
