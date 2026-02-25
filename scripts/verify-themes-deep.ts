#!/usr/bin/env node
/**
 * Deep Theme Strategy Verification
 *
 * Analyzes README + source code to verify strategy detection.
 * Outputs a detailed report for manual review.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
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

const CACHE_DIR = ".cache/theme-verifier";
const REPORTS_DIR = "reports";

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

function writeJsonFile(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function runGhJson(args: string[]): unknown {
  try {
    const out = execFileSync("gh", ["api", ...args], { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

function slugRepo(repo: string): string {
  return repo.replace("/", "__");
}

function cachePath(kind: "readme" | "tree", repo: string, ext: string): string {
  return path.join(CACHE_DIR, kind, `${slugRepo(repo)}.${ext}`);
}

function fetchReadme(repo: string): string {
  const cpath = cachePath("readme", repo, "md");
  if (existsSync(cpath)) {
    return readFileSync(cpath, "utf-8");
  }

  const data = runGhJson([`repos/${repo}/readme`]) as { content?: string } | null;
  if (!data?.content) return "";

  const readme = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
  ensureDir(path.dirname(cpath));
  writeFileSync(cpath, readme, "utf-8");
  return readme;
}

function fetchRepoTree(repo: string): Array<{ path: string; type: string }> {
  const cpath = cachePath("tree", repo, "json");
  if (existsSync(cpath)) {
    return readJsonFile<Array<{ path: string; type: string }>>(cpath);
  }

  const data = runGhJson([`repos/${repo}/git/trees/HEAD?recursive=1`]) as {
    tree?: Array<{ path: string; type: string }>;
  } | null;

  const tree = data?.tree ?? [];
  writeJsonFile(cpath, tree);
  return tree;
}

function analyzeReadme(readme: string): ThemeAnalysis["readmePatterns"] {
  const text = readme;
  return {
    hasSetup: /require\(["'][^"']+["']\)\.setup\s*\(/i.test(text),
    hasLoad: /require\(["'][^"']+["']\)\.load\s*\(/i.test(text),
    hasColorscheme: /:?colorscheme\s+[a-z0-9_.-]+/i.test(text) || /vim\.cmd.*colorscheme/i.test(text),
    hasVimGlobals: /let\s+g:[a-z_]+\s*=/i.test(text) && !/require\(/i.test(text),
  };
}

function analyzeSource(tree: Array<{ path: string; type: string }>): ThemeAnalysis["sourceStructure"] {
  const files = tree.filter((t) => t.type === "blob").map((t) => t.path);
  return {
    hasLuaModule: files.some((f) => /^lua\/[^/]+\/init\.lua$/i.test(f) || /^lua\/[^/]+\.lua$/i.test(f)),
    hasColorsLua: files.some((f) => /^colors\/.+\.lua$/i.test(f)),
    hasColorsVim: files.some((f) => /^colors\/.+\.vim$/i.test(f)),
    hasPluginDir: files.some((f) => /^plugin\/.+\.lua$/i.test(f)),
  };
}

function determineStrategy(
  readme: ThemeAnalysis["readmePatterns"],
  source: ThemeAnalysis["sourceStructure"]
): { strategy: StrategyType; signals: string[]; minimalCode: string } {
  const signals: string[] = [];

  // Rule 1: Has explicit .load() in README
  if (readme.hasLoad) {
    signals.push("README shows .load() pattern");
    return { strategy: "load", signals, minimalCode: `require("theme").load()` };
  }

  // Rule 2: Pure Vimscript (colors/*.vim, no Lua module)
  if (source.hasColorsVim && !source.hasLuaModule && !source.hasColorsLua) {
    signals.push("Vimscript colorscheme (no Lua module)");
    return { strategy: "colorscheme", signals, minimalCode: `vim.cmd.colorscheme("theme")` };
  }

  // Rule 3: Has setup() in README with colors/*.lua
  if (readme.hasSetup && source.hasColorsLua) {
    signals.push("Has setup() + colors/*.lua");
    return { strategy: "setup", signals, minimalCode: `require("theme").setup({}) + colorscheme` };
  }

  // Rule 4: Has Lua module but no colors/*.lua
  if (source.hasLuaModule && !source.hasColorsLua && !source.hasColorsVim) {
    signals.push("Lua module without colors/");
    if (readme.hasLoad) {
      return { strategy: "load", signals, minimalCode: `require("theme").load()` };
    }
    return { strategy: "setup", signals, minimalCode: `require("theme").setup({})` };
  }

  // Rule 5: Vim globals only (classic Vim theme)
  if (readme.hasVimGlobals && !source.hasLuaModule) {
    signals.push("Vim globals without Lua");
    return { strategy: "colorscheme", signals, minimalCode: `vim.cmd.colorscheme("theme")` };
  }

  // Rule 6: Has setup() in README
  if (readme.hasSetup) {
    signals.push("Has setup() in README");
    return { strategy: "setup", signals, minimalCode: `require("theme").setup({}) + colorscheme` };
  }

  // Rule 7: Has colorscheme in README, no setup
  if (readme.hasColorscheme && !readme.hasSetup) {
    signals.push("Only colorscheme in README");
    return { strategy: "colorscheme", signals, minimalCode: `vim.cmd.colorscheme("theme")` };
  }

  // Default: unknown
  signals.push("Could not determine strategy");
  return { strategy: "unknown", signals, minimalCode: "UNKNOWN" };
}

function analyzeTheme(repo: string, themeNames: string[], detectedStrategy: StrategyType): ThemeAnalysis {
  const readme = fetchReadme(repo);
  const tree = fetchRepoTree(repo);

  const readmePatterns = analyzeReadme(readme);
  const sourceStructure = analyzeSource(tree);
  const { strategy: verifiedStrategy, signals, minimalCode } = determineStrategy(readmePatterns, sourceStructure);

  const correct = detectedStrategy === verifiedStrategy || 
    (detectedStrategy === "unknown" && verifiedStrategy !== "unknown");

  return {
    repo,
    themeNames,
    detectedStrategy,
    verifiedStrategy,
    confidence: correct ? 1 : 0,
    correct,
    signals,
    readmePatterns,
    sourceStructure,
    minimalLoadCode: minimalCode,
    notes: correct ? "" : `Detected as ${detectedStrategy}, should be ${verifiedStrategy}`,
  };
}

function generateHeuristicFindings(themes: ThemeAnalysis[]): string[] {
  const findings: string[] = [];

  // Count patterns
  const setupWithLoad = themes.filter(t => t.readmePatterns.hasSetup && t.readmePatterns.hasLoad);
  const vimOnly = themes.filter(t => t.sourceStructure.hasColorsVim && !t.sourceStructure.hasLuaModule);
  const luaWithColors = themes.filter(t => t.sourceStructure.hasLuaModule && t.sourceStructure.hasColorsLua);

  findings.push(`Total themes analyzed: ${themes.length}`);
  findings.push(`Themes with setup() + load(): ${setupWithLoad.length}`);
  findings.push(`Pure Vimscript themes: ${vimOnly.length}`);
  findings.push(`Lua themes with colors/*.lua: ${luaWithColors.length}`);

  // Incorrect detections
  const incorrect = themes.filter(t => !t.correct);
  const byDetected: Record<string, number> = {};
  for (const t of incorrect) {
    byDetected[t.detectedStrategy] = (byDetected[t.detectedStrategy] || 0) + 1;
  }

  findings.push(`\nIncorrect detections: ${incorrect.length}`);
  for (const [strategy, count] of Object.entries(byDetected)) {
    findings.push(`  ${strategy}: ${count} incorrect`);
  }

  // Common mistakes
  const mistakes: Record<string, number> = {};
  for (const t of incorrect) {
    const key = `${t.detectedStrategy}→${t.verifiedStrategy}`;
    mistakes[key] = (mistakes[key] || 0) + 1;
  }

  findings.push(`\nCommon misclassifications:`);
  for (const [key, count] of Object.entries(mistakes).sort((a, b) => b[1] - a[1])) {
    findings.push(`  ${key}: ${count}`);
  }

  return findings;
}

async function main(): Promise<void> {
  ensureDir(CACHE_DIR);
  ensureDir(REPORTS_DIR);

  const reportPath = path.join(REPORTS_DIR, "themes.json");
  const themes = readJsonFile<Array<{ name: string; repo?: string }>>(
    "theme-browser-registry-ts/artifacts/themes.json"
  );

  const overrides = readJsonFile<{
    overrides: Array<{ name: string; repo?: string; meta?: { strategy?: { type?: string } } }>;
  }>("theme-browser-registry-ts/overrides.json");

  const excluded = readJsonFile<string[]>("theme-browser-registry-ts/excluded.json");

  const strategyMap = new Map<string, StrategyType>();
  for (const o of overrides.overrides) {
    if (o.repo) {
      strategyMap.set(o.repo, (o.meta?.strategy?.type as StrategyType) || "unknown");
    }
  }

  const excludedSet = new Set(excluded);

  // Build repo -> theme names map
  const repoThemes = new Map<string, string[]>();
  for (const t of themes) {
    if (!t.repo || excludedSet.has(t.repo)) continue;
    const arr = repoThemes.get(t.repo) ?? [];
    arr.push(t.name);
    repoThemes.set(t.repo, arr);
  }

  const repos = [...repoThemes.keys()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  console.log(`Analyzing ${repos.length} repos...\n`);

  const analyses: ThemeAnalysis[] = [];
  let processed = 0;

  for (const repo of repos) {
    processed++;
    const detectedStrategy = strategyMap.get(repo) || "unknown";
    const themeNames = repoThemes.get(repo) ?? [];

    process.stdout.write(`\r[${processed}/${repos.length}] ${repo.slice(0, 40).padEnd(40)}`);

    try {
      const analysis = analyzeTheme(repo, themeNames, detectedStrategy);
      analyses.push(analysis);
    } catch (err) {
      analyses.push({
        repo,
        themeNames,
        detectedStrategy,
        verifiedStrategy: "unknown",
        confidence: 0,
        correct: false,
        signals: [`Error: ${err}`],
        readmePatterns: { hasSetup: false, hasLoad: false, hasColorscheme: false, hasVimGlobals: false },
        sourceStructure: { hasLuaModule: false, hasColorsLua: false, hasColorsVim: false, hasPluginDir: false },
        minimalLoadCode: "ERROR",
        notes: String(err),
      });
    }
  }

  console.log("\n\nGenerating report...\n");

  // Build report
  const byStrategy: Record<StrategyType, { total: number; correct: number; incorrect: number }> = {
    setup: { total: 0, correct: 0, incorrect: 0 },
    load: { total: 0, correct: 0, incorrect: 0 },
    colorscheme: { total: 0, correct: 0, incorrect: 0 },
    file: { total: 0, correct: 0, incorrect: 0 },
    unknown: { total: 0, correct: 0, incorrect: 0 },
  };

  for (const a of analyses) {
    byStrategy[a.detectedStrategy].total++;
    if (a.correct) {
      byStrategy[a.detectedStrategy].correct++;
    } else {
      byStrategy[a.detectedStrategy].incorrect++;
    }
  }

  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    totalThemes: analyses.length,
    byStrategy,
    incorrectThemes: analyses.filter((a) => !a.correct),
    heuristicFindings: generateHeuristicFindings(analyses),
    themes: analyses,
  };

  writeJsonFile(path.join(REPORTS_DIR, "deep-verification-report.json"), report);

  // Print summary
  console.log("=== VERIFICATION REPORT ===\n");
  console.log(`Total themes: ${report.totalThemes}\n`);

  console.log("By Strategy:");
  for (const [strategy, stats] of Object.entries(byStrategy)) {
    if (stats.total === 0) continue;
    const pct = Math.round((stats.correct / stats.total) * 100);
    console.log(`  ${strategy.padEnd(12)} ${stats.total.toString().padStart(4)} total, ${stats.correct.toString().padStart(4)} correct (${pct}%)`);
  }

  console.log("\n" + report.heuristicFindings.join("\n"));

  console.log(`\nIncorrect themes: ${report.incorrectThemes.length}`);
  for (const t of report.incorrectThemes.slice(0, 20)) {
    console.log(`  ${t.repo}: ${t.detectedStrategy} → ${t.verifiedStrategy}`);
  }
  if (report.incorrectThemes.length > 20) {
    console.log(`  ... and ${report.incorrectThemes.length - 20} more`);
  }

  console.log(`\nFull report: ${REPORTS_DIR}/deep-verification-report.json`);
}

main().catch(console.error);
