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

type SourcesFile = {
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

type DetectionRow = {
  repo: string;
  themeNames: string[];
  currentStrategy: StrategyType | "missing";
  detectedStrategy: StrategyType;
  confidence: number;
  status: "match" | "mismatch" | "missing-meta" | "error";
  signals: DetectionSignal[];
  error?: string;
};

type CliOptions = {
  themesPath: string;
  sourcesPath: string;
  sample?: number;
  repo?: string;
  theme?: string;
  apply: boolean;
  report: boolean;
  cacheDir: string;
  outDir: string;
  noCache: boolean;
};

type LogLevel = "info" | "success" | "warn" | "error" | "dim";

const DEFAULTS = {
  themesPath: "theme-browser-registry-ts/artifacts/themes.json",
  sourcesPath: "theme-browser-registry-ts/overrides.json",
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
    sourcesPath: DEFAULTS.sourcesPath,
    apply: false,
    report: false,
    cacheDir: DEFAULTS.cacheDir,
    outDir: DEFAULTS.outDir,
    noCache: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];

    if (a === "--themes" && next) { opts.themesPath = next; i++; continue; }
    if (a === "--sources" && next) { opts.sourcesPath = next; i++; continue; }
    if (a === "--sample" && next) { opts.sample = Number(next); i++; continue; }
    if (a === "--repo" && next) { opts.repo = next; i++; continue; }
    if (a === "--theme" && next) { opts.theme = next; i++; continue; }
    if (a === "--cache-dir" && next) { opts.cacheDir = next; i++; continue; }
    if (a === "--out-dir" && next) { opts.outDir = next; i++; continue; }
    if (a === "--apply") { opts.apply = true; continue; }
    if (a === "--report") { opts.report = true; continue; }
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
detect-strategies.ts - Detect theme loading strategies

Usage:
  tsx scripts/detect-strategies.ts [options]

Options:
  --themes <path>       Path to artifacts/themes.json
  --sources <path>      Path to overrides.json
  --sample <n>          Detect first N repos
  --repo <owner/name>   Detect only one repo
  --theme <name>        Detect theme by name
  --apply               Update sources/*.json with detected strategies
  --report              Show detailed report output
  --cache-dir <path>    Cache directory
  --out-dir <path>      Output reports directory
  --no-cache            Disable cache reads/writes
  -h, --help            Show help

Output:
  Always writes: reports/detection.json

Examples:
  tsx scripts/detect-strategies.ts --sample 20
  tsx scripts/detect-strategies.ts --repo folke/tokyonight.nvim
  tsx scripts/detect-strategies.ts --apply
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

  if (/require\(["'][^"']+["']\)\.load\s*\(/i.test(text)) {
    signals.push({ strategy: "load", score: 8, reason: `README contains require(...).load(...)` });
  }
  if (/\.load\s*\(\s*{?/i.test(text) && /require\(/i.test(text)) {
    signals.push({ strategy: "load", score: 2, reason: `README shows .load() pattern` });
  }

  if (/require\(["'][^"']+["']\)\.setup\s*\(/i.test(text)) {
    signals.push({ strategy: "setup", score: 6, reason: `README contains require(...).setup(...)` });
  }
  if (/setup\s*\(\s*{[\s\S]*?}\s*\)/i.test(text)) {
    signals.push({ strategy: "setup", score: 2, reason: `README shows setup({...}) options block` });
  }

  if (/:?colorscheme\s+[a-z0-9_.-]+/i.test(text)) {
    signals.push({ strategy: "colorscheme", score: 4, reason: `README shows :colorscheme usage` });
  }
  if (/vim\.cmd\s*\(\s*["']colorscheme\s+[a-z0-9_.-]+["']\s*\)/i.test(text)) {
    signals.push({ strategy: "colorscheme", score: 4, reason: `README shows vim.cmd("colorscheme ...")` });
  }
  if (/vim\.cmd\.colorscheme\s*\(\s*["'][a-z0-9_.-]+["']\s*\)/i.test(text)) {
    signals.push({ strategy: "colorscheme", score: 4, reason: `README shows vim.cmd.colorscheme(...)` });
  }

  if (/let\s+g:[a-z_]+\s*=/i.test(text) && !/require\(/i.test(text)) {
    signals.push({ strategy: "colorscheme", score: 3, reason: `README shows vim.g globals without require()` });
  }

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
    confidence < 0.9;

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

  if (hasColorsVim && !hasLuaModule && !hasColorsLua) {
    signals.push({ strategy: "colorscheme", score: 6, reason: `Repo has colors/*.vim without Lua module` });
  }

  if (hasLuaModule && hasColorsLua) {
    signals.push({ strategy: "setup", score: 4, reason: `Repo has Lua module + colors/*.lua` });
  }

  if (hasColorsLua && !hasLuaModule) {
    signals.push({ strategy: "colorscheme", score: 5, reason: `Repo has colors/*.lua without Lua module` });
  }

  if (hasLuaModule && !hasColorsDir) {
    signals.push({ strategy: "setup", score: 2, reason: `Repo has Lua module without colors/` });
  }

  if (hasPluginDir && hasLuaModule) {
    signals.push({ strategy: "load", score: 2, reason: `Repo has lua/ + plugin/ layout` });
  }

  if (hasColorsVim && hasLuaModule && !hasColorsLua) {
    signals.push({ strategy: "colorscheme", score: 4, reason: `Repo has colors/*.vim + Lua module` });
  }

  if (signals.length === 0) return {};

  const tally: Record<StrategyType, number> = { setup: 0, load: 0, colorscheme: 0, file: 0, unknown: 0 };
  for (const s of signals) tally[s.strategy] += s.score;
  const best = (Object.entries(tally) as Array<[StrategyType, number]>).sort((a, b) => b[1] - a[1])[0];

  return {
    detected: (best?.[0] ?? "unknown") as StrategyType,
    confidence: 0.5,
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

function findCurrentStrategy(repo: string, sources: SourcesFile): StrategyType | "missing" {
  const entry = sources.overrides.find((o) => o.repo === repo);
  return (entry?.meta?.strategy?.type as StrategyType | undefined) ?? "missing";
}

function detectRepo(
  repo: string,
  repoThemes: ThemeEntry[],
  sources: SourcesFile,
  opts: CliOptions,
  hintsMap: Map<string, StrategyType>
): DetectionRow {
  try {
    const readme = fetchReadme(repo, opts);
    let det = detectFromText(readme);

    if (det.needsSourceInspection) {
      const src = inspectSource(repo, opts);
      const mergedSignals = [...det.signals, ...(src.signals ?? [])];

      if (
        (det.detected === "unknown" && src.detected) ||
        (det.confidence < 0.9 && src.detected && src.detected !== "unknown")
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

    if (hintsMap.has(repo)) {
      det = {
        detected: hintsMap.get(repo)!,
        confidence: 1.0,
        signals: [...det.signals, { strategy: hintsMap.get(repo)!, score: 10, reason: "Manual hint override" }],
        needsSourceInspection: false,
      };
    }

    const current = findCurrentStrategy(repo, sources);
    const status: DetectionRow["status"] =
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
      signals: det.signals,
    };
  } catch (err) {
    return {
      repo,
      themeNames: [...new Set(repoThemes.map((t) => t.name))],
      currentStrategy: findCurrentStrategy(repo, sources),
      detectedStrategy: "unknown",
      confidence: 0,
      status: "error",
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

function buildPatch(rows: DetectionRow[]): Array<{ repo: string; strategy: StrategyType; confidence: number }> {
  return rows
    .filter((r) =>
      (r.status === "mismatch" || r.status === "missing-meta") &&
      r.detectedStrategy !== "unknown" &&
      r.confidence >= 0.9
    )
    .map((r) => ({ repo: r.repo, strategy: r.detectedStrategy, confidence: r.confidence }));
}

function applyPatch(
  sources: SourcesFile,
  patch: Array<{ repo: string; strategy: StrategyType; confidence: number }>,
  themes: ThemeEntry[]
): SourcesFile {
  const patchMap = new Map(patch.map((p) => [p.repo, p.strategy]));
  const existingRepos = new Set(sources.overrides.filter((o) => o.repo).map((o) => o.repo));

  const updated = sources.overrides.map((entry) => {
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

  const newEntries: ThemeEntry[] = [];
  for (const p of patch) {
    if (existingRepos.has(p.repo)) continue;

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
    ...sources,
    overrides: allOverrides,
  };
}

function printSummary(rows: DetectionRow[], patch: DetectionRow[], opts: CliOptions): void {
  const matches = rows.filter((r) => r.status === "match").length;
  const mismatches = rows.filter((r) => r.status === "mismatch").length;
  const missingMeta = rows.filter((r) => r.status === "missing-meta").length;
  const errors = rows.filter((r) => r.status === "error").length;

  console.log("");
  log("Detection complete", "success");
  console.log("");
  console.log("  Summary:");
  console.log(`    \x1b[32m✓ Matches:\x1b[0m      ${matches}`);
  console.log(`    \x1b[33m↻ Mismatches:\x1b[0m   ${mismatches}`);
  console.log(`    \x1b[34m+ Missing meta:\x1b[0m  ${missingMeta}`);
  console.log(`    \x1b[31m✗ Errors:\x1b[0m       ${errors}`);
  console.log(`    \x1b[36m◆ To apply:\x1b[0m     ${patch.length} repos`);
  console.log("");

  if (opts.report) {
    const mismatches = rows.filter((r) => r.status === "mismatch");
    if (mismatches.length > 0) {
      log("Mismatches:", "warn");
      for (const r of mismatches) {
        logDim(`  ${r.repo}: ${r.currentStrategy} → ${r.detectedStrategy} (conf: ${r.confidence})`);
      }
      console.log("");
    }

    const errors = rows.filter((r) => r.status === "error");
    if (errors.length > 0) {
      log("Errors:", "error");
      for (const r of errors) {
        logDim(`  ${r.repo}: ${r.error || "unknown"}`);
      }
      console.log("");
    }
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  ensureDir(opts.cacheDir);
  ensureDir(opts.outDir);

  log("Loading theme data...", "info");

  const themes = readJsonFile<ThemeEntry[]>(opts.themesPath);
  const sources = readJsonFile<SourcesFile>(opts.sourcesPath);
  
  const hintsPath = "theme-browser-registry-ts/sources/hints.json";
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

    log(`Detecting: ${theme.repo}`, "info");

    const repoIndex = buildRepoIndex(themes);
    const row = detectRepo(theme.repo, repoIndex.get(theme.repo) ?? [theme], sources, opts, hintsMap);

    if (row.status === "match") {
      log(`Strategy: ${row.detectedStrategy} (confidence: ${row.confidence})`, "success");
    } else if (row.status === "mismatch") {
      log(`${row.currentStrategy} → ${row.detectedStrategy} (confidence: ${row.confidence})`, "warn");
    } else if (row.status === "missing-meta") {
      log(`Detected: ${row.detectedStrategy} (confidence: ${row.confidence})`, "info");
    } else {
      log(`Error: ${row.error}`, "error");
    }

    if (opts.report && row.signals.length > 0) {
      console.log("");
      for (const s of row.signals) {
        logDim(`${s.strategy} (+${s.score}): ${s.reason}`);
      }
    }

    writeJsonFile(path.join(opts.outDir, "detection.json"), row);
    return;
  }

  const repoIndex = buildRepoIndex(themes);
  let repos = [...repoIndex.keys()].sort();

  if (opts.repo) repos = repos.filter((r) => r === opts.repo);
  if (opts.sample && opts.sample > 0) repos = repos.slice(0, opts.sample);

  log(`Detecting ${repos.length} repos`, "info");
  console.log("");

  let lastProgressUpdate = 0;

  const rows = await limit(repos, 6, (repo) => detectRepo(repo, repoIndex.get(repo) ?? [], sources, opts, hintsMap), (idx, row) => {
    const now = Date.now();
    if (now - lastProgressUpdate > 50 || idx === repos.length - 1) {
      updateProgress(idx + 1, repos.length, row.repo, row.status);
      lastProgressUpdate = now;
    }
  });

  clearProgress();

  rows.sort((a, b) => a.repo.toLowerCase().localeCompare(b.repo.toLowerCase()));

  writeJsonFile(path.join(opts.outDir, "detection.json"), rows);

  const patch = buildPatch(rows);
  patch.sort((a, b) => a.repo.toLowerCase().localeCompare(b.repo.toLowerCase()));

  printSummary(rows, rows.filter(r => patch.some(p => p.repo === r.repo)), opts);

  if (opts.apply) {
    log(`Applying ${patch.length} strategy updates...`, "info");
    const nextSources = applyPatch(sources, patch, themes);
    writeJsonFile(opts.sourcesPath, nextSources);
    log(`Updated ${opts.sourcesPath}`, "success");
  } else if (patch.length > 0) {
    log(`Run with --apply to update sources`, "info");
  }

  logDim(`Report: ${opts.outDir}/detection.json`);
}

main().catch((err) => {
  clearProgress();
  console.log("");
  log(err.message || err, "error");
  process.exit(1);
});
