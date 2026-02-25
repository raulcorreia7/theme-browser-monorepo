#!/usr/bin/env tsx
/**
 * apply-variant-modes.ts - Apply detected variant modes to source files
 *
 * Usage: npx tsx scripts/apply-variant-modes.ts [options]
 *
 * Options:
 *   -r, --report <path>  Detection report (default: reports/detection.json)
 *   -s, --sources <dir>  Sources directory (default: theme-browser-registry-ts/sources)
 *   -d, --dry-run        Show what would be changed without applying
 *   -h, --help           Show help
 */

import { parseArgs } from "node:util";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

interface DetectionSignal {
  strategy: string;
  score: number;
  reason: string;
}

interface VariantModeResult {
  name: string;
  detectedMode?: "dark" | "light";
  confidence: number;
  source: "pattern" | "readme" | "hint" | "unknown";
  reason?: string;
}

interface DetectionRow {
  repo: string;
  themeNames: string[];
  currentStrategy: string | "missing";
  detectedStrategy: string;
  confidence: number;
  status: "match" | "mismatch" | "missing-meta" | "error";
  signals: DetectionSignal[];
  error?: string;
  variants?: {
    total: number;
    withMode: number;
    detected: VariantModeResult[];
    coverage: number;
  };
}

interface ThemeEntry {
  name: string;
  repo?: string;
  colorscheme?: string;
  variants?: Array<{
    name: string;
    colorscheme?: string;
    mode?: string;
  }>;
  meta?: {
    strategy?: {
      type: string;
    };
  };
}

interface SourcesFile {
  overrides: ThemeEntry[];
  builtin?: ThemeEntry[];
}

const help = `
apply-variant-modes - Apply detected variant modes to source files

Usage:
  apply-variant-modes [options]

Options:
  -r, --report <path>   Detection report (default: reports/detection.json)
  -s, --sources <dir>   Sources directory (default: theme-browser-registry-ts/sources)
  -d, --dry-run         Show what would be changed without applying
  -h, --help            Show this help
`;

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      report: { type: "string", short: "r", default: "reports/detection.json" },
      sources: { type: "string", short: "s", default: "theme-browser-registry-ts/sources" },
      "dry-run": { type: "boolean", short: "d", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(help);
    process.exit(0);
  }

  return values;
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeJsonFile(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
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
  // Group themes by strategy
  const byStrategy: Record<string, ThemeEntry[]> = {
    setup: [],
    load: [],
    colorscheme: [],
    builtin: sources.builtin ?? [],
  };

  for (const theme of sources.overrides) {
    const strategy = theme.meta?.strategy?.type ?? "unknown";
    if (byStrategy[strategy]) {
      byStrategy[strategy].push(theme);
    } else {
      byStrategy[strategy] = [theme];
    }
  }

  // Write each strategy file
  for (const [strategy, themes] of Object.entries(byStrategy)) {
    if (strategy === "builtin") continue;

    const filePath = path.join(sourcesDir, `${strategy}.json`);
    const data = {
      $schema: "../schemas/source.schema.json",
      description: `Themes using the ${strategy} loading strategy`,
      strategy,
      themes,
    };
    writeJsonFile(filePath, data);
  }

  // Write builtin file
  if (byStrategy.builtin.length > 0) {
    const builtinPath = path.join(sourcesDir, "builtin.json");
    const data = {
      $schema: "../schemas/source.schema.json",
      description: "Built-in Vim/Neovim themes",
      themes: byStrategy.builtin,
    };
    writeJsonFile(builtinPath, data);
  }
}

function applyVariantModes(
  sources: SourcesFile,
  detectionRows: DetectionRow[],
  dryRun: boolean
): { changes: number; themes: number; details: string[] } {
  const changes: string[] = [];
  let changeCount = 0;
  let themeCount = 0;

  // Build a map of repo -> variant modes from detection
  const repoVariantModes = new Map<string, Map<string, string>>();
  
  for (const row of detectionRows) {
    if (!row.variants || row.variants.detected.length === 0) continue;
    
    const variantMap = new Map<string, string>();
    
    for (const variant of row.variants.detected) {
      if (variant.detectedMode) {
        variantMap.set(variant.name, variant.detectedMode);
      }
    }
    
    if (variantMap.size > 0) {
      repoVariantModes.set(row.repo, variantMap);
    }
  }

  // Apply to sources
  for (const theme of sources.overrides) {
    if (!theme.repo || !theme.variants || theme.variants.length === 0) continue;

    const variantMap = repoVariantModes.get(theme.repo);
    if (!variantMap) continue;

    let themeChanged = false;
    for (const variant of theme.variants) {
      // Only apply if variant doesn't already have a mode
      if (!variant.mode && variantMap.has(variant.name)) {
        const newMode = variantMap.get(variant.name)!;
        if (!dryRun) {
          variant.mode = newMode;
        }
        changes.push(`${theme.repo}:${variant.name} → ${newMode}`);
        themeChanged = true;
        changeCount++;
      }
    }

    if (themeChanged) {
      themeCount++;
    }
  }

  return { changes: changeCount, themes: themeCount, details: changes };
}

function main() {
  const opts = parseCliArgs();

  // Load detection report
  if (!existsSync(opts.report)) {
    console.error(`Report not found: ${opts.report}`);
    console.error("Run 'npx tsx scripts/02-detect-strategies.ts' first to generate the report.");
    process.exit(1);
  }

  const detectionRows = readJsonFile<DetectionRow[]>(opts.report);
  
  // Count repos with variants
  const reposWithVariants = detectionRows.filter(r => r.variants && r.variants.total > 0);
  const totalDetectedModes = reposWithVariants.reduce(
    (sum, r) => sum + (r.variants?.withMode || 0), 
    0
  );
  
  // Load sources
  const sources = loadSources(opts.sources);

  console.log(`Loaded ${sources.overrides.length} themes from sources`);
  console.log(`Detection report has ${reposWithVariants.length} repos with variants`);
  console.log(`Total detected variant modes: ${totalDetectedModes}`);
  console.log("");

  // Apply variant modes
  const result = applyVariantModes(sources, detectionRows, opts["dry-run"]);

  if (result.changes === 0) {
    console.log("No variant modes to apply (all variants already have modes).");
    return;
  }

  console.log(`${opts["dry-run"] ? "Would apply" : "Applied"} ${result.changes} variant modes to ${result.themes} themes`);
  console.log("");

  if (opts["dry-run"]) {
    console.log("Sample changes (dry-run):");
    for (const detail of result.details.slice(0, 20)) {
      console.log(`  ${detail}`);
    }
    if (result.details.length > 20) {
      console.log(`  ... and ${result.details.length - 20} more`);
    }
    console.log("");
    console.log("Run without --dry-run to apply these changes.");
  } else {
    // Save sources
    saveSources(opts.sources, sources);
    console.log(`Updated source files in ${opts.sources}`);
    console.log("");
    console.log("Next steps:");
    console.log("  1. Review the changes: git diff");
    console.log("  2. Run: npm run build (in theme-browser-registry-ts)");
    console.log("  3. Test: npx tsx theme-browser-registry-ts/src/cli/commands/sync.ts");
  }
}

main();
