# Theme Browser Modernization: 0→1 Parallel Execution Plan

## Executive Summary
Transform theme-browser from Python indexer + nui gallery to TypeScript indexer + leetcode.nvim-style picker UI with 100 curated themes.

**Parallelization Strategy**: 4 workstreams with clear interfaces
**Total Estimated Effort**: ~40-50 hours (parallelized: ~15-20 hours wall time)
**Quality Gates**: 6 checkpoints with automated validation

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PHASE 0: FOUNDATION                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ 0.1 TypeScript   │  │ 0.2 Theme        │  │ 0.3 UI Provider  │          │
│  │    Project Setup │  │    Research      │  │    Interface     │          │
│  │    (Agent A1)    │  │    (Agent A2)    │  │    (Agent A3)    │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                      │                      │                   │
│           ▼                      ▼                      ▼                   │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                    QUALITY GATE 0: INTERFACES                     │      │
│  │     All contracts defined, tests pass, research complete          │      │
│  └──────────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 1: CORE IMPLEMENTATION                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ 1.1 GitHub API   │  │ 1.2 Theme        │  │ 1.3 Telescope    │          │
│  │    Client        │  │    Definitions   │  │    Provider      │          │
│  │    (Agent B1)    │  │    (Agent B2)    │  │    (Agent B3)    │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ 1.4 SQLite State │  │ 1.5 Parser       │  │ 1.6 FZF-Lua      │          │
│  │    Cache         │  │    Engine        │  │    Provider      │          │
│  │    (Agent B4)    │  │    (Agent B5)    │  │    (Agent B6)    │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                      │                      │                   │
│           ▼                      ▼                      ▼                   │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                  QUALITY GATE 1: CORE MODULES                     │      │
│  │     All modules unit tested, interfaces match spec                │      │
│  └──────────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 2: INTEGRATION                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ 2.1 Runner       │  │ 2.2 Registry     │  │ 2.3 Picker       │          │
│  │    Orchestration │  │    Generation    │  │    Integration   │          │
│  │    (Agent C1)    │  │    (Agent C2)    │  │    (Agent C3)    │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                      │                      │                   │
│           ▼                      ▼                      ▼                   │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                 QUALITY GATE 2: INTEGRATION                       │      │
│  │     End-to-end tests pass, registry valid, UI functional          │      │
│  └──────────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 3: VALIDATION                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ 3.1 Theme        │  │ 3.2 Performance  │  │ 3.3 Migration    │          │
│  │    Testing       │  │    Benchmarking  │  │    Guide         │          │
│  │    (Agent D1)    │  │    (Agent D2)    │  │    (Agent D3)    │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                      │                      │                   │
│           ▼                      ▼                      ▼                   │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                  QUALITY GATE 3: PRODUCTION READY                 │      │
│  │     100 themes load, <100ms picker, backward compat               │      │
│  └──────────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Foundation (Parallel Workstreams)

### Workstream 0.1: TypeScript Project Setup
**Owner**: Agent A1
**Dependencies**: None
**Duration**: 2 hours
**Output**: `theme-browser-registry-ts/` with full toolchain

**Tasks**:
1. Initialize npm project with TypeScript
2. Configure tsconfig.json (ES2022, strict mode, path aliases)
3. Setup ESLint + Prettier
4. Install dependencies:
   - `better-sqlite3@^11.0.0`
   - `commander@^12.0.0`
   - `pino@^9.0.0` + `pino-pretty@^11.0.0`
   - `simple-git@^3.25.0`
   - Dev: `@types/better-sqlite3`, `@types/node`, `typescript@^5.4.0`
5. Create directory structure:
   ```
   src/
     models.ts      # All interfaces
     config.ts      # Config loading
     logger.ts      # Pino setup
     types/         # Shared types
   ```
6. Setup build scripts in package.json
7. Create `.gitignore`
8. **Quality Gate 0.1**: `npm install && npm run build` succeeds with no errors

**Context for Agent**:
- Project is at `/home/rcorreia/projects/theme-browser-monorepo/theme-browser-registry-ts/`
- Must support Node.js >= 20
- TypeScript strict mode required
- Must produce CommonJS output for compatibility

---

### Workstream 0.2: Theme Research (100 Themes)
**Owner**: Agent A2
**Dependencies**: None
**Duration**: 8 hours (parallelizable per theme batch)
**Output**: `research/themes-research.json`

**Tasks**:
Research top 100 themes from vimcolorschemes.com. For each theme, determine:

1. **Repository URL**: `owner/repo` format
2. **Colorscheme Names**: All files in `colors/` directory
3. **Loading Strategy**:
   - `colorscheme_only`: Just `:colorscheme name`
   - `setup_colorscheme`: `require('module').setup(opts)` then `:colorscheme`
   - `setup_load`: `require('module').load(variant)` custom method
   - `vimg_colorscheme`: Set vim.g vars before `:colorscheme`
4. **Variants**: Style variations (dark/light, soft/medium/hard, etc.)
5. **Dependencies**: Other plugins required
6. **Metadata**: stars, description, topics, last_updated

**Theme Batches** (parallel sub-agents):
- Batch 0.2.1: Themes 1-20 (gruvbox, tokyonight, catppuccin, solarized, kanagawa, etc.)
- Batch 0.2.2: Themes 21-40 (jellybeans, ayu, seoul256, oxocarbon, etc.)
- Batch 0.2.3: Themes 41-60 (solarized-osaka, vscode, melange, nightfly, etc.)
- Batch 0.2.4: Themes 61-80 (material.vim, base16-nvim, tokyodark, etc.)
- Batch 0.2.5: Themes 81-100 (mellifluous, bluloco, vim-lucius, etc.)

**Research Template per Theme**:
```json
{
  "name": "tokyonight",
  "repo": "folke/tokyonight.nvim",
  "colorschemes": ["tokyonight", "tokyonight-night", "tokyonight-storm", "tokyonight-moon", "tokyonight-day"],
  "strategy": "setup_colorscheme",
  "module": "tokyonight",
  "variants": [
    {"name": "night", "colorscheme": "tokyonight-night", "background": "dark", "opts": {"style": "night"}},
    {"name": "storm", "colorscheme": "tokyonight-storm", "background": "dark", "opts": {"style": "storm"}},
    {"name": "moon", "colorscheme": "tokyonight-moon", "background": "dark", "opts": {"style": "moon"}},
    {"name": "day", "colorscheme": "tokyonight-day", "background": "light", "opts": {"style": "day"}}
  ],
  "stars": 7791,
  "description": "A clean, dark Neovim theme written in Lua",
  "topics": ["neovim", "colorscheme", "theme"],
  "dependencies": []
}
```

**Research Methodology**:
1. Visit GitHub repo
2. Check README for setup instructions
3. Look at `colors/` directory structure
4. Check for `setup()` function in Lua files
5. Check for variant-specific configuration
6. Look at existing dotfyle-top50.json for patterns

**Quality Gate 0.2**: 
- All 100 themes researched
- At least 80% have confirmed loading strategy
- Research data validates against schema
- Sample of 10 themes manually verified

**Context for Agent**:
- Current research in `/home/rcorreia/projects/theme-browser-monorepo/theme-browser-registry/curated/dotfyle-top50.json`
- Current overrides in `/home/rcorreia/projects/theme-browser-monorepo/theme-browser-registry/overrides.json`
- Schema at `/home/rcorreia/projects/theme-browser-monorepo/theme-browser-registry/themes.schema.json`
- Top themes list from vimcolorschemes.com (pages 1-5) in plan document

---

### Workstream 0.3: UI Provider Interface Design
**Owner**: Agent A3
**Dependencies**: None
**Duration**: 3 hours
**Output**: Interface definitions + telescope reference impl

**Tasks**:
1. Analyze leetcode.nvim picker architecture:
   - Read `/tmp/leetcode.nvim/lua/leetcode/picker/init.lua`
   - Read `/tmp/leetcode.nvim/lua/leetcode/picker/question/init.lua`
   - Read `/tmp/leetcode.nvim/lua/leetcode/picker/question/telescope.lua`
   - Read `/tmp/leetcode.nvim/lua/leetcode/picker/question/fzf.lua`

2. Design provider interface:
   ```lua
   ---@class ThemePickerProvider
   ---@field name string
   ---@field is_available fun(): boolean
   ---@field pick fun(opts: PickerOptions): ThemeEntry
   ---@field entry_maker fun(theme: ThemeEntry): table
   ---@field displayer fun(): table
   ```

3. Design entry display format:
   ```lua
   -- Columns: Status | Background | Name | Variant | Stars | Description
   {
     value = theme_entry,
     display = function()
       return displayer({
         { icon, hl },      -- Status: installed/downloaded/available
         { icon, hl },      -- Background: dark/light
         name,              -- Theme name
         variant,           -- Variant name (if applicable)
         stars,             -- Formatted star count
         description,       -- Truncated description
       })
     end,
     ordinal = "tokyonight storm"
   }
   ```

4. Design filter options:
   ```lua
   ---@class PickerFilterOptions
   ---@field background? "dark" | "light" | "all"
   ---@field status? "installed" | "downloaded" | "available" | "all"
   ---@field search? string
   ---@field sort_by? "stars" | "name" | "updated"
   ```

5. Create reference telescope implementation stub

**Quality Gate 0.3**:
- Interface documented with LuaCATS annotations
- Example usage code provided
- Compatible with telescope.nvim API
- Compatible with fzf-lua API

**Context for Agent**:
- Current UI at `/home/rcorreia/projects/theme-browser-monorepo/theme-browser.nvim/lua/theme-browser/ui/gallery.lua`
- Current registry adapter at `/home/rcorreia/projects/theme-browser-monorepo/theme-browser.nvim/lua/theme-browser/adapters/registry.lua`
- leetcode.nvim cloned at `/tmp/leetcode.nvim/`

---

## QUALITY GATE 0: FOUNDATION COMPLETE

**Checklist**:
- [ ] TypeScript project builds successfully
- [ ] 100 themes researched with loading strategies
- [ ] UI provider interfaces defined and documented
- [ ] All workstreams synchronized on data formats

**Entry Criteria for Phase 1**:
- Agent A1 delivers: `theme-browser-registry-ts/package.json`, `tsconfig.json`
- Agent A2 delivers: `research/themes-research.json` (100 themes)
- Agent A3 delivers: `lua/theme-browser/picker/provider.lua` (interface)

---

## Phase 1: Core Implementation (Parallel Workstreams)

### Workstream 1.1: GitHub API Client
**Owner**: Agent B1
**Dependencies**: Phase 0 complete
**Duration**: 4 hours
**Output**: `src/github-client.ts`

**Tasks**:
1. Implement GitHub API client class:
   ```typescript
   class GitHubClient {
     constructor(token: string, options: ClientOptions)
     async searchRepositories(topic: string, page: number): Promise<Repo[]>
     async getRepository(repo: string): Promise<RepoDetails>
     async getTree(repo: string, ref: string): Promise<TreeItem[]>
     getRateLimitStatus(): RateLimitInfo
   }
   ```

2. Implement rate limiting:
   - Configurable delay between requests (default: 250ms)
   - Exponential backoff: 2^attempt seconds, max 60s
   - Honor `Retry-After` header
   - Check `X-RateLimit-Remaining` and `X-RateLimit-Reset`

3. Implement retry logic:
   - Max 3 retries for transient failures (5xx, timeout)
   - No retry for 404 (not found)
   - Log all retries

4. Implement error handling:
   - Distinguish API errors vs network errors
   - Provide actionable error messages
   - Continue batch on individual failures

**Quality Gate 1.1**:
- Unit tests for all methods
- Rate limiting tests (mock responses)
- Retry logic tests
- All tests pass

**Context for Agent**:
- See Python implementation: `/home/rcorreia/projects/theme-browser-monorepo/theme-browser-registry/indexer/github_client.py`
- GitHub API docs: https://docs.github.com/en/rest
- Required endpoints:
  - `GET /search/repositories?q=topic:{topic}`
  - `GET /repos/{owner}/{repo}`
  - `GET /repos/{owner}/{repo}/git/trees/{ref}?recursive=1`

---

### Workstream 1.2: Theme Definitions (from Research)
**Owner**: Agent B2
**Dependencies**: Workstream 0.2 complete
**Duration**: 6 hours
**Output**: `themes-overrides.json` (100 themes with adapters)

**Tasks**:
1. Convert research data to registry format
2. Create adapter metadata for each theme:
   ```json
   {
     "name": "tokyonight",
     "repo": "folke/tokyonight.nvim",
     "colorscheme": "tokyonight",
     "stars": 7791,
     "description": "...",
     "topics": ["neovim", "colorscheme"],
     "variants": [...],
     "meta": {
       "strategy": "setup_colorscheme",
       "module": "tokyonight",
       "opts": {}
     }
   }
   ```

3. Batch Processing:
   - Process themes 1-20
   - Process themes 21-40
   - Process themes 41-60
   - Process themes 61-80
   - Process themes 81-100

4. Validate against schema

**Quality Gate 1.2**:
- All 100 themes have valid entries
- JSON validates against schema
- No duplicate names
- All repos exist (check URLs)

**Context for Agent**:
- Input: `research/themes-research.json` from Agent A2
- Schema: `/home/rcorreia/projects/theme-browser-monorepo/theme-browser-registry/themes.schema.json`
- Output: `theme-browser-registry/overrides.json` (merge with existing)

---

### Workstream 1.3: Telescope Provider
**Owner**: Agent B3
**Dependencies**: Workstream 0.3 complete
**Duration**: 5 hours
**Output**: `lua/theme-browser/picker/telescope.lua`

**Tasks**:
1. Implement provider interface:
   ```lua
   local M = {}
   M.name = "telescope"
   
   function M.is_available()
     return pcall(require, "telescope")
   end
   
   function M.pick(opts)
     -- Implementation
   end
   ```

2. Create entry maker:
   - Status icon column (installed/downloaded/available)
   - Background indicator (dark/light)
   - Theme name
   - Variant (if applicable)
   - Star count (formatted: 7.8k, 1.2m)
   - Description (truncated)

3. Create displayer with telescope's entry_display

4. Implement filtering:
   - Background filter (dark/light/all)
   - Status filter
   - Search (fuzzy match name/description)
   - Sort options

5. Implement selection handler:
   - Preview on select
   - Apply theme
   - Close picker

**Quality Gate 1.3**:
- Works with telescope.nvim
- Entry display matches spec
- Filters work correctly
- Selection applies theme

**Context for Agent**:
- Reference: `/tmp/leetcode.nvim/lua/leetcode/picker/question/telescope.lua`
- Interface: From Agent A3
- Theme data: From registry
- Install status: Check lazy.nvim installed list

---

### Workstream 1.4: SQLite State Cache
**Owner**: Agent B4
**Dependencies**: Phase 0 complete
**Duration**: 4 hours
**Output**: `src/state.ts`

**Tasks**:
1. Implement SQLite database:
   ```typescript
   class StateCache {
     constructor(dbPath: string)
     shouldRefresh(repo: string, updatedAt: string): boolean
     readRepo(repo: string): RepoCache | null
     listPayloads(): ThemeEntry[]
     upsertRepo(repo: string, data: RepoCache): void
     close(): void
   }
   ```

2. Database schema:
   ```sql
   CREATE TABLE repo_cache (
     repo VARCHAR(255) PRIMARY KEY,
     updated_at VARCHAR(64) NOT NULL,
     scanned_at INTEGER NOT NULL,
     payload_json TEXT NOT NULL,
     parse_error TEXT
   );
   ```

3. Implement cache logic:
   - TTL based on config.stale_after_days
   - Check if GitHub updated_at changed
   - Handle parse errors

4. Use `better-sqlite3` (synchronous API)

**Quality Gate 1.4**:
- Unit tests for all operations
- Concurrent access handled
- Cache hit/miss tests
- All tests pass

**Context for Agent**:
- See Python implementation: `/home/rcorreia/projects/theme-browser-monorepo/theme-browser-registry/indexer/state.py`
- Use `better-sqlite3` package
- Database path: configurable (default: `.cache/theme-browser.db`)

---

### Workstream 1.5: Parser Engine
**Owner**: Agent B5
**Dependencies**: Phase 0 complete
**Duration**: 3 hours
**Output**: `src/parser.ts`

**Tasks**:
1. Implement name normalization:
   ```typescript
   function normalizeThemeName(repo: string): string
   function sanitizeRepoName(name: string): string
   ```

2. Implement colorscheme extraction:
   ```typescript
   function extractColorschemes(tree: TreeItem[]): string[]
   // Pattern: ^colors/([^/]+)\.(vim|lua)$
   ```

3. Implement base colorscheme selection:
   ```typescript
   function pickBaseColorscheme(themeName: string, colors: string[]): string
   ```

4. Implement ThemeEntry builder:
   ```typescript
   function buildEntry(repo: RepoDetails, colors: string[]): ThemeEntry
   ```

**Quality Gate 1.5**:
- Unit tests for normalization
- Unit tests for extraction
- Unit tests for selection
- Edge cases handled

**Context for Agent**:
- See Python implementation: `/home/rcorreia/projects/theme-browser-monorepo/theme-browser-registry/indexer/parser.py`
- Must handle: `.nvim`, `.vim`, `-nvim`, `_nvim` suffixes
- Must handle generic names

---

### Workstream 1.6: FZF-Lua Provider
**Owner**: Agent B6
**Dependencies**: Workstream 0.3 complete
**Duration**: 4 hours
**Output**: `lua/theme-browser/picker/fzf.lua`

**Tasks**:
1. Implement fzf-lua provider following same interface as telescope

2. Use fzf-lua's API:
   - `fzf_lua.fzf_exec()`
   - `fzf_lua.make_entry()`
   - Custom previewer

3. Match telescope provider feature parity:
   - Same columns
   - Same filters
   - Same actions

**Quality Gate 1.6**:
- Works with fzf-lua
- Feature parity with telescope provider
- Performance < 100ms for 1000 themes

**Context for Agent**:
- Reference: `/tmp/leetcode.nvim/lua/leetcode/picker/question/fzf.lua`
- fzf-lua docs: https://github.com/ibhagwan/fzf-lua
- Must be consistent with telescope provider

---

## QUALITY GATE 1: CORE MODULES COMPLETE

**Checklist**:
- [ ] GitHub client tested with rate limiting
- [ ] 100 theme entries validated
- [ ] Telescope provider functional
- [ ] SQLite cache working
- [ ] Parser handles all edge cases
- [ ] FZF-Lua provider functional
- [ ] All unit tests pass

---

## Phase 2: Integration (Parallel Workstreams)

### Workstream 2.1: Runner Orchestration
**Owner**: Agent C1
**Dependencies**: Workstreams 1.1, 1.4, 1.5 complete
**Duration**: 4 hours
**Output**: `src/runner.ts` + `src/index.ts`

**Tasks**:
1. Implement main runner:
   ```typescript
   class Runner {
     constructor(config: Config)
     async runOnce(): Promise<void>
     async runLoop(): Promise<void>
     async runOncePublish(): Promise<void>
   }
   ```

2. Implement batch processing:
   - Fetch repos from GitHub (using GitHubClient)
   - Check cache (using StateCache)
   - Process in batches
   - Upsert to cache
   - Apply overrides
   - Sort and output

3. Implement CLI:
   ```typescript
   program
     .command('run-once')
     .command('run-loop')
     .command('run-once-publish')
     .option('--config <path>')
     .option('--log-level <level>')
   ```

4. Implement config loading:
   - JSON config file
   - Environment variables
   - CLI overrides

**Quality Gate 2.1**:
- `run-once` completes successfully
- Produces valid themes.json
- All CLI commands work
- Logging is clear

**Context for Agent**:
- See Python: `/home/rcorreia/projects/theme-browser-monorepo/theme-browser-registry/indexer/runner.py`
- Config: `/home/rcorreia/projects/theme-browser-monorepo/theme-browser-registry/indexer.config.json`
- Entry: `/home/rcorreia/projects/theme-browser-monorepo/theme-browser-registry/scripts/indexer.py`

---

### Workstream 2.2: Registry Generation
**Owner**: Agent C2
**Dependencies**: Workstreams 1.2, 2.1 complete
**Duration**: 2 hours
**Output**: `themes.json` (with 100 new themes)

**Tasks**:
1. Merge new themes with existing registry
2. Generate `themes.json`
3. Generate manifest (`artifacts/latest.json`)
4. Validate against schema
5. Create validation report

**Quality Gate 2.2**:
- themes.json validates against schema
- 100 new themes included
- No breaking changes to existing themes
- Manifest generated with SHA256

**Context for Agent**:
- Input: `overrides.json` (from Agent B2)
- Existing: `/home/rcorreia/projects/theme-browser-monorepo/theme-browser-registry/themes.json`
- Schema: `/home/rcorreia/projects/theme-browser-monorepo/theme-browser-registry/themes.schema.json`

---

### Workstream 2.3: Picker Integration
**Owner**: Agent C3
**Dependencies**: Workstreams 1.3, 1.6 complete
**Duration**: 3 hours
**Output**: `lua/theme-browser/picker/init.lua`

**Tasks**:
1. Create provider resolver:
   ```lua
   local providers = {
     telescope = require("theme-browser.picker.telescope"),
     fzf = require("theme-browser.picker.fzf"),
   }
   
   local function resolve_provider()
     -- Auto-detect or use config
   end
   ```

2. Create unified API:
   ```lua
   local M = {}
   M.provider = resolve_provider()
   
   function M.pick(opts)
     return M.provider.pick(opts)
   end
   ```

3. Add to main plugin:
   - `:ThemeBrowser` command uses picker
   - Config option for provider selection
   - Fallback to old gallery if picker unavailable

4. Add keymaps integration

**Quality Gate 2.3**:
- `:ThemeBrowser` opens picker
- Provider auto-detection works
- Configurable provider selection
- Falls back gracefully

**Context for Agent**:
- Main plugin: `/home/rcorreia/projects/theme-browser-monorepo/theme-browser.nvim/lua/theme-browser/init.lua`
- Config: `/home/rcorreia/projects/theme-browser-monorepo/theme-browser.nvim/lua/theme-browser/config.lua`

---

## QUALITY GATE 2: INTEGRATION COMPLETE

**Checklist**:
- [ ] TypeScript indexer produces valid output
- [ ] themes.json has 100+ new themes
- [ ] `:ThemeBrowser` opens picker
- [ ] Both telescope and fzf-lua work
- [ ] End-to-end test passes

---

## Phase 3: Validation (Parallel Workstreams)

### Workstream 3.1: Theme Testing
**Owner**: Agent D1
**Dependencies**: Phase 2 complete
**Duration**: 6 hours
**Output**: Test report + fixes

**Tasks**:
1. Load test: Verify all 100 themes load without errors
2. Visual test: Spot-check 20 themes for correct colors
3. Variant test: Test variant switching on 10 themes
4. Adapter test: Verify each strategy type works

**Test Matrix**:
- Strategy types: colorscheme_only, setup_colorscheme, setup_load, vimg_colorscheme
- Variant types: dark/light, soft/medium/hard, style variants
- Background: Verify correct vim.o.background

**Quality Gate 3.1**:
- 100% of themes load without Lua errors
- 95% of themes display correct colors
- All variants work

---

### Workstream 3.2: Performance Benchmarking
**Owner**: Agent D2
**Dependencies**: Phase 2 complete
**Duration**: 2 hours
**Output**: Performance report

**Tasks**:
1. Benchmark picker open time (target: < 100ms for 1000 themes)
2. Benchmark theme switch time (target: < 50ms)
3. Benchmark indexer run time (target: < 5 min for 100 repos)
4. Memory usage check

**Quality Gate 3.2**:
- Picker opens in < 100ms
- Theme switches in < 50ms
- Indexer completes in < 5 min
- Memory usage reasonable

---

### Workstream 3.3: Migration Guide
**Owner**: Agent D3
**Dependencies**: Phase 2 complete
**Duration**: 2 hours
**Output**: `MIGRATION.md`

**Tasks**:
1. Document breaking changes
2. Document new configuration options
3. Provide migration examples
4. Document deprecation timeline

**Quality Gate 3.3**:
- Migration guide is clear
- Examples work
- Breaking changes listed

---

## QUALITY GATE 3: PRODUCTION READY

**Checklist**:
- [ ] All 100 themes load and display correctly
- [ ] Performance targets met
- [ ] Migration guide complete
- [ ] Backward compatibility maintained
- [ ] No critical bugs

---

## Cross-Cutting Concerns

### Error Handling Strategy
- **Indexer**: Log and continue on individual repo failures
- **UI**: Graceful fallback (picker → gallery → message)
- **Config**: Validation with helpful error messages

### Testing Strategy
- **Unit tests**: Each module (Jest for TS, busted/plenary for Lua)
- **Integration tests**: End-to-end workflows
- **Manual tests**: Visual verification of themes

### Documentation Requirements
- **API docs**: TypeScript interfaces, LuaCATS annotations
- **User docs**: README, configuration examples
- **Developer docs**: Architecture, contribution guide

### Dependencies to Add

**TypeScript**:
```json
{
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "commander": "^12.0.0",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0",
    "simple-git": "^3.25.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "jest": "^29.0.0",
    "prettier": "^3.2.0",
    "typescript": "^5.4.0"
  }
}
```

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| GitHub API rate limits | High | Exponential backoff, caching, user token |
| Theme loading failures | Medium | Adapter metadata validation, fallback strategies |
| Picker incompatibility | Medium | Multiple provider support, fallback UI |
| Performance degradation | Medium | Benchmarks, lazy loading, caching |
| Breaking changes | Low | Backward compatibility, deprecation warnings |

---

## Timeline Summary

| Phase | Duration | Workstreams | Quality Gate |
|-------|----------|-------------|--------------|
| 0. Foundation | 2-8 hrs | A1, A2, A3 (parallel) | QG0 |
| 1. Core | 4-6 hrs | B1-B6 (parallel) | QG1 |
| 2. Integration | 2-4 hrs | C1-C3 (parallel) | QG2 |
| 3. Validation | 2-6 hrs | D1-D3 (parallel) | QG3 |
| **Total Wall Time** | **~15-20 hrs** | | |

**Critical Path**: A2 → B2 → C2 → D1
**Parallelizable**: A1, A3, B1, B3-B6, C1, C3, D2-D3

---

## Success Criteria

1. **Indexer**: TypeScript indexer has feature parity with Python
2. **Themes**: 100 new themes with proper adapter metadata
3. **UI**: Telescope + FZF-Lua providers work with leetcode.nvim-style display
4. **Performance**: < 100ms picker, < 5 min indexer
5. **Quality**: 100% of themes load, all tests pass

---

## Next Steps

1. **User Approval**: Review and approve this plan
2. **Switch to Build Mode**: Execute Phase 0 in parallel
3. **Checkpoint Reviews**: Quality gates before each phase
4. **Final Delivery**: Production-ready release

