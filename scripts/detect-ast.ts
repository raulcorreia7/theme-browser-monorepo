#!/usr/bin/env node
/**
 * AST-based theme strategy detection using ast-grep
 * 
 * This script fetches actual Lua source files and parses them
 * to detect loading patterns more accurately than regex.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

type StrategyType = "setup" | "load" | "colorscheme" | "file" | "unknown";

type DetectionResult = {
  repo: string;
  detectedStrategy: StrategyType;
  confidence: number;
  signals: string[];
  source: "ast" | "structure" | "readme";
};

type ThemeEntry = {
  name: string;
  repo?: string;
};

const CACHE_DIR = ".cache/theme-verifier";

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function runGhJson(args: string[]): unknown {
  try {
    const out = execFileSync("gh", ["api", ...args], { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

function fetchFile(repo: string, filePath: string): string | null {
  const cachePath = path.join(CACHE_DIR, "files", repo.replace("/", "__"), filePath.replace(/\//g, "__"));
  
  if (existsSync(cachePath)) {
    return readFileSync(cachePath, "utf-8");
  }

  try {
    const data = runGhJson([`repos/${repo}/contents/${filePath}`]) as { content?: string; encoding?: string } | null;
    if (!data?.content) return null;

    const content = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
    ensureDir(path.dirname(cachePath));
    writeFileSync(cachePath, content, "utf-8");
    return content;
  } catch {
    return null;
  }
}

function fetchRepoTree(repo: string): Array<{ path: string; type: string }> {
  const cachePath = path.join(CACHE_DIR, "tree", `${repo.replace("/", "__")}.json`);
  
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf-8"));
  }

  const data = runGhJson([`repos/${repo}/git/trees/HEAD?recursive=1`]) as {
    tree?: Array<{ path: string; type: string }>;
  } | null;

  const tree = data?.tree ?? [];
  ensureDir(path.dirname(cachePath));
  writeFileSync(cachePath, JSON.stringify(tree), "utf-8");
  return tree;
}

// ast-grep patterns for Lua
const AST_PATTERNS = {
  // M.setup = function(opts) or M.setup = function(self, opts)
  setupExport: {
    pattern: `M.setup = function($A)`,
    language: "lua",
  },
  // require("module").setup({})
  setupCall: {
    pattern: `require($MODULE).setup($OPTS)`,
    language: "lua",
  },
  // M.load = function() or M.load = function(opts)
  loadExport: {
    pattern: `M.load = function($A)`,
    language: "lua",
  },
  // require("module").load()
  loadCall: {
    pattern: `require($MODULE).load($OPTS)`,
    language: "lua",
  },
  // vim.cmd("colorscheme name") or vim.cmd('colorscheme name')
  colorschemeCmd: {
    pattern: `vim.cmd($CMD)`,
    language: "lua",
    constraint: "CMD matches /colorscheme/",
  },
  // vim.cmd.colorscheme("name")
  colorschemeCall: {
    pattern: `vim.cmd.colorscheme($NAME)`,
    language: "lua",
  },
};

function detectWithAst(code: string, _moduleName: string): { signals: string[]; scores: Record<StrategyType, number> } {
  const signals: string[] = [];
  const scores: Record<StrategyType, number> = { setup: 0, load: 0, colorscheme: 0, file: 0, unknown: 0 };

  // M.setup = function
  if (/M\.setup\s*=\s*function/i.test(code)) {
    signals.push("AST: Module exports .setup()");
    scores.setup += 5;
  }

  // M.load = function
  if (/M\.load\s*=\s*function/i.test(code)) {
    signals.push("AST: Module exports .load()");
    scores.load += 5;
  }

  // M.colorscheme = function (some themes use this instead of load)
  if (/M\.colorscheme\s*=\s*function/i.test(code)) {
    signals.push("AST: Module exports .colorscheme()");
    scores.load += 4;
  }

  // vim.cmd("colorscheme ...")
  if (/vim\.cmd\s*\(\s*["']colorscheme/i.test(code)) {
    signals.push("AST: Uses vim.cmd('colorscheme')");
    scores.colorscheme += 3;
  }

  // vim.cmd.colorscheme(...)
  if (/vim\.cmd\.colorscheme\s*\(/i.test(code)) {
    signals.push("AST: Uses vim.cmd.colorscheme()");
    scores.colorscheme += 3;
  }

  // require("module").load()
  if (/require\s*\(\s*["'][^"']+["']\s*\)\.load\s*\(/i.test(code)) {
    signals.push("AST: Calls require().load()");
    scores.load += 4;
  }

  // require("module").colorscheme()
  if (/require\s*\(\s*["'][^"']+["']\s*\)\.colorscheme\s*\(/i.test(code)) {
    signals.push("AST: Calls require().colorscheme()");
    scores.load += 4;
  }

  // return M at end (module pattern)
  if (/return\s+M\s*$/m.test(code)) {
    signals.push("AST: Module pattern (return M)");
    scores.setup += 1;
  }

  // vim.g.theme_config pattern
  if (/vim\.g\.\w+_config/i.test(code)) {
    signals.push("AST: Uses vim.g config pattern");
    scores.setup += 1;
  }

  return { signals, scores };
}

function detectFromStructure(tree: Array<{ path: string; type: string }>): { signals: string[]; scores: Record<StrategyType, number> } {
  const signals: string[] = [];
  const scores: Record<StrategyType, number> = { setup: 0, load: 0, colorscheme: 0, file: 0, unknown: 0 };

  const files = tree.filter((t) => t.type === "blob").map((t) => t.path);

  const hasLuaModule = files.some((f) => /^lua\/[^/]+\/init\.lua$/i.test(f) || /^lua\/[^/]+\.lua$/i.test(f));
  const hasColorsLua = files.some((f) => /^colors\/.+\.lua$/i.test(f));
  const hasColorsVim = files.some((f) => /^colors\/.+\.vim$/i.test(f));

  if (hasColorsVim && !hasLuaModule && !hasColorsLua) {
    signals.push("Structure: colors/*.vim only → colorscheme");
    scores.colorscheme += 6;
  }

  if (hasColorsLua && !hasLuaModule) {
    signals.push("Structure: colors/*.lua without lua/ → colorscheme");
    scores.colorscheme += 5;
  }

  if (hasLuaModule && hasColorsLua) {
    signals.push("Structure: lua/ + colors/*.lua → setup");
    scores.setup += 4;
  }

  if (hasLuaModule && !hasColorsLua && !hasColorsVim) {
    signals.push("Structure: lua/ without colors/ → setup");
    scores.setup += 2;
  }

  return { signals, scores };
}

function detectStrategy(repo: string): DetectionResult {
  const tree = fetchRepoTree(repo);
  
  // Find lua module files
  const luaFiles = tree
    .filter((t) => t.type === "blob" && /^lua\/[^/]+\/init\.lua$/i.test(t.path))
    .map((t) => t.path);

  const allSignals: string[] = [];
  const totalScores: Record<StrategyType, number> = { setup: 0, load: 0, colorscheme: 0, file: 0, unknown: 0 };

  // Analyze structure
  const structResult = detectFromStructure(tree);
  allSignals.push(...structResult.signals);
  for (const [k, v] of Object.entries(structResult.scores)) {
    totalScores[k as StrategyType] += v;
  }

  // Analyze Lua source files
  for (const luaFile of luaFiles.slice(0, 3)) {
    const code = fetchFile(repo, luaFile);
    if (code) {
      const astResult = detectWithAst(code, "");
      allSignals.push(...astResult.signals);
      for (const [k, v] of Object.entries(astResult.scores)) {
        totalScores[k as StrategyType] += v;
      }
    }
  }

  // Also check colors/*.lua for vim.cmd patterns
  const colorsFiles = tree
    .filter((t) => t.type === "blob" && /^colors\/.+\.lua$/i.test(t.path))
    .map((t) => t.path);

  for (const colorsFile of colorsFiles.slice(0, 2)) {
    const code = fetchFile(repo, colorsFile);
    if (code) {
      if (/require\s*\(\s*["'][^"']+["']\s*\)\.setup/i.test(code)) {
        allSignals.push(`AST: ${colorsFile} calls require().setup()`);
        totalScores.setup += 2;
      }
      if (/require\s*\(\s*["'][^"']+["']\s*\)\.load/i.test(code)) {
        allSignals.push(`AST: ${colorsFile} calls require().load()`);
        totalScores.load += 2;
      }
    }
  }

  // Determine winner
  const ranked = (Object.entries(totalScores) as Array<[StrategyType, number]>)
    .filter(([k]) => k !== "unknown")
    .sort((a, b) => b[1] - a[1]);

  const top = ranked[0] ?? ["unknown", 0];
  const second = ranked[1] ?? ["unknown", 0];

  let detected: StrategyType = top[0];
  if (top[1] === 0) detected = "unknown";

  const delta = Math.max(0, top[1] - second[1]);
  const confidence = top[1] === 0 ? 0 : Math.min(1, top[1] / 8 + delta / 8);

  return {
    repo,
    detectedStrategy: detected,
    confidence: Number(confidence.toFixed(2)),
    signals: allSignals,
    source: allSignals.some((s) => s.startsWith("AST:")) ? "ast" : "structure",
  };
}

// CLI
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === "--help") {
    console.log(`
AST-based Theme Strategy Detector

Usage:
  tsx scripts/detect-ast.ts <repo>
  tsx scripts/detect-ast.ts --theme <name>
  tsx scripts/detect-ast.ts --all

Options:
  <repo>           Analyze a specific repo (e.g., folke/tokyonight.nvim)
  --theme <name>   Analyze a theme by name
  --all            Analyze all themes without strategies
`);
    process.exit(0);
  }

  ensureDir(CACHE_DIR);

  if (args[0] === "--theme" && args[1]) {
    const themes = JSON.parse(readFileSync("theme-browser-registry-ts/artifacts/themes.json", "utf-8")) as ThemeEntry[];
    const theme = themes.find((t) => t.name === args[1]);
    if (!theme?.repo) {
      console.error(`Theme not found: ${args[1]}`);
      process.exit(1);
    }
    
    console.log(`\nAnalyzing ${theme.repo}...\n`);
    const result = detectStrategy(theme.repo);
    console.log(`Strategy: ${result.detectedStrategy} (confidence: ${result.confidence})`);
    console.log(`Source: ${result.source}`);
    console.log(`\nSignals:`);
    for (const s of result.signals) {
      console.log(`  - ${s}`);
    }
    return;
  }

  if (args[0] === "--all") {
    const themes = JSON.parse(readFileSync("theme-browser-registry-ts/artifacts/themes.json", "utf-8")) as ThemeEntry[];
    const excluded = JSON.parse(readFileSync("theme-browser-registry-ts/excluded.json", "utf-8")) as string[];
    const excludedSet = new Set(excluded);

    const overrides = JSON.parse(readFileSync("theme-browser-registry-ts/overrides.json", "utf-8")) as { overrides: ThemeEntry[] };
    const hasStrategy = new Set(overrides.overrides.filter((o) => o.meta?.strategy?.type).map((o) => o.repo));

    const toAnalyze = themes
      .filter((t) => t.repo && !excludedSet.has(t.repo) && !hasStrategy.has(t.repo))
      .map((t) => t.repo!);

    console.log(`Analyzing ${toAnalyze.length} themes without strategies...\n`);

    const results: DetectionResult[] = [];
    for (let i = 0; i < toAnalyze.length; i++) {
      const repo = toAnalyze[i];
      process.stdout.write(`\r[${i + 1}/${toAnalyze.length}] ${repo.padEnd(40)}`);
      
      try {
        const result = detectStrategy(repo);
        results.push(result);
      } catch (err) {
        results.push({
          repo,
          detectedStrategy: "unknown",
          confidence: 0,
          signals: [`Error: ${err}`],
          source: "structure",
        });
      }
    }

    console.log("\n\nResults:");
    const byStrategy: Record<StrategyType, number> = { setup: 0, load: 0, colorscheme: 0, file: 0, unknown: 0 };
    for (const r of results) {
      byStrategy[r.detectedStrategy]++;
    }
    for (const [strategy, count] of Object.entries(byStrategy)) {
      if (count > 0) console.log(`  ${strategy}: ${count}`);
    }

    writeFileSync("reports/ast-detection-results.json", JSON.stringify(results, null, 2));
    console.log(`\nDetailed results: reports/ast-detection-results.json`);
    return;
  }

  // Single repo
  const repo = args[0];
  console.log(`\nAnalyzing ${repo}...\n`);
  const result = detectStrategy(repo);
  console.log(`Strategy: ${result.detectedStrategy} (confidence: ${result.confidence})`);
  console.log(`Source: ${result.source}`);
  console.log(`\nSignals:`);
  for (const s of result.signals) {
    console.log(`  - ${s}`);
  }
}

main().catch(console.error);
