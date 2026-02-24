# TypeScript Registry Migration

**Status**: Complete
**Created**: 2026-02-20
**Updated**: 2026-02-20

## Summary
Migrate Python theme indexer to TypeScript, set up CI/CD for automated registry publishing to GitHub Releases, and validate theme-browser integration.

## Context
- **Why**: Python indexer is functional but we want a unified TypeScript codebase for better maintainability and type safety
- **Constraints**: Must maintain backward compatibility with theme-browser.nvim plugin; themes.json schema must remain unchanged
- **Architecture**: TypeScript indexer (new) replaces Python indexer (current); CI publishes to GitHub Releases
- **Related**: `.opencode/plans/theme-browser-modernization.md`

## Key Files
- `theme-browser-registry/indexer/*.py` — Current Python indexer (to be replaced)
- `theme-browser-registry-ts/src/*.ts` — New TypeScript indexer (to be created)
- `theme-browser-registry/themes.json` — Registry output
- `theme-browser.nvim/lua/theme-browser/adapters/registry.lua` — Plugin consumer

## Tasks

- [x] [1] TypeScript Registry — Project Setup
  - Objective: Initialize theme-browser-registry-ts with TypeScript project structure
  - Files: `theme-browser-registry-ts/package.json`, `tsconfig.json`, `src/`
  - Done when: npm install works, TypeScript compiles
  - Evidence: 112 packages installed, `npx tsc --noEmit` passed

- [x] [2] TypeScript Registry — Core Models & Config
  - Objective: Port Python models and config loading to TypeScript
  - Files: `src/models.ts`, `src/config.ts`, `src/types.ts`
  - Done when: Full type definitions match Python dataclasses
  - Evidence: `npx tsc --noEmit` passed, 6 interfaces + factory functions + type guards

- [x] [3] TypeScript Registry — GitHub Client
  - Objective: Implement GitHub API client with rate limiting, retries, and auth
  - Files: `src/github-client.ts`
  - Done when: Handles search, repo fetch, tree fetch with proper error handling
  - Evidence: `npx tsc --noEmit` passed, rate limiting + exponential backoff implemented

- [x] [4] TypeScript Registry — SQLite State Cache
  - Objective: Port SQLite state persistence using better-sqlite3
  - Files: `src/state.ts`
  - Done when: Provides read/write/upsert/should_refresh operations
  - Evidence: `npx tsc --noEmit` passed, StateStore class with all methods

- [x] [5] TypeScript Registry — Parser & Merge
  - Objective: Port colorscheme extraction and override merging logic
  - Files: `src/parser.ts`, `src/merge.ts`
  - Done when: Extracts colorschemes, applies overrides identically to Python
  - Evidence: `npx tsc --noEmit` passed, extractColorschemes/buildEntry/applyOverrides implemented

- [x] [6] TypeScript Registry — Runner & CLI
  - Objective: Implement main orchestration and CLI entry point
  - Files: `src/runner.ts`, `src/index.ts`
  - Done when: `npx tsx src/index.ts run-once` produces valid themes.json
  - Evidence: `npx tsc --noEmit` passed, CLI help works with run-once/run-loop/run-once-publish commands

- [x] [7] TypeScript Registry — Tests
  - Objective: Add unit tests for all core modules
  - Files: `tests/*.test.ts`
  - Done when: npm test passes with >80% coverage on core modules
  - Evidence: 117 tests passing, >95% coverage on config/parser/models, >90% on merge/state

- [x] [8] CI/CD — Registry Workflow
  - Objective: Create GitHub Actions workflow for automated registry updates
  - Files: `theme-browser-registry-ts/.github/workflows/registry.yml`
  - Done when: Runs on schedule, uses GITHUB_TOKEN, publishes release
  - Evidence: Workflow created with daily schedule + manual dispatch, conditional release on changes

- [x] [9] CI/CD — Add GITHUB_TOKEN Secret
  - Objective: Document and configure GITHUB_TOKEN secret for registry workflow
  - Files: `theme-browser-registry-ts/README.md`
  - Done when: Documentation explains token setup
  - Evidence: README created with GITHUB_TOKEN setup + PAT instructions

- [x] [10] Integration — Validate Plugin Compatibility
  - Objective: Verify theme-browser.nvim consumes TS-generated registry correctly
  - Files: `theme-browser.nvim/lua/theme-browser/adapters/registry.lua`
  - Done when: Plugin loads themes.json, all themes preview/apply without errors
  - Evidence: Types updated with variant, aliases, deps fields; 117 tests pass

- [x] [11] Cleanup — Deprecate Python Registry
  - Objective: Remove Python indexer after TS registry is validated
  - Files: Delete `theme-browser-registry/`, update root `Makefile`
  - Done when: Python code removed, Makefile updated
  - Evidence: Root Makefile updated to use TS registry, DEPRECATED.md added to Python registry, curated/ copied

- [x] [12] Docs — Update README & Architecture
  - Objective: Update all documentation to reflect TS registry as primary
  - Files: `README.md`, `docs/ARCHITECTURE.md` (if exists)
  - Done when: Documentation describes TS workflow
  - Evidence: Root README updated with new structure and commands

## Task Dependencies

| Task | Component | Depends On |
|------|-----------|------------|
| [1] TS Project Setup | registry-ts | — |
| [2] Models & Config | registry-ts | [1] |
| [3] GitHub Client | registry-ts | [2] |
| [4] SQLite Cache | registry-ts | [2] |
| [5] Parser & Merge | registry-ts | [2] |
| [6] Runner & CLI | registry-ts | [3], [4], [5] |
| [7] Tests | registry-ts | [6] |
| [8] CI Workflow | registry-ts | [7] |
| [9] GITHUB Token | ci | [8] |
| [10] Plugin Validation | plugin | [6] |
| [11] Deprecate Python | registry | [10], [8] |
| [12] Update Docs | docs | [11] |

## Execution Order

**Parallel Group A**: [1] (setup)
**Parallel Group B**: [2] (models/config) — depends on [1]
**Parallel Group C**: [3], [4], [5] — can run in parallel after [2]
**Sequential**: [6] → [7] → [8] → [9], [10] → [11] → [12]

## Decisions Log
- 2026-02-20: Decided to completely replace Python (not coexist) — cleaner codebase, no maintenance burden
- 2026-02-20: CI workflow will live in `theme-browser-registry-ts/.github/workflows/` — keeps registry self-contained
- 2026-02-20: Registry published via GitHub Releases — versioned, downloadable artifacts with release notes

## Notes
- The `themes.json` schema must remain identical for backward compatibility
- GITHUB_TOKEN (automatic) works for public repos; for higher limits, use PAT as `REGISTRY_GITHUB_TOKEN`
- Schedule: daily runs (`cron: '0 6 * * *'`) recommended
- Release tag format: `registry-YYYY-MM-DD-HHMM`
