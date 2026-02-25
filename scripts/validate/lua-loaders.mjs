#!/usr/bin/env zx
/**
 * validate-lua-loaders.mjs - Validate Lua syntax for all theme loader files
 *
 * Usage: zx scripts/validate/lua-loaders.mjs
 *
 * Runs luac -p on all .lua files in theme-browser-registry-ts/themes/
 * Reports pass/fail for each file.
 *
 * Exit code 0 if all pass, 1 if any fail
 */

import { readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const THEMES_DIR = resolve(ROOT, 'theme-browser-registry-ts/themes');

if (!existsSync(THEMES_DIR)) {
  console.error('Themes directory not found:', THEMES_DIR);
  process.exit(1);
}

const luaFiles = readdirSync(THEMES_DIR)
  .filter(f => f.endsWith('.lua'))
  .sort();

if (luaFiles.length === 0) {
  console.log('No .lua files found in themes directory');
  process.exit(0);
}

console.log(`# Lua Syntax Validation\n`);
console.log(`Checking ${luaFiles.length} files...\n`);

let passed = 0;
let failed = 0;
const failures = [];

for (const file of luaFiles) {
  const filePath = resolve(THEMES_DIR, file);
  try {
    await $`luac -p ${filePath}`.quiet();
    console.log(`✅ ${file}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${file}`);
    failed++;
    failures.push({ file, error: error.message });
  }
}

console.log(`\n---\n`);
console.log(`**Summary**: ${passed} passed, ${failed} failed\n`);

if (failures.length > 0) {
  console.log(`## Failures\n`);
  for (const { file, error } of failures) {
    console.log(`### ${file}\n\`\`\`\n${error}\n\`\`\`\n`);
  }
  process.exit(1);
}

process.exit(0);
