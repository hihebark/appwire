import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { ChildProcess } from "child_process";
import { detectEntry, findPackageRoot, findPnpmRoot } from "./detect/entry.js";
import { detectTSRuntime, resolveRuntimeLoader, type PackageJson } from "./detect/runtime.js";
import { spawnApp } from "./process/spawn.js";
import { createIPCChannel } from "./channel/ipc.js";
import type { AppwireTransport } from "./transport/types.js";
import { isUndefinedResult } from "./protocol/types.js";
import { createIPCTransport } from "./transport/ipc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BOOTSTRAP_PATH = join(__dirname, "bootstrap.cjs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version: serverVersion } = require(`${__dirname}/../package.json`) as { version: string };

let currentChild: ChildProcess | null = null;

async function spawnTransport(): Promise<AppwireTransport> {
  const cwd = process.cwd();
  const entryFile = process.env.APPWIRE_ENTRY ?? (await detectEntry(cwd)).file;

  if (!existsSync(entryFile)) {
    throw new Error(`Entry not found: ${entryFile}. Set APPWIRE_ENTRY env var.`);
  }

  const appDir = findPackageRoot(dirname(entryFile));
  let runtimeLoader: string | null = null;

  if (/\.(ts|mts|cts)$/.test(entryFile)) {
    let pkg: PackageJson = {};
    try {
      pkg = JSON.parse(await readFile(join(appDir, "package.json"), "utf8")) as PackageJson;
    } catch {
      /* no package.json */
    }
    const runtime = await detectTSRuntime(appDir, pkg);
    if (runtime) runtimeLoader = resolveRuntimeLoader(appDir, runtime);
  }

  const extraEnv: NodeJS.ProcessEnv = { APPWIRE: "1" };
  const pnpmRoot = findPnpmRoot(appDir);
  if (pnpmRoot) extraEnv.APPWIRE_PNPM_ROOT = pnpmRoot;

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
    let exitCode: number | null = null;

    channel.onExit((code) => {
      if (!ready) {
        reject(new Error(`App exited before ready (code: ${code ?? "signal"})`));
      } else {
        exitCode = code;
      }
    });

    channel.onReady(() => {
      ready = true;
      const t = createIPCTransport(channel);
      t.onDisconnect(() => {
        process.stderr.write(`appwire-mcp: app exited (code: ${exitCode ?? "signal"})\n`);
        // Defer exit so promise-rejection microtasks drain first and in-flight
        // eval calls can send a JSON-RPC error response before the process ends.
        setImmediate(() => process.exit(1));
      });
      resolve(t);
    });
  });
}

const TOOLS = [
  {
    name: "evaluate",
    description:
      "Evaluate JavaScript/TypeScript in the running app's context. " +
      "Has access to $app (DI container) and all imported modules.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Code to evaluate" },
        timeout: { type: "number", description: "Timeout in ms (default 10000)" },
      },
      required: ["code"],
    },
  },
  {
    name: "list_services",
    description: "List all injectable services available in the app's DI container.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ping",
    description: "Check if the appwire agent is reachable.",
    inputSchema: { type: "object", properties: {} },
  },
];

async function callTool(
  transport: AppwireTransport,
  name: string,
  args: Record<string, unknown>,
) {
  if (name === "evaluate") {
    const code = args.code as string;
    const timeout = (args.timeout as number) ?? 10_000;
    const logs: string[] = [];
    const res = await transport.evaluate(code, timeout, (msg) => {
      logs.push(`[${msg.level}] ${msg.args.join(" ")}`);
    });
    const output = logs.length ? logs.join("\n") + "\n" : "";
    if (res.type === "error") {
      return {
        content: [
          {
            type: "text",
            text: output + `${res.error?.name ?? "Error"}: ${res.error?.message}`,
          },
        ],
        isError: true,
      };
    }
    const val = isUndefinedResult(res.value) ? "undefined" : JSON.stringify(res.value, null, 2);
    return { content: [{ type: "text", text: output + val }] };
  }

  if (name === "list_services") {
    const services = await transport.getServices();
    return { content: [{ type: "text", text: services.join("\n") || "(none)" }] };
  }

  if (name === "ping") {
    const ok = await transport.ping();
    return { content: [{ type: "text", text: ok ? "pong" : "unreachable" }] };
  }

  throw new Error(`Unknown tool: ${name}`);
}

type RpcRequest = { jsonrpc: string; id?: unknown; method?: string; params?: unknown };

const respond = (id: unknown, result: unknown) =>
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");

const respondError = (id: unknown, code: number, message: string) =>
  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n",
  );

async function main() {
  process.on("SIGINT", () => { currentChild?.kill("SIGINT"); process.exit(0); });
  process.on("exit", () => { currentChild?.kill(); });

  // Lazy transport: spawned on first tools/call so initialize responds immediately.
  let transportPromise: Promise<AppwireTransport> | null = null;
  const getTransport = () => {
    if (!transportPromise) transportPromise = spawnTransport();
    return transportPromise;
  };

  let processingQueue = Promise.resolve();

  async function handleLine(line: string) {
    let req: RpcRequest;
    try {
      req = JSON.parse(line);
    } catch {
      return;
    }

    try {
      if (req.method === "initialize") {
        respond(req.id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "appwire", version: serverVersion },
        });
      } else if (req.method === "notifications/initialized") {
        // no-op
      } else if (req.method === "tools/list") {
        respond(req.id, { tools: TOOLS });
      } else if (req.method === "tools/call") {
        const p = req.params as {
          name?: string;
          arguments?: Record<string, unknown>;
        } | null;
        if (!p || typeof p.name !== "string") {
          respondError(req.id, -32602, "Invalid params");
          return;
        }
        respond(req.id, await callTool(await getTransport(), p.name, p.arguments ?? {}));
      } else if (req.method !== undefined && req.id !== undefined) {
        respondError(req.id, -32601, `Method not found: ${req.method}`);
      } else if (req.id !== undefined) {
        respondError(req.id, -32600, "Invalid Request");
      }
    } catch (err: unknown) {
      if (req.id !== undefined) {
        respondError(
          req.id,
          -32603,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  let buf = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    buf += chunk;
    const lines = buf.split("\n");
    buf = lines.pop()!;
    for (const line of lines.filter(Boolean)) {
      processingQueue = processingQueue.then(() => handleLine(line)).catch(console.error);
    }
  });
}

main().catch((err: Error) => {
  process.stderr.write(`appwire-mcp: ${err.message}\n`);
  process.exit(1);
});
