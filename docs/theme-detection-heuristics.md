# Theme Detection Heuristics

Use this reference when a detect result looks wrong and you need to understand
why the registry chose a strategy.

## Strategy Definitions

| Strategy | Expected loading method |
|----------|-------------------------|
| `setup` | `require("theme").setup({})` then `vim.cmd.colorscheme("theme")` |
| `load` | `require("theme").load()` |
| `colorscheme` | `vim.cmd.colorscheme("theme")` |

## README Signals

| Pattern | Strategy | Score |
|---------|----------|-------|
| `require("x").load()` | `load` | 8 |
| `require("x").setup({...})` | `setup` | 6 |
| `:colorscheme x` | `colorscheme` | 4 |
| `vim.cmd.colorscheme("x")` | `colorscheme` | 4 |
| `let g:theme_option = value` | `colorscheme` | 3 |

## Source Structure Fallback

| Structure | Strategy | Score | Reason |
|-----------|----------|-------|--------|
| `colors/*.vim` only | `colorscheme` | 6 | Classic Vim colorscheme |
| `colors/*.lua` only | `colorscheme` | 5 | Lush or compiled theme layout |
| `lua/*/init.lua` plus `colors/*.lua` | `setup` | 4 | Modern Neovim theme with config |
| `lua/*/init.lua` plus `colors/*.vim` | `colorscheme` | 4 | Hybrid Vim or Lua theme |
| `lua/*/init.lua` only | `setup` | 2 | Module exists but no clear colors dir |

## Tie-Breaking

1. `load` beats `setup` when both are present.
2. `setup` beats `colorscheme` when `setup()` exists.
3. Manual hints win when automation stays ambiguous.

## Common Manual Hint Cases

| Repo | Detected | Should be | Why |
|------|----------|-----------|-----|
| `hyperb1iss/silkcircuit.nvim` | `colorscheme` | `setup` | Lua module exists without a strong colors dir signal |
| `rktjmp/lush.nvim` | `colorscheme` | `setup` | Theme generator framework, not a normal theme |
| `skylarmb/torchlight.nvim` | `colorscheme` | `setup` | Lua module exists without a strong colors dir signal |

## Exclusion Patterns

Exclude repos that are not real themes, including:

- dotfiles or editor config repos
- bare vimrc or init files
- repos with no `colors/` directory and no relevant Lua theme module
- theme generators such as `lush.nvim`
- themes with side effects outside Neovim runtime

## Detection Order

```text
1. Parse README signals.
2. Fall back to source structure.
3. Apply tie-break rules.
4. Use curated hints when automation is still wrong.
```

## Related Files

- `../packages/registry/config/sources/hints.json` - manual corrections
- `theme-detection.md` - stage debugging workflow
