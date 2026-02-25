#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

type StrategyType = "setup" | "load" | "colorscheme" | "file" | "unknown";

type Strategy = {
  type: StrategyType;
  module?: string;
  file?: string;
};

type ThemeEntry = {
  name: string;
  repo?: string;
  colorscheme?: string;
  variants?: Array<{ name: string; colorscheme?: string; mode?: string; meta?: { strategy?: Strategy } }>;
  meta?: { strategy?: Strategy };
};

type OverridesFile = {
  overrides: ThemeEntry[];
  builtin?: ThemeEntry[];
};

type Hint = {
  repo: string;
  strategy: StrategyType;
  reason: string;
};

type HintsFile = {
  hints: Hint[];
};

type DetectionSignal = {
  strategy: StrategyType;
  score: number;
  reason: string;
};

type DetectionResult = {
  detected: StrategyType;
  confidence: number;
  signals: DetectionSignal[];
  needsSourceInspection: boolean;
};

type VerificationRow = {
  repo: string;
  themeNames: string[];
  currentStrategy: StrategyType | "missing";
  detectedStrategy: StrategyType;
  confidence: number;
  status: "match" | "mismatch" | "missing-meta" | "error";
  needsSourceInspection: boolean;
  signals: DetectionSignal[];
  error?: string;
};

type CliOptions = {
  themesPath: string;
  overridesPath: string;
  sample?: number;
  repo?: string;
  theme?: string;
  apply: boolean;
  verbose: boolean;
  cacheDir: string;
  outDir: string;
  noCache: boolean;
};

type LogLevel = "info" | "success" | "warn" | "error" | "dim";

const DEFAULTS = {
  themesPath: "theme-browser-registry-ts/artifacts/themes.json",
  overridesPath: "theme-browser-registry-ts/overrides.json",
  cacheDir: ".cache/theme-verifier",
  outDir: "reports",
};

let progressLine = "";

function log(msg: string, level: LogLevel = "info"): void {
  const prefix: Record<LogLevel, string> = {
    info: "\x1b[34m→\x1b[0m",
    success: "\x1b[32m✓\x1b[0m",
    warn: "\x1b[33m⚠\x1b[0m",
    error: "\x1b[31m✗\x1b[0m",
    dim: "\x1b[90m○\x1b[0m",
  };
  console.log(`${prefix[level]} ${msg}`);
}

function logDim(msg: string): void {
  console.log(`\x1b[90m  ${msg}\x1b[0m`);
}

function updateProgress(current: number, total: number, repo: string, status: string): void {
  const pct = Math.round((current / total) * 100);
  const bar = "█".repeat(Math.floor(pct / 5)) + "░".repeat(20 - Math.floor(pct / 5));
  const statusIcon: Record<string, string> = {
    match: "\x1b[32m✓\x1b[0m",
    mismatch: "\x1b[33m↻\x1b[0m",
    "missing-meta": "\x1b[34m+\x1b[0m",
    error: "\x1b[31m✗\x1b[0m",
  };
  const line = `  [${bar}] ${current}/${total} (${pct}%) ${statusIcon[status] || "?"} ${repo}`;
  
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(line);
  progressLine = line;
}

function clearProgress(): void {
  if (progressLine) {
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 1);
    progressLine = "";
  }
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    themesPath: DEFAULTS.themesPath,
    overridesPath: DEFAULTS.overridesPath,
    apply: false,
    verbose: false,
    cacheDir: DEFAULTS.cacheDir,
    outDir: DEFAULTS.outDir,
    noCache: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];

    if (a === "--themes" && next) { opts.themesPath = next; i++; continue; }
    if (a === "--overrides" && next) { opts.overridesPath = next; i++; continue; }
    if (a === "--sample" && next) { opts.sample = Number(next); i++; continue; }
    if (a === "--repo" && next) { opts.repo = next; i++; continue; }
    if (a === "--theme" && next) { opts.theme = next; i++; continue; }
    if (a === "--cache-dir" && next) { opts.cacheDir = next; i++; continue; }
    if (a === "--out-dir" && next) { opts.outDir = next; i++; continue; }
    if (a === "--apply") { opts.apply = true; continue; }
    if (a === "--verbose" || a === "-v") { opts.verbose = true; continue; }
    if (a === "--no-cache") { opts.noCache = true; continue; }
    if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return opts;
}

function printHelp(): void {
  console.log(`
verify-themes.ts

Usage:
  tsx scripts/verify-themes.ts [options]

Options:
  --themes <path>       Path to artifacts/themes.json
  --overrides <path>    Path to overrides.json
  --sample <n>          Verify first N repos
  --repo <owner/name>   Verify only one repo
  --theme <name>        Verify theme by name (e.g., tokyonight)
  --apply               Apply safe repo-level strategy updates to overrides.json
  --cache-dir <path>    Cache directory
  --out-dir <path>      Output reports directory
  --no-cache            Disable cache reads/writes
  -v, --verbose         Verbose logs
  -h, --help            Show help

Examples:
  tsx scripts/verify-themes.ts --sample 20 -v
  tsx scripts/verify-themes.ts --repo folke/tokyonight.nvim -v
  tsx scripts/verify-themes.ts --theme catppuccin -v
`);
}

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

function slugRepo(repo: string): string {
  return repo.replace("/", "__");
}

function cachePath(base: string, kind: "readme" | "tree", repo: string, ext: string): string {
  return path.join(base, kind, `${slugRepo(repo)}.${ext}`);
}

function runGhJson(args: string[]): unknown {
  const out = execFileSync("gh", ["api", ...args], { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  return JSON.parse(out);
}

function fetchReadme(repo: string, opts: CliOptions): string {
  const cpath = cachePath(opts.cacheDir, "readme", repo, "md");
  if (!opts.noCache && existsSync(cpath)) {
    return readFileSync(cpath, "utf-8");
  }

  const data = runGhJson([`repos/${repo}/readme`]) as { content?: string; encoding?: string };
  if (!data?.content) throw new Error("README content missing");

  const readme = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
  if (!opts.noCache) {
    ensureDir(path.dirname(cpath));
    writeFileSync(cpath, readme, "utf-8");
  }
  return readme;
}

function fetchRepoTree(repo: string, opts: CliOptions): Array<{ path: string; type: string }> {
  const cpath = cachePath(opts.cacheDir, "tree", repo, "json");
  if (!opts.noCache && existsSync(cpath)) {
    return readJsonFile<Array<{ path: string; type: string }>>(cpath);
  }

  const data = runGhJson([`repos/${repo}/git/trees/HEAD?recursive=1`]) as {
    tree?: Array<{ path: string; type: string }>;
  };

  const tree = data.tree ?? [];
  if (!opts.noCache) {
    writeJsonFile(cpath, tree);
  }
  return tree;
}

function detectFromText(readme: string): DetectionResult {
  const signals: DetectionSignal[] = [];
  const text = readme;
  const lower = readme.toLowerCase();

  // LOAD signals - explicit .load() function is the strongest indicator
  if (/require\(["'][^"']+["']\)\.load\s*\(/i.test(text)) {
    signals.push({ strategy: "load", score: 8, reason: `README contains require(...).load(...)` });
  }
  if (/\.load\s*\(\s*{?/i.test(text) && /require\(/i.test(text)) {
    signals.push({ strategy: "load", score: 2, reason: `README shows .load() pattern` });
  }

  // SETUP signals - setup() for config + colorscheme to load
  if (/require\(["'][^"']+["']\)\.setup\s*\(/i.test(text)) {
    signals.push({ strategy: "setup", score: 6, reason: `README contains require(...).setup(...)` });
  }
  if (/setup\s*\(\s*{[\s\S]*?}\s*\)/i.test(text)) {
    signals.push({ strategy: "setup", score: 2, reason: `README shows setup({...}) options block` });
  }

  // COLORSCHEME signals - multiple patterns including vim.cmd variations
  // Pattern 1: :colorscheme name
  if (/:?colorscheme\s+[a-z0-9_.-]+/i.test(text)) {
    signals.push({ strategy: "colorscheme", score: 4, reason: `README shows :colorscheme usage` });
  }
  // Pattern 2: vim.cmd("colorscheme name") or vim.cmd('colorscheme name')
  if (/vim\.cmd\s*\(\s*["']colorscheme\s+[a-z0-9_.-]+["']\s*\)/i.test(text)) {
    signals.push({ strategy: "colorscheme", score: 4, reason: `README shows vim.cmd("colorscheme ...")` });
  }
  // Pattern 3: vim.cmd.colorscheme("name") - chained call
  if (/vim\.cmd\.colorscheme\s*\(\s*["'][a-z0-9_.-]+["']\s*\)/i.test(text)) {
    signals.push({ strategy: "colorscheme", score: 4, reason: `README shows vim.cmd.colorscheme(...)` });
  }

  // Vimscript-only indicators (no Lua module)
  if (/let\s+g:[a-z_]+\s*=/i.test(text) && !/require\(/i.test(text)) {
    signals.push({ strategy: "colorscheme", score: 3, reason: `README shows vim.g globals without require()` });
  }

  // FILE signals - complex custom setup
  if (/background\s*=\s*["'](dark|light)["']/i.test(text) && /colorscheme/i.test(text)) {
    signals.push({ strategy: "file", score: 2, reason: `README suggests mode-dependent setup + colorscheme` });
  }
  if (/before\s+loading|after\s+loading|must\s+set\s+global/i.test(lower)) {
    signals.push({ strategy: "file", score: 2, reason: `README suggests custom init ordering` });
  }

  const tally: Record<StrategyType, number> = {
    setup: 0,
    load: 0,
    colorscheme: 0,
    file: 0,
    unknown: 0,
  };

  for (const s of signals) tally[s.strategy] += s.score;

  // Tie-breaking rules based on analysis:
  // - load > setup when both present (explicit .load() is distinctive)
  // - setup > colorscheme when setup() exists (has config options)
  // - When setup AND colorscheme both present, it's "setup" (theme-browser does both)
  if (tally.load > 0 && tally.setup > 0 && tally.load >= tally.setup) {
    tally.load = tally.load + 2;
  }
  if (tally.setup > 0 && tally.colorscheme > 0) {
    tally.setup = tally.setup + 3;
  }

  const ranked = (Object.entries(tally) as Array<[StrategyType, number]>)
    .filter(([k]) => k !== "unknown")
    .sort((a, b) => b[1] - a[1]);

  const top = ranked[0] ?? ["unknown", 0];
  const second = ranked[1] ?? ["unknown", 0];

  let detected: StrategyType = top[0];
  if (top[1] === 0) detected = "unknown";

  const delta = Math.max(0, top[1] - second[1]);
  const confidence = detected === "unknown" ? 0 : Math.min(1, top[1] / 10 + delta / 10);

  const needsSourceInspection =
    detected === "unknown" ||
    confidence < 0.7 ||
    (detected === "file" && confidence < 0.85);

  return { detected, confidence, signals, needsSourceInspection };
}

function inspectSource(repo: string, opts: CliOptions): Partial<DetectionResult> {
  const tree = fetchRepoTree(repo, opts);
  const files = tree.filter((t) => t.type === "blob").map((t) => t.path);

  const hasLuaModule = files.some((f) => /^lua\/[^/]+\/init\.lua$/i.test(f) || /^lua\/[^/]+\.lua$/i.test(f));
  const hasColorsLua = files.some((f) => /^colors\/.+\.lua$/i.test(f));
  const hasColorsVim = files.some((f) => /^colors\/.+\.vim$/i.test(f));
  const hasPluginDir = files.some((f) => /^plugin\/.+\.lua$/i.test(f));
  const hasColorsDir = hasColorsLua || hasColorsVim;

  const signals: DetectionSignal[] = [];

  // LESSON: File structure is strong signal - use as fallback when README fails
  // Many themes have no usage docs but colors/ files prove they're themes

  // Pure Vimscript colorscheme (colors/*.vim only, no Lua)
  if (hasColorsVim && !hasLuaModule && !hasColorsLua) {
    signals.push({ strategy: "colorscheme", score: 6, reason: `Repo has colors/*.vim without Lua module` });
  }

  // Lua-based theme with both module and colors/ (setup pattern)
  if (hasLuaModule && hasColorsLua) {
    signals.push({ strategy: "setup", score: 4, reason: `Repo has Lua module + colors/*.lua` });
  }

  // colors/*.lua without Lua module (lush.nvim themes, compiled themes)
  if (hasColorsLua && !hasLuaModule) {
    signals.push({ strategy: "colorscheme", score: 5, reason: `Repo has colors/*.lua without Lua module` });
  }

  // Lua module without colors/ (may use plugin/ or direct load)
  if (hasLuaModule && !hasColorsDir) {
    signals.push({ strategy: "setup", score: 2, reason: `Repo has Lua module without colors/` });
  }

  // plugin/ directory often means auto-load or special setup
  if (hasPluginDir && hasLuaModule) {
    signals.push({ strategy: "load", score: 2, reason: `Repo has lua/ + plugin/ layout` });
  }

  // Any colors/*.vim with Lua module (hybrid themes)
  if (hasColorsVim && hasLuaModule && !hasColorsLua) {
    signals.push({ strategy: "colorscheme", score: 4, reason: `Repo has colors/*.vim + Lua module` });
  }

  if (signals.length === 0) return {};

  const tally: Record<StrategyType, number> = { setup: 0, load: 0, colorscheme: 0, file: 0, unknown: 0 };
  for (const s of signals) tally[s.strategy] += s.score;
  const best = (Object.entries(tally) as Array<[StrategyType, number]>).sort((a, b) => b[1] - a[1])[0];

  return {
    detected: (best?.[0] ?? "unknown") as StrategyType,
    confidence: 0.55,
    signals,
    needsSourceInspection: false,
  };
}

function buildRepoIndex(themes: ThemeEntry[]): Map<string, ThemeEntry[]> {
  const map = new Map<string, ThemeEntry[]>();
  for (const t of themes) {
    if (!t.repo) continue;
    const arr = map.get(t.repo) ?? [];
    arr.push(t);
    map.set(t.repo, arr);
  }
  return map;
}

function findThemeByName(themes: ThemeEntry[], name: string): ThemeEntry | undefined {
  return themes.find((t) => t.name === name);
}

function findCurrentStrategyFromOverrides(repo: string, overrides: OverridesFile): StrategyType | "missing" {
  const entry = overrides.overrides.find((o) => o.repo === repo);
  return (entry?.meta?.strategy?.type as StrategyType | undefined) ?? "missing";
}

function verifyRepo(
  repo: string,
  repoThemes: ThemeEntry[],
  overrides: OverridesFile,
  opts: CliOptions,
  hintsMap: Map<string, StrategyType>
): VerificationRow {
  try {
    const readme = fetchReadme(repo, opts);
    let det = detectFromText(readme);

    if (det.needsSourceInspection) {
      const src = inspectSource(repo, opts);
      const mergedSignals = [...det.signals, ...(src.signals ?? [])];

      if (
        (det.detected === "unknown" && src.detected) ||
        (det.confidence < 0.55 && src.detected && src.detected !== "unknown")
      ) {
        det = {
          detected: src.detected ?? det.detected,
          confidence: Math.max(det.confidence, src.confidence ?? 0),
          signals: mergedSignals,
          needsSourceInspection: false,
        };
      } else {
        det = { ...det, signals: mergedSignals };
      }
    }

    // Apply manual hint if available
    if (hintsMap.has(repo)) {
      det = {
        detected: hintsMap.get(repo)!,
        confidence: 1.0,
        signals: [...det.signals, { strategy: hintsMap.get(repo)!, score: 10, reason: "Manual hint override" }],
        needsSourceInspection: false,
      };
    }

    const current = findCurrentStrategyFromOverrides(repo, overrides);
    const status: VerificationRow["status"] =
      current === "missing"
        ? "missing-meta"
        : current === det.detected
          ? "match"
          : "mismatch";

    return {
      repo,
      themeNames: [...new Set(repoThemes.map((t) => t.name))],
      currentStrategy: current,
      detectedStrategy: det.detected,
      confidence: Number(det.confidence.toFixed(2)),
      status,
      needsSourceInspection: det.needsSourceInspection,
      signals: det.signals,
    };
  } catch (err) {
    return {
      repo,
      themeNames: [...new Set(repoThemes.map((t) => t.name))],
      currentStrategy: findCurrentStrategyFromOverrides(repo, overrides),
      detectedStrategy: "unknown",
      confidence: 0,
      status: "error",
      needsSourceInspection: true,
      signals: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function limit<T, R>(
  items: T[],
  n: number,
  fn: (item: T) => R,
  onProgress?: (idx: number, result: R) => void
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  let active = 0;
  let done = 0;

  return new Promise<R[]>((resolve, reject) => {
    const next = () => {
      if (done === items.length) return resolve(out);
      while (active < n && i < items.length) {
        const idx = i++;
        active++;
        Promise.resolve(fn(items[idx]))
          .then((res) => {
            out[idx] = res;
            onProgress?.(idx, res);
          })
          .catch(reject)
          .finally(() => {
            active--;
            done++;
            next();
          });
      }
    };
    next();
  }) as unknown as R[];
}

function writeMarkdownReport(rows: VerificationRow[], outPath: string): void {
  const matches = rows.filter((r) => r.status === "match").length;
  const mismatches = rows.filter((r) => r.status === "mismatch").length;
  const missing = rows.filter((r) => r.status === "missing-meta").length;
  const errors = rows.filter((r) => r.status === "error").length;

  const lines: string[] = [];
  lines.push("# Theme Strategy Verification Report", "");
  lines.push(`- Total repos checked: **${rows.length}**`);
  lines.push(`- Matches: **${matches}**`);
  lines.push(`- Mismatches: **${mismatches}**`);
  lines.push(`- Missing meta: **${missing}**`);
  lines.push(`- Errors: **${errors}**`, "");

  const errorRows = rows.filter((r) => r.status === "error");
  if (errorRows.length) {
    lines.push("## Errors", "");
    for (const r of errorRows) {
      lines.push(`### ${r.repo}`);
      lines.push(`- Themes: ${r.themeNames.join(", ")}`);
      lines.push(`- Error: ${r.error || "unknown"}`);
      lines.push("");
    }
  }

  const actionable = rows
    .filter((r) => r.status === "mismatch" || r.status === "missing-meta")
    .sort((a, b) => a.confidence - b.confidence);

  if (actionable.length) {
    lines.push("## Actionable Repos", "");
    for (const r of actionable) {
      lines.push(`### ${r.repo}`);
      lines.push(`- Themes: ${r.themeNames.join(", ")}`);
      lines.push(`- Current: \`${r.currentStrategy}\``);
      lines.push(`- Detected: \`${r.detectedStrategy}\``);
      lines.push(`- Confidence: \`${r.confidence}\``);
      for (const s of r.signals.slice(0, 5)) {
        lines.push(`  - ${s.strategy} (+${s.score}): ${s.reason}`);
      }
      lines.push("");
    }
  }

  ensureDir(path.dirname(outPath));
  writeFileSync(outPath, lines.join("\n"), "utf-8");
}

function buildPatchProposal(rows: VerificationRow[]): Array<{ repo: string; strategy: StrategyType; confidence: number }> {
  return rows
    .filter((r) =>
      (r.status === "mismatch" || r.status === "missing-meta") &&
      r.detectedStrategy !== "unknown" &&
      r.confidence >= 0.7
    )
    .map((r) => ({ repo: r.repo, strategy: r.detectedStrategy, confidence: r.confidence }));
}

function applyPatchToOverrides(
  overrides: OverridesFile,
  patch: Array<{ repo: string; strategy: StrategyType; confidence: number }>,
  themes: ThemeEntry[]
): OverridesFile {
  const patchMap = new Map(patch.map((p) => [p.repo, p.strategy]));
  const existingRepos = new Set(overrides.overrides.filter((o) => o.repo).map((o) => o.repo));

  // Update existing entries
  const updated = overrides.overrides.map((entry) => {
    if (!entry.repo) return entry;
    const detected = patchMap.get(entry.repo);
    if (!detected) return entry;

    const meta = entry.meta ?? {};
    const strategy = { ...(meta.strategy ?? {}) };
    strategy.type = detected;

    return {
      ...entry,
      meta: {
        ...meta,
        strategy,
      },
    };
  });

  // Add new entries for repos not in overrides
  const newEntries: ThemeEntry[] = [];
  for (const p of patch) {
    if (existingRepos.has(p.repo)) continue;

    // Find theme entry for this repo
    const theme = themes.find((t) => t.repo === p.repo);
    if (!theme) continue;

    newEntries.push({
      name: theme.name,
      repo: p.repo,
      colorscheme: theme.colorscheme,
      meta: {
        strategy: {
          type: p.strategy,
        },
      },
    });
  }

  const allOverrides = [...updated, ...newEntries];
  allOverrides.sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()));

  return {
    ...overrides,
    overrides: allOverrides,
  };
}

function printErrorSummary(rows: VerificationRow[]): void {
  const errors = rows.filter((r) => r.status === "error");
  if (errors.length === 0) return;

  console.log("");
  log("Errors encountered:", "error");
  for (const r of errors) {
    logDim(`  ${r.repo}: ${r.error || "unknown error"}`);
  }
}

function printMismatchSummary(rows: VerificationRow[], verbose: boolean): void {
  const mismatches = rows.filter((r) => r.status === "mismatch");
  if (mismatches.length === 0) return;

  console.log("");
  log("Strategy mismatches detected:", "warn");
  for (const r of mismatches.slice(0, verbose ? undefined : 10)) {
    logDim(`  ${r.repo}: ${r.currentStrategy} → ${r.detectedStrategy} (conf: ${r.confidence})`);
  }
  if (!verbose && mismatches.length > 10) {
    logDim(`  ... and ${mismatches.length - 10} more (use -v for full list)`);
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  ensureDir(opts.cacheDir);
  ensureDir(opts.outDir);

  console.log("");
  log("Loading theme data...", "info");

  const themes = readJsonFile<ThemeEntry[]>(opts.themesPath);
  const overrides = readJsonFile<OverridesFile>(opts.overridesPath);
  
  // Load manual hints for edge cases
  const hintsPath = "theme-browser-registry-ts/overrides/hints.json";
  const hints = existsSync(hintsPath) ? readJsonFile<HintsFile>(hintsPath)?.hints ?? [] : [];
  const hintsMap = new Map(hints.map((h) => [h.repo, h.strategy]));

  if (opts.theme) {
    const theme = findThemeByName(themes, opts.theme);
    if (!theme) {
      log(`Theme not found: ${opts.theme}`, "error");
      process.exit(1);
    }
    if (!theme.repo) {
      log(`Theme ${opts.theme} has no repo`, "error");
      process.exit(1);
    }

    console.log("");
    log(`Verifying single theme: ${opts.theme}`, "info");
    logDim(`Repo: ${theme.repo}`);

    const repoIndex = buildRepoIndex(themes);
    const row = verifyRepo(theme.repo, repoIndex.get(theme.repo) ?? [theme], overrides, opts, hintsMap);

    console.log("");
    if (row.status === "match") {
      log(`Strategy confirmed: ${row.detectedStrategy} (confidence: ${row.confidence})`, "success");
    } else if (row.status === "mismatch") {
      log(`Strategy mismatch: ${row.currentStrategy} → ${row.detectedStrategy} (confidence: ${row.confidence})`, "warn");
    } else if (row.status === "missing-meta") {
      log(`No strategy in overrides. Detected: ${row.detectedStrategy} (confidence: ${row.confidence})`, "info");
    } else {
      log(`Error: ${row.error}`, "error");
    }

    if (opts.verbose && row.signals.length > 0) {
      console.log("");
      logDim("Detection signals:");
      for (const s of row.signals) {
        logDim(`  ${s.strategy} (+${s.score}): ${s.reason}`);
      }
    }

    const jsonPath = path.join(opts.outDir, `theme-strategy-${opts.theme}.json`);
    const mdPath = path.join(opts.outDir, `theme-strategy-${opts.theme}.md`);
    writeJsonFile(jsonPath, row);

    const lines: string[] = [];
    lines.push(`# Theme Strategy: ${opts.theme}`, "");
    lines.push(`- **Repo**: \`${row.repo}\``);
    lines.push(`- **Current Strategy**: \`${row.currentStrategy}\``);
    lines.push(`- **Detected Strategy**: \`${row.detectedStrategy}\``);
    lines.push(`- **Confidence**: ${row.confidence}`);
    lines.push(`- **Status**: ${row.status}`);
    if (row.error) lines.push(`- **Error**: ${row.error}`);
    lines.push("");
    if (row.signals.length) {
      lines.push("## Signals", "");
      for (const s of row.signals) {
        lines.push(`- **${s.strategy}** (+${s.score}): ${s.reason}`);
      }
    }
    writeFileSync(mdPath, lines.join("\n"), "utf-8");

    console.log("");
    logDim(`Reports: ${jsonPath}`);
    return;
  }

  const repoIndex = buildRepoIndex(themes);
  let repos = [...repoIndex.keys()].sort();

  if (opts.repo) repos = repos.filter((r) => r === opts.repo);
  if (opts.sample && opts.sample > 0) repos = repos.slice(0, opts.sample);

  console.log("");
  log(`Verifying ${repos.length} repos (${repoIndex.size} unique repos in registry)`, "info");
  if (opts.sample) {
    logDim(`Running in sample mode (--sample ${opts.sample})`);
  }
  console.log("");

  const stats = { cached: 0, fetched: 0 };
  let lastProgressUpdate = 0;

  const rows = await limit(repos, 6, (repo) => verifyRepo(repo, repoIndex.get(repo) ?? [], overrides, opts, hintsMap), (idx, row) => {
    const now = Date.now();
    if (now - lastProgressUpdate > 50 || idx === repos.length - 1) {
      updateProgress(idx + 1, repos.length, row.repo, row.status);
      lastProgressUpdate = now;
    }
  });

  clearProgress();

  rows.sort((a, b) => a.repo.toLowerCase().localeCompare(b.repo.toLowerCase()));

  const jsonReportPath = path.join(opts.outDir, "theme-strategy-report.json");
  const mdReportPath = path.join(opts.outDir, "theme-strategy-report.md");
  writeJsonFile(jsonReportPath, rows);
  writeMarkdownReport(rows, mdReportPath);

  const patch = buildPatchProposal(rows);
  patch.sort((a, b) => a.repo.toLowerCase().localeCompare(b.repo.toLowerCase()));
  const patchPath = path.join(opts.outDir, "overrides.patch.json");
  writeJsonFile(patchPath, patch);

  const matches = rows.filter((r) => r.status === "match").length;
  const mismatches = rows.filter((r) => r.status === "mismatch").length;
  const missingMeta = rows.filter((r) => r.status === "missing-meta").length;
  const errors = rows.filter((r) => r.status === "error").length;

  console.log("");
  log("Verification complete", "success");
  console.log("");
  console.log("  Summary:");
  console.log(`    \x1b[32m✓ Matches:\x1b[0m      ${matches}`);
  console.log(`    \x1b[33m↻ Mismatches:\x1b[0m   ${mismatches}`);
  console.log(`    \x1b[34m+ Missing meta:\x1b[0m  ${missingMeta}`);
  console.log(`    \x1b[31m✗ Errors:\x1b[0m       ${errors}`);
  console.log(`    \x1b[36m◆ Patch ready:\x1b[0m   ${patch.length} repos`);
  console.log("");

  printMismatchSummary(rows, opts.verbose);
  printErrorSummary(rows);

  if (opts.apply) {
    console.log("");
    log(`Applying ${patch.length} strategy updates to overrides.json...`, "info");
    const nextOverrides = applyPatchToOverrides(overrides, patch, themes);
    writeJsonFile(opts.overridesPath, nextOverrides);
    log(`Updated ${opts.overridesPath}`, "success");
  } else if (patch.length > 0) {
    console.log("");
    log(`Ready to apply changes? Run with --apply to update overrides.json`, "info");
  }

  console.log("");
  logDim(`Reports saved to ${opts.outDir}/`);
  logDim(`  - theme-strategy-report.json`);
  logDim(`  - theme-strategy-report.md`);
  logDim(`  - overrides.patch.json`);
}

main().catch((err) => {
  clearProgress();
  console.log("");
  log(err.message || err, "error");
  process.exit(1);
});
