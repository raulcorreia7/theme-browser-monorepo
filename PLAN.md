# Monorepo Restructuring Plan

## Goal
Restructure the monorepo to use a standard `packages/` layout with domain-organized code, shared libraries, and symlinks for developer convenience.

## Current Structure

```
theme-browser-monorepo/
├── scripts/                    # Pipeline scripts (mixed responsibilities)
├── scripts/lib/                # logger.ts only
├── scripts/validate/           # validation scripts
├── theme-browser-registry-ts/  # TypeScript indexer
├── theme-browser-registry-rs/  # Rust indexer
├── theme-browser.nvim/         # Neovim plugin
└── docs/
```

## Target Structure

```
theme-browser-monorepo/
├── README.md
├── Makefile
├── package.json
├── PLAN.md
├── docs/
│   └── theme-detection.md
├── reports/                    # DEV output (gitignored)
├── scripts/                    # SYMLINKS to packages/registry/tasks/
│   ├── 01-sync.ts             # → ../packages/registry/tasks/01-sync.ts
│   ├── 02-detect.ts           # → ../packages/registry/tasks/02-detect.ts
│   ├── 03-merge.ts            # → ../packages/registry/tasks/03-merge.ts
│   ├── 04-build.ts            # → ../packages/registry/tasks/04-build.ts
│   ├── 05-bundle.ts           # → ../packages/registry/tasks/05-bundle.ts
│   ├── 06-lint.ts             # → ../packages/registry/tasks/06-lint.ts
│   └── validate/
│       └── registry.ts        # → ../../packages/registry/tasks/validate/registry.ts
│
└── packages/
    ├── registry/               # TypeScript indexer
    │   ├── src/
    │   │   ├── lib/            # Shared library
    │   │   │   ├── types.ts    # ThemeEntry, StrategyType, Config
    │   │   │   ├── logger.ts
    │   │   │   ├── fs.ts       # readJson, writeJson, ensureDir
    │   │   │   ├── cli.ts      # parseArgs helpers
    │   │   │   └── paths.ts    # Default path constants
    │   │   │
    │   │   ├── db/             # Persistence layer
    │   │   │   ├── index.ts
    │   │   │   ├── types.ts    # Store interfaces
    │   │   │   ├── sqlite.ts
    │   │   │   ├── file.ts     # File-based cache
    │   │   │   └── memory.ts   # For tests
    │   │   │
    │   │   ├── sync/           # Sync themes from GitHub
    │   │   │   ├── index.ts
    │   │   │   ├── indexer.ts
    │   │   │   ├── github.ts
    │   │   │   └── parser.ts
    │   │   │
    │   │   ├── detect/         # Detect loading strategies
    │   │   │   ├── index.ts
    │   │   │   ├── strategy.ts
    │   │   │   ├── variant.ts
    │   │   │   └── types.ts
    │   │   │
    │   │   ├── merge/          # Merge overrides
    │   │   │   ├── index.ts
    │   │   │   ├── loader.ts
    │   │   │   ├── saver.ts
    │   │   │   └── apply.ts
    │   │   │
    │   │   ├── build/          # Build artifacts
    │   │   │   ├── index.ts
    │   │   │   ├── themes.ts
    │   │   │   ├── registry.ts
    │   │   │   └── select.ts
    │   │   │
    │   │   ├── lint/           # Validate output
    │   │   │   ├── index.ts
    │   │   │   ├── registry.ts
    │   │   │   └── loaders.ts
    │   │   │
    │   │   ├── push/           # Release artifacts
    │   │   │   ├── index.ts
    │   │   │   └── git.ts
    │   │   │
    │   │   └── cmd/            # CLI commands
    │   │       ├── index.ts
    │   │       └── commands/
    │   │           ├── sync.ts
    │   │           ├── detect.ts
    │   │           ├── merge.ts
    │   │           ├── build.ts
    │   │           ├── lint.ts
    │   │           ├── push.ts
    │   │           └── export.ts
    │   │
    │   ├── tasks/              # Pipeline tasks (use cases)
    │   │   ├── 01-sync.ts
    │   │   ├── 02-detect.ts
    │   │   ├── 03-merge.ts
    │   │   ├── 04-build.ts
    │   │   ├── 05-bundle.ts
    │   │   ├── 06-lint.ts
    │   │   └── validate/
    │   │       └── registry.ts
    │   │
    │   ├── data/               # sources/, excluded.json, hints.json, overrides.json
    │   ├── artifacts/          # Generated: index.json, themes.json, manifest.json
    │   ├── tests/              # Mirror src/ structure
    │   │   ├── lib/
    │   │   ├── db/
    │   │   ├── sync/
    │   │   ├── detect/
    │   │   ├── merge/
    │   │   ├── build/
    │   │   └── lint/
    │   │
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── README.md
    │
    ├── registry-rs/            # Rust indexer
    │   ├── src/
    │   ├── Cargo.toml
    │   └── README.md
    │
    └── plugin/                 # Neovim plugin
        ├── .github/workflows/
        ├── lua/
        ├── tests/
        ├── data/
        │   └── registry.json
        ├── Makefile
        └── README.md
```

## Principles

1. **Each package is standalone** - Can be cloned and developed independently
2. **Domain-organized** - Code organized by what it does (sync, detect, merge, build, lint, push)
3. **Shared library** - `lib/` contains types, utilities, and cross-cutting concerns
4. **Persistence abstraction** - `db/` provides storage interface with multiple implementations
5. **Thin tasks** - `tasks/` are use case orchestrations, not implementations
6. **Git tracks symlinks** - Works cross-platform

## Module Responsibilities

| Module | Responsibility | Depends On |
|--------|---------------|------------|
| `lib/` | Types, utilities, logger, fs, cli helpers | None |
| `db/` | Persistence (sqlite, file, memory) | `lib/` |
| `sync/` | Fetch themes from GitHub | `lib/`, `db/` |
| `detect/` | Classify loading strategies | `lib/`, `db/` |
| `merge/` | Apply overrides and hints | `lib/` |
| `build/` | Create output artifacts | `lib/`, `merge/` |
| `lint/` | Validate output | `lib/`, `build/` |
| `push/` | Release to git | `lib/` |
| `cmd/` | CLI entry points | All domains |
| `tasks/` | Use case orchestration | `cmd/`, domains |

## Phase 1: Move Directories

```bash
# Move to packages/
git mv theme-browser-registry-ts packages/registry
git mv theme-browser-registry-rs packages/registry-rs
git mv theme-browser.nvim packages/plugin
```

## Phase 2: Reorganize Registry Package

```bash
# Create new structure
mkdir -p packages/registry/src/{lib,db,sync,detect,merge,build,lint,push,cmd/commands}
mkdir -p packages/registry/tasks/validate
mkdir -p packages/registry/tests/{lib,db,sync,detect,merge,build,lint}

# Move core utilities
git mv packages/registry/src/utils/logger.ts packages/registry/src/lib/
git mv packages/registry/src/utils/config.ts packages/registry/src/lib/
git mv packages/registry/src/utils/errors.ts packages/registry/src/lib/

# Move types
git mv packages/registry/src/types/schemas.ts packages/registry/src/lib/types.ts

# Move discovery domain → sync/
git mv packages/registry/src/services/indexer.ts packages/registry/src/sync/
git mv packages/registry/src/services/parser.ts packages/registry/src/sync/
git mv packages/registry/src/providers/github.ts packages/registry/src/sync/github.ts
git mv packages/registry/src/providers/cache.ts packages/registry/src/db/sqlite.ts

# Move merger → merge/
git mv packages/registry/src/services/merger.ts packages/registry/src/merge/apply.ts

# Move publisher → push/
git mv packages/registry/src/services/publisher.ts packages/registry/src/push/git.ts

# Move CLI
git mv packages/registry/src/cli packages/registry/src/cmd
```

## Phase 3: Extract Detection Logic

```bash
# Create detection domain (extracted from scripts/02-detect-strategies.ts)
mkdir -p packages/registry/src/detect

# Files will be created:
# - detect/strategy.ts   (detectFromText, inspectSource)
# - detect/variant.ts    (detectVariantModeFromName)
# - detect/types.ts      (DetectionRow, DetectionResult)
```

## Phase 4: Create Build Domain

```bash
# Create build domain (extracted from scripts/04-generate-themes.mjs, 05-install-themes.mjs)
mkdir -p packages/registry/src/build

# Files will be created:
# - build/themes.ts     (generate themes.json)
# - build/registry.ts   (generate plugin registry.json)
# - build/select.ts     (top-N selection heuristics)
```

## Phase 5: Create Lint Domain

```bash
# Create lint domain (extracted from scripts/validate/)
mkdir -p packages/registry/src/lint

# Move validation
git mv scripts/validate/registry.mjs packages/registry/src/lint/registry.ts
git mv scripts/validate/lua-loaders.mjs packages/registry/src/lint/loaders.ts
```

## Phase 6: Create Tasks

```bash
# Create tasks directory
mkdir -p packages/registry/tasks/validate

# Convert scripts to tasks (thin orchestration)
# 01-sync.ts      → calls sync domain
# 02-detect.ts    → calls detect domain
# 03-merge.ts     → calls merge domain
# 04-build.ts     → calls build domain
# 05-bundle.ts    → calls build domain (registry.json)
# 06-lint.ts      → calls lint domain
```

## Phase 7: Create Symlinks at Root

```bash
# Remove old scripts (after tasks are created)
rm -rf scripts/

# Recreate scripts directory with symlinks
mkdir -p scripts/validate

# Create symlinks (relative paths)
ln -s ../packages/registry/tasks/01-sync.ts scripts/01-sync.ts
ln -s ../packages/registry/tasks/02-detect.ts scripts/02-detect.ts
ln -s ../packages/registry/tasks/03-merge.ts scripts/03-merge.ts
ln -s ../packages/registry/tasks/04-build.ts scripts/04-build.ts
ln -s ../packages/registry/tasks/05-bundle.ts scripts/05-bundle.ts
ln -s ../packages/registry/tasks/06-lint.ts scripts/06-lint.ts
ln -s ../../packages/registry/tasks/validate/registry.ts scripts/validate/registry.ts
```

## Phase 8: Update Imports and Paths

### Update all imports
- `../utils/logger` → `../lib/logger`
- `../types/schemas` → `../lib/types`
- `../providers/github` → `../sync/github`
- etc.

### Update default paths in `lib/paths.ts`
- All paths relative to package root

### Update Makefile
- `theme-browser-registry-ts/` → `packages/registry/`
- `theme-browser.nvim/` → `packages/plugin/`

## Phase 9: Update Tests

```bash
# Move tests to mirror new structure
git mv packages/registry/tests/services/* packages/registry/tests/sync/
git mv packages/registry/tests/providers/* packages/registry/tests/db/
```

## Phase 10: Test

```bash
# Test pipeline works from root
make pipeline

# Test individual tasks
npx tsx scripts/01-sync.ts
npx tsx scripts/02-detect.ts --sample 5
npx tsx scripts/03-merge.ts
npx tsx scripts/04-build.ts
npx tsx scripts/05-bundle.ts
npx tsx scripts/06-lint.ts

# Test from within registry (standalone)
cd packages/registry && npm run sync
```

## Git Handling

```bash
# Add all changes
git add -A

# Commit with clear message
git commit -m "refactor: restructure into packages/ with domain organization

- Move theme-browser-registry-ts -> packages/registry
- Move theme-browser-registry-rs -> packages/registry-rs
- Move theme-browser.nvim -> packages/plugin
- Reorganize registry into domains: sync, detect, merge, build, lint, push
- Extract shared code to lib/
- Abstract persistence to db/ (sqlite, file, memory)
- Create tasks/ for use case orchestration
- Create symlinks at root for developer convenience
- Convert .mjs scripts to .ts for type safety

Each package remains standalone with its own CI/DB.
Root provides convenience symlinks and Makefile."

# Push
git push
```

## Post-Restructure

### Each package is independent:
```bash
cd packages/registry && npm run sync      # Works standalone
cd packages/plugin && make test          # Works standalone
cd packages/registry-rs && cargo build   # Works standalone
```

### Root provides convenience:
```bash
make pipeline    # Runs full pipeline via symlinks
make test-all    # Tests all packages
make status      # Shows git status for all
```

## Notes

- **Symlinks in Git**: Git tracks symlinks correctly. On Windows, ensure `core.symlinks=true` in git config.
- **No code duplication**: Single source of truth in `packages/registry/src/`
- **Backward compatibility**: Root scripts still work via symlinks
- **IDE support**: Most IDEs follow symlinks correctly
- **Testability**: `db/memory.ts` enables fast unit tests without file I/O

## Rollback Plan

If issues arise:
```bash
# Revert to pre-restructure commit
git revert HEAD
# Or restore from backup branch
git checkout -b backup-restructure
git checkout master
git reset --hard HEAD~1
```
