package main

import (
	"os"
	"path/filepath"

	"github.com/raulcorreia7/theme-browser-monorepo/internal/gitutil"
	"github.com/spf13/cobra"
)

func newInstallHooksCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "install-hooks",
		Short: "Configure local git hooks (.githooks)",
		RunE: func(cmd *cobra.Command, args []string) error {
			hookPath := filepath.Join(".githooks", "pre-push")
			if _, err := os.Stat(hookPath); err != nil {
				exitf("missing hook file: %s", hookPath)
			}
			if err := gitutil.Stream(".", "config", "core.hooksPath", ".githooks"); err != nil {
				return err
			}
			entries, err := os.ReadDir(".githooks")
			if err != nil {
				return err
			}
			for _, e := range entries {
				if e.IsDir() {
					continue
				}
				p := filepath.Join(".githooks", e.Name())
				if info, err := os.Stat(p); err == nil && info.Mode().Perm()&0o111 == 0 {
					if err := os.Chmod(p, 0o755); err != nil {
						return err
					}
				}
			}
			ok("Configured git hooks at .githooks")
			return nil
		},
	}
}
