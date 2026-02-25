# Theme Registry Validation Agent

## Mission

Validate every theme in the registry for:
1. Loading strategy accuracy
2. Variant mode classification (light/dark) using multi-source analysis

## Context

You are validating a Neovim theme registry. Each theme has:
- A loading strategy (`colorscheme`, `setup`, `load`, or `file`)
- Zero or more variants (color schemes within the theme)
- Each variant should have a `mode` field: `light` or `dark`

The existing heuristics may produce false positives. Your job is to verify ALL variants using multiple sources.

## Input Files

- **Registry:** `theme-browser.nvim/lua/theme-browser/data/registry.json`
- **Hints:** `theme-browser-registry-ts/sources/hints.json`
- **Custom loaders:** `theme-browser-registry-ts/themes/*.lua`
- **Schemas:** `theme-browser-registry-ts/src/types/schemas.ts`

## Output File

- **Report:** `theme-validation-report.md` (create in project root)

---

## Validation Process

### Phase 1: Initialize

1. Read the full `registry.json`
2. Parse into theme entries array
3. Read `hints.json` for known manual classifications
4. Initialize progress tracking

### Phase 2: Per-Theme Validation Loop

Iterate through EACH theme in the registry. Report progress after every 5 themes.

#### 2.1 Loading Strategy Validation

For each theme, verify the strategy is correct:

| Strategy | Expected in Repo |
|----------|------------------|
| `colorscheme` | `colors/` directory with `.vim` or `.lua` files |
| `setup` | `lua/<module>/init.lua` with `setup()` function |
| `load` | `lua/<module>/init.lua` with `load()` function |
| `file` | Custom loader exists in `theme-browser-registry-ts/themes/<name>.lua` |

**Actions:**
1. Construct GitHub URL: `https://github.com/{repo}`
2. Fetch repo structure (use `ddg-search_fetch_content` or `webfetch`)
3. Check for expected files based on strategy type
4. Mark status: `verified`, `needs-review`, or `broken`

#### 2.2 Variant Mode Classification

For EACH variant in `theme.variants`, perform multi-source analysis:

---

**SOURCE 1: README Analysis**

1. Fetch README from `https://github.com/{repo}`
2. Search for:
   - Variant name mentions
   - Mode keywords near variant: "light", "dark", "day", "night", "bright", "dim"
   - Tables/lists describing variants
   - Explicit mode declarations in markdown tables

**README Search Patterns:**
```markdown
- "latte (light theme)"
- "| Variant | Mode |"
- "background = 'light'"
- "for light mode, use..."
```

---

**SOURCE 2: Code Analysis**

1. Browse GitHub repo tree to find theme source files
2. Key locations to check:
   - `lua/<theme>/init.lua` - main setup
   - `lua/<theme>/colors.lua` - color definitions
   - `lua/<theme>/themes/<variant>.lua` - variant-specific
   - `colors/<variant>.vim` - vim colorscheme files

**Code Patterns to Search:**
```lua
-- Pattern 1: Explicit background setting
vim.o.background = "dark"
vim.o.background = "light"

-- Pattern 2: Config/style options
style = "dark"
background = "light"
variant = "dark"

-- Pattern 3: Background color hex values
bg = "#ffffff"    -- high luminance = light
bg = "#282c34"    -- low luminance = dark
background = "#1e1e2e"

-- Pattern 4: Theme variant definitions
local themes = {
  day = { bg = "#ffffff" },    -- light
  night = { bg = "#1a1a1a" },  -- dark
}
```

**Luminance Calculation for Hex Colors:**
- Extract hex background color
- Calculate relative luminance: `0.299*R + 0.587*G + 0.114*B`
- Luminance > 0.5 suggests light theme
- Luminance <= 0.5 suggests dark theme

---

**SOURCE 3: Asset/Screenshot Analysis**

1. Find screenshots in README (image URLs in markdown)
2. Check for variant-specific images:
   - `assets/<variant>.png`
   - `screenshots/<variant>-light.png`
   - Images with variant name in filename
3. Download images using `curl` and analyze with your built-in vision capabilities

**Image Download:**
```bash
# Download image to temp file for analysis
curl -sL "https://raw.githubusercontent.com/{owner}/{repo}/main/assets/{variant}.png" -o /tmp/theme-preview.png
```

**Vision Analysis Prompt (use with downloaded image):**
```
Analyze this Neovim theme screenshot.

Determine if this is a LIGHT or DARK theme based on:
1. Background color brightness (white/cream/pastel = light, black/dark gray = dark)
2. Text contrast (dark text on light bg = light, light text on dark bg = dark)
3. Overall luminance of the screenshot

Output JSON:
{
  "mode": "light" or "dark",
  "confidence": 0.0-1.0,
  "background_color": "hex or description",
  "reasoning": "1-2 sentence explanation"
}
```

**GitHub Image URL Patterns:**
- Raw content: `https://raw.githubusercontent.com/{owner}/{repo}/main/{path}`
- README images: Extract from markdown `![alt](url)` patterns
- Common paths: `assets/`, `screenshots/`, `img/`, `.github/`

---

**CROSS-VALIDATION**

After collecting all available sources:

| Scenario | Confidence | Action |
|----------|------------|--------|
| All 3 sources agree | High (0.9-1.0) | Accept classification |
| 2 of 3 sources agree | Medium (0.7-0.89) | Accept, flag for review |
| Only 1 source available | Low (0.5-0.69) | Accept tentatively, flag |
| Sources conflict | Conflicted | Flag for manual review |
| No sources found | Unknown | Mark as unclassifiable |

**Mismatch Detection:**
- Compare final classification against `variant.mode` in registry
- If different, flag as `MISMATCH` with both values

---

### Phase 3: Generate Report

Create `theme-validation-report.md` with this structure:

```markdown
# Theme Registry Validation Report

**Generated:** [ISO timestamp]
**Agent:** Theme Validation Agent v1.0

## Executive Summary

| Metric | Count | Percentage |
|--------|-------|------------|
| Total Themes | X | 100% |
| Strategies Verified | X | Y% |
| Strategies with Issues | X | Y% |
| Total Variants | X | 100% |
| Variants Classified (High Confidence) | X | Y% |
| Variants Classified (Medium Confidence) | X | Y% |
| Variants Classified (Low Confidence) | X | Y% |
| Variants Unclassifiable | X | Y% |
| Registry Mismatches Found | X | Y% |

## Critical Issues

### Strategy Issues

| Theme | Repo | Strategy | Issue | Recommendation |
|-------|------|----------|-------|----------------|
| ... | ... | ... | ... | ... |

### Registry Mismatches

These variants have a `mode` in the registry that differs from analysis:

| Theme | Variant | Registry Mode | Analysis Mode | Confidence | Sources |
|-------|---------|---------------|---------------|------------|---------|
| kanagawa | kanagawa-lotus | dark | light | 0.92 | README, Code, Screenshot |

## Classification Results by Theme

### [Theme Name]

**Repo:** owner/repo
**Strategy:** setup (verified)
**Stars:** 1234

| Variant | Registry | Analysis | Confidence | README | Code | Screenshot | Notes |
|---------|----------|----------|------------|--------|------|------------|-------|
| variant-1 | light | light | 0.95 | light | light | light | All agree |
| variant-2 | (none) | dark | 0.88 | - | dark | dark | New classification |

#### Source Details

**README Analysis:**
- Found: "variant-1 is a light theme"
- Classification: light (confidence: 0.90)

**Code Analysis:**
- File: `lua/theme/variants/variant-1.lua`
- Found: `bg = "#ffffff"`
- Luminance: 1.0 (light)
- Classification: light (confidence: 0.95)

**Screenshot Analysis:**
- URL: https://github.com/.../variant-1.png
- Vision result: light (confidence: 0.98)
- Background: white (#ffffff)

---

[Repeat for each theme]

## Unclassifiable Variants

| Theme | Variant | Reason | Possible Actions |
|-------|---------|--------|------------------|
| ... | ... | No screenshots, no code refs | Manual inspection needed |

## Recommendations

1. [Actionable recommendation based on findings]
2. [...]

## Appendix: Methodology

- **README analysis:** Text extraction via webfetch, keyword matching for mode indicators
- **Code analysis:** GitHub API/curl to fetch Lua/Vimscript files, parse for background settings
- **Screenshot analysis:** curl download + built-in vision model classification
- **Confidence scoring:** Source agreement calculation (3-way consensus = high, 2/3 = medium, 1/3 = low)
```

---

## Error Handling

1. **Continue on failures:** Never stop the entire loop for one theme
2. **Rate limiting:** Add 1-2 second delays between GitHub API requests
3. **Network errors:** Mark theme as "network-error", continue to next
4. **Missing repos:** Mark as "repo-not-found", continue
5. **Image download failures:** Fall back to text/code analysis only
6. **Vision analysis failures:** Fall back to README/code analysis only
7. **Max retries:** 2 attempts per source before marking unavailable
8. **API rate limits:** If GitHub API returns 403, wait and retry with exponential backoff

---

## Progress Reporting

After every 5 themes, output a brief status:

```
[Progress] Processed 5/150 themes (3.3%)
  - Strategies verified: 5
  - Variants analyzed: 12
  - Mismatches found: 1
  - Issues: 0

[Progress] Processed 10/150 themes (6.7%)
  ...
```

---

## Tools to Use

| Tool | Purpose |
|------|---------|
| `read` | Read registry.json, hints.json, local files |
| `ddg-search_fetch_content` | Fetch GitHub README content |
| `ddg-search_search` | Search for theme info if README unavailable |
| `webfetch` | Fetch GitHub pages, raw file content |
| `bash` (curl) | Download images for vision analysis |
| `bash` (gh) | GitHub CLI for repo structure, file contents |
| Built-in vision | Analyze downloaded screenshots (light/dark classification) |
| `write` | Generate final report |

**GitHub API via curl (unauthenticated, rate limited):**
```bash
# Get repo contents
curl -s "https://api.github.com/repos/{owner}/{repo}/contents/"

# Get specific file
curl -s "https://api.github.com/repos/{owner}/{repo}/contents/lua/theme/init.lua" | jq -r '.content' | base64 -d

# Get directory tree
curl -s "https://api.github.com/repos/{owner}/{repo}/git/trees/main?recursive=1" | jq '.tree[].path'
```

**GitHub CLI (if authenticated, higher rate limits):**
```bash
# List repo structure
gh api repos/{owner}/{repo}/contents

# Get file content
gh api repos/{owner}/{repo}/contents/lua/theme/init.lua --jq '.content' | base64 -d
```

---

## Starting Instructions

1. Read `theme-browser.nvim/lua/theme-browser/data/registry.json`
2. Parse and count total themes and variants
3. Begin iteration from first theme
4. Process each theme completely before moving to next
5. Generate report at end

**Begin now.**
