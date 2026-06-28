import { readFile, access } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join, resolve } from "path";

export interface DetectedEntry {
  file: string;
  source: "main" | "scripts.start" | "scripts.dev" | "fallback" | "explicit";
}

interface PackageJson {
  main?: string;
  scripts?: Record<string, string>;
}

const KNOWN_RUNTIMES = new Set([
  "ts-node",
  "ts-node-esm",
  "tsx",
  "node",
  "npx",
  "pnpx",
  "yarn",
  "cross-env",
  "dotenv",
  "dotenv-cli",
]);

// Flags that consume the next token as their value
const FLAGS_WITH_VALUE = new Set([
  "--require",
  "-r",
  "--loader",
  "--import",
  "--env-file",
  "-e",
  "--eval",
]);

export function extractEntryFromScript(script: string): string | null {
  const tokens = script.trim().split(/\s+/);
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (KNOWN_RUNTIMES.has(token)) {
      i++;
      continue;
    }
    if (token.startsWith("-")) {
      if (FLAGS_WITH_VALUE.has(token)) i++; // skip value token
      i++;
      continue;
    }
    if (!token.includes("=") && /\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(token)) {
      return token;
    }
    i++;
  }
  return null;
}

export async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export function findPackageRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

export function findPnpmRoot(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    if (
      existsSync(join(dir, "pnpm-workspace.yaml")) ||
      existsSync(join(dir, "pnpm-lock.yaml"))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function detectEntry(cwd: string): Promise<DetectedEntry> {
  const pkgPath = join(cwd, "package.json");
  let pkg: PackageJson = {};

  try {
    const raw = await readFile(pkgPath, "utf8");
    pkg = JSON.parse(raw) as PackageJson;
  } catch {
    // no package.json or unparseable — continue to fallbacks
  }

  if (pkg.main) {
    const file = resolve(cwd, pkg.main);
    if (await fileExists(file)) return { file, source: "main" };
  }

  for (const scriptKey of ["start", "dev"] as const) {
    const script = pkg.scripts?.[scriptKey];
    if (!script) continue;
    const entry = extractEntryFromScript(script);
    if (!entry) continue;
    const file = resolve(cwd, entry);
    if (await fileExists(file)) {
      return {
        file,
        source: scriptKey === "start" ? "scripts.start" : "scripts.dev",
      };
    }
  }

  for (const fallback of ["src/main.ts", "dist/main.js"]) {
    const file = resolve(cwd, fallback);
    if (await fileExists(file)) return { file, source: "fallback" };
  }

  throw new Error(
    "Could not detect entry point. Use --entry to specify it explicitly.",
  );
}
