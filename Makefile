SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c
.ONESHELL:

ROOT := $(CURDIR)

.PHONY: all help status build validate verify clean \
        sync detect detect-apply merge generate \
        plugin-test plugin-verify plugin-lint

all: build validate verify

help:
	@echo "theme-browser-monorepo"
	@echo ""
	@echo "Pipeline:"
	@echo "  make sync           Sync themes from GitHub (→ artifacts/index.json)"
	@echo "  make detect-dryrun   Detect strategies (dry-run)"
	@echo "  make detect-apply    Apply detected strategies to sources/"
	@echo "  make merge          Merge sources/ → overrides.json"
	@echo "  make generate       Generate final themes.json"
	@echo "  make build          Same as generate"
	@echo ""
	@echo "Validation:"
	@echo "  make validate       Validate registry completeness"
	@echo "  make validate-lua   Validate Lua loader syntax"
	@echo ""
	@echo "Testing:"
	@echo "  make verify         Run all verifications"
	@echo "  make plugin-test    Run theme-browser.nvim tests"
	@echo "  make plugin-verify  Run plugin lint, format check, smoke, and tests"
	@echo ""
	@echo "Utilities:"
	@echo "  make status         Show git status for all repos"
	@echo "  make clean          Clean all artifacts"

status:
	@echo "=== theme-browser.nvim ==="
	@git -C theme-browser.nvim status --short --branch
	@echo ""
	@echo "=== theme-browser-registry-ts ==="
	@git -C theme-browser-registry-ts status --short --branch

sync:
	@npx tsx scripts/01-sync-index.ts

detect-dryrun:
	@npx tsx scripts/02-detect-strategies.ts

detect-apply:
	@npx tsx scripts/02-detect-strategies.ts --apply

merge:
	@npx tsx scripts/03-merge-sources.ts

generate build:
	@node scripts/04-generate-themes.mjs

validate:
	@node scripts/validate/registry.mjs

validate-lua:
	@zx scripts/validate/lua-loaders.mjs

verify: build validate plugin-verify

plugin-test:
	@$(MAKE) -C theme-browser.nvim test

plugin-verify:
	@$(MAKE) -C theme-browser.nvim verify

plugin-lint:
	@$(MAKE) -C theme-browser.nvim lint

clean:
	@rm -rf theme-browser-registry-ts/.state
	@rm -rf theme-browser-registry-ts/artifacts
	@rm -rf theme-browser-registry-ts/dist
	@rm -rf theme-browser-registry-ts/coverage
	@rm -rf reports .cache
	@$(MAKE) -C theme-browser.nvim clean
	@echo "Cleaned all artifacts"
