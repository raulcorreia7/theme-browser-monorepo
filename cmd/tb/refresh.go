package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/raulcorreia7/theme-browser-monorepo/internal/gitutil"
	"github.com/raulcorreia7/theme-browser-monorepo/internal/registrybin"
	"github.com/spf13/cobra"
)

const (
	pluginDir             = "packages/plugin"
	pluginRegistryPath    = "lua/theme-browser/data/registry.json"
	defaultMonorepoURL    = "https://github.com/raulcorreia7/theme-browser-monorepo.git"
	defaultWorkRoot       = "/var/lib/theme-browser-refresh"
	defaultMonorepoBranch = "master"
	defaultRegistryBranch = "master"
	defaultPluginBranch   = "main"
)

func newRefreshCmd() *cobra.Command {
	var (
		force, noCache, testing bool
		commit, dryRun          bool
		unattended              bool
	)
	cmd := &cobra.Command{
		Use:   "refresh",
		Short: "Run the registry refresh flow and optionally commit plugin changes",
		RunE: func(cmd *cobra.Command, args []string) error {
			if unattended {
				return runUnattendedRefresh(dryRun)
			}
			return runRefresh(force, noCache, testing, commit, dryRun)
		},
	}
	f := cmd.Flags()
	f.BoolVarP(&force, "force", "f", false, "Force sync refresh (ignore cache)")
	f.BoolVarP(&noCache, "no-cache", "n", false, "Disable detect cache")
	f.BoolVarP(&testing, "testing", "t", false, "Testing mode (isolated outputs)")
	f.BoolVarP(&commit, "commit", "c", false, "Commit plugin refresh in the submodule and stage the root pointer update")
	f.BoolVarP(&dryRun, "dry-run", "d", false, "Show what would be done without executing")
	f.BoolVar(&unattended, "unattended", false, "Clone the monorepo, refresh registry data, and optionally push (registry-refresh.sh flow)")
	return cmd
}

// runRefresh ports scripts/refresh.sh.
func runRefresh(force, noCache, testing, commit, dryRun bool) error {
	info("Running monorepo refresh")
	if dryRun {
		info("(dry run mode)")
	}
	if testing {
		info("(testing mode)")
	}

	var pipelineArgs []string
	if force {
		pipelineArgs = append(pipelineArgs, "--force")
	}
	if noCache {
		pipelineArgs = append(pipelineArgs, "--no-cache")
	}
	if testing {
		pipelineArgs = append(pipelineArgs, "--testing")
	}

	info("Step 1/2: Run registry refresh")
	if dryRun {
		dryLog("(cd packages/registry && go build -o bin/registry ./cmd/registry && ./bin/registry pipeline %s)",
			strings.Join(pipelineArgs, " "))
	} else {
		if err := registrybin.Build("packages/registry"); err != nil {
			return err
		}
		if err := registrybin.Run("packages/registry", append([]string{"pipeline"}, pipelineArgs...)...); err != nil {
			return err
		}
		ok("Registry refresh complete")
	}

	if testing {
		warn("Testing mode: skipping plugin refresh commit")
		return nil
	}

	info("Step 2/2: Review plugin refresh")
	if pluginRegistryChanged() {
		ok("Plugin data updated (registry.json bundled)")
		if commit {
			if err := commitPluginRefresh(dryRun); err != nil {
				return err
			}
		} else {
			warn("Plugin repo has bundled registry changes. Run with --commit, or commit manually.")
			info("Manual flow: commit packages/plugin first, then commit the root packages/plugin pointer")
		}
	} else {
		ok("No plugin changes detected")
	}

	fmt.Println("")
	ok("Refresh complete!")
	fmt.Println("Outputs:")
	fmt.Println("  - packages/registry/artifacts/themes.json")
	fmt.Println("  - packages/registry/artifacts/manifest.json")
	fmt.Println("  - packages/plugin/lua/theme-browser/data/registry.json")
	return nil
}

func pluginRegistryChanged() bool {
	return gitutil.HasChanges(pluginDir, pluginRegistryPath)
}

func rootPluginPointerChanged() bool {
	return gitutil.HasChanges(".", pluginDir)
}

// unexpectedChanges ports refresh.sh's list_unexpected_changes: porcelain
// lines whose status path is not in allowed.
func unexpectedChanges(dir string, allowed ...string) ([]string, error) {
	lines, err := gitutil.Porcelain(dir)
	if err != nil {
		return nil, err
	}
	var out []string
	for _, line := range lines {
		path := gitutil.StatusPath(line)
		isAllowed := false
		for _, a := range allowed {
			if path == a {
				isAllowed = true
				break
			}
		}
		if !isAllowed {
			out = append(out, line)
		}
	}
	return out, nil
}

func commitPluginRefresh(dryRun bool) error {
	if dryRun {
		dryLog("Commit plugin refresh in packages/plugin")
		dryLog("Commit root submodule pointer update")
		return nil
	}

	if !pluginRegistryChanged() {
		info("No plugin registry changes to commit")
		return nil
	}

	unexpected, err := unexpectedChanges(pluginDir, pluginRegistryPath)
	if err != nil {
		return err
	}
	if len(unexpected) > 0 {
		fail("packages/plugin has unrelated changes; commit manually:")
		for _, line := range unexpected {
			fmt.Fprintln(os.Stderr, line)
		}
		os.Exit(1)
	}

	info("Committing bundled registry refresh in packages/plugin")
	if err := gitutil.Stream(pluginDir, "add", "--", pluginRegistryPath); err != nil {
		return err
	}
	if err := gitutil.Stream(pluginDir, "commit", "-m", "chore: refresh bundled registry"); err != nil {
		return err
	}
	ok("Plugin refresh committed")

	rootUnexpected, err := unexpectedChanges(".", pluginDir)
	if err != nil {
		return err
	}
	if len(rootUnexpected) > 0 {
		warn("Root repo has unrelated changes; leaving submodule pointer commit for manual review")
		for _, line := range rootUnexpected {
			fmt.Fprintln(os.Stderr, line)
		}
		return nil
	}

	if !rootPluginPointerChanged() {
		info("No root submodule pointer changes to commit")
		return nil
	}

	info("Committing root submodule pointer update")
	if err := gitutil.Stream(".", "add", "--", pluginDir); err != nil {
		return err
	}
	if err := gitutil.Stream(".", "commit", "-m", "chore(plugin): update submodule pointer"); err != nil {
		return err
	}
	ok("Root submodule pointer committed")
	return nil
}

// --- unattended flow (ports scripts/registry-refresh.sh) ---

type unattendedConfig struct {
	authUser       string
	monorepoURL    string
	monorepoBranch string
	registryBranch string
	pluginBranch   string
	workRoot       string
	skipPush       bool
	skipSubmodules bool
	token          string
	authorName     string
	authorEmail    string
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envTrue(key string) bool { return os.Getenv(key) == "true" }

func requireEnv(key string) bool {
	if os.Getenv(key) == "" {
		tsFail("missing required env: %s", key)
		return false
	}
	return true
}

// buildAuthenticatedURL mirrors build_authenticated_url in registry-refresh.sh.
func buildAuthenticatedURL(url, authUser, token string) string {
	switch {
	case strings.HasPrefix(url, "https://github.com/"):
		return fmt.Sprintf("https://%s:%s@github.com/%s", authUser, token, strings.TrimPrefix(url, "https://github.com/"))
	case strings.HasPrefix(url, "git@github.com:"):
		return fmt.Sprintf("https://%s:%s@github.com/%s", authUser, token, strings.TrimPrefix(url, "git@github.com:"))
	}
	return url
}

func runUnattendedRefresh(dryRun bool) error {
	if !requireEnv("GITHUB_TOKEN") || !requireEnv("GIT_AUTHOR_NAME") || !requireEnv("GIT_AUTHOR_EMAIL") {
		os.Exit(1)
	}
	cfg := unattendedConfig{
		authUser:       envOr("GIT_AUTH_USER", "git"),
		monorepoURL:    envOr("MONOREPO_URL", defaultMonorepoURL),
		monorepoBranch: envOr("MONOREPO_BRANCH", defaultMonorepoBranch),
		registryBranch: envOr("REGISTRY_BRANCH", defaultRegistryBranch),
		pluginBranch:   envOr("PLUGIN_BRANCH", defaultPluginBranch),
		workRoot:       envOr("WORK_ROOT", defaultWorkRoot),
		skipPush:       envTrue("SKIP_PUSH"),
		skipSubmodules: envTrue("SKIP_SUBMODULE_UPDATE"),
		token:          os.Getenv("GITHUB_TOKEN"),
		authorName:     os.Getenv("GIT_AUTHOR_NAME"),
		authorEmail:    os.Getenv("GIT_AUTHOR_EMAIL"),
	}

	runDir := ""
	var repoDir string
	if dryRun {
		repoDir = filepath.Join(cfg.workRoot, "repo-dry-run")
	} else {
		if err := os.MkdirAll(cfg.workRoot, 0o755); err != nil {
			return err
		}
		tmp, err := os.MkdirTemp(cfg.workRoot, "run.")
		if err != nil {
			return err
		}
		runDir = tmp
		defer func() {
			tsInfo("Cleaning up workspace: %s", runDir)
			os.RemoveAll(runDir)
		}()
		repoDir = filepath.Join(runDir, "repo")
	}

	showUnattendedVersions()
	showUnattendedConfig(cfg, dryRun)

	tsInfo("Clone monorepo")
	if dryRun {
		tsDryLog("git clone --branch %s --recurse-submodules %s %s", cfg.monorepoBranch, cfg.monorepoURL, repoDir)
	} else if err := gitutil.Stream(".", "clone", "--branch", cfg.monorepoBranch, "--recurse-submodules", cfg.monorepoURL, repoDir); err != nil {
		return err
	}

	if !dryRun {
		for _, dir := range []string{repoDir, filepath.Join(repoDir, "packages/registry"), filepath.Join(repoDir, "packages/plugin")} {
			if err := configureRepoAccess(dir, cfg); err != nil {
				return err
			}
		}
	}

	tsInfo("Prepare branches")
	if dryRun {
		tsDryLog("git -C %s checkout %s", repoDir, cfg.monorepoBranch)
	} else if err := gitutil.Stream(repoDir, "checkout", cfg.monorepoBranch); err != nil {
		return err
	}
	for _, pair := range [][2]string{
		{filepath.Join(repoDir, "packages/registry"), cfg.registryBranch},
		{filepath.Join(repoDir, "packages/plugin"), cfg.pluginBranch},
	} {
		if err := prepareBranch(pair[0], pair[1], dryRun); err != nil {
			return err
		}
	}

	if !cfg.skipSubmodules {
		tsInfo("Fast-forward submodules")
		if dryRun {
			tsDryLog("(cd %s && tb update-submodules)", repoDir)
		} else if err := runUpdateSubmodules(repoDir, false); err != nil {
			return err
		}
	}

	// registry-refresh.sh ran `pnpm install` here; the Go rewrite has no node
	// dependency — module downloads happen inside `make refresh`.

	tsInfo("Run refresh")
	if dryRun {
		tsDryLog("(cd %s && make refresh)", repoDir)
	} else if err := runInDir(repoDir, "make", "refresh"); err != nil {
		return err
	}

	tsInfo("Run verification")
	if dryRun {
		tsDryLog("(cd %s && make verify)", repoDir)
	} else if err := runInDir(repoDir, "make", "verify"); err != nil {
		return err
	}

	if dryRun {
		tsOk("Dry run complete")
		return nil
	}

	registryChanged := false
	pluginChanged := false

	if commitIfChanged(filepath.Join(repoDir, "packages/registry"), "chore: refresh registry data") {
		registryChanged = true
		pushBranch(filepath.Join(repoDir, "packages/registry"), cfg.registryBranch, cfg.skipPush)
	}

	if commitIfChanged(filepath.Join(repoDir, "packages/plugin"), "chore: refresh bundled registry") {
		pluginChanged = true
		pushBranch(filepath.Join(repoDir, "packages/plugin"), cfg.pluginBranch, cfg.skipPush)
	}

	if registryChanged || pluginChanged {
		if err := gitutil.Stream(repoDir, "add", "packages/registry", "packages/plugin"); err != nil {
			return err
		}
	}

	if commitIfChanged(repoDir, "chore: refresh submodule pointers") {
		pushBranch(repoDir, cfg.monorepoBranch, cfg.skipPush)
	} else {
		tsInfo("No root changes to commit")
	}

	tsOk("Refresh run complete")
	return nil
}

func showUnattendedVersions() {
	tsInfo("Runtime versions")
	if gitVersion, err := gitutil.Output(".", "--version"); err == nil {
		fmt.Printf("  git: %s\n", lastField(gitVersion))
	}
	fmt.Printf("  go: %s\n", runtime.Version())
}

func showUnattendedConfig(cfg unattendedConfig, dryRun bool) {
	tsInfo("Run configuration")
	fmt.Printf("  repo: %s\n", cfg.monorepoURL)
	fmt.Printf("  branches: root=%s registry=%s plugin=%s\n", cfg.monorepoBranch, cfg.registryBranch, cfg.pluginBranch)
	fmt.Printf("  work_root: %s\n", cfg.workRoot)
	fmt.Printf("  skip_push: %v\n", cfg.skipPush)
	fmt.Printf("  skip_submodule_update: %v\n", cfg.skipSubmodules)
	fmt.Printf("  dry_run: %v\n", dryRun)
}

func configureRepoAccess(dir string, cfg unattendedConfig) error {
	if err := gitutil.Stream(dir, "config", "user.name", cfg.authorName); err != nil {
		return err
	}
	if err := gitutil.Stream(dir, "config", "user.email", cfg.authorEmail); err != nil {
		return err
	}
	remoteURL := gitutil.RemoteURL(dir)
	authenticated := buildAuthenticatedURL(remoteURL, cfg.authUser, cfg.token)
	if authenticated != remoteURL {
		if err := gitutil.Stream(dir, "remote", "set-url", "origin", authenticated); err != nil {
			return err
		}
	}
	return nil
}

func prepareBranch(path, branch string, dryRun bool) error {
	if dryRun {
		tsDryLog("git -C %s fetch origin %s", path, branch)
		tsDryLog("git -C %s checkout -B %s origin/%s", path, branch, branch)
		return nil
	}
	if err := gitutil.Stream(path, "fetch", "origin", branch); err != nil {
		return err
	}
	return gitutil.Stream(path, "checkout", "-B", branch, "origin/"+branch)
}

func commitIfChanged(path, message string) bool {
	lines, _ := gitutil.Porcelain(path)
	if len(lines) == 0 {
		tsInfo("No changes in %s", path)
		return false
	}
	tsInfo("Changes detected in %s", path)
	if err := gitutil.Stream(path, "add", "-A"); err != nil {
		tsFail("%v", err)
		os.Exit(1)
	}
	if err := gitutil.Stream(path, "commit", "-m", message); err != nil {
		tsFail("%v", err)
		os.Exit(1)
	}
	return true
}

func pushBranch(path, branch string, skipPush bool) {
	if skipPush {
		tsDryLog("git -C %s push origin %s", path, branch)
		return
	}
	tsInfo("Push %s -> origin/%s", path, branch)
	if err := gitutil.Stream(path, "push", "origin", branch); err != nil {
		tsFail("%v", err)
		os.Exit(1)
	}
}

func runInDir(dir string, name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("%s %s (in %s): %w", name, strings.Join(args, " "), dir, err)
	}
	return nil
}

func lastField(s string) string {
	fields := strings.Fields(s)
	if len(fields) == 0 {
		return s
	}
	return fields[len(fields)-1]
}
