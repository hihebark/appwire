#!/usr/bin/env node
"use strict";

// node_modules/tsup/assets/cjs_shims.js
var getImportMetaUrl = () => typeof document === "undefined" ? new URL(`file:${__filename}`).href : document.currentScript && document.currentScript.tagName.toUpperCase() === "SCRIPT" ? document.currentScript.src : new URL("main.js", document.baseURI).href;
var importMetaUrl = /* @__PURE__ */ getImportMetaUrl();

// src/mcp.ts
var import_fs2 = require("fs");
var import_promises2 = require("fs/promises");
var import_path3 = require("path");
var import_url = require("url");

// src/detect/entry.ts
var import_promises = require("fs/promises");
var import_fs = require("fs");
var import_path = require("path");
var KNOWN_RUNTIMES = /* @__PURE__ */ new Set([
  "ts-node",
  "ts-node-esm",
  "tsx",
  "node",
  "npx",
  "pnpx",
  "yarn",
  "cross-env",
  "dotenv",
  "dotenv-cli"
]);
var FLAGS_WITH_VALUE = /* @__PURE__ */ new Set([
  "--require",
  "-r",
  "--loader",
  "--import",
  "--env-file",
  "-e",
  "--eval"
]);
function extractEntryFromScript(script) {
  const tokens = script.trim().split(/\s+/);
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (KNOWN_RUNTIMES.has(token)) {
      i++;
      continue;
    }
    if (token.startsWith("-")) {
      if (FLAGS_WITH_VALUE.has(token)) i++;
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
async function fileExists(p) {
  try {
    await (0, import_promises.access)(p);
    return true;
  } catch {
    return false;
  }
}
function findPackageRoot(startDir) {
  let dir = startDir;
  while (true) {
    if ((0, import_fs.existsSync)((0, import_path.join)(dir, "package.json"))) return dir;
    const parent = (0, import_path.dirname)(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}
function findPnpmRoot(startDir) {
  let dir = startDir;
  while (true) {
    if ((0, import_fs.existsSync)((0, import_path.join)(dir, "pnpm-workspace.yaml")) || (0, import_fs.existsSync)((0, import_path.join)(dir, "pnpm-lock.yaml"))) {
      return dir;
    }
    const parent = (0, import_path.dirname)(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
async function detectEntry(cwd) {
  const pkgPath = (0, import_path.join)(cwd, "package.json");
  let pkg = {};
  try {
    const raw = await (0, import_promises.readFile)(pkgPath, "utf8");
    pkg = JSON.parse(raw);
  } catch {
  }
  if (pkg.main) {
    const file = (0, import_path.resolve)(cwd, pkg.main);
    if (await fileExists(file)) return { file, source: "main" };
  }
  for (const scriptKey of ["start", "dev"]) {
    const script = pkg.scripts?.[scriptKey];
    if (!script) continue;
    const entry = extractEntryFromScript(script);
    if (!entry) continue;
    const file = (0, import_path.resolve)(cwd, entry);
    if (await fileExists(file)) {
      return {
        file,
        source: scriptKey === "start" ? "scripts.start" : "scripts.dev"
      };
    }
  }
  for (const fallback of ["src/main.ts", "dist/main.js"]) {
    const file = (0, import_path.resolve)(cwd, fallback);
    if (await fileExists(file)) return { file, source: "fallback" };
  }
  throw new Error(
    "Could not detect entry point. Use --entry to specify it explicitly."
  );
}

// src/detect/runtime.ts
var import_path2 = require("path");
var import_module = require("module");
async function detectTSRuntime(cwd, pkg) {
  for (const key of ["start", "dev"]) {
    const script = pkg.scripts?.[key];
    if (!script) continue;
    const tokens = script.split(/\s+/);
    if (tokens.includes("tsx")) return "tsx";
    if (tokens.includes("ts-node") || tokens.includes("ts-node-esm"))
      return "ts-node";
  }
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  if ("tsx" in allDeps) return "tsx";
  if ("ts-node" in allDeps) return "ts-node";
  if (await fileExists((0, import_path2.join)(cwd, "node_modules/.bin/tsx"))) return "tsx";
  if (await fileExists((0, import_path2.join)(cwd, "node_modules/.bin/ts-node")))
    return "ts-node";
  return null;
}
function resolveRuntimeLoader(cwd, runtime) {
  const userRequire = (0, import_module.createRequire)((0, import_path2.join)(cwd, "package.json"));
  try {
    if (runtime === "tsx") return userRequire.resolve("tsx/cjs");
    return userRequire.resolve("ts-node/register");
  } catch {
    throw new Error(
      `Could not resolve ${runtime} in ${cwd}. Make sure it is installed as a dependency.`
    );
  }
}

// src/process/spawn.ts
var import_child_process = require("child_process");
function spawnApp({
  entry,
  bootstrapPath,
  runtimeLoader,
  cwd,
  env
}) {
  const execArgv = [];
  if (runtimeLoader) {
    execArgv.push("--require", runtimeLoader);
  }
  execArgv.push("--require", bootstrapPath);
  return (0, import_child_process.fork)(entry, [], {
    cwd,
    env: { ...process.env, ...env },
    execArgv,
    // inherit stdio so app output goes directly to terminal; 'ipc' opens the message channel
    stdio: ["inherit", "inherit", "inherit", "ipc"]
  });
}

// src/channel/ipc.ts
function createIPCChannel(child) {
  const messageHandlers = [];
  const readyHandlers = [];
  const statusHandlers = [];
  const exitHandlers = [];
  const onChildMessage = (msg) => {
    const m = msg;
    if (m.type === "appwire:ready") {
      readyHandlers.forEach((h) => h());
      return;
    }
    if (m.type === "appwire:status") {
      statusHandlers.forEach((h) => h(m.text));
      return;
    }
    messageHandlers.forEach((h) => h(m));
  };
  const onChildExit = (code) => {
    exitHandlers.forEach((h) => h(code));
  };
  child.on("message", onChildMessage);
  child.on("exit", onChildExit);
  return {
    send(msg) {
      if (!child.send(msg)) throw new Error("IPC channel closed");
    },
    onMessage(handler) {
      messageHandlers.push(handler);
    },
    onReady(handler) {
      readyHandlers.push(handler);
    },
    onStatus(handler) {
      statusHandlers.push(handler);
    },
    onExit(handler) {
      exitHandlers.push(handler);
    }
  };
}

// src/protocol/types.ts
function isUndefinedResult(value) {
  return typeof value === "object" && value !== null && value.__type === "undefined";
}

// src/transport/types.ts
async function evalGetServices(t) {
  const res = await t.evaluate("JSON.stringify(__appwireGetServices())", 5e3, () => {
  });
  if (res.type === "result" && typeof res.value === "string") {
    try {
      return JSON.parse(res.value);
    } catch {
      return [];
    }
  }
  return [];
}

// src/transport/ipc.ts
function createIPCTransport(channel) {
  const disconnectHandlers = /* @__PURE__ */ new Set();
  const pending = /* @__PURE__ */ new Map();
  let seq = 0;
  let disconnected = false;
  function fireDisconnect(reason) {
    disconnected = true;
    const err = new Error(reason);
    const pendingEntries = [...pending.values()];
    pending.clear();
    for (const p of pendingEntries) p.reject(err);
    const handlers = [...disconnectHandlers];
    disconnectHandlers.clear();
    handlers.forEach((h) => h());
  }
  channel.onMessage((msg) => {
    if (msg.type === "log") {
      pending.get(msg.id)?.onLog(msg);
    } else if (msg.type === "result" || msg.type === "error") {
      const r = msg;
      const p = pending.get(r.id);
      if (p) {
        pending.delete(r.id);
        p.resolve(r);
      }
    }
  });
  channel.onExit(() => {
    fireDisconnect("App process exited");
  });
  const transport = {
    mode: "ipc",
    evaluate(code, timeout, onLog) {
      const id = `ipc-${++seq}`;
      return new Promise((resolve2, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`IPC eval timed out after ${timeout}ms`));
        }, timeout + 5e3);
        pending.set(id, {
          resolve(r) {
            clearTimeout(timer);
            resolve2(r);
          },
          reject(e) {
            clearTimeout(timer);
            reject(e);
          },
          onLog
        });
        try {
          channel.send({ id, code, timeout });
        } catch (err) {
          clearTimeout(timer);
          pending.delete(id);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    },
    getServices() {
      return evalGetServices(transport);
    },
    async ping() {
      const id = `ipc-${++seq}`;
      let timerId;
      const timeout = new Promise((_, reject) => {
        timerId = setTimeout(() => reject(new Error("ping timeout")), 2500);
      });
      const evalPromise = new Promise((resolve2, reject) => {
        pending.set(id, { resolve: resolve2, reject, onLog: () => {
        } });
        channel.send({ id, code: "true", timeout: 2e3 });
      });
      try {
        await Promise.race([evalPromise, timeout]);
        clearTimeout(timerId);
        return true;
      } catch {
        clearTimeout(timerId);
        pending.delete(id);
        return false;
      }
    },
    disconnect() {
      fireDisconnect("Transport disconnected");
    },
    onDisconnect(handler) {
      if (disconnected) {
        handler();
      } else {
        disconnectHandlers.add(handler);
      }
    },
    onStatus(handler) {
      channel.onStatus(handler);
    }
  };
  return transport;
}

// src/mcp.ts
var __dirname = (0, import_path3.dirname)((0, import_url.fileURLToPath)(importMetaUrl));
var BOOTSTRAP_PATH = (0, import_path3.join)(__dirname, "bootstrap.cjs");
var { version: serverVersion } = require(`${__dirname}/../package.json`);
var currentChild = null;
async function spawnTransport() {
  const cwd = process.cwd();
  const entryFile = process.env.APPWIRE_ENTRY ?? (await detectEntry(cwd)).file;
  if (!(0, import_fs2.existsSync)(entryFile)) {
    throw new Error(`Entry not found: ${entryFile}. Set APPWIRE_ENTRY env var.`);
  }
  const appDir = findPackageRoot((0, import_path3.dirname)(entryFile));
  let runtimeLoader = null;
  if (/\.(ts|mts|cts)$/.test(entryFile)) {
    let pkg = {};
    try {
      pkg = JSON.parse(await (0, import_promises2.readFile)((0, import_path3.join)(appDir, "package.json"), "utf8"));
    } catch {
    }
    const runtime = await detectTSRuntime(appDir, pkg);
    if (runtime) runtimeLoader = resolveRuntimeLoader(appDir, runtime);
  }
  const extraEnv = { APPWIRE: "1" };
  const pnpmRoot = findPnpmRoot(appDir);
  if (pnpmRoot) extraEnv.APPWIRE_PNPM_ROOT = pnpmRoot;
  return new Promise((resolve2, reject) => {
    const child = spawnApp({
      entry: entryFile,
      bootstrapPath: BOOTSTRAP_PATH,
      runtimeLoader,
      cwd: appDir,
      env: extraEnv
    });
    currentChild = child;
    const channel = createIPCChannel(child);
    let ready = false;
    let exitCode = null;
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
        process.stderr.write(`appwire-mcp: app exited (code: ${exitCode ?? "signal"})
`);
        setImmediate(() => process.exit(1));
      });
      resolve2(t);
    });
  });
}
var TOOLS = [
  {
    name: "evaluate",
    description: "Evaluate JavaScript/TypeScript in the running app's context. Has access to $app (DI container) and all imported modules.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Code to evaluate" },
        timeout: { type: "number", description: "Timeout in ms (default 10000)" }
      },
      required: ["code"]
    }
  },
  {
    name: "list_services",
    description: "List all injectable services available in the app's DI container.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "ping",
    description: "Check if the appwire agent is reachable.",
    inputSchema: { type: "object", properties: {} }
  }
];
async function callTool(transport, name, args) {
  if (name === "evaluate") {
    const code = args.code;
    const timeout = args.timeout ?? 1e4;
    const logs = [];
    const res = await transport.evaluate(code, timeout, (msg) => {
      logs.push(`[${msg.level}] ${msg.args.join(" ")}`);
    });
    const output = logs.length ? logs.join("\n") + "\n" : "";
    if (res.type === "error") {
      return {
        content: [
          {
            type: "text",
            text: output + `${res.error?.name ?? "Error"}: ${res.error?.message}`
          }
        ],
        isError: true
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
var respond = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
var respondError = (id, code, message) => process.stdout.write(
  JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n"
);
async function main() {
  process.on("SIGINT", () => {
    currentChild?.kill("SIGINT");
    process.exit(0);
  });
  process.on("exit", () => {
    currentChild?.kill();
  });
  let transportPromise = null;
  const getTransport = () => {
    if (!transportPromise) transportPromise = spawnTransport();
    return transportPromise;
  };
  let processingQueue = Promise.resolve();
  async function handleLine(line) {
    let req;
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
          serverInfo: { name: "appwire", version: serverVersion }
        });
      } else if (req.method === "notifications/initialized") {
      } else if (req.method === "tools/list") {
        respond(req.id, { tools: TOOLS });
      } else if (req.method === "tools/call") {
        const p = req.params;
        if (!p || typeof p.name !== "string") {
          respondError(req.id, -32602, "Invalid params");
          return;
        }
        respond(req.id, await callTool(await getTransport(), p.name, p.arguments ?? {}));
      } else if (req.method !== void 0 && req.id !== void 0) {
        respondError(req.id, -32601, `Method not found: ${req.method}`);
      } else if (req.id !== void 0) {
        respondError(req.id, -32600, "Invalid Request");
      }
    } catch (err) {
      if (req.id !== void 0) {
        respondError(
          req.id,
          -32603,
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  }
  let buf = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buf += chunk;
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines.filter(Boolean)) {
      processingQueue = processingQueue.then(() => handleLine(line)).catch(console.error);
    }
  });
}
main().catch((err) => {
  process.stderr.write(`appwire-mcp: ${err.message}
`);
  process.exit(1);
});
//# sourceMappingURL=mcp.cjs.map