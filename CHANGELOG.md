# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-02-27

UX release focused on reducing command surface area and improving preview reliability.

### Plugin

#### Added

- Single routed command UX under `:ThemeBrowser` with discoverable subcommands (`pick`, `use`,
  `status`, `pm`, `browser`, `registry`, `validate`, `reset`, `help`)
- Context-aware command completion for subcommands, theme names, and variants

#### Fixed

- Runtime loader now resets Neovim's Lua module cache after adding a new theme runtimepath,
  preventing stale `module not found` failures after install

#### Changed

- Help/docs/tests now use the single root command model instead of many `:ThemeBrowser*` aliases
- CI, release, and E2E workflows now use explicit branch filters, concurrency control, and
  stricter verification steps

### Registry

#### Added

- Shared mode resolution utilities and expanded test coverage for build/detect/parser behavior
- Dedicated task scripts for manifest and top-theme bundling used by release automation

#### Changed

- Discovery and detection hints were expanded to improve strategy/mode classification quality
- CI and release workflows now use cached installs, `npm ci`, stronger checks, and idempotent
  release asset publishing

### Monorepo

#### Changed

- Version bumped to `0.3.0`
- Plugin and registry submodules updated with command UX, reliability, and CI/CD improvements

## [0.2.1] - 2026-02-27

Stability release focused on safer theme handling, strategy compatibility, and CI reliability.

### Plugin

#### Fixed

- Setup-strategy variants now load consistently for themes that require different setup keys
  (`theme`, `palette`, `style`, `colorscheme`, `variant`, `flavour`, `flavor`)
- Registry adapter entries now preserve root strategy/module metadata when expanding variants
- AstroTheme variants (for example `astrolight`) no longer fail with false preview errors
- E2E workflow path/bootstrap issues were fixed (`plenary` install path, lazy workspace path)
- Release workflow no longer fails when a tag release already exists

#### Changed

- Picker rendering uses dynamic width sizing for better readability with long theme names
- Picker highlights now link to semantic groups for better compatibility across colorschemes

### Registry

#### Fixed

- Release workflow now uses package version in `manifest.json` instead of a hardcoded version
- Release workflow now updates existing versioned releases instead of failing
- Override merge supports `allowSynthetic: false` to prevent reintroducing excluded repos

#### Changed

- Excluded `cvusmo/blackbeard-nvim` from discovery and curated sources
- Removed `blackbeard` from setup sources, overrides, and bundled plugin registry data

### Monorepo

#### Changed

- Version bumped to `0.2.1`
- Submodules updated to include plugin and registry stability fixes

## [0.2.0] - 2026-02-26

A major refactor focused on code quality, architecture, and developer experience.

### Registry

#### Added

- Prettier configuration and format scripts
- Variant mode detection and quality filtering
- `minStars` filtering at discovery stage
- `@/` path alias for clean imports

#### Changed

- **Major refactor**: reorganized into domain modules (`sync/`, `detect/`, `merge/`, `build/`, `push/`, `db/`, `lib/`)
- Extracted core logic from tasks into domain modules
- Converted all `.mjs` scripts to TypeScript with proper types
- Optimized pipeline scripts for performance and maintainability
- Moved pipeline scripts from monorepo root to registry package
- Replaced `console.log` with `logger.info` in commands
- Updated to 391 top-level themes with 385 variant options (variants are nested under themes, not additive)

#### Removed

- Unused lua-loaders and file strategy validation
- Generated reports from git tracking

### Plugin

#### Added

- Native `vim.ui.select` picker integration
- Entry display utilities with icons
- StyLua formatting configuration
- Comprehensive test infrastructure (`tests/helpers/test_utils.lua`, `tests/helpers/fixtures/registry.lua`)

#### Changed

- **Breaking**: replaced custom gallery UI with native picker (simpler, more extensible)
- Applied StyLua formatting to all Lua files
- Fixed all luacheck warnings
- Improved Lua 5.1 compatibility (replaced `goto` with `if-not`)
- **Refactored test suite** (25% line reduction, 76% integration test reduction):
  - Created shared test utilities
  - Rewrote integration tests to be focused and smaller
  - Standardized module reset patterns
  - Added test fixtures

#### Removed

- Custom gallery UI components (`ui/gallery/`)
- Deprecated log utility
- **Removed Python dependencies**: migrated `lint-lua.py` and `smoke.py` to Bash

### Monorepo

#### Added

- Root-level CI/CD workflow with registry and plugin jobs
- Documentation for planned dependency upgrades (`docs/dependencies.md`)
- Release automation script (`scripts/release.sh`)
- CHANGELOG.md for tracking changes

#### Changed

- Restructured into `packages/` directory with domain organization
- Root scripts now delegate to registry workspace (removed zx dependency)

#### Removed

- Empty `packages/validate` directory

## [0.1.0] - 2025-01-15

### Added

- Initial monorepo structure with workspaces
- Registry: TypeScript theme indexer for Neovim colorschemes
- Plugin: Neovim theme browser with gallery UI
- CI/CD workflows for both packages
- Basic documentation and configuration files

[0.3.0]: https://github.com/raulcorreia7/theme-browser-monorepo/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/raulcorreia7/theme-browser-monorepo/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/raulcorreia7/theme-browser-monorepo/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/raulcorreia7/theme-browser-monorepo/releases/tag/v0.1.0
