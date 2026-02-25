SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c
.ONESHELL:

ROOT := $(CURDIR)

.PHONY: all help status build validate verify clean \
        sync-themes detect-strategies build-overrides \
        plugin-test plugin-verify plugin-lint \
        registry-sync registry-watch registry-publish registry-export registry-test

all: build validate verify

help:
	@echo "theme-browser-monorepo"
	@echo ""
	@echo "Build & Generate:"
	@echo "  make build              Generate registry.json from themes.json"
	@echo ""
	@echo "Theme Detection:"
	@echo "  make sync-themes        Sync themes from GitHub"
	@echo "  make detect-strategies  Detect loading strategies (dry-run)"
	@echo "  make build-overrides    Merge sources/*.json → overrides.json"
	@echo ""
	@echo "Validation:"
	@echo "  make validate           Validate registry completeness"
	@echo "  make validate-lua       Validate Lua loader syntax"
	@echo ""
	@echo "Testing:"
	@echo "  make verify             Run all verifications (build + validate + plugin tests)"
	@echo "  make plugin-test        Run theme-browser.nvim tests"
	@echo "  make plugin-verify      Run plugin lint, format check, smoke, and tests"
	@echo "  make registry-test      Run registry-ts tests"
	@echo ""
	@echo "Registry Operations:"
	@echo "  make registry-sync      Sync themes from GitHub"
	@echo "  make registry-watch     Sync themes continuously"
	@echo "  make registry-publish   Sync and publish to git"
	@echo "  make registry-export    Export database to JSON"
	@echo ""
	@echo "Utilities:"
	@echo "  make status             Show git status for all repos"
	@echo "  make clean              Clean all artifacts"

status:
	@echo "=== theme-browser.nvim ==="
	@git -C theme-browser.nvim status --short --branch
	@echo ""
	@echo "=== theme-browser-registry-ts ==="
	@git -C theme-browser-registry-ts status --short --branch

build:
	@node scripts/build/generate-registry.mjs

validate:
	@node scripts/validate/registry.mjs

validate-lua:
	@zx scripts/validate/lua-loaders.mjs

verify: build validate plugin-verify

sync-themes:
	@cd theme-browser-registry-ts && npm run sync

detect-strategies:
	@npx tsx scripts/detect-strategies.ts

detect-strategies-apply:
	@npx tsx scripts/detect-strategies.ts --apply

build-overrides:
	@npx tsx scripts/build-overrides.ts

plugin-test:
	@$(MAKE) -C theme-browser.nvim test

plugin-verify:
	@$(MAKE) -C theme-browser.nvim verify

plugin-lint:
	@$(MAKE) -C theme-browser.nvim lint

registry-sync:
	@cd theme-browser-registry-ts && npm run sync

registry-watch:
	@cd theme-browser-registry-ts && npm run watch

registry-publish:
	@cd theme-browser-registry-ts && npm run publish

registry-export:
	@cd theme-browser-registry-ts && npm run export

registry-test:
	@cd theme-browser-registry-ts && npm test

clean:
	@rm -rf theme-browser-registry-ts/.state
	@rm -rf theme-browser-registry-ts/artifacts
	@rm -rf theme-browser-registry-ts/dist
	@rm -rf theme-browser-registry-ts/coverage
	@$(MAKE) -C theme-browser.nvim clean
	@echo "Cleaned all artifacts"
