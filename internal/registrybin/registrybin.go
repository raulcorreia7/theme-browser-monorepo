// Package registrybin builds and runs the packages/registry pipeline binary.
package registrybin

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// Build compiles bin/registry inside registryDir via `go build`.
func Build(registryDir string) error {
	cmd := exec.Command("go", "build", "-o", "bin/registry", "./cmd/registry")
	cmd.Dir = registryDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("go build -o bin/registry ./cmd/registry (in %s): %w", registryDir, err)
	}
	return nil
}

// Run executes registryDir/bin/registry with the given args, streaming output.
func Run(registryDir string, args ...string) error {
	bin := filepath.Join(registryDir, "bin", "registry")
	cmd := exec.Command(bin, args...)
	cmd.Dir = registryDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("%s %s (in %s): %w", bin, joinArgs(args), registryDir, err)
	}
	return nil
}

func joinArgs(args []string) string {
	out := ""
	for i, a := range args {
		if i > 0 {
			out += " "
		}
		out += a
	}
	return out
}
