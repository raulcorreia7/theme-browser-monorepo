# Theme Color Verification System

**Status**: Planning
**Created**: 2026-02-26
**Updated**: 2026-02-26

## Summary
Add static color analysis to verify theme light/dark classification, compare with registry hints, and report discrepancies for manual verification.

## Context
- **Why**: Themes like `ashrasmiser_light` are marked as "light" based on name patterns but may actually be dark. Current detection only uses suffix patterns (`-light`, `-dark`), not actual color inspection.
- **Constraints**: Static analysis preferred over runtime; discrepancies require manual verification
- **Architecture**: Extend existing `packages/registry/src/detect/` system
- **Related**: `.opencode/plans/plugin-cleanup-2026-02-26.md`

## Current State

**Existing detection** (`src/detect/variant.ts`):
- Pattern-based: checks name suffixes (`-light`, `-dark`, `-day`, `-night`, etc.)
- Hints override: from `hints.json`
- **Missing**: actual color inspection

**Problem example**:
- `ashrasmiser_light` → detected as "light" (name pattern)
- Actually dark → wrong classification

## Key Files
- `packages/registry/src/detect/variant.ts` — add color analysis
- `packages/registry/src/detect/color.ts` — NEW: static color analysis
- `packages/registry/src/detect/types.ts` — extend types
- `packages/registry/src/detect/index.ts` — integrate verification
- `packages/registry/reports/verification.json` — NEW: discrepancy report

## Tasks

### Phase 1: Static Color Analysis

- [ ] Task 1: Create color analysis module
  - Objective: Parse Lua theme files to extract background color
  - Files: CREATE `packages/registry/src/detect/color.ts`
  - Approach:
    - Parse `colors/*.lua` and `lua/*/init.lua` files
    - Look for `vim.g.terminal_color_0` (black) vs `_15` (white) luminance
    - Look for `Normal` highlight background
    - Calculate relative luminance to determine light vs dark
  - Done when: Function `analyzeThemeColors(fileTree, contentFetcher)` returns `{ mode: "light"|"dark"|"unknown", confidence: number, evidence: string[] }`
  - Commit hint: feat(detect): add static color analysis module

- [ ] Task 2: Extend detection types
  - Objective: Add types for color verification results
  - Files: UPDATE `packages/registry/src/detect/types.ts`
  - Add:
    ```typescript
    interface ColorVerificationResult {
      patternMode?: ThemeMode;      // From name pattern
      actualMode?: ThemeMode;       // From color analysis
      hintMode?: ThemeMode;         // From hints.json
      status: "match" | "discrepancy" | "unknown";
      evidence: string[];
      confidence: number;
    }
    ```
  - Done when: Types compile, existing code unaffected
  - Commit hint: feat(detect): add color verification types

### Phase 2: Integration

- [ ] Task 3: Integrate color analysis into variant detection
  - Objective: Add color verification step to variant detection
  - Files: UPDATE `packages/registry/src/detect/variant.ts`, `index.ts`
  - Flow:
    1. Run pattern-based detection (existing)
    2. Apply hints (existing)
    3. NEW: Run color analysis if repo is cached
    4. NEW: Compare and report discrepancies
  - Done when: Detection results include `colorVerification` field
  - Commit hint: feat(detect): integrate color analysis

- [ ] Task 4: Add verification report output
  - Objective: Generate discrepancy report for manual review
  - Files: UPDATE `packages/registry/src/detect/index.ts`
  - Output: `reports/color-verification.json`
  - Include:
    - Themes with pattern/actual mismatches
    - Themes with hint/actual mismatches
    - High-confidence discrepancies (need manual fix)
    - Unknown cases (need manual inspection)
  - Done when: Report generated with actionable discrepancy list
  - Commit hint: feat(detect): add verification report output

### Phase 3: CLI Command

- [ ] Task 5: Add verify CLI command
  - Objective: Provide dedicated command to run verification
  - Files: UPDATE `packages/registry/src/cmd/commands/`
  - Command: `npx tsx src/cli.ts verify [options]`
  - Options:
    - `--repo <repo>` — verify single repo
    - `--sample <n>` — verify sample of n repos
    - `--use-cache` — use cached repo trees
    - `--download` — download repos if not cached
    - `--output <path>` — output report path
  - Done when: Command runs verification and outputs report
  - Commit hint: feat(cli): add verify command

### Phase 4: Discrepancy Handling

- [ ] Task 6: Add discrepancy resolution workflow
  - Objective: Document how to fix discrepancies
  - Files: UPDATE `packages/registry/README.md` or CREATE `docs/verification.md`
  - Include:
    - How to run verification
    - How to read discrepancy report
    - How to add/fix hints
    - How to update registry entries
  - Done when: Documentation exists for manual verification workflow
  - Commit hint: docs: add discrepancy resolution guide

## Task Summary Table

| # | Task | Component | Depends On |
|---|------|-----------|------------|
| 1 | Create color analysis | detect/color.ts | None |
| 2 | Extend detection types | detect/types.ts | None |
| 3 | Integrate color analysis | detect/variant.ts, index.ts | 1, 2 |
| 4 | Add verification report | detect/index.ts | 3 |
| 5 | Add verify CLI command | cmd/commands/ | 4 |
| 6 | Add resolution docs | docs/ | 5 |

## Technical Approach

### Color Analysis Algorithm

```typescript
// 1. Find theme Lua files
const luaFiles = fileTree.filter(f => 
  f.path.match(/^lua\/.+\/init\.lua$/) ||
  f.path.match(/^colors\/.+\.lua$/)
);

// 2. Parse for color definitions
const patterns = [
  /bg\s*=\s*["']#([0-9a-fA-F]{6})["']/,      // bg = "#ffffff"
  /background\s*=\s*["']#([0-9a-fA-F]{6})["']/,
  /Normal\s*=\s*\{[^}]*bg\s*=\s*["']#([0-9a-fA-F]{6})["']/,
];

// 3. Calculate luminance
function luminance(hex: string): number {
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// 4. Classify
const mode = luminance > 0.5 ? "light" : "dark";
```

### Discrepancy Classification

| Pattern | Actual | Hint | Status | Action |
|---------|--------|------|--------|--------|
| light | light | - | match | None |
| light | dark | - | discrepancy | Fix hint or rename |
| light | light | dark | hint-mismatch | Fix hint |
| unknown | dark | - | detected | Add to hints |
| unknown | unknown | - | unknown | Manual inspection |

## Decisions Log
- 2026-02-26: Static analysis preferred over runtime (user input)
- 2026-02-26: Manual verification for discrepancies, not auto-fix
- 2026-02-26: Run as dedicated task/command, not on every build

## Notes
- Existing detection system is well-structured, easy to extend
- Pattern-based detection has 92% coverage but may be wrong
- Hints already exist as the override mechanism
- This adds verification layer to validate hints and patterns
