SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c

.PHONY: all help status clean build refresh refresh-testing validate test test-plugin verify verify-versioning install-hooks update-submodules release release-dry

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

build:
	@mkdir -p bin
	@go build -ldflags "-X main.version=$$(cat VERSION)" -o bin/tb ./cmd/tb

refresh:
	@./bin/tb refresh

refresh-testing:
	@./bin/tb refresh --testing

validate:
	@cd packages/registry && go run ./cmd/registry validate -i artifacts/themes.json

test:
	@cd packages/registry && go test ./...

test-plugin:
	@$(MAKE) -C packages/plugin verify

verify:
	@$(MAKE) verify-versioning
	@$(MAKE) test
	@$(MAKE) test-plugin
	@$(MAKE) validate

verify-versioning:
	@./bin/tb verify-versioning

install-hooks:
	@./bin/tb install-hooks

update-submodules:
	@./bin/tb update-submodules

release:
	@[[ -n "$(VERSION)" ]] || { echo "error: VERSION is required" >&2; exit 1; }
	@./bin/tb release "$(VERSION)"

release-dry:
	@[[ -n "$(VERSION)" ]] || { echo "error: VERSION is required" >&2; exit 1; }
	@./bin/tb release "$(VERSION)" --dry-run

clean:
	@rm -rf packages/registry/dist packages/registry/coverage packages/registry/.state packages/registry/artifacts packages/registry/reports
	@rm -rf reports .cache
	@rm -rf packages/plugin/dist
	@echo "✓ Cleaned"
