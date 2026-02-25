/**
 * Logger utility for consistent CLI output
 */

type LogLevel = "info" | "success" | "warn" | "error";

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[90m",
  bold: "\x1b[1m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

const ICONS: Record<LogLevel, string> = {
  info: `${COLORS.blue}→${COLORS.reset}`,
  success: `${COLORS.green}✓${COLORS.reset}`,
  warn: `${COLORS.yellow}⚠${COLORS.reset}`,
  error: `${COLORS.red}✗${COLORS.reset}`,
};

export function log(msg: string, level: LogLevel = "info"): void {
  console.log(`${ICONS[level]} ${msg}`);
}

export function logDim(msg: string): void {
  console.log(`${COLORS.dim}${msg}${COLORS.reset}`);
}

export function logHeader(title: string): void {
  console.log("");
  console.log(`${COLORS.bold}${title}${COLORS.reset}`);
  console.log("");
}

export function logTable(rows: Array<{ label: string; value: string | number; status?: "ok" | "warn" | "error" }>): void {
  const statusIcons = {
    ok: `${COLORS.green}✓${COLORS.reset}`,
    warn: `${COLORS.yellow}↻${COLORS.reset}`,
    error: `${COLORS.red}✗${COLORS.reset}`,
  };
  console.log("");
  for (const row of rows) {
    const icon = row.status ? statusIcons[row.status] : " ";
    console.log(`  ${icon} ${row.label}: ${row.value}`);
  }
  console.log("");
}

export function logDone(msg: string = "Done"): void {
  console.log("");
  log(msg, "success");
  console.log("");
}

export function logFail(msg: string, detail?: string): void {
  console.log("");
  log(msg, "error");
  if (detail) logDim(`  ${detail}`);
  console.log("");
}

export const logger = {
  info: (msg: string) => log(msg, "info"),
  success: (msg: string) => log(msg, "success"),
  warn: (msg: string) => log(msg, "warn"),
  error: (msg: string) => log(msg, "error"),
  dim: logDim,
  header: logHeader,
  table: logTable,
  done: logDone,
  fail: logFail,
};
