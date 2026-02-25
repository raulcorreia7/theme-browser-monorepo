SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c
.ONESHELL:

ROOT := $(CURDIR)

.PHONY: all help status clean \
        sync detect merge build pipeline publish \
        validate validate-lua \
        test test-plugin verify

all: build validate

pipeline: sync detect merge build
	@echo "✓ Pipeline complete → artifacts/themes.json"

publish: pipeline
	@echo "→ Publishing to registry repo..."
	@cd theme-browser-registry-ts && git add -A && git commit -m "chore: update themes $(shell date +%Y-%m-%d)" && git push
	@echo "✓ Pushed to registry repo (CI will create release)"

help:
	@echo "theme-browser-monorepo"
	@echo ""
	@echo "Pipeline (run in order):"
	@echo "  make sync        01: Sync themes from GitHub → artifacts/index.json"
	@echo "  make detect      02: Detect strategies → sources/*.json"
	@echo "  make merge       03: Merge sources → overrides.json"
	@echo "  make build       04: Generate final themes.json"
	@echo ""
	@echo "  make pipeline    Run all steps in sequence"
	@echo "  make publish     Push to registry repo (triggers release)"
	@echo ""
	@echo "Validation:"
	@echo "  make validate       Validate registry completeness"
	@echo "  make validate-lua   Validate Lua loader syntax"
	@echo "  make verify         Full verification (build + validate + plugin)"
	@echo ""
	@echo "Testing:"
	@echo "  make test           Run registry tests"
	@echo "  make test-plugin    Run plugin tests"
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

detect:
	@npx tsx scripts/02-detect-strategies.ts --apply

merge:
	@npx tsx scripts/03-merge-sources.ts

build:
	@node scripts/04-generate-themes.mjs

validate:
	@node scripts/validate/registry.mjs

validate-lua:
	@zx scripts/validate/lua-loaders.mjs

verify: build validate
	@$(MAKE) -C theme-browser.nvim verify

test:
	@npm run test -w theme-browser-registry-ts

test-plugin:
	@$(MAKE) -C theme-browser.nvim test

clean:
	@rm -rf theme-browser-registry-ts/.state
	@rm -rf theme-browser-registry-ts/artifacts
	@rm -rf theme-browser-registry-ts/dist
	@rm -rf theme-browser-registry-ts/coverage
	@rm -rf reports .cache
	@$(MAKE) -C theme-browser.nvim clean
	@echo "✓ Cleaned all artifacts"
