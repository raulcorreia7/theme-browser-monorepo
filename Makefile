.PHONY: all help status plugin-verify registry-sync registry-watch registry-publish registry-export registry-test registry-clean

all: status plugin-verify registry-test

help:
	@echo "theme-browser-monorepo"
	@echo ""
	@echo "Usage:"
	@echo "  make status              Show git status for all repos"
	@echo "  make plugin-verify       Run theme-browser.nvim verification"
	@echo "  make registry-sync       Sync themes from GitHub"
	@echo "  make registry-watch      Sync themes continuously"
	@echo "  make registry-publish    Sync and publish to git"
	@echo "  make registry-export     Export database to JSON"
	@echo "  make registry-test       Run registry tests"
	@echo "  make registry-clean      Clean registry artifacts"

status:
	@git -C theme-browser.nvim status --short --branch
	@git -C theme-browser-registry-ts status --short --branch

plugin-verify:
	@$(MAKE) -C theme-browser.nvim verify

registry-sync:
	@cd theme-browser-registry-ts && npx tsx src/index.ts sync

registry-watch:
	@cd theme-browser-registry-ts && npx tsx src/index.ts watch

registry-publish:
	@cd theme-browser-registry-ts && npx tsx src/index.ts publish

registry-export:
	@cd theme-browser-registry-ts && npx tsx src/index.ts export

registry-test:
	@cd theme-browser-registry-ts && npm test

registry-clean:
	@rm -rf theme-browser-registry-ts/.state
	@rm -rf theme-browser-registry-ts/artifacts
