# Plugin Cleanup and Polish

**Status**: Complete
**Created**: 2026-02-26
**Updated**: 2026-02-26

## Summary
Clean up theme-browser plugin by removing dead code (gallery, telescope/fzf), deduplicating shared utilities, and fixing minor issues.

## Context
- **Why**: Codebase has ~500 lines of dead gallery code, duplicate picker implementations, and duplicated utility functions
- **Constraints**: Maintain backward compatibility for public API; all tests must pass
- **Architecture**: Single native NUI-based picker; remove telescope/fzf dependencies
- **Related**: None

## Key Files
- `packages/plugin/lua/theme-browser/picker/init.lua` — Simplify to native-only picker
- `packages/plugin/lua/theme-browser/ui/gallery.lua` — DELETE (dead code)
- `packages/plugin/lua/theme-browser/ui/gallery/*.lua` — DELETE (dead code)
- `packages/plugin/lua/theme-browser/picker/native.lua` — Primary picker (keep)
- `packages/plugin/tests/ui/gallery_*.lua` — DELETE (tests for dead code)
- `packages/plugin/tests/integration/workflow_spec.lua` — Update to use native picker

## Tasks

### Phase 1: Remove Dead Gallery Code (6 files + 4 tests)

- [x] Task 1: Delete ui/gallery.lua and ui/gallery/ directory ✅
  - Objective: Remove dead gallery implementation never used in production
  - Files: 
    - DELETE: `packages/plugin/lua/theme-browser/ui/gallery.lua`
    - DELETE: `packages/plugin/lua/theme-browser/ui/gallery/actions.lua`
    - DELETE: `packages/plugin/lua/theme-browser/ui/gallery/keymaps.lua`
    - DELETE: `packages/plugin/lua/theme-browser/ui/gallery/model.lua`
    - DELETE: `packages/plugin/lua/theme-browser/ui/gallery/renderer.lua`
    - DELETE: `packages/plugin/lua/theme-browser/ui/gallery/state.lua`
  - Done when: Files deleted, no import errors
  - Commit hint: refactor(ui): remove unused gallery implementation

- [x] Task 2: Delete gallery tests ✅
  - Objective: Remove tests for deleted gallery code
  - Files:
    - DELETE: `packages/plugin/tests/ui/gallery_focus_spec.lua`
    - DELETE: `packages/plugin/tests/ui/gallery_preview_on_move_spec.lua`
    - DELETE: `packages/plugin/tests/ui/gallery_search_spec.lua`
    - DELETE: `packages/plugin/tests/ui/gallery_selection_spec.lua`
  - Done when: Files deleted, remaining tests pass
  - Commit hint: test(ui): remove unused gallery tests

- [x] Task 3: Update workflow_spec.lua to use native picker ✅
  - Objective: Fix integration test to mock native picker instead of gallery
  - Files: `packages/plugin/tests/integration/workflow_spec.lua`
  - Done when: Test passes with native picker mock
  - Commit hint: test(integration): update to use native picker

### Phase 2: Remove Telescope/FZF Pickers (keep native only)

- [x] Task 4: Simplify picker/init.lua to native-only ✅
  - Objective: Remove telescope and fzf-lua picker code, keep only native
  - Files: `packages/plugin/lua/theme-browser/picker/init.lua`
  - Done when: Only native picker remains, `pick()` calls native directly
  - Commit hint: refactor(picker): remove telescope/fzf, keep native only

### Phase 3: Remove Other Dead Code

- [x] Task 5: Remove dead code in preview/manager.lua ✅
  - Objective: Delete unused `register_applied_preview()` and `track_runtimepath()` functions
  - Files: `packages/plugin/lua/theme-browser/preview/manager.lua`
  - Done when: Functions removed, grep confirms no references
  - Commit hint: refactor(preview): remove unused functions

- [x] Task 6: Remove dead code in config/options.lua ✅
  - Objective: Delete unused `get_expected_type()` function
  - Files: `packages/plugin/lua/theme-browser/config/options.lua`
  - Done when: Function removed, tests pass
  - Commit hint: refactor(config): remove unused get_expected_type

- [x] Task 7: Remove dead code in persistence/state.lua ⚠️ SKIPPED
  - Objective: Delete unused `cancel_pending_saves()` function
  - Files: `packages/plugin/lua/theme-browser/persistence/state.lua`
  - Done when: Function removed, state persistence still works
  - Commit hint: refactor(state): remove unused cancel_pending_saves
  - Note: Function is actually used in cleanup() - not dead code

- [x] Task 8: Fix dead code path in downloader/github.lua ✅
  - Objective: Remove useless `use_credentials` branch that produces identical URLs
  - Files: `packages/plugin/lua/theme-browser/downloader/github.lua`
  - Done when: Clone URL construction simplified
  - Commit hint: fix(downloader): remove redundant credentials branch

- [x] Task 9: Remove unused opts parameters ✅
  - Objective: Clean up discarded `opts` in factory.lua and runtime/loader.lua
  - Files: 
    - `packages/plugin/lua/theme-browser/adapters/factory.lua`
    - `packages/plugin/lua/theme-browser/runtime/loader.lua`
  - Done when: No `local _ = opts` patterns remain
  - Commit hint: refactor: remove unused opts parameters

### Phase 4: Deduplicate Shared Code

- [x] Task 10: Extract shared icon utilities ✅
  - Objective: Consolidate `has_nerd_font()` and icon definitions into single `util/icons.lua` module
  - Files:
    - CREATE: `packages/plugin/lua/theme-browser/util/icons.lua`
    - UPDATE: `packages/plugin/lua/theme-browser/ui/state_labels.lua`
    - UPDATE: `packages/plugin/lua/theme-browser/persistence/state.lua`
  - Dependencies: Task 1 (gallery deleted)
  - Done when: Single `has_nerd_font()` function used by all consumers
  - Commit hint: refactor(util): extract icon utilities to shared module

- [x] Task 11: Extract shared entry formatting utilities ✅
  - Objective: Consolidate `entry_background()` and `entry_status()` into `ui/entry.lua`
  - Files:
    - CREATE: `packages/plugin/lua/theme-browser/ui/entry.lua`
    - UPDATE: `packages/plugin/lua/theme-browser/picker/native.lua`
  - Done when: `picker/native.lua` imports from shared `ui/entry.lua`
  - Commit hint: refactor(ui): extract entry formatting to shared module

- [x] Task 12: Consolidate notification modules ✅
  - Objective: Merge `util/log.lua` and `util/notify.lua` into single `util/notify.lua` with opt-in throttling
  - Files:
    - DELETE: `packages/plugin/lua/theme-browser/util/log.lua`
    - UPDATE: `packages/plugin/lua/theme-browser/util/notify.lua`
    - UPDATE: All files importing `util/log`
  - Done when: Single module with all notification functions
  - Commit hint: refactor(util): consolidate notification modules

### Phase 5: Minor Fixes

- [x] Task 13: Simplify adapters/plugins.lua ✅
  - Objective: Document the single everforest handler pattern; consider inlining
  - Files: `packages/plugin/lua/theme-browser/adapters/plugins.lua`
  - Done when: Code is clearer, pattern documented
  - Commit hint: refactor(adapters): simplify plugins adapter

### Phase 6: Add Missing Tests

- [x] Task 14: Add tests for validation/soak.lua ✅
  - Objective: Add unit tests for `run()` function main paths
  - Files: CREATE: `packages/plugin/tests/validation/soak_spec.lua`
  - Done when: Coverage for success, failure, and checkpoint paths
  - Commit hint: test(validation): add soak test coverage

- [x] Task 15: Add tests for registry/sync.lua async paths ✅
  - Objective: Add tests for `fetch_url_async` success/failure scenarios
  - Files: UPDATE: `packages/plugin/tests/config/registry_spec.lua` or CREATE: `packages/plugin/tests/registry/sync_spec.lua`
  - Done when: Async download and manifest checking tested
  - Commit hint: test(registry): add sync async path coverage

## Task Summary Table

| # | Task | Component | Depends On |
|---|------|-----------|------------|
| 1 | Delete gallery files | ui/gallery | None |
| 2 | Delete gallery tests | tests/ui | None |
| 3 | Update workflow test | tests/integration | None |
| 4 | Simplify picker | picker | 1, 2, 3 |
| 5 | Remove preview dead code | preview | None |
| 6 | Remove options dead code | config | None |
| 7 | Remove state dead code | persistence | None |
| 8 | Fix github.lua | downloader | None |
| 9 | Remove unused opts | adapters, runtime | None |
| 10 | Extract icons util | util | 1 |
| 11 | Extract entry util | ui | None |
| 12 | Consolidate notify | util | None |
| 13 | Simplify plugins adapter | adapters | None |
| 14 | Add soak tests | tests/validation | None |
| 15 | Add sync tests | tests/registry | None |

## Parallel Execution Groups

**Group A (can run in parallel):** 1, 2, 3, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15
**Group B (after Group A):** 4, 10

## Decisions Log
- 2026-02-26: Decided to delete gallery code rather than consolidate (500+ lines dead code)
- 2026-02-26: Decided to remove telescope/fzf pickers, keep native NUI only (simplifies maintenance)
- 2026-02-26: Decided to consolidate log.lua into notify.lua (single notification module)
- 2026-02-26: Task 7 skipped - `cancel_pending_saves()` is actually used in `cleanup()` on VimLeavePre

## Notes
- `picker/native.lua` is the primary picker (660 lines) using NUI popup
- Gallery code was never wired up in production, only in tests
- After cleanup, plugin will have single picker implementation with clear ownership
- Run `make verify` after each task to ensure tests pass

## Results Summary
- **14/15 tasks completed** (1 skipped - not dead code)
- **1027 tests passing**
- **6 pre-existing failures** in `registry_full_flow_spec.lua` (requires actual theme data)
- **Files deleted**: 11 (gallery source + tests + util/log.lua)
- **Files created**: 3 (util/icons.lua, ui/entry.lua, tests/validation/soak_spec.lua, tests/registry/sync_spec.lua)
- **Code reduction**: ~600 lines of dead/duplicate code removed
