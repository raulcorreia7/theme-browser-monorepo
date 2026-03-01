SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c

.PHONY: all help status clean pipeline sync detect merge build validate test version version-dry

all: build validate

help:
	@echo "theme-browser-monorepo"
	@echo ""
	@echo "Pipeline:"
	@echo "  make pipeline    Run full pipeline (sync → detect → merge → build)"
	@echo "  make validate    Validate registry"
	@echo "  make test        Run tests"
	@echo ""
	@echo "Individual steps (delegated to packages/registry):"
	@echo "  make sync        Sync themes from GitHub"
	@echo "  make detect      Detect loading strategies"
	@echo "  make merge       Merge sources"
	@echo "  make build       Generate themes.json"
	@echo ""
	@echo "Versioning:"
	@echo "  make version VERSION=0.4.0        Bump version and create tags"
	@echo "  make version-dry VERSION=0.4.0    Preview version bump"
	@echo ""
	@echo "Utilities:"
	@echo "  make status      Show git status"
	@echo "  make clean       Clean all artifacts"

status:
	@echo "=== packages/plugin ===" && git -C packages/plugin status --short --branch
	@echo ""
	@echo "=== packages/registry ===" && git -C packages/registry status --short --branch

pipeline:
	@pnpm --filter @theme-browser/registry pipeline
	@echo "✓ Pipeline complete → packages/registry/artifacts/themes.json"

sync:
	@pnpm --filter @theme-browser/registry task:sync

detect:
	@pnpm --filter @theme-browser/registry task:detect

merge:
	@pnpm --filter @theme-browser/registry task:merge

build:
	@pnpm --filter @theme-browser/registry task:build

validate:
	@pnpm --filter @theme-browser/registry task:validate

test:
	@pnpm --filter @theme-browser/registry test

version:
	@[[ -n "$(VERSION)" ]] || { echo "error: VERSION is required" >&2; exit 1; }
	@./scripts/version.sh "$(VERSION)"

version-dry:
	@[[ -n "$(VERSION)" ]] || { echo "error: VERSION is required" >&2; exit 1; }
	@./scripts/version.sh "$(VERSION)" --dry-run

clean:
	@pnpm --filter @theme-browser/registry clean
	@rm -rf reports .cache
	@$(MAKE) -C packages/plugin clean
	@echo "✓ Cleaned"
