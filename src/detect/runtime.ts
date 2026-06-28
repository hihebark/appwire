import { join } from "path";
import { createRequire } from "module";
import { fileExists } from "./entry.js";

export type TSRuntime = "ts-node" | "tsx";

export interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function detectTSRuntime(
  cwd: string,
  pkg: PackageJson,
): Promise<TSRuntime | null> {
  // 1. Check start/dev scripts only — scanning all scripts risks picking up
  //    tsx/ts-node from test or seed scripts unrelated to the app's own runtime.
  for (const key of ["start", "dev"] as const) {
    const script = pkg.scripts?.[key];
    if (!script) continue;
    const tokens = script.split(/\s+/);
    if (tokens.includes("tsx")) return "tsx";
    if (tokens.includes("ts-node") || tokens.includes("ts-node-esm"))
      return "ts-node";
  }

  // 2. Check dependencies
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  if ("tsx" in allDeps) return "tsx";
  if ("ts-node" in allDeps) return "ts-node";

  // 3. Check node_modules/.bin
  if (await fileExists(join(cwd, "node_modules/.bin/tsx"))) return "tsx";
  if (await fileExists(join(cwd, "node_modules/.bin/ts-node")))
    return "ts-node";

  return null;
}

export function resolveRuntimeLoader(cwd: string, runtime: TSRuntime): string {
  const userRequire = createRequire(join(cwd, "package.json"));
  try {
    if (runtime === "tsx") return userRequire.resolve("tsx/cjs");
    return userRequire.resolve("ts-node/register");
  } catch {
    throw new Error(
      `Could not resolve ${runtime} in ${cwd}. Make sure it is installed as a dependency.`,
    );
  }
}
