# Theme Browser Registry Modernization Plan

## Overview
Modernize the theme-browser monorepo by:
1. Converting Python indexer to TypeScript
2. Adding top 100 themes from vimcolorschemes.com with proper adapter metadata
3. Reverse-engineering leetcode.nvim's picker UI for theme browsing

---

## Phase 1: TypeScript Indexer (Foundation)

### 1.1 Project Setup
**Location**: `theme-browser-registry-ts/`

**Files to Create**:
- `package.json` - Dependencies (better-sqlite3, commander, pino, simple-git)
- `tsconfig.json` - TypeScript configuration
- `src/models.ts` - Core data interfaces
- `src/config.ts` - Configuration loading/validation
- `src/logger.ts` - Pino logging setup
- `src/github-client.ts` - GitHub API client with rate limiting
- `src/state.ts` - SQLite cache layer
- `src/parser.ts` - Colorscheme name normalization & extraction
- `src/merge.ts` - Override merging logic
- `src/runner.ts` - Main orchestration
- `src/index.ts` - CLI entry point

### 1.2 Key Design Decisions

**Database**: Use `better-sqlite3` (synchronous API, simpler than async)

**Rate Limiting**:
- Configurable delay between requests (default 250ms)
- Exponential backoff on rate limit (2^attempt seconds, max 60s)
- Honor `Retry-After` and `X-RateLimit-Reset` headers

**Error Handling**:
- Continue on individual repo failures (don't stop batch)
- Log errors to SQLite with `parse_error` field
- Retry mechanism for transient failures

---

## Phase 2: Top 100 Themes Registry

### 2.1 Themes to Add (from vimcolorschemes.com/i/top pages 1-5)

**Page 1**:
1. gruvbox (morhetz/gruvbox) - 15,165 stars
2. tokyonight (folke/tokyonight.nvim) - 7,791 stars
3. catppuccin (catppuccin/nvim) - 7,183 stars
4. solarized (altercation/vim-colors-solarized) - 6,621 stars
5. kanagawa (rebelot/kanagawa.nvim) - 5,888 stars
6. onedark (joshdick/onedark.vim) - 3,993 stars
7. nightfox (EdenEast/nightfox.nvim) - 3,891 stars
8. everforest (sainnhe/everforest) - 3,850 stars
9. molokai (tomasr/molokai) - 3,631 stars
10. rose-pine (rose-pine/neovim) - 2,933 stars
11. papercolor (NLKNguyen/papercolor-theme) - 2,829 stars
12. nord (nordtheme/vim) - 2,581 stars
13. gruvbox-material (sainnhe/gruvbox-material) - 2,480 stars
14. gruvbox.nvim (ellisonleao/gruvbox.nvim) - 2,456 stars
15. github-nvim-theme (projekt0n/github-nvim-theme) - 2,417 stars
16. iceberg (cocopon/iceberg.vim) - 2,357 stars
17. vim-one (rakr/vim-one) - 2,018 stars
18. onedark.nvim (navarasu/onedark.nvim) - 1,921 stars
19. sonokai (sainnhe/sonokai) - 1,913 stars
20. vim-colorschemes (flazz/vim-colorschemes) - 3,467 stars

**Page 2**:
21. jellybeans (nanotech/jellybeans.vim) - 1,855 stars
22. ayu (ayu-theme/ayu-vim) - 1,762 stars
23. seoul256 (junegunn/seoul256.vim) - 1,724 stars
24. oxocarbon (nyoom-engineering/oxocarbon.nvim) - 1,522 stars
25. hybrid (w0ng/vim-hybrid) - 1,497 stars
26. monokai (ku1ik/vim-monokai) - 1,466 stars
27. dracula (dracula/vim) - 1,376 stars
28. badwolf (sjl/badwolf) - 1,275 stars
29. cyberdream (scottmckendry/cyberdream.nvim) - 1,249 stars
30. moonfly (bluz71/vim-moonfly-colors) - 1,242 stars
31. tender (jacoborus/tender.vim) - 1,231 stars
32. oceanic-next (mhartington/oceanic-next) - 1,173 stars
33. material.nvim (marko-cerovac/material.nvim) - 1,075 stars
34. zenbones (zenbones-theme/zenbones.nvim) - 1,062 stars
35. onedarkpro (olimorris/onedarkpro.nvim) - 1,023 stars
36. vim-code-dark (tomasiser/vim-code-dark) - 999 stars
37. edge (sainnhe/edge) - 992 stars
38. nordic (AlexvZyl/nordic.nvim) - 987 stars
39. vague (vague-theme/vague.nvim) - 976 stars
40. nord.nvim (shaunsingh/nord.nvim) - 974 stars

**Page 3**:
41. solarized-osaka (craftzdog/solarized-osaka.nvim) - 942 stars
42. vscode (Mofiqul/vscode.nvim) - 940 stars
43. melange (savq/melange-nvim) - 924 stars
44. nightfly (bluz71/vim-nightfly-colors) - 921 stars
45. zenburn (jnurmine/Zenburn) - 917 stars
46. apprentice (romainl/Apprentice) - 916 stars
47. srcery (srcery-colors/srcery-vim) - 882 stars
48. spaceduck (pineapplegiant/spaceduck) - 849 stars
49. lucario (raphamorim/lucario) - 830 stars
50. falcon (fenetikm/falcon) - 823 stars
51. dracula.nvim (Mofiqul/dracula.nvim) - 757 stars
52. colorbuddy (tjdevries/colorbuddy.nvim) - 756 stars
53. embark (embark-theme/vim) - 717 stars
54. monokai-pro (loctvl842/monokai-pro.nvim) - 664 stars
55. vim-dogrun (wadackel/vim-dogrun) - 660 stars
56. palenight (drewtempelmeyer/palenight.vim) - 659 stars
57. vim-colors-xcode (lunacookies/vim-colors-xcode) - 645 stars
58. onenord (rmehri01/onenord.nvim) - 622 stars
59. space-vim-dark (liuchengxu/space-vim-dark) - 615 stars
60. rainglow (rainglow/vim) - 476 stars

**Page 4**:
61. material.vim (kaicataldo/material.vim) - 613 stars
62. base16-nvim (RRethy/base16-nvim) - 612 stars
63. tokyodark (tiagovla/tokyodark.nvim) - 592 stars
64. tokyonight-vim (ghifarit53/tokyonight-vim) - 589 stars
65. evergarden (everviolet/nvim) - 575 stars
66. neovim-ayu (Shatur/neovim-ayu) - 549 stars
67. vim-hybrid-material (kristijanhusak/vim-hybrid-material) - 543 stars
68. vim-gruvbox8 (lifepillar/vim-gruvbox8) - 538 stars
69. spacecamp (jaredgorski/SpaceCamp) - 526 stars
70. lackluster (slugbyte/lackluster.nvim) - 525 stars
71. rigel (Rigellute/rigel) - 517 stars
72. night-owl (haishanh/night-owl.vim) - 510 stars
73. poimandres (olivercederborg/poimandres.nvim) - 492 stars
74. miasma (xero/miasma.nvim) - 485 stars
75. alduin (AlessandroYorba/Alduin) - 484 stars
76. vim-monokai (crusoexia/vim-monokai) - 473 stars
77. kanso (webhooked/kanso.nvim) - 471 stars
78. gruvbox-baby (luisiacc/gruvbox-baby) - 447 stars
79. bamboo (ribru17/bamboo.nvim) - 439 stars
80. catppuccin-vim (catppuccin/vim) - 345 stars

**Page 5**:
81. mellifluous (ramojus/mellifluous.nvim) - 438 stars
82. bluloco (uloco/bluloco.nvim) - 422 stars
83. vim-lucius (jonathanfilip/vim-lucius) - 417 stars
84. neodark (KeitaNakamura/neodark.vim) - 410 stars
85. vim-atom-dark (gosukiwi/vim-atom-dark) - 409 stars
86. mellow (mellow-theme/mellow.nvim) - 403 stars
87. modus-themes (miikanissi/modus-themes.nvim) - 399 stars
88. vim-monokai-tasty (patstockwell/vim-monokai-tasty) - 394 stars
89. darcula (doums/darcula) - 385 stars
90. monokai.nvim (tanvirtin/monokai.nvim) - 384 stars
91. zephyr (nvimdev/zephyr-nvim) - 376 stars
92. vim-colors-github (cormacrelf/vim-colors-github) - 376 stars
93. aurora (ray-x/aurora) - 370 stars
94. vim-material (hzchirs/vim-material) - 369 stars
95. vim-afterglow (danilo-augusto/vim-afterglow) - 364 stars
96. kanagawa-paper (thesimonho/kanagawa-paper.nvim) - 354 stars
97. vim-snazzy (connorholyday/vim-snazzy) - 342 stars
98. nofrils (robertmeta/nofrils) - 332 stars
99. everblush (Everblush/everblush.vim) - 324 stars
100. challenger-deep (challenger-deep-theme/vim) - 629 stars

### 2.2 Adapter Strategy Research Required

For each theme, research:
1. **Strategy**: How to load the colorscheme
   - `colorscheme_only` - Simple `:colorscheme name`
   - `setup_colorscheme` - `require('module').setup(opts)` then `:colorscheme`
   - `setup_load` - `require('module').load()` or custom method
   - `vimg_colorscheme` - Set vim.g vars before `:colorscheme`

2. **Variants**: Different styles (dark/light, soft/medium/hard, etc.)

3. **Metadata**:
   - `module`: Lua module name for setup()
   - `opts`: Default options for setup()
   - `background`: dark/light preference
   - `priority`: Load order hint

### 2.3 Example Theme Entries

```json
{
  "name": "tokyonight",
  "repo": "folke/tokyonight.nvim",
  "colorscheme": "tokyonight",
  "description": "A clean, dark Neovim theme",
  "stars": 7791,
  "topics": ["neovim", "colorscheme"],
  "variants": [
    {
      "name": "tokyonight-night",
      "colorscheme": "tokyonight-night",
      "meta": {
        "strategy": "setup_colorscheme",
        "module": "tokyonight",
        "opts": { "style": "night" },
        "background": "dark"
      }
    },
    {
      "name": "tokyonight-storm",
      "colorscheme": "tokyonight-storm",
      "meta": {
        "strategy": "setup_colorscheme",
        "module": "tokyonight",
        "opts": { "style": "storm" },
        "background": "dark"
      }
    }
  ],
  "meta": {
    "strategy": "setup_colorscheme",
    "module": "tokyonight",
    "opts": {},
    "background": "dark"
  }
}
```

---

## Phase 3: UI Refactor (leetcode.nvim Pattern)

### 3.1 Provider Interface

```lua
---@class ThemePickerProvider
---@field name string
---@field is_available fun(): boolean
---@field pick fun(opts: PickerOptions): ThemeEntry
```

### 3.2 Display Columns (per leetcode.nvim style)

1. **Status Icon**: Installation state (installed/downloaded/available)
2. **Background**: Dark/light indicator
3. **Theme Name**: Primary display name
4. **Variant**: Specific variant if applicable
5. **Stars**: GitHub star count (formatted)
6. **Description**: Brief description truncated

### 3.3 Filter System

- **Background**: dark/light/all
- **Status**: installed/downloaded/available
- **Search**: Fuzzy match on name, description, tags
- **Sort**: stars (default), name, recently updated

### 3.4 Supported Backends (Priority Order)

1. **telescope.nvim** - Most popular
2. **fzf-lua** - Very fast, popular alternative
3. **snacks.nvim** (picker) - New, growing fast
4. **mini.pick** - Part of mini.nvim ecosystem
5. **nui.nvim** (current) - Fallback when no picker available

### 3.5 Entry Display Format

```lua
-- Example entry structure
{
  value = theme_entry,
  display = function()
    return displayer({
      { "●", "ThemeBrowserInstalled" },  -- Status
      { "◐", "ThemeBrowserDark" },       -- Background
      "tokyonight",                       -- Name
      "storm",                            -- Variant
      "(7.8k)",                           -- Stars
      "A clean dark theme",               -- Description
    })
  end,
  ordinal = "tokyonight storm"
}
```

---

## Phase 4: Implementation Order

### Sprint 1: TypeScript Indexer Core
1. Set up TypeScript project structure
2. Implement models & config
3. Implement GitHub API client
4. Implement SQLite state cache
5. Implement colorscheme parser
6. Implement merge logic
7. Implement runner orchestration
8. Add CLI entry point

### Sprint 2: Top 100 Themes
1. Research each theme's loading strategy
2. Create comprehensive entries in overrides.json
3. Run indexer to generate themes.json
4. Validate all entries load correctly

### Sprint 3: UI Refactor
1. Create provider interface
2. Implement telescope provider
3. Implement fzf-lua provider
4. Create unified picker API
5. Add configuration for provider selection
6. Deprecate old gallery (or keep as fallback)

---

## Acceptance Criteria

### TypeScript Indexer
- [ ] Feature parity with Python indexer
- [ ] All existing themes load correctly
- [ ] Rate limiting respects GitHub API limits
- [ ] SQLite cache improves incremental runs
- [ ] CLI commands work: run-once, run-loop, run-once-publish

### Top 100 Themes
- [ ] All 100 themes have entries in registry
- [ ] Each theme has correct adapter metadata
- [ ] Variants are properly specified
- [ ] Manual testing confirms themes load

### UI Refactor
- [ ] telescope provider works
- [ ] fzf-lua provider works
- [ ] Entry display matches leetcode.nvim pattern
- [ ] Filters work (background, status, search)
- [ ] Configuration allows provider selection

---

## Migration Notes

### Breaking Changes
- New `themes.json` format with expanded metadata
- New UI picker replaces gallery (configurable fallback)
- TypeScript indexer requires Node.js >= 20

### Backward Compatibility
- Old Python indexer can still be used (deprecated)
- Old gallery UI remains available via config
- themes.json schema is extended, not changed

---

## Questions Resolved

**User asked:**
1. Add top 100 themes (5 pages) from vimcolorschemes.com ✅
2. Telescope + fzf-lua for UI ✅
3. Manual research for adapter metadata ✅

**User also said:** Convert Python code to TypeScript ✅

This plan addresses all requirements.
