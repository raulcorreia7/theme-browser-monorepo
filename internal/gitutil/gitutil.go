// Package gitutil provides thin wrappers over `git -C` commands used by the
// tb subcommands, with captured output and wrapped errors.
package gitutil

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// Output runs `git -C dir args...`, returning trimmed stdout.
func Output(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			return "", fmt.Errorf("git %s: %w", strings.Join(args, " "), err)
		}
		return "", fmt.Errorf("git %s: %w: %s", strings.Join(args, " "), err, msg)
	}
	return strings.TrimSpace(stdout.String()), nil
}

// Stream runs `git -C dir args...` with stdio wired to the current process.
func Stream(dir string, args ...string) error {
	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git %s: %w", strings.Join(args, " "), err)
	}
	return nil
}

// Quiet reports whether the git command succeeds, discarding all output.
func Quiet(dir string, args ...string) bool {
	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
	cmd.Stdout = nil
	cmd.Stderr = nil
	return cmd.Run() == nil
}

// Porcelain returns `git status --porcelain --untracked-files=all` lines for
// dir, optionally restricted to paths. Each line is "XY <path>".
func Porcelain(dir string, paths ...string) ([]string, error) {
	args := append([]string{"status", "--porcelain", "--untracked-files=all"}, paths...)
	out, err := Output(dir, args...)
	if err != nil {
		return nil, err
	}
	if out == "" {
		return nil, nil
	}
	return strings.Split(out, "\n"), nil
}

// StatusPath extracts the path from a porcelain status line, following the
// rename arrow like refresh.sh's extract_status_path.
func StatusPath(line string) string {
	path := line[3:]
	if i := strings.Index(path, " -> "); i >= 0 {
		path = path[i+4:]
	}
	return path
}

// CurrentBranch returns the checked-out branch; empty if HEAD is detached.
func CurrentBranch(dir string) string {
	out, err := Output(dir, "symbolic-ref", "--quiet", "--short", "HEAD")
	if err != nil {
		return ""
	}
	return out
}

// ConfiguredBranch reads submodule.<path>.branch from the root .gitmodules.
func ConfiguredBranch(root, path string) string {
	out, _ := Output(root, "config", "-f", ".gitmodules", "--get", "submodule."+path+".branch")
	return out
}

// RemoteURL returns the origin remote URL, or "" when origin is absent.
func RemoteURL(dir string) string {
	out, err := Output(dir, "remote", "get-url", "origin")
	if err != nil {
		return ""
	}
	return out
}

// TagExistsLocal reports whether the tag resolves locally.
func TagExistsLocal(dir, tag string) bool {
	return Quiet(dir, "rev-parse", tag)
}

// TagExistsRemote reports whether the tag exists on origin.
func TagExistsRemote(dir, tag string) bool {
	if RemoteURL(dir) == "" {
		return false
	}
	out, _ := Output(dir, "ls-remote", "--tags", "origin", "refs/tags/"+tag)
	return out != ""
}

// TagExists mirrors release.sh's local-or-remote check.
func TagExists(dir, tag string) bool {
	return TagExistsLocal(dir, tag) || TagExistsRemote(dir, tag)
}

// HasChanges reports whether the repo has any porcelain entries.
func HasChanges(dir string, paths ...string) bool {
	lines, _ := Porcelain(dir, paths...)
	return len(lines) > 0
}

// PorcelainNormal returns `git status --porcelain --untracked-files=normal`
// lines for dir (release.sh's check_git_clean view).
func PorcelainNormal(dir string) ([]string, error) {
	out, err := Output(dir, "status", "--porcelain", "--untracked-files=normal")
	if err != nil {
		return nil, err
	}
	if out == "" {
		return nil, nil
	}
	return strings.Split(out, "\n"), nil
}
