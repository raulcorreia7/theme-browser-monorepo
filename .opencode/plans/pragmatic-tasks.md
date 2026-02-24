# Pragmatic Implementation Plan

## Goal
Get 100+ quality themes into the registry with proper adapter metadata, without unnecessary rewrites.

---

## Task 1: Run Indexer & Assess Auto-Discovery (30 min)
**Objective**: See what the indexer actually finds automatically

**Steps**:
1. Set GITHUB_TOKEN environment variable
2. Run: `python scripts/indexer.py run-once`
3. Examine generated themes.json
4. Compare against vimcolorschemes.com top 100
5. Document which themes were auto-discovered vs missing

**Deliverable**: Assessment report showing:
- X themes auto-discovered
- Y themes need manual override
- Z themes not found (possibly reasons)

**Decision Point**: Based on results, decide how many manual overrides actually needed

---

## Task 2: Add Critical Theme Overrides (2-4 hours)
**Objective**: Manually configure only themes that need special adapter handling

**Priority Order** (based on popularity):
1. tokyonight (setup_colorscheme with variants)
2. catppuccin (setup_colorscheme with variants)
3. kanagawa (colorscheme_only with variants)
4. onedark variants (multiple repos)
5. nightfox (setup_load)
6. everforest (vimg_colorscheme)
7. gruvbox-material (vimg_colorscheme)
8. github-nvim-theme (setup_colorscheme)
9. vscode.nvim (setup_colorscheme)
10. Other top 20 as needed

**Steps per theme**:
1. Check repo README for setup instructions
2. Identify loading strategy
3. Identify variants and their configs
4. Add entry to overrides.json
5. Test loading in Neovim

**Deliverable**: overrides.json with 10-20 high-quality theme configurations

---

## Task 3: Python Indexer Test Suite (4 hours)
**Objective**: Add pytest coverage for critical indexer modules

**Test Files**:
1. `tests/test_github_client.py`
   - Rate limiting behavior
   - Retry logic
   - Error handling
   
2. `tests/test_parser.py`
   - Name normalization
   - Colorscheme extraction
   - Base colorscheme selection
   
3. `tests/test_state.py`
   - Cache operations
   - TTL expiration
   - Concurrent access
   
4. `tests/test_runner.py`
   - Batch processing
   - Override merging
   - Output generation

**Deliverable**: pytest suite with >80% coverage on core modules

---

## Task 4: Validate Theme Loading (2 hours)
**Objective**: Ensure all configured themes actually work

**Test Matrix**:
- Test each strategy type: colorscheme_only, setup_colorscheme, setup_load, vimg_colorscheme
- Test variant switching
- Test with/without lazy.nvim

**Deliverable**: Test report confirming all themes load without errors

---

## Task 5: Documentation (1 hour)
**Objective**: Document how to add themes for future contributors

**Create**:
1. `docs/ADDING_THEMES.md` - Step-by-step guide
2. `docs/ADAPTER_STRATEGIES.md` - Reference for each strategy type
3. Update main README with theme count and usage

**Deliverable**: Clear documentation enabling others to add themes

---

## Optional Tasks (If Time Permits)

### Task 6: Gallery Fuzzy Search Enhancement (4 hours)
Add fzf-style fuzzy matching to current gallery

### Task 7: Telescope Adapter (8 hours)
Add telescope as optional picker backend (only if users actually want it)

---

## Execution Order

```
Task 1 ──┬──> Task 2 ──┬──> Task 4 ──┬──> Task 5
         │             │             │
         └──> Task 3 ──┘             └──> Optional Tasks
```

**Dependencies**:
- Task 1 results inform scope of Task 2
- Task 3 independent, can run parallel
- Task 4 depends on Task 2
- Task 5 documentation based on Tasks 1-4 learnings

---

## Success Criteria

- [ ] Indexer runs successfully
- [ ] 100+ themes in registry
- [ ] Top 20 themes have proper adapter configs
- [ ] All tests pass
- [ ] All configured themes load correctly
- [ ] Documentation complete

---

## Time Estimate

**Core Tasks**: 9.5-11.5 hours
**With Optional**: 21.5-23.5 hours

**vs Original Plan**: 64% reduction (50 hours → 11 hours)
