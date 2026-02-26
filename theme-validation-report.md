# Theme Registry Validation Report

**Generated:** 2026-02-26
**Status:** VERIFICATION COMPLETE
**Total Themes Analyzed:** 79 hint entries (~300+ variants)

---

## Executive Summary

| Issue Type | Count | Status |
|------------|-------|--------|
| Duplicate Repo Entries | 4 | Needs Fix |
| Missing Variants | 1 | Needs Fix |
| Missing README | 1 | Needs Fetch |
| Strategy Mismatches | 35 | Review Required |

---

## Issues Found

### 1. DUPLICATE REPO ENTRIES (CRITICAL - Need Merge)

These repos appear multiple times in hints.json and need to be merged:

| Repo | Entries | Variants |
|------|---------|----------|
| Ferouk/bearded-nvim | 2 | 18 + 63 = 81 total |
| earthbound-themes/vim | 2 | 10 + 11 = 21 total |
| casonadams/walh | 2 | 9 + 8 = 17 total |
| everviolet/nvim | 2 | 5 + 4 = 9 total |

### 2. MISSING VARIANTS

| Repo | Missing Variant | Mode | Evidence |
|------|-----------------|------|----------|
| oonamo/ef-themes.nvim | ef-arbutus | light | README shows under "Light Themes" |

### 3. MISSING README

| Repo | Status |
|------|--------|
| crimson-kat/witchesbrew.vim | README not in cache |

---

## Strategy Verification (Need Manual Review)

The following repos have potential strategy mismatches. This is based on simple README text matching and may be FALSE POSITIVES because many themes support multiple loading methods:

| Repo | Hint Strategy | Detected | Notes |
|------|---------------|----------|-------|
| rktjmp/lush.nvim | setup | colorscheme | Lush is a framework for building themes |
| skylarmb/torchlight.nvim | setup | colorscheme | Check actual module |
| rebelot/kanagawa.nvim | load | setup | Has both setup() and load() |
| sainnhe/everforest | colorscheme | unknown | Vim plugin |
| zenbones-theme/zenbones.nvim | load | colorscheme | Has both methods |
| metalelf0/black-metal-theme-neovim | colorscheme | setup | Check source |
| Iron-E/nvim-highlite | setup | load | Has setup() |
| earthbound-themes/vim | colorscheme | unknown | Vim plugin |
| talha-akram/noctis.nvim | setup | unknown | Check source |
| casonadams/walh | colorscheme | setup | Check source |
| navarasu/onedark.nvim | setup | load | Has setup() |
| ragatol/nvimthemes | colorscheme | unknown | Check source |
| ribru17/bamboo.nvim | setup | load | Has setup() |
| Prince-Ramani/crush.nvim | setup | colorscheme | Check source |
| leeonon/four-symbols.nvim | setup | unknown | Check source |
| nocksock/bloop.nvim | setup | unknown | Check source |
| rockerBOO/boo-colorscheme-nvim | setup | load | Has load() |
| ricardoraposo/nightwolf.nvim | setup | load | Has load() |
| Mizux/vim-colorschemes | colorscheme | unknown | Vim plugins |
| simonvic/minerals.nvim | setup | load | Has setup() |
| arch-err/ibad.nvim | setup | colorscheme | Check source |
| arch-err/venomous.nvim | setup | colorscheme | Check source |
| b0o/lavi | setup | colorscheme | Check source |
| bilbopingouin/vim-syntax-colors | colorscheme | unknown | Vim plugin |
| CosecSecCot/cosec-twilight.nvim | setup | colorscheme | Check source |
| hachy/eva01.vim | colorscheme | load | Vim plugin |
| jaljoue/dracula-alucard.nvim | setup | unknown | Check source |
| lewpoly/sherbet.nvim | setup | colorscheme | Check source |
| LunarVim/onedarker.nvim | setup | colorscheme | Has setup() |
| mikesmithgh/gruvsquirrel.nvim | setup | colorscheme | Check source |
| ptdewey/darkearth-nvim | setup | colorscheme | Check source |
| Woife5/windows.nvim | setup | colorscheme | Check source |
| arsham/arshamiser.nvim | colorscheme | setup | Check source |

**NOTE:** Many themes support multiple loading methods (both `colorscheme X` and `require('X').setup()`). The detection is based on simple text matching and may not reflect the primary/recommended loading method. Manual review needed.

---

## Verified Correct

The following repos have been verified against their README and appear CORRECT:

### ef-themes.nvim
- All 36 variant modes verified against README preview
- ef-arbutus is the only missing variant (light theme)

### neko-night/nvim
- All 25 variants in hints are documented in README (even if not all shown in code samples)
- Modes verified: day=light, all others dark

### zenbones-theme/zenbones.nvim
- All 12 variants have correct modes based on source inspirations
- zenbones, rosebones, vimbones, zenwritten = light; others = dark

### Iron-E/nvim-highlite
- All 19 variants have correct modes
- seoul256-light, papercolor, tomorrow = light; rest = dark

### catppuccin/nvim
- latte = light; frappe/macchiato/mocha = dark ✅

### rose-pine/neovim
- main/moon = dark; dawn = light ✅

### kanagawa.nvim
- wave/dragon = dark; lotus = light ✅

---

## Recommended Actions

### Immediate Fixes Required:

1. **Merge duplicate repo entries:**
   - Combine Ferouk/bearded-nvim (18 + 63 variants)
   - Combine earthbound-themes/vim (10 + 11 variants)
   - Combine casonadams/walh (9 + 8 variants)
   - Combine everviolet/nvim (5 + 4 variants)

2. **Add missing variant:**
   - Add `ef-arbutus: "light"` to oonamo/ef-themes.nvim

3. **Fetch missing README:**
   - Fetch crimson-kat/witchesbrew.vim README manually

### Review Required:

1. Review all 35 strategy mismatches to determine if the current hint is correct
2. Many themes support multiple loading methods - the current hint may be correct even if detection fails

---

## Previous Fixes (Still Valid)

These fixes from the previous report are still valid:

| Theme | Variant | Was | Now | Evidence |
|-------|---------|-----|-----|----------|
| kanagawa | kanagawa-lotus | dark | **light** | README: `background = { light = "lotus" }` |
| astrotheme | astrojupiter | dark | **light** | Palette: pale pink background |
| boo | crimson_moonlight | light | **dark** | Name indicates night |
| nvim-highlite | highlite-tomorrow-night-bright | light | **dark** | "Tomorrow Night" is dark |
| ef-themes | 7 variants | dark | **light** | README lists under Light Themes |
| modus-themes | modus_operandi | missing | **light** | Official light variant |
| modus-themes | modus_vivendi | missing | **dark** | Official dark variant |

(End of report)
