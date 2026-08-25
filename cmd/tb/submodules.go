package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/raulcorreia7/theme-browser-monorepo/internal/gitutil"
	"github.com/spf13/cobra"
)

var submodulePaths = []string{"packages/plugin", "packages/registry"}

func newUpdateSubmodulesCmd() *cobra.Command {
	var dryRun bool
	cmd := &cobra.Command{
		Use:   "update-submodules",
		Short: "Fast-forward nested repos and stage updated pointers",
		RunE: func(cmd *cobra.Command, args []string) error {
			root, err := os.Getwd()
			if err != nil {
				return err
			}
			return runUpdateSubmodules(root, dryRun)
		},
	}
	cmd.Flags().BoolVarP(&dryRun, "dry-run", "n", false, "Show what would be done without making changes")
	return cmd
}

// runUpdateSubmodules ports scripts/update-submodules.sh. root is the
// monorepo root (the unattended flow calls this against a fresh clone).
func runUpdateSubmodules(root string, dryRun bool) error {
	run := func(args ...string) error {
		if dryRun {
			dryLog("git -C %s %s", root, strings.Join(args, " "))
			return nil
		}
		return gitutil.Stream(root, args...)
	}
	runIn := func(dir string, args ...string) error {
		if dryRun {
			dryLog("git -C %s %s", dir, strings.Join(args, " "))
			return nil
		}
		return gitutil.Stream(dir, args...)
	}

	info("Sync submodule metadata")
	if !dryRun {
		if err := gitutil.Stream(root, "submodule", "sync", "--recursive"); err != nil {
			return err
		}
		if err := gitutil.Stream(root, "submodule", "update", "--init", "--recursive"); err != nil {
			return err
		}
	} else {
		dryLog("git -C %s submodule sync --recursive", root)
		dryLog("git -C %s submodule update --init --recursive", root)
	}

	for _, path := range submodulePaths {
		dir := filepath.Join(root, path)
		requireCleanRepo(dir)

		branch := detectDefaultBranch(root, dir, path)
		ensureBranchCheckout(dir, branch, dryRun)

		info("Update %s on %s", path, branch)
		if err := runIn(dir, "fetch", "origin", branch); err != nil {
			return err
		}
		if err := runIn(dir, "pull", "--ff-only", "origin", branch); err != nil {
			return err
		}
		ok("%s updated", path)
	}

	info("Stage updated submodule pointers")
	if err := run(append([]string{"add"}, submodulePaths...)...); err != nil {
		return err
	}

	fmt.Println("")
	ok("submodules are up to date")
	if dryRun {
		dryLog("git status --short %s", strings.Join(submodulePaths, " "))
	} else if err := gitutil.Stream(root, append([]string{"status", "--short"}, submodulePaths...)...); err != nil {
		return err
	}
	return nil
}

func requireCleanRepo(dir string) {
	lines, _ := gitutil.PorcelainNormal(dir)
	if len(lines) > 0 {
		fail("uncommitted changes in %s", dir)
		gitutil.Stream(dir, "status", "--short")
		os.Exit(1)
	}
}

// detectDefaultBranch ports detect_default_branch: current branch, else
// .gitmodules configured branch, else origin's default HEAD.
func detectDefaultBranch(root, dir, relPath string) string {
	if b := gitutil.CurrentBranch(dir); b != "" {
		return b
	}
	if b := gitutil.ConfiguredBranch(root, relPath); b != "" {
		return b
	}
	_ = gitutil.Stream(dir, "remote", "set-head", "origin", "--auto")
	out, _ := gitutil.Output(dir, "symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD")
	if out == "" {
		exitf("unable to determine branch for %s", dir)
	}
	return strings.TrimPrefix(out, "origin/")
}

// ensureBranchCheckout attaches a detached/mismatched checkout to branch,
// like update-submodules.sh's ensure_branch_checkout.
func ensureBranchCheckout(dir, branch string, dryRun bool) {
	if gitutil.CurrentBranch(dir) == branch {
		return
	}
	info("Attach %s to %s", filepath.Base(dir), branch)
	if dryRun {
		dryLog("git -C %s fetch origin %s", dir, branch)
		dryLog("git -C %s checkout -B %s origin/%s", dir, branch, branch)
		return
	}
	if err := gitutil.Stream(dir, "fetch", "origin", branch); err != nil {
		os.Exit(1)
	}
	if err := gitutil.Stream(dir, "checkout", "-B", branch, "origin/"+branch); err != nil {
		os.Exit(1)
	}
}
