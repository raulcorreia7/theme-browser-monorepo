#!/usr/bin/env node
/**
 * 02-detect-strategies.ts - Detect theme loading strategies
 *
 * Usage: npx tsx scripts/02-detect-strategies.ts [options]
 *
 * Options:
 *   -i, --index <path>    Index file (default: theme-browser-registry-ts/artifacts/index.json)
 *   -s, --sources <dir>   Sources directory (default: theme-browser-registry-ts/sources)
 *   -o, --output <dir>    Output directory (default: reports)
 *   -n, --sample <n>      Process first N repos only
 *   -r, --repo <owner/repo>  Process single repo
 *   -t, --theme <name>    Process by theme name
 *   -a, --apply           Apply changes to sources
 *   -v, --verbose         Show detailed output
 *   --no-cache            Disable cache
 *   -h, --help            Show help
 */
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const help = `
02-detect-strategies - Detect theme loading strategies

Usage:
  02-detect-strategies [options]

Options:
  -i, --index <path>       Index file (default: theme-browser-registry-ts/artifacts/index.json)
  -s, --sources <dir>      Sources directory (default: theme-browser-registry-ts/sources)
  -o, --output <dir>       Output directory (default: reports)
  --cache <dir>            Cache directory (default: .cache/theme-verifier)
  -n, --sample <n>         Process first N repos only
  -r, --repo <owner/repo>  Process single repo
  -t, --theme <name>       Process by theme name
  -a, --apply              Apply changes to sources
  -v, --verbose            Show detailed output
  --no-cache               Disable cache
  -h, --help               Show this help

Output:
  Always writes: reports/detection.json
`;

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
  index: string;
  sources: string;
  output: string;
  cache: string;
  sample?: number;
  repo?: string;
  theme?: string;
  apply: boolean;
  verbose: boolean;
  noCache: boolean;
};

type LogLevel = "info" | "success" | "warn" | "error" | "dim";

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

function parseCliArgs(): CliOptions {
  const { values } = parseArgs({
    options: {
      index: { type: "string", short: "i", default: "theme-browser-registry-ts/artifacts/index.json" },
      sources: { type: "string", short: "s", default: "theme-browser-registry-ts/sources" },
      output: { type: "string", short: "o", default: "reports" },
      cache: { type: "string", default: ".cache/theme-verifier" },
      sample: { type: "string", short: "n" },
      repo: { type: "string", short: "r" },
      theme: { type: "string", short: "t" },
      apply: { type: "boolean", short: "a", default: false },
      verbose: { type: "boolean", short: "v", default: false },
      "no-cache": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(help);
    process.exit(0);
  }

  return {
    index: resolve(ROOT, values.index),
    sources: resolve(ROOT, values.sources),
    output: resolve(ROOT, values.output),
    cache: resolve(ROOT, values.cache),
    sample: values.sample ? Number(values.sample) : undefined,
    repo: values.repo,
    theme: values.theme,
    apply: values.apply,
    verbose: values.verbose,
    noCache: values["no-cache"],
  };
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
  const cpath = cachePath(opts.cache, "readme", repo, "md");
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
  const cpath = cachePath(opts.cache, "tree", repo, "json");
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

function printSummary(rows: DetectionRow[], patchRows: DetectionRow[], opts: CliOptions): void {
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
  console.log(`    \x1b[36m◆ To apply:\x1b[0m     ${patchRows.length} repos`);
  console.log("");

  if (opts.verbose) {
    const mismatchesList = rows.filter((r) => r.status === "mismatch");
    if (mismatchesList.length > 0) {
      log("Mismatches:", "warn");
      for (const r of mismatchesList) {
        logDim(`  ${r.repo}: ${r.currentStrategy} → ${r.detectedStrategy} (conf: ${r.confidence})`);
      }
      console.log("");
    }

    const errorsList = rows.filter((r) => r.status === "error");
    if (errorsList.length > 0) {
      log("Errors:", "error");
      for (const r of errorsList) {
        logDim(`  ${r.repo}: ${r.error || "unknown"}`);
      }
      console.log("");
    }
  }
}

function loadSources(sourcesDir: string): SourcesFile {
  const overridesPath = path.join(sourcesDir, "overrides.json");
  if (existsSync(overridesPath)) {
    return readJsonFile<SourcesFile>(overridesPath);
  }

  const allThemes: ThemeEntry[] = [];
  const builtin: ThemeEntry[] = [];

  const strategyFiles = ["setup.json", "load.json", "colorscheme.json", "builtin.json"];

  for (const file of strategyFiles) {
    const filePath = path.join(sourcesDir, file);
    if (!existsSync(filePath)) continue;

    const data = readJsonFile<{ themes: ThemeEntry[]; strategy?: string }>(filePath);
    if (!data?.themes) continue;

    if (file === "builtin.json") {
      builtin.push(...data.themes);
    } else {
      for (const t of data.themes) {
        allThemes.push(t);
      }
    }
  }

  return { overrides: allThemes, builtin };
}

function saveSources(sourcesDir: string, sources: SourcesFile): void {
  const byStrategy: Record<string, ThemeEntry[]> = {
    setup: [],
    load: [],
    colorscheme: [],
    builtin: sources.builtin ?? [],
  };

  for (const t of sources.overrides) {
    const strategy = t.meta?.strategy?.type ?? "colorscheme";
    if (byStrategy[strategy]) {
      byStrategy[strategy].push(t);
    } else {
      byStrategy.colorscheme.push(t);
    }
  }

  for (const [strategy, themes] of Object.entries(byStrategy)) {
    if (themes.length === 0) continue;

    const filePath = path.join(sourcesDir, `${strategy}.json`);
    const existing = existsSync(filePath) ? readJsonFile<{ themes: ThemeEntry[] }>(filePath) : null;

    writeJsonFile(filePath, {
      strategy,
      count: themes.length,
      themes: themes.sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase())),
    });
  }
}

async function main(): Promise<void> {
  const opts = parseCliArgs();
  ensureDir(opts.cache);
  ensureDir(opts.output);

  log("Loading theme data...", "info");

  const themes = readJsonFile<ThemeEntry[]>(opts.index);
  const sources = loadSources(opts.sources);

  const hintsPath = path.join(opts.sources, "hints.json");
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

    if (opts.verbose && row.signals.length > 0) {
      console.log("");
      for (const s of row.signals) {
        logDim(`${s.strategy} (+${s.score}): ${s.reason}`);
      }
    }

    writeJsonFile(path.join(opts.output, "detection.json"), row);
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

  writeJsonFile(path.join(opts.output, "detection.json"), rows);

  const patch = buildPatch(rows);
  patch.sort((a, b) => a.repo.toLowerCase().localeCompare(b.repo.toLowerCase()));

  printSummary(rows, rows.filter(r => patch.some(p => p.repo === r.repo)), opts);

  if (opts.apply) {
    log(`Applying ${patch.length} strategy updates...`, "info");
    const nextSources = applyPatch(sources, patch, themes);
    saveSources(opts.sources, nextSources);
    log(`Updated ${opts.sources}`, "success");
  } else if (patch.length > 0) {
    log(`Run with --apply to update sources`, "info");
  }

  logDim(`Report: ${opts.output}/detection.json`);
}

main().catch((err) => {
  clearProgress();
  console.log("");
  log(err.message || err, "error");
  process.exit(1);
});
