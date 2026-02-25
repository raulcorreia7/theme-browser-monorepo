#!/usr/bin/env node
/**
 * Generate detailed verification report for all themes
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type StrategyType = "setup" | "load" | "colorscheme" | "file" | "unknown";

type ThemeAnalysis = {
  repo: string;
  themeNames: string[];
  detectedStrategy: StrategyType;
  verifiedStrategy: StrategyType;
  confidence: number;
  correct: boolean;
  signals: string[];
  readmePatterns: {
    hasSetup: boolean;
    hasLoad: boolean;
    hasColorscheme: boolean;
    hasVimGlobals: boolean;
  };
  sourceStructure: {
    hasLuaModule: boolean;
    hasColorsLua: boolean;
    hasColorsVim: boolean;
    hasPluginDir: boolean;
  };
  minimalLoadCode: string;
  notes: string;
};

type VerificationReport = {
  timestamp: string;
  totalThemes: number;
  byStrategy: Record<StrategyType, { total: number; correct: number; incorrect: number }>;
  incorrectThemes: ThemeAnalysis[];
  heuristicFindings: string[];
  themes: ThemeAnalysis[];
};

const report: VerificationReport = JSON.parse(
  readFileSync("reports/deep-verification-report.json", "utf-8")
);

function generateMarkdown(): string {
  const lines: string[] = [];

  lines.push("# Theme Strategy Verification - Complete Report");
  lines.push("");
  lines.push(`**Generated:** ${report.timestamp}`);
  lines.push(`**Total Themes:** ${report.totalThemes}`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push("| Strategy | Total | Correct | Incorrect | Accuracy |");
  lines.push("|----------|-------|---------|-----------|----------|");

  for (const [strategy, stats] of Object.entries(report.byStrategy)) {
    if (stats.total === 0) continue;
    const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    lines.push(`| ${strategy} | ${stats.total} | ${stats.correct} | ${stats.incorrect} | ${pct}% |`);
  }

  const totalCorrect = Object.values(report.byStrategy).reduce((sum, s) => sum + s.correct, 0);
  const totalIncorrect = Object.values(report.byStrategy).reduce((sum, s) => sum + s.incorrect, 0);
  const totalAccuracy = Math.round((totalCorrect / report.totalThemes) * 100);

  lines.push(`| **Total** | **${report.totalThemes}** | **${totalCorrect}** | **${totalIncorrect}** | **${totalAccuracy}%** |`);
  lines.push("");

  // Heuristic Findings
  lines.push("## Heuristic Findings");
  lines.push("");
  for (const f of report.heuristicFindings) {
    lines.push(f);
  }
  lines.push("");

  // Incorrect Themes
  if (report.incorrectThemes.length > 0) {
    lines.push("## Incorrect Detections (Need Manual Review)");
    lines.push("");
    lines.push("| Repo | Detected | Should Be | Signals |");
    lines.push("|------|----------|-----------|---------|");
    for (const t of report.incorrectThemes) {
      const signals = t.signals.slice(0, 2).join("; ");
      lines.push(`| ${t.repo} | ${t.detectedStrategy} | ${t.verifiedStrategy} | ${signals} |`);
    }
    lines.push("");
  }

  // Detailed verification by strategy
  lines.push("## Detailed Verification by Strategy");
  lines.push("");

  for (const strategy of ["colorscheme", "setup", "load"] as StrategyType[]) {
    const themes = report.themes.filter(t => t.detectedStrategy === strategy);
    if (themes.length === 0) continue;

    lines.push(`### ${strategy.toUpperCase()} (${themes.length} themes)`);
    lines.push("");

    const correct = themes.filter(t => t.correct);
    const incorrect = themes.filter(t => !t.correct);

    lines.push(`**Correct:** ${correct.length} | **Incorrect:** ${incorrect.length}`);
    lines.push("");

    if (incorrect.length > 0) {
      lines.push("#### Incorrect Detections");
      lines.push("");
      lines.push("| Repo | Signals | Minimal Code |");
      lines.push("|------|---------|--------------|");
      for (const t of incorrect) {
        const signals = t.signals.join(", ");
        lines.push(`| ${t.repo} | ${signals} | ${t.minimalLoadCode} |`);
      }
      lines.push("");
    }

    lines.push("#### All Themes (sample of 50)");
    lines.push("");
    lines.push("| Repo | Patterns | Structure | Correct |");
    lines.push("|------|----------|-----------|---------|");

    const sample = themes.slice(0, 50);
    for (const t of sample) {
      const patterns = [
        t.readmePatterns.hasSetup ? "setup" : "",
        t.readmePatterns.hasLoad ? "load" : "",
        t.readmePatterns.hasColorscheme ? "cs" : "",
      ].filter(Boolean).join("+");

      const structure = [
        t.sourceStructure.hasLuaModule ? "lua" : "",
        t.sourceStructure.hasColorsLua ? "colors.lua" : "",
        t.sourceStructure.hasColorsVim ? "colors.vim" : "",
      ].filter(Boolean).join("+");

      const mark = t.correct ? "✓" : "✗";
      lines.push(`| ${t.repo} | ${patterns || "-"} | ${structure || "-"} | ${mark} |`);
    }
    lines.push("");

    if (themes.length > 50) {
      lines.push(`_... and ${themes.length - 50} more_`);
      lines.push("");
    }
  }

  // Unknown themes
  const unknownThemes = report.themes.filter(t => t.detectedStrategy === "unknown");
  if (unknownThemes.length > 0) {
    lines.push(`### UNKNOWN (${unknownThemes.length} themes)`);
    lines.push("");
    lines.push("These themes could not be automatically classified:");
    lines.push("");
    for (const t of unknownThemes.slice(0, 20)) {
      lines.push(`- ${t.repo}`);
    }
    if (unknownThemes.length > 20) {
      lines.push(`- _... and ${unknownThemes.length - 20} more_`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

const md = generateMarkdown();
writeFileSync("reports/VERIFICATION-DETAILED.md", md, "utf-8");
console.log("Generated reports/VERIFICATION-DETAILED.md");
console.log(`\nSummary:
- Total: ${report.totalThemes}
- Correct: ${report.themes.filter(t => t.correct).length}
- Incorrect: ${report.incorrectThemes.length}
- Accuracy: ${Math.round((report.themes.filter(t => t.correct).length / report.totalThemes) * 100)}%`);
