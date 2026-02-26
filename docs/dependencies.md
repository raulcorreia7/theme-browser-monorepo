# Dependency Upgrades

This document tracks planned dependency upgrades and their migration paths.

## Planned Upgrades

### Zod 3.x → 4.x

**Status**: Planned
**Risk**: Medium (API changes)
**Current**: 3.25.76
**Target**: 4.x

**Migration Notes**:
- Review [Zod 4 migration guide](https://zod.dev/v4)
- Key changes: improved performance, new API patterns
- Test all schema validations thoroughly
- Update any custom error handling

**Affected Files**:
- `packages/registry/src/lib/config.ts`
- `packages/registry/src/lib/schemas.ts`
- All files using zod schemas

---

### Vitest 3.x → 4.x

**Status**: Planned
**Risk**: Low
**Current**: 3.2.4
**Target**: 4.x

**Migration Notes**:
- Review [Vitest changelog](https://github.com/vitest-dev/vitest/releases)
- Check for deprecated APIs
- Update coverage configuration if needed

---

### ESLint 9.x → 10.x

**Status**: Planned
**Risk**: Low
**Current**: 9.39.3
**Target**: 10.x

**Migration Notes**:
- Review [ESint 10 migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0)
- Already using flat config, should be straightforward
- Check typescript-eslint compatibility

---

### better-sqlite3 11.x → 12.x

**Status**: Planned
**Risk**: Medium (native module)
**Current**: 11.10.0
**Target**: 12.6.2

**Migration Notes**:
- Native module - may require rebuild
- Test thoroughly on all target platforms
- Check for API changes in database operations

---

## Upgrade Process

1. Create feature branch for upgrade
2. Update package.json version
3. Run `npm install`
4. Run full test suite
5. Address any breaking changes
6. Update documentation if needed
7. PR with detailed notes

## Last Updated

2026-02-26
