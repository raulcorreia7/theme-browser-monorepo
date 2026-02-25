# Monorepo Restructuring Plan

## Goal
Restructure the monorepo to use a standard `packages/` layout with symlinks for developer convenience.

## Current Structure

```
theme-browser-monorepo/
├── scripts/                    # Pipeline scripts (02-detect, 03-merge, 04-generate)
├── scripts/lib/                # logger.ts
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
├── PLAN.md                     # This file
├── docs/
│   └── theme-detection.md
├── reports/                    # DEV output (gitignored)
├── scripts/                    # SYMLINKS to packages/registry/scripts/
│   ├── 01-sync-index.ts       # → ../packages/registry/scripts/01-sync-index.ts
│   ├── 02-detect-strategies.ts # → ../packages/registry/scripts/02-detect-strategies.ts
│   ├── 03-merge-sources.ts    # → ../packages/registry/scripts/03-merge-sources.ts
│   ├── 04-generate-themes.mjs # → ../packages/registry/scripts/04-generate-themes.mjs
│   ├── lib/
│   │   └── logger.ts          # → ../../packages/registry/scripts/lib/logger.ts
│   └── validate/
│       ├── registry.mjs       # → ../../packages/registry/validate/registry.mjs
│       └── lua-loaders.mjs    # → ../../packages/registry/validate/lua-loaders.mjs
│
└── packages/
    ├── registry/               # TypeScript indexer (was theme-browser-registry-ts)
    │   ├── .github/workflows/
    │   ├── src/               # Core implementation (indexer, cli, etc.)
    │   ├── scripts/           # ACTUAL PIPELINE SCRIPTS (single source of truth)
    │   │   ├── 01-sync-index.ts
    │   │   ├── 02-detect-strategies.ts
    │   │   ├── 03-merge-sources.ts
    │   │   ├── 04-generate-themes.mjs
    │   │   └── lib/
    │   │       └── logger.ts
    │   ├── validate/
    │   │   ├── registry.mjs
    │   │   └── lua-loaders.mjs
    │   ├── data/              # sources/, excluded.json, hints.json, overrides.json
    │   ├── artifacts/         # Generated: index.json, themes.json, manifest.json
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── README.md
    │
    ├── registry-rs/            # Rust indexer (was theme-browser-registry-rs)
    │   ├── src/
    │   ├── Cargo.toml
    │   └── README.md
    │
    └── plugin/                 # Neovim plugin (was theme-browser.nvim)
        ├── .github/workflows/
        ├── lua/
        ├── tests/
        ├── data/
        │   └── registry.json    # Bundled top-50 themes
        ├── Makefile
        └── README.md
```

## Principles

1. **Each package is standalone** - Can be cloned and developed independently
2. **No shared code** - Each package manages its own dependencies
3. **Root is convenience only** - Makefile, docs, symlinks for local dev
4. **Single source of truth** - Actual scripts live in `packages/registry/scripts/`
5. **Git tracks symlinks** - Works cross-platform

## Phase 1: Move Directories

```bash
# Move to packages/
git mv theme-browser-registry-ts packages/registry
git mv theme-browser-registry-rs packages/registry-rs
git mv theme-browser.nvim packages/plugin
```

## Phase 2: Move Scripts into Registry

```bash
# Create registry scripts directory
mkdir -p packages/registry/scripts/lib
mkdir -p packages/registry/validate

# Move actual scripts (source of truth)
git mv scripts/02-detect-strategies.ts packages/registry/scripts/
git mv scripts/03-merge-sources.ts packages/registry/scripts/
git mv scripts/04-generate-themes.mjs packages/registry/scripts/
git mv scripts/lib/logger.ts packages/registry/scripts/lib/
git mv scripts/validate/registry.mjs packages/registry/validate/
git mv scripts/validate/lua-loaders.mjs packages/registry/validate/

# Remove empty directories
rmdir scripts/lib 2>/dev/null || true
rmdir scripts/validate 2>/dev/null || true
rmdir scripts 2>/dev/null || true
```

## Phase 3: Create Symlinks at Root

```bash
# Recreate scripts directory with symlinks
mkdir -p scripts/lib scripts/validate

# Create symlinks (relative paths)
ln -s ../packages/registry/scripts/01-sync-index.ts scripts/01-sync-index.ts
ln -s ../packages/registry/scripts/02-detect-strategies.ts scripts/02-detect-strategies.ts
ln -s ../packages/registry/scripts/03-merge-sources.ts scripts/03-merge-sources.ts
ln -s ../packages/registry/scripts/04-generate-themes.mjs scripts/04-generate-themes.mjs
ln -s ../../packages/registry/scripts/lib/logger.ts scripts/lib/logger.ts
ln -s ../../packages/registry/validate/registry.mjs scripts/validate/registry.mjs
ln -s ../../packages/registry/validate/lua-loaders.mjs scripts/validate/lua-loaders.mjs
```

## Phase 4: Update Paths

### Root Makefile
Update all references:
- `theme-browser-registry-ts/` → `packages/registry/`
- `theme-browser.nvim/` → `packages/plugin/`

### Scripts (if any hardcoded paths)
Update relative paths in:
- `packages/registry/scripts/*.ts`
- Default config paths

### No changes needed for:
- `.github/workflows` in each package (self-contained)
- Plugin code (it fetches from GitHub releases, not local paths)

## Phase 5: Test

```bash
# Test pipeline works from root
make pipeline

# Test individual scripts
npx tsx scripts/01-sync-index.ts
npx tsx scripts/02-detect-strategies.ts --sample 5
npx tsx scripts/03-merge-sources.ts
node scripts/04-generate-themes.mjs

# Test from within registry (standalone)
cd packages/registry && npm run sync
```

## Git Handling

```bash
# Add all changes
git add -A

# Commit with clear message
git commit -m "refactor: restructure into packages/ with symlinks

- Move theme-browser-registry-ts -> packages/registry
- Move theme-browser-registry-rs -> packages/registry-rs  
- Move theme-browser.nvim -> packages/plugin
- Move scripts into packages/registry/scripts/ (source of truth)
- Create symlinks at root for developer convenience
- Update Makefile paths

Each package remains standalone with its own CI/CD.
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
- **No code duplication**: Single source of truth in `packages/registry/scripts/`
- **Backward compatibility**: Root scripts still work via symlinks
- **IDE support**: Most IDEs follow symlinks correctly

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
