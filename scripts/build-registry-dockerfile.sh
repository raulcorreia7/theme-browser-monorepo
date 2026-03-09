#!/usr/bin/env bash
# build-registry-dockerfile.sh - Build the registry refresh runner image
#
# Usage:
#   build-registry-dockerfile.sh [image-tag]
#
# Defaults:
#   image-tag: theme-browser-registry-refresh:local

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE_TAG="${1:-theme-browser-registry-refresh:local}"
DOCKERFILE_PATH="$ROOT_DIR/docker/registry.Dockerfile"

if [[ ! -f "$DOCKERFILE_PATH" ]]; then
	echo "error: missing Dockerfile: $DOCKERFILE_PATH" >&2
	exit 1
fi

echo "► Building $IMAGE_TAG"
docker build -t "$IMAGE_TAG" -f "$DOCKERFILE_PATH" "$ROOT_DIR"
echo "✓ Built $IMAGE_TAG"
