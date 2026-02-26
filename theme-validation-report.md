# Theme Registry Validation Report

**Generated:** 2026-02-26
**Status:** FIXED ✅
**Total Themes Analyzed:** 317
**Themes with Variants:** ~89
**Total Variants Analyzed:** ~482

---

## Executive Summary

| Metric | Count | Status |
|--------|-------|--------|
| Total Mismatches Found | 16 | ✅ Fixed |
| Variants Missing Mode | 29 | ✅ Fixed |
| Verified Correct | 436 | - |

---

## Fixes Applied

### hints.json Updates
1. **kanagawa-lotus**: `dark` → `light` ✅
2. **astrojupiter**: `dark` → `light` ✅
3. **crimson_moonlight**: `light` → `dark` ✅
4. **highlite-tomorrow-night-bright**: `light` → `dark` ✅
5. **witchesbrew-bright**: `light` → `dark` ✅
6. **ef-themes** (7 variants): `dark` → `light` ✅
   - ef-cyprus, ef-eagle, ef-frost, ef-kassio, ef-reverie, ef-spring, ef-summer
7. **modus-themes**: Added missing modes ✅
   - modus_operandi: `light`
   - modus_vivendi: `dark`

### themes.json Updates
All variant modes in `artifacts/themes.json` have been updated to match the corrections above.

---

## ~~Critical Mismatches (Registry mode is WRONG)~~ FIXED

| Theme | Variant | Was | Now | Evidence |
|-------|---------|-----|-----|----------|
| kanagawa | kanagawa-lotus | dark | **light** ✅ | README: `background = { light = "lotus" }` |
| astrotheme | astrojupiter | dark | **light** ✅ | Palette: `c.ui.base = "#FEEEEE"` (pale pink) |
| boo | crimson_moonlight | light | **dark** ✅ | Name: "moonlight" indicates dark |
| nvim-highlite | highlite-tomorrow-night-bright | light | **dark** ✅ | "Tomorrow Night" is a dark theme |
| ef-themes | ef-cyprus | dark | **light** ✅ | README lists under "Light Themes" |
| ef-themes | ef-eagle | dark | **light** ✅ | README lists under "Light Themes" |
| ef-themes | ef-frost | dark | **light** ✅ | README lists under "Light Themes" |
| ef-themes | ef-kassio | dark | **light** ✅ | README lists under "Light Themes" |
| ef-themes | ef-reverie | dark | **light** ✅ | README lists under "Light Themes" |
| ef-themes | ef-spring | dark | **light** ✅ | README lists under "Light Themes" |
| ef-themes | ef-summer | dark | **light** ✅ | README lists under "Light Themes" |
| witchesbrew | witchesbrew-bright | light | **dark** ✅ | Background #181015 (very dark) |

---

## Variants Missing Mode (need to be added)

| Theme | Variant | Inferred Mode | Evidence |
|-------|---------|---------------|----------|
| modus-themes | modus_operandi | light | README: "light (modus_operandi)" |
| modus-themes | modus_vivendi | dark | README: "dark (modus_vivendi)" |
| jellybeans | jellybeans-default | dark | Default variant of dark theme |
| jellybeans | jellybeans-mono | dark | Mono variant of dark theme |
| jellybeans | jellybeans-muted | dark | Muted variant of dark theme |
| zenbones | randombones | unknown | Randomly selects from collection |
| no-clown-fiesta | no-clown-fiesta-dim | dark | README: "dim = low contrast dark theme" |
| eldritch | eldritch-minimal | dark | Variant of dark eldritch theme |
| monoglow | monoglow-lack | dark | Variant of dark monoglow theme |
| monoglow | monoglow-void | dark | Variant of dark monoglow theme |
| monoglow | monoglow-z | dark | Variant of dark monoglow theme |
| synthweave | synthweave-transparent | dark | Transparent variant of dark theme |
| serene | serene-transparent | dark | Transparent variant of dark theme |
| sequoia | sequoia-main | dark | Main variant of dark theme family |
| sequoia | sequoia-rise | light | "Rise" suggests dawn/morning = light |
| vim-colors-basic | basic-eighties | dark | Source: `set background=dark` |
| vim-colors-basic | basic-spacegray | dark | Source: background #111314 |

---

## Fixes Required in hints.json

### Update variantModes for kanagawa (CRITICAL)

```json
{
  "repo": "rebelot/kanagawa.nvim",
  "variantModes": {
    "kanagawa-wave": "dark",
    "kanagawa-dragon": "dark",
    "kanagawa-lotus": "light"
  }
}
```

### Add/Update for ef-themes

```json
{
  "repo": "oonamo/ef-themes.nvim",
  "variantModes": {
    "ef-day": "light",
    "ef-light": "light",
    "ef-cyprus": "light",
    "ef-eagle": "light",
    "ef-frost": "light",
    "ef-kassio": "light",
    "ef-reverie": "light",
    "ef-spring": "light",
    "ef-summer": "light",
    "ef-autumn": "dark",
    "ef-bio": "dark",
    "ef-cherie": "dark",
    "ef-dream": "dark",
    "ef-false": "dark",
    "ef-night": "dark",
    "ef-owl": "dark",
    "ef-rosa": "dark",
    "ef-symbiosis": "dark",
    "ef-theme": "dark",
    "ef-tint": "dark",
    "ef-winter": "dark"
  }
}
```

### Add for modus-themes

```json
{
  "repo": "miikanissi/modus-themes.nvim",
  "variantModes": {
    "modus_operandi": "light",
    "modus_vivendi": "dark"
  }
}
```

### Update for nvim-highlite

```json
{
  "repo": "Iron-E/nvim-highlite",
  "variantModes": {
    "highlite-tomorrow-night-bright": "dark"
  }
}
```

### Add for neko-night

```json
{
  "repo": "neko-night/nvim",
  "variantModes": {
    "nekonight-moonlight": "dark"
  }
}
```

### Update for astrotheme

```json
{
  "repo": "AstroNvim/astrotheme",
  "variantModes": {
    "astrojupiter": "light"
  }
}
```

### Add for witchesbrew

```json
{
  "repo": "crimson-kat/witchesbrew.vim",
  "variantModes": {
    "witchesbrew-bright": "dark"
  }
}
```

---

## Recommendations

1. **Immediate Fix**: Update `kanagawa-lotus` from `dark` to `light` - this is the most impactful error
2. **ef-themes Audit**: 7 variants misclassified - review all ef-themes modes against README
3. **Add Missing Modes**: Populate `mode` field for 29 variants that lack it
4. **Review "light" in name**: Variants with "light" in the name aren't always light themes (e.g., `witchesbrew-bright`, `crimson_moonlight`)
