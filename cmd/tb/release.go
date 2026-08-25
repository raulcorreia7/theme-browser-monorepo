package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/raulcorreia7/theme-browser-monorepo/internal/gitutil"
	"github.com/spf13/cobra"
)

const (
	rootVersionFile     = "VERSION"
	appVersionFile      = "internal/appversion/VERSION"
	registryVersionFile = "packages/registry/internal/version/VERSION"
	pluginSyncFile      = "packages/plugin/lua/theme-browser/registry/sync.lua"
)

var semverRe = regexp.MustCompile(`^[0-9]+\.[0-9]+\.[0-9]+$`)
var compatibleVersionRe = regexp.MustCompile(`(?m)^local COMPATIBLE_VERSION = ".*"$`)

func newReleaseCmd() *cobra.Command {
	var dryRun, push, skipDocs, yes bool
	cmd := &cobra.Command{
		Use:   "release <version>",
		Short: "Prepare and tag a coordinated release across the workspace",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			version := args[0]
			if !semverRe.MatchString(version) {
				exitf("version must be semver format (e.g., 0.2.0)")
			}
			return runRelease(version, dryRun, push, skipDocs, yes)
		},
	}
	f := cmd.Flags()
	f.BoolVarP(&dryRun, "dry-run", "d", false, "Show what would be done without executing")
	f.BoolVarP(&push, "push", "p", false, "Push commits and tags to remotes")
	f.BoolVarP(&skipDocs, "skip-docs", "s", false, "Skip documentation checks (use if already updated)")
	f.BoolVarP(&yes, "yes", "y", false, "Skip confirmation prompt")
	return cmd
}

type releaseOpts struct {
	dryRun   bool
	push     bool
	skipDocs bool
	yes      bool
}

// runRelease ports scripts/release.sh without its dead package-lock branches.
func runRelease(v string, dryRun, push, skipDocs, yes bool) error {
	opts := releaseOpts{dryRun: dryRun, push: push, skipDocs: skipDocs, yes: yes}
	tag := "v" + v

	info("Releasing %s", v)
	if dryRun {
		info("(dry run mode)")
	}
	if push {
		info("(will push to remotes)")
	} else {
		info("(local only - use --push to push)")
	}
	if skipDocs {
		info("(skipping docs check)")
	}

	fmt.Println("")
	fmt.Println("Current versions:")
	fmt.Printf("  root:     %s\n", readVersionFile(rootVersionFile))
	fmt.Printf("  registry: %s\n", readVersionFile(registryVersionFile))
	fmt.Println("  plugin:   (lua, no package.json)")
	fmt.Println("")

	if !skipDocs {
		if !checkChangelogs(v) {
			os.Exit(1)
		}
	}

	if err := runVerifyVersioning("."); err != nil {
		return err
	}

	ensureTagAvailableEverywhere(tag)
	checkGitClean(".")

	if !opts.yes {
		fmt.Println("")
		if !confirm(fmt.Sprintf("Proceed with version %s?", v)) {
			return nil
		}
	}

	if err := releaseRegistrySubmodule(v, tag, opts); err != nil {
		return err
	}
	if err := releasePluginSubmodule(v, tag, opts); err != nil {
		return err
	}
	if err := releaseRoot(v, tag, opts); err != nil {
		return err
	}

	fmt.Println("")
	if opts.push {
		ok("Release %s complete and pushed!", v)
	} else {
		ok("Version %s complete (local only)", v)
		info("To push: git push origin --tags && git push origin")
	}
	return nil
}

func readVersionFile(path string) string {
	b, err := os.ReadFile(path)
	if err != nil {
		return "unknown"
	}
	return strings.TrimSpace(string(b))
}

func checkChangelogEntry(v, changelog, label string) bool {
	data, err := os.ReadFile(changelog)
	if err != nil {
		warn("%s changelog not found at %s", label, changelog)
		return false
	}
	if containsLine(data, "## ["+v+"]") {
		ok("%s changelog has entry for %s", label, v)
		return true
	}
	warn("%s changelog missing entry for %s", label, v)
	fmt.Println("")
	fmt.Printf("Add an entry to %s:\n", changelog)
	fmt.Println("")
	fmt.Printf("## [%s] - %s\n", v, currentDate())
	fmt.Println("")
	fmt.Println("### Added")
	fmt.Println("- ...")
	fmt.Println("")
	fmt.Println("### Changed")
	fmt.Println("- ...")
	fmt.Println("")
	fmt.Println("### Fixed")
	fmt.Println("- ...")
	fmt.Println("")
	return false
}

func containsLine(data []byte, needle string) bool {
	for _, line := range strings.Split(string(data), "\n") {
		if strings.Contains(line, needle) {
			return true
		}
	}
	return false
}

func currentDate() string {
	out, err := exec.Command("date", "+%Y-%m-%d").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func checkChangelogs(v string) bool {
	rootOK := checkChangelogEntry(v, "CHANGELOG.md", "root")
	pluginOK := checkChangelogEntry(v, filepath.Join(pluginDir, "CHANGELOG.md"), "plugin")
	return rootOK && pluginOK
}

func ensureTagAvailableEverywhere(tag string) {
	exists := false
	for _, dir := range []string{".", pluginDir, "packages/registry"} {
		if gitutil.TagExists(dir, tag) {
			fail("tag %s already exists in %s", tag, dir)
			exists = true
		}
	}
	if exists {
		os.Exit(1)
	}
}

func checkGitClean(dir string) {
	lines, _ := gitutil.PorcelainNormal(dir)
	if len(lines) > 0 {
		abs, _ := filepath.Abs(dir)
		fail("uncommitted changes in %s", abs)
		gitutil.Stream(dir, "status", "--short")
		os.Exit(1)
	}
}

func checkMainBranch(dir string) string {
	branch := gitutil.CurrentBranch(dir)
	if branch != "main" && branch != "master" {
		exitf("must be on main or master branch (currently on %s)", branch)
	}
	return branch
}

// versionSeries returns the major.minor prefix of a semver string.
func versionSeries(v string) string {
	i := strings.LastIndex(v, ".")
	if i < 0 {
		return v
	}
	return v[:i]
}

func writeFileIfChanged(path, content string) error {
	old, err := os.ReadFile(path)
	if err == nil && string(old) == content {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0o644)
}

// runQualityChecks ports run_quality_checks for the registry submodule,
// which is Go now: go vet ./... replaces the package.json script probes.
func runQualityChecks(registryDir string, opts releaseOpts) error {
	if opts.dryRun {
		dryLog("Run quality checks in %s", registryDir)
		return nil
	}
	info("Running quality checks (go vet ./...)...")
	cmd := exec.Command("go", "vet", "./...")
	cmd.Dir = registryDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		warn("Quality checks failed.")
		return fmt.Errorf("go vet in %s: %w", registryDir, err)
	}
	return nil
}

// commitVersionBump ports commit_version_bump.
func commitVersionBump(opts releaseOpts, dir, msg string, paths ...string) error {
	if len(paths) == 0 {
		exitf("commit_version_bump requires at least one path")
	}
	if opts.dryRun {
		dryLog("Commit: %s", msg)
		dryLog("Stage paths: %s", strings.Join(paths, " "))
		return nil
	}
	args := append([]string{"add", "--"}, paths...)
	if err := gitutil.Stream(dir, args...); err != nil {
		return err
	}
	if gitutil.Quiet(dir, "diff", "--cached", "--quiet") {
		info("No staged changes for: %s", strings.Join(paths, " "))
		return nil
	}
	return gitutil.Stream(dir, "commit", "-m", msg)
}

func confirm(msg string) bool {
	fmt.Printf("%s [y/N] ", msg)
	reader := bufio.NewReader(os.Stdin)
	response, _ := reader.ReadString('\n')
	switch strings.TrimSpace(response) {
	case "y", "Y", "yes", "YES", "Yes":
		return true
	}
	return false
}

func gitDirty(dir, path string) bool {
	return !gitutil.Quiet(dir, "diff", "--quiet", "HEAD", "--", path)
}

func releaseRegistrySubmodule(v, tag string, opts releaseOpts) error {
	dir := "packages/registry"
	info("--- Releasing %s ---", dir)

	checkGitClean(dir)
	branch := checkMainBranch(dir)
	if gitutil.TagExists(dir, tag) {
		exitf("tag %s already exists in %s", tag, dir)
	}

	if err := runQualityChecks(dir, opts); err != nil {
		return err
	}

	current := readVersionFile(registryVersionFile)
	if current == "unknown" {
		exitf("%s not found", registryVersionFile)
	}
	if opts.dryRun {
		dryLog("Update %s to version %s", registryVersionFile, v)
	} else {
		info("Bump %s: %s → %s", dir, current, v)
		if err := writeFileIfChanged(registryVersionFile, v+"\n"); err != nil {
			return err
		}
	}

	const rel = "internal/version/VERSION"
	if !opts.dryRun && gitDirty(dir, rel) {
		if err := commitVersionBump(opts, dir, "chore(release): bump version to "+v, rel); err != nil {
			return err
		}
	}

	return releaseTagAndMaybePush(dir, branch, tag, opts, dir)
}

func releasePluginSubmodule(v, tag string, opts releaseOpts) error {
	dir := pluginDir
	info("--- Releasing %s ---", dir)

	checkGitClean(dir)
	branch := checkMainBranch(dir)
	if gitutil.TagExists(dir, tag) {
		exitf("tag %s already exists in %s", tag, dir)
	}

	series := versionSeries(v)
	syncRel := "lua/theme-browser/registry/sync.lua"
	if _, err := os.Stat(pluginSyncFile); err != nil {
		exitf("plugin sync file not found: %s", pluginSyncFile)
	}
	if opts.dryRun {
		dryLog("Update plugin compatibility series to %s in %s", series, pluginSyncFile)
		dryLog("Commit version bump in %s", dir)
	} else {
		info("Set plugin compatibility series to %s", series)
		data, err := os.ReadFile(pluginSyncFile)
		if err != nil {
			return err
		}
		updated := compatibleVersionRe.ReplaceAllString(string(data), `local COMPATIBLE_VERSION = "`+series+`"`)
		if err := os.WriteFile(pluginSyncFile, []byte(updated), 0o644); err != nil {
			return err
		}
		if gitDirty(dir, syncRel) {
			if err := commitVersionBump(opts, dir, "chore(release): align compatibility to "+v, syncRel); err != nil {
				return err
			}
		} else {
			info("No compatibility change in %s, skipping commit", dir)
		}
	}

	return releaseTagAndMaybePush(dir, branch, tag, opts, dir)
}

func releaseRoot(v, tag string, opts releaseOpts) error {
	info("--- Releasing root ---")

	branch := checkMainBranch(".")
	if gitutil.TagExists(".", tag) {
		exitf("tag %s already exists", tag)
	}

	current := readVersionFile(rootVersionFile)
	if opts.dryRun {
		dryLog("Update %s to version %s", rootVersionFile, v)
		dryLog("Update %s to version %s", appVersionFile, v)
	} else {
		info("Bump root: %s → %s", current, v)
		if err := writeFileIfChanged(rootVersionFile, v+"\n"); err != nil {
			return err
		}
		if err := writeFileIfChanged(appVersionFile, v+"\n"); err != nil {
			return err
		}
	}

	if err := runVerifyVersioning("."); err != nil {
		return err
	}

	if err := commitVersionBump(opts, ".", "chore(release): bump version to "+v,
		rootVersionFile, appVersionFile, "packages/registry", "packages/plugin"); err != nil {
		return err
	}

	return releaseTagAndMaybePush(".", branch, tag, opts, "root")
}

func releaseTagAndMaybePush(dir, branch, tag string, opts releaseOpts, label string) error {
	if opts.dryRun {
		dryLog("git -C %s tag %s", dir, tag)
	} else if err := gitutil.Stream(dir, "tag", tag); err != nil {
		return err
	}
	if opts.push {
		if opts.dryRun {
			dryLog("git -C %s push origin %s", dir, branch)
			dryLog("git -C %s push origin %s", dir, tag)
		} else {
			if err := gitutil.Stream(dir, "push", "origin", branch); err != nil {
				return err
			}
			if err := gitutil.Stream(dir, "push", "origin", tag); err != nil {
				return err
			}
		}
		ok("%s released and pushed", label)
	} else {
		ok("%s tagged (not pushed - use --push)", label)
	}
	return nil
}
