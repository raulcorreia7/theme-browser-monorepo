package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/raulcorreia7/theme-browser-monorepo/internal/appversion"
	"github.com/spf13/cobra"
)

func newVerifyVersioningCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "verify-versioning",
		Short: "Check release metadata and cross-repo version alignment",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runVerifyVersioning(".")
		},
	}
}

var compatibleExtractRe = regexp.MustCompile(`(?m)^local COMPATIBLE_VERSION = "(.*)"$`)

// verifier accumulates failures like verify-versioning.sh.
type verifier struct {
	failures int
}

func (v *verifier) pass(format string, a ...any) { ok(format, a...) }

func (v *verifier) failf(format string, a ...any) {
	fail(format, a...)
	v.failures++
}

// runVerifyVersioning ports scripts/verify-versioning.sh natively
// (no ripgrep). root is the repo root directory.
func runVerifyVersioning(root string) error {
	v := &verifier{}

	requireFile := func(rel string) {
		if _, err := os.Stat(filepath.Join(root, rel)); err != nil {
			v.failf("missing file: %s", rel)
		}
	}
	requireFile(rootVersionFile)
	requireFile(registryVersionFile)
	requireFile("CHANGELOG.md")
	requireFile(filepath.Join(pluginDir, "CHANGELOG.md"))
	requireFile(pluginSyncFile)
	v.ensureGitmodulesEntries(root)

	if v.failures != 0 {
		fmt.Fprintln(os.Stderr, "")
		fmt.Fprintf(os.Stderr, "verify-versioning: %d issue(s) found\n", v.failures)
		os.Exit(1)
	}

	rootVersion := readVersionFileAt(root, rootVersionFile)
	registryVersion := readVersionFileAt(root, registryVersionFile)
	data, _ := os.ReadFile(filepath.Join(root, pluginSyncFile))
	m := compatibleExtractRe.FindStringSubmatch(string(data))
	pluginCompat := ""
	if m != nil {
		pluginCompat = m[1]
	}
	registrySeries := versionSeries(registryVersion)

	if rootVersion == "" {
		v.failf("root VERSION is missing a version")
	} else {
		v.pass("root version: %s", rootVersion)
	}

	if registryVersion == "" {
		v.failf("registry VERSION is missing a version")
	} else {
		v.pass("registry version: %s", registryVersion)
	}

	if rootVersion != "" && rootVersion == registryVersion {
		v.pass("root and registry versions are aligned")
	} else {
		v.failf("root version (%s) and registry version (%s) differ", rootVersion, registryVersion)
	}

	if pluginCompat != "" && pluginCompat == registrySeries {
		v.pass("plugin compatibility series matches registry series (%s)", pluginCompat)
	} else {
		v.failf("plugin compatibility series (%s) does not match registry series (%s)", pluginCompat, registrySeries)
	}

	if rootVersion != "" {
		v.ensureChangelogEntry(root, "CHANGELOG.md", rootVersion, "root")
		v.ensureChangelogEntry(root, filepath.Join(pluginDir, "CHANGELOG.md"), rootVersion, "plugin")
	}

	v.ensureReleaseDocReferences(root)

	if appversion.Current() != rootVersion {
		// The embedded copy is refreshed by `tb release`; a mismatch means the
		// tree needs `go build` to pick it up or release was bypassed.
		v.failf("embedded app version (%s) differs from root VERSION (%s)", appversion.Current(), rootVersion)
	} else {
		v.pass("embedded app version matches root VERSION")
	}

	if v.failures != 0 {
		fmt.Fprintln(os.Stderr, "")
		fmt.Fprintf(os.Stderr, "verify-versioning: %d issue(s) found\n", v.failures)
		os.Exit(1)
	}

	fmt.Println("")
	ok("versioning metadata is consistent")
	return nil
}

func readVersionFileAt(root, rel string) string {
	b, err := os.ReadFile(filepath.Join(root, rel))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

func (v *verifier) ensureGitmodulesEntries(root string) {
	path := filepath.Join(root, ".gitmodules")
	data, err := os.ReadFile(path)
	if err != nil {
		v.failf(".gitmodules is missing")
		return
	}
	content := string(data)
	hasPlugin := strings.Contains(content, `submodule "packages/plugin"`)
	hasRegistry := strings.Contains(content, `submodule "packages/registry"`)
	if hasPlugin && hasRegistry {
		v.pass(".gitmodules declares plugin and registry submodules")
	} else {
		v.failf(".gitmodules is missing plugin or registry submodule entries")
	}
}

func (v *verifier) ensureChangelogEntry(root, changelog, version, label string) {
	data, err := os.ReadFile(filepath.Join(root, changelog))
	if err != nil || !containsLine(data, "## ["+version+"]") {
		v.failf("%s changelog missing entry for %s (%s)", label, version, changelog)
		return
	}
	v.pass("%s changelog has entry for %s", label, version)
}

// ensureReleaseDocReferences replaces the ripgrep scan with a native walk:
// docs/release.md must document the tb release flow.
func (v *verifier) ensureReleaseDocReferences(root string) {
	var matches []string

	scan := func(path string) {
		data, err := os.ReadFile(path)
		if err != nil {
			return
		}
		for i, line := range strings.Split(string(data), "\n") {
			if strings.Contains(line, "scripts/version.sh") {
				matches = append(matches, fmt.Sprintf("%s:%d:%s", path, i+1, line))
			}
		}
	}

	scan(filepath.Join(root, "README.md"))
	docsDir := filepath.Join(root, "docs")
	if entries, err := os.ReadDir(docsDir); err == nil {
		for _, e := range entries {
			if !e.IsDir() && strings.HasSuffix(e.Name(), ".md") {
				scan(filepath.Join(docsDir, e.Name()))
			}
		}
	}

	releaseDoc := filepath.Join(docsDir, "release.md")
	data, err := os.ReadFile(releaseDoc)
	if err != nil || !strings.Contains(string(data), "tb release") {
		v.failf("docs/release.md does not reference `tb release`")
	} else {
		v.pass("release docs reference tb release")
	}
}
