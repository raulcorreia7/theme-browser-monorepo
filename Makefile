SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c

.PHONY: all help status clean refresh refresh-testing validate test test-plugin verify verify-versioning install-hooks update-submodules release release-dry

all: verify

help:
	@echo "theme-browser-monorepo"
	@echo ""
	@echo "Common:"
	@echo "  make refresh             Run the monorepo refresh flow"
	@echo "  make refresh-testing     Run the refresh flow in isolated testing mode"
	@echo "  make verify              Run the high-level repo verification flow"
	@echo "  make validate            Validate registry output"
	@echo "  make test                Run registry tests"
	@echo "  make test-plugin         Run plugin verification"
	@echo "  make verify-versioning   Check version/changelog/release metadata"
	@echo "  make install-hooks       Configure local git hooks"
	@echo "  make update-submodules   Fast-forward nested repos and stage pointers"
	@echo ""
	@echo "Versioning:"
	@echo "  make release VERSION=0.4.0        Bump versions and create tags"
	@echo "  make release-dry VERSION=0.4.0    Preview the release"
	@echo ""
	@echo "Utilities:"
	@echo "  make status              Show git status"
	@echo "  make clean               Clean artifacts"

status:
	@echo "=== packages/plugin ===" && git -C packages/plugin status --short --branch
	@echo ""
	@echo "=== packages/registry ===" && git -C packages/registry status --short --branch

refresh:
	@bash ./scripts/refresh.sh

refresh-testing:
	@bash ./scripts/refresh.sh --testing

validate:
	@pnpm --filter @theme-browser/registry validate

test:
	@pnpm --filter @theme-browser/registry test

test-plugin:
	@$(MAKE) -C packages/plugin verify

verify:
	@bash ./scripts/verify-versioning.sh
	@$(MAKE) test
	@$(MAKE) test-plugin
	@$(MAKE) validate

verify-versioning:
	@bash ./scripts/verify-versioning.sh

install-hooks:
	@bash ./scripts/install-hooks.sh

update-submodules:
	@bash ./scripts/update-submodules.sh

release:
	@[[ -n "$(VERSION)" ]] || { echo "error: VERSION is required" >&2; exit 1; }
	@bash ./scripts/release.sh "$(VERSION)"

release-dry:
	@[[ -n "$(VERSION)" ]] || { echo "error: VERSION is required" >&2; exit 1; }
	@bash ./scripts/release.sh "$(VERSION)" --dry-run

clean:
	@pnpm --filter @theme-browser/registry clean
	@rm -rf reports .cache
	@$(MAKE) -C packages/plugin clean
	@echo "✓ Cleaned"
