import { resolve, dirname, join } from "path";
import { readFile } from "fs/promises";
import { existsSync, statSync } from "fs";
import { fileURLToPath } from "url";
import type { ChildProcess } from "child_process";
import { detectEntry, findPackageRoot, findPnpmRoot } from "../detect/entry.js";
import { detectTSRuntime, resolveRuntimeLoader, type PackageJson } from "../detect/runtime.js";
import { spawnApp } from "../process/spawn.js";
import { createIPCChannel } from "../channel/ipc.js";
import type { AppwireTransport } from "../transport/types.js";
import { createIPCTransport } from "../transport/ipc.js";

export interface AttachOptions {
  entry?: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
// dist/cli.cjs is one level below dist/, bootstrap.cjs is at dist/bootstrap.cjs
const BOOTSTRAP_PATH = join(__dirname, "bootstrap.cjs");


interface AppwireRc {
  entry?: string;
}

async function loadAppwireRc(cwd: string): Promise<AppwireRc> {
  try {
    const raw = await readFile(join(cwd, ".appwirerc"), "utf8");
    return JSON.parse(raw) as AppwireRc;
  } catch {
    return {};
  }
}

export async function runAttach(options: AttachOptions): Promise<void> {
  const cwd = process.cwd();
  const rc = await loadAppwireRc(cwd);

  let entryFile: string;

  if (options.entry) {
    const resolved = resolve(cwd, options.entry);
    if (!existsSync(resolved)) {
      console.error(`appwire: entry not found: ${resolved}`);
      process.exit(1);
    }
    if (statSync(resolved).isDirectory()) {
      const detected = await detectEntry(resolved);
      entryFile = detected.file;
      console.log(`appwire: detected entry ${entryFile} (from ${detected.source})`);
    } else {
      entryFile = resolved;
    }
  } else if (rc.entry) {
    entryFile = resolve(cwd, rc.entry);
    if (!existsSync(entryFile)) {
      console.error(`appwire: entry from .appwirerc not found: ${entryFile}`);
      process.exit(1);
    }
    console.log(`appwire: using entry from .appwirerc: ${entryFile}`);
  } else {
    const detected = await detectEntry(cwd);
    entryFile = detected.file;
    console.log(`appwire: detected entry ${entryFile} (from ${detected.source})`);
  }

  const appDir = findPackageRoot(dirname(entryFile));

  const isTS = /\.(ts|mts|cts)$/.test(entryFile);
  let runtimeLoader: string | null = null;

  if (isTS) {
    let pkg: PackageJson = {};
    try {
      pkg = JSON.parse(await readFile(join(appDir, "package.json"), "utf8")) as PackageJson;
    } catch {
      /* no package.json */
    }

    const runtime = await detectTSRuntime(appDir, pkg);
    if (!runtime) {
      throw new Error(
        `Entry is TypeScript but no ts-node or tsx found. Install one as a dev dependency.`,
      );
    }
    runtimeLoader = resolveRuntimeLoader(appDir, runtime);
    console.log(`appwire: using ${runtime} for TypeScript`);
  }

  const extraEnv: NodeJS.ProcessEnv = { APPWIRE: "1" };
  const pnpmRoot = findPnpmRoot(appDir);
  if (pnpmRoot) {
    extraEnv.APPWIRE_PNPM_ROOT = pnpmRoot;
    console.log(`appwire: pnpm workspace detected, resolving ghost dependencies`);
  }

  // Track the current child so SIGINT and exit reach the right process.
  let currentChild: ChildProcess | null = null;
  process.on("SIGINT", () => {
    currentChild?.kill("SIGINT");
  });
  process.on("exit", () => {
    currentChild?.kill();
  });

  function spawnTransport(): Promise<AppwireTransport> {
    return new Promise((resolve, reject) => {
      const child = spawnApp({
        entry: entryFile,
        bootstrapPath: BOOTSTRAP_PATH,
        runtimeLoader,
        cwd: appDir,
        env: extraEnv,
      });
      currentChild = child;

      const channel = createIPCChannel(child);

      let ready = false;
      channel.onExit((code) => {
        if (!ready)
          reject(
            new Error(`App exited before ready (code: ${code ?? "signal"})`),
          );
      });

      channel.onReady(() => {
        ready = true;
        resolve(createIPCTransport(channel));
      });
    });
  }

  if (process.env.NODE_ENV && process.env.NODE_ENV !== "development") {
    console.error(`appwire: NODE_ENV=${process.env.NODE_ENV}`);
  }
  console.log(`appwire: starting ${entryFile} ...`);
  const transport = await spawnTransport();

  // Wait for the app to signal readiness ("appwire: app ready (N services)").
  // Covers NestJS auto-wiring and startAppwireAgent. Falls back after 30s for
  // apps that never emit a status (no adapter, raw scripts, etc.).
  // Only show the erasable "loading" line in TTY mode — piped output can't erase it.
  if (process.stdout.isTTY) process.stdout.write("appwire: loading services...\n");
  let crashedBeforeReady = false;
  await new Promise<void>((resolve) => {
    let settled = false;
    let timerId: ReturnType<typeof setTimeout>;
    function finish(statusText?: string, crashed = false) {
      if (settled) return;
      settled = true;
      clearTimeout(timerId);
      if (process.stdout.isTTY) process.stdout.write("\x1b[1A\x1b[2K"); // erase loading line
      if (statusText) process.stdout.write(statusText + "\n");
      crashedBeforeReady = crashed;
      resolve();
    }
    transport.onStatus?.((text) => finish(text));
    transport.onDisconnect(() => finish(undefined, true));
    timerId = setTimeout(() => finish(), 30_000);
  });

  if (crashedBeforeReady) {
    process.stderr.write("appwire: app exited before it was ready\n");
    process.exit(1);
  }

  const label = entryFile.split("/").pop() ?? entryFile;

  const { startRepl } = await import("../repl/index.js");
  await startRepl(transport, {
    appLabel: label,
    onReconnect: async () => {
      if (currentChild) {
        const child = currentChild;
        if (child.exitCode === null) {
          const exited = new Promise<void>((r) => child.once("exit", r));
          child.kill();
          let fallback: ReturnType<typeof setTimeout> | undefined;
          await Promise.race([
            exited,
            new Promise<void>((r) => { fallback = setTimeout(r, 1_000); }),
          ]);
          clearTimeout(fallback);
          if (child.exitCode === null) child.kill("SIGKILL");
        }
      }
      console.log(`\nappwire: restarting ${entryFile} ...`);
      return spawnTransport();
    },
  });
}
