# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

#### Removed

- Unused lua-loaders and file strategy validation
- Generated reports from git tracking

### Plugin

#### Added

- Native `vim.ui.select` picker integration
- Entry display utilities with icons
- StyLua formatting configuration

#### Changed

- **Breaking**: replaced custom gallery UI with native picker (simpler, more extensible)
- Applied StyLua formatting to all Lua files
- Fixed all luacheck warnings
- Improved Lua 5.1 compatibility (replaced `goto` with `if-not`)

#### Removed

- Custom gallery UI components (`ui/gallery/`)
- Deprecated log utility

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

[0.2.0]: https://github.com/raulcorreia7/theme-browser-monorepo/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/raulcorreia7/theme-browser-monorepo/releases/tag/v0.1.0
