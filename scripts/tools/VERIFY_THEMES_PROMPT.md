# Theme Strategy Verification Prompt

## Goal
Verify all themes in artifacts/themes.json have correct loading strategies by checking their GitHub repos.

## Process
For each theme in themes.json:

1. Fetch repo README using: `gh repo view <repo> --json readme --jq .readme`
2. Look for loading patterns:
   - `require("theme").setup()` → strategy: setup
   - `require("theme").load()` → strategy: load
   - `colorscheme name` → strategy: colorscheme
   - Complex logic → strategy: file (needs themes/<name>.lua)
3. Check for variants (dark/light, styles)
4. Update overrides.json with correct strategy
5. If file strategy needed, create/update themes/<name>.lua

## Strategy Types

| Type | Pattern | Example |
|------|---------|---------|
| `setup` | `require("module").setup()` | tokyonight, catppuccin |
| `load` | `require("module").load()` or `require("module")(opts)` | kanagawa, onedark |
| `colorscheme` | Simple `:colorscheme name` | gruvbox |
| `file` | Complex initialization requiring custom Lua | special cases |

## Files to Update
- theme-browser-registry-ts/overrides.json
- theme-browser-registry-ts/themes/*.lua (for file strategy)

## Output Format
After processing all themes, output:
- Summary of changes made
- List of themes updated
- List of .lua files created
