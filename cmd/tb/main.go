// Command tb replaces the root shell orchestration scripts (refresh,
// release, verify-versioning, update-submodules, install-hooks).
package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

// version is injected at build time:
//
//	go build -ldflags "-X main.version=$(cat VERSION)" -o bin/tb ./cmd/tb
var version = "dev"

func main() {
	root := &cobra.Command{
		Use:          "tb",
		Short:        "theme-browser-monorepo orchestration tool",
		Version:      version,
		SilenceUsage: true,
	}
	root.AddCommand(
		newRefreshCmd(),
		newReleaseCmd(),
		newVerifyVersioningCmd(),
		newUpdateSubmodulesCmd(),
		newInstallHooksCmd(),
	)
	if err := root.Execute(); err != nil {
		os.Exit(1)
	}
}

// exitf prints "error: msg" to stderr and exits 1, matching the scripts.
func exitf(format string, a ...any) {
	fmt.Fprintf(os.Stderr, "error: "+format+"\n", a...)
	os.Exit(1)
}
