#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/tsup/assets/cjs_shims.js
var getImportMetaUrl, importMetaUrl;
var init_cjs_shims = __esm({
  "node_modules/tsup/assets/cjs_shims.js"() {
    "use strict";
    getImportMetaUrl = () => typeof document === "undefined" ? new URL(`file:${__filename}`).href : document.currentScript && document.currentScript.tagName.toUpperCase() === "SCRIPT" ? document.currentScript.src : new URL("main.js", document.baseURI).href;
    importMetaUrl = /* @__PURE__ */ getImportMetaUrl();
  }
});

// src/detect/entry.ts
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
var import_promises, import_fs, import_path, KNOWN_RUNTIMES, FLAGS_WITH_VALUE;
var init_entry = __esm({
  "src/detect/entry.ts"() {
    "use strict";
    init_cjs_shims();
    import_promises = require("fs/promises");
    import_fs = require("fs");
    import_path = require("path");
    KNOWN_RUNTIMES = /* @__PURE__ */ new Set([
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
    FLAGS_WITH_VALUE = /* @__PURE__ */ new Set([
      "--require",
      "-r",
      "--loader",
      "--import",
      "--env-file",
      "-e",
      "--eval"
    ]);
  }
});

// src/detect/runtime.ts
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
var import_path2, import_module;
var init_runtime = __esm({
  "src/detect/runtime.ts"() {
    "use strict";
    init_cjs_shims();
    import_path2 = require("path");
    import_module = require("module");
    init_entry();
  }
});

// src/process/spawn.ts
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
var import_child_process;
var init_spawn = __esm({
  "src/process/spawn.ts"() {
    "use strict";
    init_cjs_shims();
    import_child_process = require("child_process");
  }
});

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
var init_ipc = __esm({
  "src/channel/ipc.ts"() {
    "use strict";
    init_cjs_shims();
  }
});

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
var init_types = __esm({
  "src/transport/types.ts"() {
    "use strict";
    init_cjs_shims();
  }
});

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
      return new Promise((resolve3, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`IPC eval timed out after ${timeout}ms`));
        }, timeout + 5e3);
        pending.set(id, {
          resolve(r) {
            clearTimeout(timer);
            resolve3(r);
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
      const evalPromise = new Promise((resolve3, reject) => {
        pending.set(id, { resolve: resolve3, reject, onLog: () => {
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
var init_ipc2 = __esm({
  "src/transport/ipc.ts"() {
    "use strict";
    init_cjs_shims();
    init_types();
  }
});

// src/protocol/types.ts
function isUndefinedResult(value) {
  return typeof value === "object" && value !== null && value.__type === "undefined";
}
var init_types2 = __esm({
  "src/protocol/types.ts"() {
    "use strict";
    init_cjs_shims();
  }
});

// src/repl/pretty.ts
function prompt(mode) {
  return `${c.cyan}appwire${c.reset}${c.dim}(${mode})${c.reset} ${c.bold}>${c.reset} `;
}
function displayValue(value) {
  if (value === null) return c.dim + "null" + c.reset;
  if (typeof value === "object" && value !== null) {
    const v = value;
    if (v.__type === "undefined") return c.dim + "undefined" + c.reset;
    if (v.__type === "function")
      return c.cyan + `[Function: ${v.name}]` + c.reset;
    if (v.__type === "bigint") return c.yellow + `${v.value}n` + c.reset;
    if (v.__type === "symbol")
      return c.green + `Symbol(${v.description ?? ""})` + c.reset;
    if (v.__type === "error") return c.red + `[Error: ${v.message}]` + c.reset;
  }
  return (0, import_util.inspect)(value, { depth: 2, colors: true, compact: false });
}
function displayError(err) {
  const head = `${c.bold}${c.red}${err.name}: ${err.message}${c.reset}`;
  if (!err.stack) return head;
  const stackLines = err.stack.split("\n").slice(1).filter(Boolean).map((l) => `  ${c.dim}${l.trim()}${c.reset}`).join("\n");
  return stackLines ? `${head}
${stackLines}` : head;
}
function displayLog(level, args2) {
  const prefix = level === "error" ? c.red + "\u203A" : c.dim + "\u203A";
  return `${prefix} ${args2.join(" ")}${c.reset}`;
}
function displayDuration(ms) {
  const s = ms < 1e3 ? `${ms}ms` : `${(ms / 1e3).toFixed(2)}s`;
  return `${c.dim}(${s})${c.reset}`;
}
var import_util, c;
var init_pretty = __esm({
  "src/repl/pretty.ts"() {
    "use strict";
    init_cjs_shims();
    import_util = require("util");
    c = {
      reset: "\x1B[0m",
      dim: "\x1B[2m",
      bold: "\x1B[1m",
      red: "\x1B[31m",
      green: "\x1B[32m",
      yellow: "\x1B[33m",
      cyan: "\x1B[36m",
      magenta: "\x1B[35m",
      white: "\x1B[37m"
    };
  }
});

// src/repl/history.ts
async function loadHistory() {
  try {
    const raw = await (0, import_promises2.readFile)(HISTORY_FILE, "utf8");
    return raw.split("\n").filter(Boolean).slice(-MAX_ENTRIES);
  } catch {
    return [];
  }
}
async function saveHistory(entries) {
  try {
    await (0, import_promises2.writeFile)(
      HISTORY_FILE,
      entries.slice(-MAX_ENTRIES).join("\n") + "\n",
      "utf8"
    );
  } catch {
  }
}
function addEntry(history, line) {
  const idx = history.lastIndexOf(line);
  if (idx !== -1) history.splice(idx, 1);
  history.push(line);
  if (history.length > MAX_ENTRIES) history.shift();
}
var import_promises2, import_path3, import_os, HISTORY_FILE, MAX_ENTRIES;
var init_history = __esm({
  "src/repl/history.ts"() {
    "use strict";
    init_cjs_shims();
    import_promises2 = require("fs/promises");
    import_path3 = require("path");
    import_os = require("os");
    HISTORY_FILE = (0, import_path3.join)((0, import_os.homedir)(), ".appwire_history");
    MAX_ENTRIES = 1e3;
  }
});

// src/repl/editor.ts
function enterEditorMode(rl) {
  return new Promise((resolve3) => {
    process.stdout.write(
      `${c.dim}// Entering editor mode (Ctrl+D to run, Ctrl+C to cancel)${c.reset}
`
    );
    const lines = [];
    const origPrompt = rl.getPrompt();
    rl.setPrompt(`${c.dim}...${c.reset} `);
    rl.prompt();
    function onLine(line) {
      lines.push(line);
      rl.prompt();
    }
    function onClose() {
      cleanup();
      resolve3({ code: lines.join("\n") });
    }
    function onSigInt() {
      cleanup();
      resolve3(null);
    }
    function cleanup() {
      rl.removeListener("line", onLine);
      rl.removeListener("close", onClose);
      rl.removeListener("SIGINT", onSigInt);
      rl.setPrompt(origPrompt);
    }
    rl.on("line", onLine);
    rl.on("close", onClose);
    rl.on("SIGINT", onSigInt);
  });
}
var init_editor = __esm({
  "src/repl/editor.ts"() {
    "use strict";
    init_cjs_shims();
    init_pretty();
  }
});

// src/repl/index.ts
var repl_exports = {};
__export(repl_exports, {
  startRepl: () => startRepl
});
async function startRepl(initialTransport, options = {}) {
  let activeTransport = initialTransport;
  let reloading = false;
  const history = await loadHistory();
  const userVars = /* @__PURE__ */ new Set();
  function trackAssignments(code) {
    for (const m of code.matchAll(/(^|\n)\s*(\$\w+)\s*=(?!=)/g)) {
      userVars.add(m[2]);
    }
  }
  let cachedServices = [];
  function refreshServices() {
    const t = activeTransport;
    t.getServices().then((s) => {
      if (t === activeTransport) cachedServices = s;
    }).catch(() => {
    });
  }
  refreshServices();
  const rl = import_readline.default.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 1e3,
    completer: (line) => {
      if (line.startsWith(".")) {
        const hits = COMMANDS.filter((c2) => c2.startsWith(line));
        return [hits.length ? hits : COMMANDS, line];
      }
      const dollarMatch = line.match(/\$(\w*)$/);
      if (dollarMatch) {
        const prefix = "$" + dollarMatch[1];
        const candidates = [
          ...BUILTINS,
          ...userVars,
          ...cachedServices.map((s) => `$app.get('${s}')`)
        ].filter((c2) => c2.startsWith(prefix));
        return [candidates, prefix];
      }
      return [[], line];
    }
  });
  rl.history = [...history].reverse();
  rl.setPrompt(
    prompt(
      options.appLabel ? `${initialTransport.mode}:${options.appLabel}` : initialTransport.mode
    )
  );
  rl.prompt();
  function printStatus(text) {
    process.stdout.write(`\r\x1B[2K${text}
`);
    rl.prompt(true);
  }
  function registerStatus(t) {
    t.onStatus?.(printStatus);
  }
  function registerDisconnect(t) {
    t.onDisconnect(async () => {
      if (t !== activeTransport || reloading) return;
      process.stdout.write(`
${c.yellow}appwire: disconnected${c.reset}
`);
      if (!options.onReconnect) return;
      reloading = true;
      try {
        process.stdout.write(`${c.dim}appwire: reconnecting...${c.reset}
`);
        const newTransport = await options.onReconnect();
        activeTransport = newTransport;
        registerStatus(newTransport);
        registerDisconnect(newTransport);
        refreshServices();
        process.stdout.write(`${c.green}appwire: reconnected${c.reset}
`);
        process.stdin.setRawMode?.(true);
        rl.prompt();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stdout.write(
          `${c.red}appwire: reconnect failed: ${msg}${c.reset}
`
        );
        process.stdout.write(`${c.dim}Type .exit to quit${c.reset}
`);
        rl.prompt();
      } finally {
        reloading = false;
      }
    });
  }
  registerStatus(activeTransport);
  registerDisconnect(activeTransport);
  async function onLine(input) {
    const line = input.trim();
    if (!line) {
      rl.prompt();
      return;
    }
    rl.pause();
    addEntry(history, line);
    if (line.startsWith(".")) {
      await handleCommand(line);
    } else {
      trackAssignments(line);
      await runEval(line);
    }
    rl.resume();
    process.stdin.setRawMode?.(true);
    if (!reloading) rl.prompt();
  }
  rl.on("line", onLine);
  let lastSigInt = 0;
  function onSigInt() {
    const now = Date.now();
    if (now - lastSigInt < 1e3) {
      process.stdout.write("\n");
      saveHistory(history).then(() => process.exit(0)).catch(() => process.exit(1));
      return;
    }
    lastSigInt = now;
    process.stdout.write("\n(Press Ctrl+C again or type .exit to quit)\n");
    rl.prompt();
  }
  rl.on("SIGINT", onSigInt);
  async function onClose() {
    await saveHistory(history);
    process.exit(0);
  }
  rl.on("close", onClose);
  async function runEval(code) {
    try {
      const response = await activeTransport.evaluate(
        code,
        3e4,
        (log) => {
          process.stdout.write(displayLog(log.level, log.args) + "\n");
        }
      );
      printResponse(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`${c.red}connection error: ${msg}${c.reset}
`);
    }
  }
  async function handleCommand(line) {
    const [cmd] = line.split(/\s+/);
    switch (cmd) {
      case ".exit":
        await saveHistory(history);
        process.exit(0);
        break;
      case ".clear":
        process.stdout.write("\x1B[2J\x1B[H");
        break;
      case ".help":
        process.stdout.write(
          [
            "",
            `  ${c.bold}.editor${c.reset}          Enter multi-line block mode`,
            `  ${c.bold}.clear${c.reset}           Clear terminal`,
            `  ${c.bold}.history${c.reset}         Show recent evaluations`,
            `  ${c.bold}.vars${c.reset}             List session variables assigned with $name = expr`,
            `  ${c.bold}.services${c.reset}        List services / context keys in the app`,
            `  ${c.bold}.reload${c.reset}              Restart the app process`,
            `  ${c.bold}.timeit [N] <expr>${c.reset}  Time expression (N runs, default 1)`,
            `  ${c.bold}.doc <expr>${c.reset}          Inspect class name, methods, properties`,
            `  ${c.bold}.help${c.reset}                Show this help`,
            `  ${c.bold}.exit${c.reset}            Quit`,
            ""
          ].join("\n")
        );
        break;
      case ".history":
        if (history.length === 0) {
          process.stdout.write(`${c.dim}(no history)${c.reset}
`);
        } else {
          history.slice(-20).forEach((entry, i) => {
            process.stdout.write(`  ${c.dim}${i + 1}${c.reset}  ${entry}
`);
          });
        }
        break;
      case ".vars": {
        if (userVars.size === 0) {
          process.stdout.write(`${c.dim}(no variables assigned yet \u2014 use $name = expr)${c.reset}
`);
        } else {
          for (const v of userVars) {
            process.stdout.write(`  ${c.cyan}${v}${c.reset}
`);
          }
        }
        break;
      }
      case ".services": {
        process.stdout.write(`${c.dim}fetching services...${c.reset}\r`);
        try {
          const services = await activeTransport.getServices();
          cachedServices = services;
          if (services.length === 0) {
            process.stdout.write(
              `${c.dim}(no services registered)${c.reset}
`
            );
          } else {
            process.stdout.write("\r\x1B[2K");
            services.forEach(
              (s) => process.stdout.write(`  ${c.cyan}${s}${c.reset}
`)
            );
          }
        } catch {
          process.stdout.write(
            `\r\x1B[2K${c.red}could not fetch services${c.reset}
`
          );
        }
        break;
      }
      case ".reload": {
        if (!options.onReconnect) {
          process.stdout.write(
            `${c.yellow}Reload not available in this mode${c.reset}
`
          );
          break;
        }
        if (reloading) {
          process.stdout.write(`${c.yellow}Already reconnecting...${c.reset}
`);
          break;
        }
        process.stdout.write(`${c.dim}reloading...${c.reset}
`);
        reloading = true;
        try {
          const newTransport = await options.onReconnect();
          activeTransport = newTransport;
          registerStatus(newTransport);
          registerDisconnect(newTransport);
          refreshServices();
          process.stdout.write(`${c.green}reloaded${c.reset}
`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          process.stdout.write(`${c.red}reload failed: ${msg}${c.reset}
`);
          process.stdout.write(`${c.dim}Type .reload to try again${c.reset}
`);
        } finally {
          reloading = false;
        }
        break;
      }
      case ".timeit": {
        const rest = line.slice(".timeit".length).trim();
        const nMatch = rest.match(/^(\d+)\s+/);
        const n = nMatch ? parseInt(nMatch[1], 10) : 1;
        const expr = nMatch ? rest.slice(nMatch[0].length) : rest;
        if (n < 1) {
          process.stdout.write(`Usage: .timeit [N] <expression>  (N must be >= 1)
`);
          break;
        }
        if (!expr) {
          process.stdout.write(`Usage: .timeit [N] <expression>
`);
          break;
        }
        const durations = [];
        let failed = false;
        for (let i = 0; i < n; i++) {
          try {
            const res = await activeTransport.evaluate(
              expr,
              3e4,
              i === 0 ? (log) => {
                process.stdout.write(displayLog(log.level, log.args) + "\n");
              } : () => {
              }
            );
            if (res.type === "error") {
              printResponse(res);
              failed = true;
              break;
            }
            if (i === 0 && !isUndefinedResult(res.value)) {
              process.stdout.write(displayValue(res.value) + "\n");
            }
            durations.push(res.duration);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            process.stdout.write(`${c.red}connection error: ${msg}${c.reset}
`);
            failed = true;
            break;
          }
        }
        if (!failed) {
          if (n === 1) {
            process.stdout.write(`  time: ${durations[0]}ms
`);
          } else {
            const avg = durations.reduce((a, b) => a + b, 0) / n;
            process.stdout.write(
              `  runs: ${n}  avg: ${avg.toFixed(0)}ms  min: ${Math.min(...durations)}ms  max: ${Math.max(...durations)}ms
`
            );
          }
        }
        break;
      }
      case ".doc": {
        const expr = line.slice(".doc".length).trim();
        if (!expr) {
          process.stdout.write(`Usage: .doc <expression>
`);
          break;
        }
        const docCode = `(async function(v){if(v&&typeof v.then==='function')v=await v;if(v===null||v===undefined)return{name:String(v)};const name=v?.constructor?.name??typeof v;const methods=[];const props=[];const seen=new Set();let p=Object.getPrototypeOf(v);while(p&&p!==Object.prototype){for(const k of Object.getOwnPropertyNames(p)){if(k==='constructor'||seen.has(k))continue;seen.add(k);const d=Object.getOwnPropertyDescriptor(p,k);if(d&&typeof d.value==='function'){const s=d.value.toString();const _o=s.indexOf('(');let _d=0,_e=-1;for(let _i=_o;_i<s.length;_i++){if(s[_i]==='(')_d++;else if(s[_i]===')'){_d--;if(_d===0){_e=_i;break;}}}const params=_o>=0&&_e>=0?s.slice(_o+1,_e).trim():'';methods.push(k+'('+params+')');}}p=Object.getPrototypeOf(p);}for(const k of Object.keys(v))props.push(k);return{name,methods,props};})(${expr})`;
        try {
          const res = await activeTransport.evaluate(docCode, 5e3, () => {
          });
          if (res.type === "error") {
            printResponse(res);
          } else {
            const info = res.value;
            process.stdout.write(`  ${c.bold}${info.name ?? "unknown"}${c.reset}
`);
            if (info.methods?.length) {
              process.stdout.write(`  ${c.dim}Methods:${c.reset}
`);
              for (const m of info.methods) {
                process.stdout.write(`    ${c.cyan}${m}${c.reset}
`);
              }
            }
            if (info.props?.length) {
              process.stdout.write(`  ${c.dim}Properties:${c.reset}
`);
              for (const p of info.props) {
                process.stdout.write(`    ${c.dim}${p}${c.reset}
`);
              }
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          process.stdout.write(`${c.red}connection error: ${msg}${c.reset}
`);
        }
        break;
      }
      case ".editor": {
        rl.removeListener("line", onLine);
        rl.removeListener("SIGINT", onSigInt);
        rl.removeListener("close", onClose);
        let result = null;
        try {
          result = await enterEditorMode(rl);
        } finally {
          if (result !== null) {
            if (result.code.trim()) {
              addEntry(history, result.code);
              trackAssignments(result.code);
              await runEval(result.code);
            } else {
              process.stdout.write(`${c.dim}// (nothing to run)${c.reset}
`);
            }
            await saveHistory(history);
            process.exit(0);
          } else {
            lastSigInt = 0;
            rl.on("line", onLine);
            rl.on("SIGINT", onSigInt);
            rl.on("close", onClose);
          }
        }
        process.stdout.write(`${c.dim}// Cancelled${c.reset}
`);
        break;
      }
      default:
        process.stdout.write(`${c.red}Unknown command: ${cmd}${c.reset}
`);
        process.stdout.write(
          `Type ${c.bold}.help${c.reset} for available commands.
`
        );
    }
  }
}
function printResponse(res) {
  if (res.type === "error" && res.error) {
    process.stdout.write(displayError(res.error) + "\n");
  } else if (!isUndefinedResult(res.value)) {
    process.stdout.write(
      displayValue(res.value) + " " + displayDuration(res.duration) + "\n"
    );
  }
}
var import_readline, COMMANDS, BUILTINS;
var init_repl = __esm({
  "src/repl/index.ts"() {
    "use strict";
    init_cjs_shims();
    import_readline = __toESM(require("readline"));
    init_types2();
    init_pretty();
    init_history();
    init_editor();
    COMMANDS = [
      ".editor",
      ".clear",
      ".history",
      ".services",
      ".vars",
      ".reload",
      ".timeit",
      ".doc",
      ".help",
      ".exit"
    ];
    BUILTINS = ["$app", "$env", "$fetch", "$reload"];
  }
});

// src/commands/attach.ts
var attach_exports = {};
__export(attach_exports, {
  runAttach: () => runAttach
});
async function loadAppwireRc(cwd) {
  try {
    const raw = await (0, import_promises3.readFile)((0, import_path4.join)(cwd, ".appwirerc"), "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
async function runAttach(options) {
  const cwd = process.cwd();
  const rc = await loadAppwireRc(cwd);
  let entryFile;
  if (options.entry) {
    const resolved = (0, import_path4.resolve)(cwd, options.entry);
    if (!(0, import_fs2.existsSync)(resolved)) {
      console.error(`appwire: entry not found: ${resolved}`);
      process.exit(1);
    }
    if ((0, import_fs2.statSync)(resolved).isDirectory()) {
      const detected = await detectEntry(resolved);
      entryFile = detected.file;
      console.log(`appwire: detected entry ${entryFile} (from ${detected.source})`);
    } else {
      entryFile = resolved;
    }
  } else if (rc.entry) {
    entryFile = (0, import_path4.resolve)(cwd, rc.entry);
    if (!(0, import_fs2.existsSync)(entryFile)) {
      console.error(`appwire: entry from .appwirerc not found: ${entryFile}`);
      process.exit(1);
    }
    console.log(`appwire: using entry from .appwirerc: ${entryFile}`);
  } else {
    const detected = await detectEntry(cwd);
    entryFile = detected.file;
    console.log(`appwire: detected entry ${entryFile} (from ${detected.source})`);
  }
  const appDir = findPackageRoot((0, import_path4.dirname)(entryFile));
  const isTS = /\.(ts|mts|cts)$/.test(entryFile);
  let runtimeLoader = null;
  if (isTS) {
    let pkg = {};
    try {
      pkg = JSON.parse(await (0, import_promises3.readFile)((0, import_path4.join)(appDir, "package.json"), "utf8"));
    } catch {
    }
    const runtime = await detectTSRuntime(appDir, pkg);
    if (!runtime) {
      throw new Error(
        `Entry is TypeScript but no ts-node or tsx found. Install one as a dev dependency.`
      );
    }
    runtimeLoader = resolveRuntimeLoader(appDir, runtime);
    console.log(`appwire: using ${runtime} for TypeScript`);
  }
  const extraEnv = { APPWIRE: "1" };
  const pnpmRoot = findPnpmRoot(appDir);
  if (pnpmRoot) {
    extraEnv.APPWIRE_PNPM_ROOT = pnpmRoot;
    console.log(`appwire: pnpm workspace detected, resolving ghost dependencies`);
  }
  let currentChild = null;
  process.on("SIGINT", () => {
    currentChild?.kill("SIGINT");
  });
  process.on("exit", () => {
    currentChild?.kill();
  });
  function spawnTransport() {
    return new Promise((resolve3, reject) => {
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
      channel.onExit((code) => {
        if (!ready)
          reject(
            new Error(`App exited before ready (code: ${code ?? "signal"})`)
          );
      });
      channel.onReady(() => {
        ready = true;
        resolve3(createIPCTransport(channel));
      });
    });
  }
  if (process.env.NODE_ENV && process.env.NODE_ENV !== "development") {
    console.error(`appwire: NODE_ENV=${process.env.NODE_ENV}`);
  }
  console.log(`appwire: starting ${entryFile} ...`);
  const transport = await spawnTransport();
  if (process.stdout.isTTY) process.stdout.write("appwire: loading services...\n");
  let crashedBeforeReady = false;
  await new Promise((resolve3) => {
    let settled = false;
    let timerId;
    function finish(statusText, crashed = false) {
      if (settled) return;
      settled = true;
      clearTimeout(timerId);
      if (process.stdout.isTTY) process.stdout.write("\x1B[1A\x1B[2K");
      if (statusText) process.stdout.write(statusText + "\n");
      crashedBeforeReady = crashed;
      resolve3();
    }
    transport.onStatus?.((text) => finish(text));
    transport.onDisconnect(() => finish(void 0, true));
    timerId = setTimeout(() => finish(), 3e4);
  });
  if (crashedBeforeReady) {
    process.stderr.write("appwire: app exited before it was ready\n");
    process.exit(1);
  }
  const label = entryFile.split("/").pop() ?? entryFile;
  const { startRepl: startRepl2 } = await Promise.resolve().then(() => (init_repl(), repl_exports));
  await startRepl2(transport, {
    appLabel: label,
    onReconnect: async () => {
      if (currentChild) {
        const child = currentChild;
        if (child.exitCode === null) {
          const exited = new Promise((r) => child.once("exit", r));
          child.kill();
          let fallback;
          await Promise.race([
            exited,
            new Promise((r) => {
              fallback = setTimeout(r, 1e3);
            })
          ]);
          clearTimeout(fallback);
          if (child.exitCode === null) child.kill("SIGKILL");
        }
      }
      console.log(`
appwire: restarting ${entryFile} ...`);
      return spawnTransport();
    }
  });
}
var import_path4, import_promises3, import_fs2, import_url, __dirname2, BOOTSTRAP_PATH;
var init_attach = __esm({
  "src/commands/attach.ts"() {
    "use strict";
    init_cjs_shims();
    import_path4 = require("path");
    import_promises3 = require("fs/promises");
    import_fs2 = require("fs");
    import_url = require("url");
    init_entry();
    init_runtime();
    init_spawn();
    init_ipc();
    init_ipc2();
    __dirname2 = (0, import_path4.dirname)((0, import_url.fileURLToPath)(importMetaUrl));
    BOOTSTRAP_PATH = (0, import_path4.join)(__dirname2, "bootstrap.cjs");
  }
});

// src/cli/index.ts
init_cjs_shims();
var args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : void 0;
}
function hasFlag(name) {
  return args.includes(name);
}
if (hasFlag("--version")) {
  const { version } = require(`${__dirname}/../package.json`);
  console.log(version);
  process.exit(0);
} else {
  const entry = flag("--entry");
  Promise.resolve().then(() => (init_attach(), attach_exports)).then(
    ({ runAttach: runAttach2 }) => runAttach2({ entry }).catch((err) => {
      console.error(`appwire: ${err.message}`);
      process.exit(1);
    })
  );
}
//# sourceMappingURL=cli.cjs.map