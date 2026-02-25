#!/usr/bin/env node
/**
 * Complete theme-by-theme verification report
 */
import { readFileSync, writeFileSync } from "node:fs";

type StrategyType = "setup" | "load" | "colorscheme" | "file" | "unknown";

type ThemeAnalysis = {
  repo: string;
  themeNames: string[];
  detectedStrategy: StrategyType;
  verifiedStrategy: StrategyType;
  correct: boolean;
  signals: string[];
  readmePatterns: { hasSetup: boolean; hasLoad: boolean; hasColorscheme: boolean; };
  sourceStructure: { hasLuaModule: boolean; hasColorsLua: boolean; hasColorsVim: boolean; };
  minimalLoadCode: string;
};

type Report = {
  themes: ThemeAnalysis[];
  totalThemes: number;
  byStrategy: Record<StrategyType, { total: number; correct: number; incorrect: number }>;
};

const report: Report = JSON.parse(readFileSync("reports/deep-verification-report.json", "utf-8"));

function generateFullReport(): string {
  const lines: string[] = [];
  
  lines.push("# COMPLETE THEME VERIFICATION REPORT");
  lines.push("");
  lines.push(`**Total Themes:** ${report.totalThemes}`);
  lines.push(`**Verified:** ${report.themes.filter(t => t.correct).length}`);
  lines.push(`**Incorrect:** ${report.themes.filter(t => !t.correct).length}`);
  lines.push("");

  // Summary table
  lines.push("## STRATEGY SUMMARY");
  lines.push("");
  lines.push("| Strategy | Count | Correct | Incorrect | Accuracy |");
  lines.push("|----------|-------|---------|-----------|----------|");
  
  for (const [strat, stats] of Object.entries(report.byStrategy)) {
    if (stats.total === 0) continue;
    const pct = Math.round((stats.correct / stats.total) * 100);
    lines.push(`| ${strat} | ${stats.total} | ${stats.correct} | ${stats.incorrect} | ${pct}% |`);
  }
  lines.push("");

  // All themes by strategy
  for (const strategy of ["colorscheme", "setup", "load", "unknown"] as StrategyType[]) {
    const themes = report.themes.filter(t => t.detectedStrategy === strategy);
    if (themes.length === 0) continue;

    const correct = themes.filter(t => t.correct).length;
    const incorrect = themes.filter(t => !t.correct).length;

    lines.push(`## ${strategy.toUpperCase()} STRATEGY (${themes.length} themes)`);
    lines.push("");
    lines.push(`Correct: ${correct} | Incorrect: ${incorrect}`);
    lines.push("");

    // Show incorrect first
    const incorrectThemes = themes.filter(t => !t.correct);
    if (incorrectThemes.length > 0) {
      lines.push("### INCORRECT DETECTIONS");
      lines.push("");
      for (const t of incorrectThemes) {
        lines.push(`#### ${t.repo}`);
        lines.push(`- **Detected:** ${t.detectedStrategy}`);
        lines.push(`- **Should be:** ${t.verifiedStrategy}`);
        lines.push(`- **Themes:** ${t.themeNames.join(", ")}`);
        lines.push(`- **Signals:** ${t.signals.join(", ")}`);
        lines.push(`- **README:** setup=${t.readmePatterns.hasSetup}, load=${t.readmePatterns.hasLoad}, colorscheme=${t.readmePatterns.hasColorscheme}`);
        lines.push(`- **Structure:** lua=${t.sourceStructure.hasLuaModule}, colors.lua=${t.sourceStructure.hasColorsLua}, colors.vim=${t.sourceStructure.hasColorsVim}`);
        lines.push("");
      }
    }

    // All themes
    lines.push("### ALL THEMES");
    lines.push("");
    lines.push("| # | Repo | README | Structure | OK |");
    lines.push("|---|------|--------|-----------|-----|");

    themes.sort((a, b) => a.repo.toLowerCase().localeCompare(b.repo.toLowerCase()));

    for (let i = 0; i < themes.length; i++) {
      const t = themes[i];
      const readme = [
        t.readmePatterns.hasSetup ? "S" : "",
        t.readmePatterns.hasLoad ? "L" : "",
        t.readmePatterns.hasColorscheme ? "C" : "",
      ].filter(Boolean).join("+") || "-";

      const structure = [
        t.sourceStructure.hasLuaModule ? "lua" : "",
        t.sourceStructure.hasColorsLua ? "cl" : "",
        t.sourceStructure.hasColorsVim ? "cv" : "",
      ].filter(Boolean).join("+") || "-";

      const ok = t.correct ? "✓" : "✗";
      lines.push(`| ${i + 1} | ${t.repo} | ${readme} | ${structure} | ${ok} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

const md = generateFullReport();
writeFileSync("reports/VERIFICATION-ALL-THEMES.md", md, "utf-8");
console.log("Generated reports/VERIFICATION-ALL-THEMES.md");
console.log(`Total lines: ${md.split("\n").length}`);
