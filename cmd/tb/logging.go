package main

import (
	"fmt"
	"os"
	"time"
)

func info(format string, a ...any)   { fmt.Printf("► "+format+"\n", a...) }
func ok(format string, a ...any)     { fmt.Printf("✓ "+format+"\n", a...) }
func warn(format string, a ...any)   { fmt.Fprintf(os.Stderr, "⚠ "+format+"\n", a...) }
func dryLog(format string, a ...any) { fmt.Printf("[DRY] ► "+format+"\n", a...) }

func fail(format string, a ...any) { fmt.Fprintf(os.Stderr, "error: "+format+"\n", a...) }

// Timestamped variants used by `tb refresh --unattended`, matching
// registry-refresh.sh's log functions.

func ts() string { return time.Now().UTC().Format("2006-01-02T15:04:05Z") }

func tsInfo(format string, a ...any) { fmt.Printf("%s ► %s\n", ts(), fmt.Sprintf(format, a...)) }
func tsOk(format string, a ...any)   { fmt.Printf("%s ✓ %s\n", ts(), fmt.Sprintf(format, a...)) }
func tsWarn(format string, a ...any) {
	fmt.Fprintf(os.Stderr, "%s ⚠ %s\n", ts(), fmt.Sprintf(format, a...))
}
func tsDryLog(format string, a ...any) {
	fmt.Printf("%s [DRY] ► %s\n", ts(), fmt.Sprintf(format, a...))
}

func tsFail(format string, a ...any) {
	fmt.Fprintf(os.Stderr, "%s error: %s\n", ts(), fmt.Sprintf(format, a...))
}
