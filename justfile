set shell := ["bash", "-euo", "pipefail", "-c"]

# Run the full verification flow.
default: verify

# Show available recipes.
help:
    @just --list

# Show git status of the nested submodule checkouts.
[group('common')]
status:
    @echo "=== packages/plugin ===" && git -C packages/plugin status --short --branch
    @echo ""
    @echo "=== packages/registry ===" && git -C packages/registry status --short --branch

# Build the tb CLI into bin/tb, embedding VERSION.
[group('common')]
build:
    @mkdir -p bin
    @go build -ldflags "-X main.version=$(cat VERSION)" -o bin/tb ./cmd/tb

# Run the monorepo refresh flow.
[group('common')]
refresh:
    @./bin/tb refresh

# Run the refresh flow in isolated testing mode.
[group('common')]
refresh-testing:
    @./bin/tb refresh --testing

# Validate registry output.
[group('common')]
validate:
    @cd packages/registry && go run ./cmd/registry validate -i artifacts/themes.json

# Run registry tests.
[group('common')]
test:
    @cd packages/registry && go test ./...

# Run plugin verification (delegates to the plugin submodule's own Makefile, unchanged).
[group('common')]
test-plugin:
    @make -C packages/plugin verify

# Run the high-level repo verification flow.
[group('common')]
verify: verify-versioning test test-plugin validate

# Check version/changelog/release metadata.
[group('common')]
verify-versioning:
    @./bin/tb verify-versioning

# Configure local git hooks.
[group('common')]
install-hooks:
    @./bin/tb install-hooks

# Fast-forward nested repos and stage pointers.
[group('common')]
update-submodules:
    @./bin/tb update-submodules

# Bump versions and create tags. Usage: just release 0.4.0
[group('versioning')]
release version:
    @./bin/tb release "{{ version }}"

# Preview the release without tagging. Usage: just release-dry 0.4.0
[group('versioning')]
release-dry version:
    @./bin/tb release "{{ version }}" --dry-run

# Clean generated artifacts.
[group('utilities')]
clean:
    @rm -rf packages/registry/dist packages/registry/coverage packages/registry/.state packages/registry/artifacts packages/registry/reports
    @rm -rf reports .cache
    @rm -rf packages/plugin/dist
    @echo "✓ Cleaned"
