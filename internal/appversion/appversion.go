// Package appversion exposes the root monorepo version, embedded at build
// time from this package's VERSION file (kept in sync by `tb release`).
package appversion

import (
	_ "embed"
	"strings"
)

//go:embed VERSION
var embedded string

// Current returns the embedded version without requiring a rebuild-aware
// runtime source.
func Current() string {
	return strings.TrimSpace(embedded)
}
