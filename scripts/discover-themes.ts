#!/usr/bin/env tsx
/**
 * discover-themes.ts - Discover potential themes from neovim-plugin topic
 *
 * Searches for repos with neovim-plugin topic that might be colorschemes
 * but don't have the standard theme topics. Outputs suggestions for manual review.
 *
 * Usage: npx tsx scripts/discover-themes.ts [options]
 *
 * Options:
 *   --min-stars <n>   Minimum stars threshold (default: 50)
 *   --output <path>   Output file path (default: reports/discovered-themes.json)
 *   --apply           Add discovered themes to config.json includeRepos
 *   -h, --help        Show help
 *
 * Environment:
 *   GITHUB_TOKEN      GitHub personal access token (required)
 */

import { parseArgs } from "node:util";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

// Load .env files if present (check multiple locations)
const envPaths = [
  path.join(ROOT, ".env"),
  path.join(ROOT, "theme-browser-registry-ts", ".env"),
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          process.env[key] = valueParts.join("=");
        }
      }
    }
  }
}

interface DiscoveredTheme {
  repo: string;
  stars: number;
  description: string;
  topics: string[];
  hasColorschemeTopic: boolean;
  hasColorsDir: boolean;
  reason: string;
}

interface GhSearchItem {
  full_name: string;
  stargazers_count: number;
  description: string | null;
  topics: string[] | undefined;
}

interface GhTreeItem {
  path: string;
  type: string;
}

const help = `
discover-themes - Discover potential themes from neovim-plugin topic

Usage:
  discover-themes [options]

Options:
  --min-stars <n>   Minimum stars threshold (default: 50)
  --limit <n>       Maximum repos to check (default: 100)
  --output <path>   Output file path (default: reports/discovered-themes.json)
  --apply           Add discovered themes to config.json includeRepos
  -h, --help        Show this help

Environment:
  GITHUB_TOKEN      GitHub personal access token (or use gh auth login)
`;

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      "min-stars": { type: "string", default: "50" },
      limit: { type: "string", default: "100" },
      output: { type: "string", default: "reports/discovered-themes.json" },
      apply: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(help);
    process.exit(0);
  }

  return {
    minStars: parseInt(values["min-stars"], 10),
    limit: parseInt(values.limit, 10),
    output: values.output,
    apply: values.apply,
  };
}

async function createGitHubClient() {
  let token = process.env.GITHUB_TOKEN?.trim();
  
  // Fallback to gh CLI token
  if (!token) {
    try {
      const { execSync } = await import("node:child_process");
      token = execSync("gh auth token", { encoding: "utf-8" }).trim();
    } catch {
      // gh CLI not available or not authenticated
    }
  }
  
  if (!token) {
    console.error("Error: GITHUB_TOKEN environment variable is required");
    console.error("Set it in .env file or authenticate with gh CLI:");
    console.error("  export GITHUB_TOKEN=your_token_here");
    console.error("  gh auth login");
    process.exit(1);
  }

  const { Octokit } = await import("@octokit/rest");
  return new Octokit({ auth: token });
}

type GitHubClient = Awaited<ReturnType<typeof createGitHubClient>>;

async function searchRepos(
  client: GitHubClient,
  query: string
): Promise<GhSearchItem[]> {
  const results: GhSearchItem[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await client.rest.search.repos({
      q: query,
      per_page: perPage,
      page,
    });

    const items = response.data.items.map((item) => ({
      full_name: item.full_name,
      stargazers_count: item.stargazers_count,
      description: item.description,
      topics: item.topics,
    }));

    if (items.length === 0) break;
    results.push(...items);

    if (items.length < perPage) break;
    page++;

    // Rate limit delay
    await new Promise((r) => setTimeout(r, 250));
  }

  return results;
}

async function hasColorsDirectory(client: GitHubClient, repo: string): Promise<boolean> {
  try {
    const [owner, repoName] = repo.split("/");
    const response = await client.rest.git.getTree({
      owner,
      repo: repoName,
      tree_sha: "HEAD",
      recursive: "true",
    });

    return response.data.tree.some((item) => /^colors\//.test(item.path));
  } catch {
    return false;
  }
}

function loadCurrentIndex(): Set<string> {
  const indexPath = "theme-browser-registry-ts/artifacts/index.json";
  if (!existsSync(indexPath)) {
    return new Set();
  }

  const data = JSON.parse(readFileSync(indexPath, "utf-8")) as Array<{ repo: string }>;
  return new Set(data.map((t) => t.repo));
}

function loadConfigIncludeRepos(): Set<string> {
  const configPath = "theme-browser-registry-ts/config.json";
  if (!existsSync(configPath)) {
    return new Set();
  }

  const data = JSON.parse(readFileSync(configPath, "utf-8")) as {
    discovery?: { includeRepos?: string[] };
  };
  return new Set(data.discovery?.includeRepos ?? []);
}

async function main() {
  const opts = parseCliArgs();
  
  // Create GitHub client
  const client = await createGitHubClient();
  
  console.log(`Searching for repos with neovim-plugin topic and ${opts.minStars}+ stars...`);
  
  // Load current index and config
  const currentIndex = loadCurrentIndex();
  const includeRepos = loadConfigIncludeRepos();
  const allKnown = new Set([...currentIndex, ...includeRepos]);
  
  // Search for repos with neovim-plugin topic
  const query = `topic:neovim-plugin stars:>${opts.minStars}`;
  const results = await searchRepos(client, query);
  
  console.log(`Found ${results.length} repos with neovim-plugin topic`);
  
  // First pass: filter by topic (cheap)
  const excludePatterns = [
    /SpaceVim$/i,
    /LazyVim$/i,
    /AstroNvim$/i,
    /NvChad$/i,
    /mini\.nvim$/i,
    /nvim-config$/i,
    /dotfiles$/i,
    /\.vim$/i,
    /vimrc$/i,
  ];
  
  const candidates = results.filter((item) => {
    if (allKnown.has(item.full_name)) return false;
    
    // Skip known non-theme patterns
    if (excludePatterns.some((p) => p.test(item.full_name))) return false;
    
    const topics = item.topics ?? [];
    const hasColorschemeTopic = topics.some((t) =>
      ["neovim-colorscheme", "vim-colorscheme", "colorscheme", "nvim-theme", "neovim-theme"].includes(t)
    );
    
    // We want repos WITHOUT colorscheme topic (they're missing it)
    return !hasColorschemeTopic;
  });
  
  console.log(`${candidates.length} repos without colorscheme topic to check`);
  
  // Second pass: check for colors/ directory (expensive, limit it)
  const toCheck = candidates.slice(0, opts.limit);
  const discovered: DiscoveredTheme[] = [];
  
  console.log(`Checking ${toCheck.length} repos for colors/ directory...`);
  
  for (let i = 0; i < toCheck.length; i++) {
    const item = toCheck[i];
    
    // Progress indicator
    process.stdout.write(`\r[${i + 1}/${toCheck.length}] Checking ${item.full_name}...`);
    
    const hasColors = await hasColorsDirectory(client, item.full_name);
    
    if (hasColors) {
      const topics = item.topics ?? [];
      discovered.push({
        repo: item.full_name,
        stars: item.stargazers_count,
        description: item.description ?? "",
        topics,
        hasColorschemeTopic: false,
        hasColorsDir: hasColors,
        reason: "Has colors/ directory but missing colorscheme topic",
      });
    }
    
    // Rate limit delay
    await new Promise((r) => setTimeout(r, 200));
  }
  
  console.log("\n");
  
  // Sort by stars
  discovered.sort((a, b) => b.stars - a.stars);
  
  console.log(`\nDiscovered ${discovered.length} potential themes for review:`);
  
  for (const theme of discovered.slice(0, 20)) {
    console.log(`  ${theme.repo} (${theme.stars} stars)`);
    console.log(`    ${theme.description.slice(0, 60)}${theme.description.length > 60 ? "..." : ""}`);
  }
  
  if (discovered.length > 20) {
    console.log(`  ... and ${discovered.length - 20} more`);
  }
  
  // Ensure output directory exists
  const outputDir = path.dirname(opts.output);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  // Write output
  const output = {
    generated_at: new Date().toISOString(),
    total: discovered.length,
    checked: toCheck.length,
    themes: discovered,
  };
  
  writeFileSync(opts.output, JSON.stringify(output, null, 2));
  console.log(`\nOutput written to: ${opts.output}`);
  
  if (opts.apply && discovered.length > 0) {
    console.log("\nTo add these themes, manually add them to config.json includeRepos:");
    for (const theme of discovered) {
      console.log(`  "${theme.repo}",`);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
