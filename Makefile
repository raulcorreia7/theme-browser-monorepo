SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c

.PHONY: all help status clean pipeline sync detect merge build validate test

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
	@echo "Utilities:"
	@echo "  make status      Show git status"
	@echo "  make clean       Clean all artifacts"

status:
	@echo "=== packages/plugin ===" && git -C packages/plugin status --short --branch
	@echo ""
	@echo "=== packages/registry ===" && git -C packages/registry status --short --branch

pipeline:
	@npm run pipeline -w packages/registry
	@echo "✓ Pipeline complete → packages/registry/artifacts/themes.json"

sync:
	@npm run sync -w packages/registry

detect:
	@npm run detect -w packages/registry

merge:
	@npm run merge -w packages/registry

build:
	@npm run build:themes -w packages/registry

validate:
	@npm run validate -w packages/registry

test:
	@npm run test -w packages/registry

clean:
	@npm run clean -w packages/registry
	@rm -rf reports .cache
	@$(MAKE) -C packages/plugin clean
	@echo "✓ Cleaned"
