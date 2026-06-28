"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/bootstrap.ts
var import_vm = __toESM(require("vm"));
var import_module = require("module");
var import_path = require("path");
(function appwireBootstrap() {
  const _out = process.stdout.write.bind(
    process.stdout
  );
  const _err = process.stderr.write.bind(
    process.stderr
  );
  function appwireLog(text) {
    if (typeof process.send === "function") {
      process.send({ type: "appwire:status", text });
    } else {
      _out(text + "\n");
    }
  }
  const _pnpmRoot = process.env.APPWIRE_PNPM_ROOT;
  if (_pnpmRoot) {
    const _M = require("module");
    const _p = require("path");
    const _fs = require("fs");
    const _pnpmDir = _p.join(_pnpmRoot, "node_modules", ".pnpm");
    const _orig = _M._resolveFilename.bind(_M);
    let _entries = null;
    _M._resolveFilename = function(request, parent, isMain, options) {
      try {
        return _orig(request, parent, isMain, options);
      } catch (err) {
        if (err.code !== "MODULE_NOT_FOUND")
          throw err;
        if (!_entries) {
          try {
            _entries = _fs.readdirSync(_pnpmDir);
          } catch {
            _entries = [];
          }
        }
        let pkg;
        if (request.startsWith("@")) {
          const [scope, name] = request.slice(1).split("/");
          pkg = `@${scope}+${name}`;
        } else {
          pkg = request.split("/")[0];
        }
        for (const entry of _entries) {
          if (!entry.startsWith(pkg + "@")) continue;
          try {
            return _orig(request, parent, isMain, {
              ...options,
              paths: [_p.join(_pnpmDir, entry, "node_modules")]
            });
          } catch {
          }
        }
        throw err;
      }
    };
  }
  if (process.env.APPWIRE === "1") {
    process.stdout.write = () => true;
    process.stderr.write = () => true;
    process.once("uncaughtException", (err) => {
      const summary = err.message.split("\n").filter(Boolean).slice(0, 2).join("\n");
      _err(`appwire: app crashed \u2014 ${summary}
`);
      process.exit(1);
    });
    const _net = require("net");
    _net.Server.prototype.listen = function(...args) {
      const port = typeof args[0] === "number" ? args[0] : args[0] !== null && typeof args[0] === "object" ? args[0].port ?? null : null;
      const cb = args.find((a) => typeof a === "function");
      this.address = () => typeof port === "number" ? { address: "127.0.0.1", family: "IPv4", port } : null;
      process.nextTick(() => {
        this.emit("listening");
        cb?.();
      });
      return this;
    };
    const _Mod = require("module");
    const _origLoad = _Mod._load.bind(_Mod);
    _Mod._load = function(request, parent, isMain) {
      const result = _origLoad(request, parent, isMain);
      if (result && typeof result.NestFactory?.create === "function" && !result.__appwirePatched) {
        result.__appwirePatched = true;
        _Mod._load = _origLoad;
        const _origCreate = result.NestFactory.create.bind(result.NestFactory);
        result.NestFactory.create = async function(...args) {
          const app = await _origCreate(...args);
          const g = global;
          const tokenMap = /* @__PURE__ */ new Map();
          try {
            const container = app.container;
            for (const mod of container.getModules().values()) {
              for (const key of mod.providers.keys()) {
                if (typeof key === "function")
                  tokenMap.set(key.name, key);
                else if (typeof key === "string") tokenMap.set(key, key);
              }
            }
          } catch {
          }
          if (typeof g.__appwireSetContext === "function") {
            g.__appwireSetContext("$app", {
              get: (token, opts) => {
                const resolved = typeof token === "string" && tokenMap.has(token) ? tokenMap.get(token) : token;
                return app.get(resolved, { strict: false, ...opts });
              }
            });
          }
          if (typeof g.__appwireSetServicesProvider === "function") {
            g.__appwireSetServicesProvider(
              () => [...tokenMap.keys()].sort()
            );
          }
          return app;
        };
      }
      return result;
    };
  }
  global.__appwire = true;
  function trimStack(stack) {
    if (!stack) return "";
    return stack.split("\n").filter(
      (line) => !line.includes("Script.runInContext") && !line.includes("bootstrap.cjs") && !line.includes("node:vm") && !line.includes("node:internal")
    ).join("\n");
  }
  const SER_MAX_DEPTH = 6;
  const SER_MAX_ARRAY = 100;
  const SER_MAX_KEYS = 50;
  function serializeValue(value) {
    if (value === void 0) return { __type: "undefined" };
    if (value === null) return null;
    if (typeof value === "bigint")
      return { __type: "bigint", value: value.toString() };
    if (typeof value === "function")
      return {
        __type: "function",
        name: value.name || "(anonymous)"
      };
    if (typeof value === "symbol")
      return { __type: "symbol", description: value.description };
    if (value instanceof Error) {
      return {
        __type: "error",
        name: value.name,
        message: value.message,
        stack: trimStack(value.stack)
      };
    }
    if (typeof value !== "object") return value;
    const seen = /* @__PURE__ */ new WeakSet();
    function ser(v, depth) {
      if (v === null) return null;
      if (v === void 0) return { __type: "undefined" };
      if (typeof v === "bigint")
        return { __type: "bigint", value: v.toString() };
      if (typeof v === "function")
        return { __type: "function", name: v.name };
      if (typeof v === "symbol")
        return { __type: "symbol", description: v.description };
      if (v instanceof Error)
        return {
          __type: "error",
          name: v.name,
          message: v.message,
          stack: trimStack(v.stack)
        };
      if (typeof v !== "object") return v;
      if (seen.has(v)) return "[Circular]";
      seen.add(v);
      if (depth >= SER_MAX_DEPTH)
        return Array.isArray(v) ? `[Array(${v.length})]` : "[Object]";
      if (v instanceof Map) {
        const out2 = {};
        let i = 0;
        for (const [k, val] of v) {
          if (i++ >= SER_MAX_KEYS) {
            out2["(\u2026)"] = `${v.size - SER_MAX_KEYS} more entries`;
            break;
          }
          out2[String(k)] = ser(val, depth + 1);
        }
        return out2;
      }
      if (v instanceof Set) {
        const arr = [...v].slice(0, SER_MAX_ARRAY).map((x) => ser(x, depth + 1));
        if (v.size > SER_MAX_ARRAY)
          arr.push(`\u2026(${v.size - SER_MAX_ARRAY} more)`);
        return arr;
      }
      if (v instanceof Date) return v.toISOString();
      if (Array.isArray(v)) {
        const out2 = v.slice(0, SER_MAX_ARRAY).map((x) => ser(x, depth + 1));
        if (v.length > SER_MAX_ARRAY)
          out2.push(`\u2026(${v.length - SER_MAX_ARRAY} more)`);
        return out2;
      }
      const keys = Object.keys(v);
      const out = {};
      for (const k of keys.slice(0, SER_MAX_KEYS)) {
        out[k] = ser(v[k], depth + 1);
      }
      if (keys.length > SER_MAX_KEYS)
        out["(\u2026)"] = `${keys.length - SER_MAX_KEYS} more keys`;
      return out;
    }
    try {
      return ser(value, 0);
    } catch {
      return String(value);
    }
  }
  let activeLogWriter = null;
  let currentEvalId = "";
  function safeStringify(v) {
    if (typeof v === "bigint") return `${v}n`;
    try {
      const seen = /* @__PURE__ */ new WeakSet();
      return JSON.stringify(
        v,
        (_k, val) => {
          if (typeof val === "bigint") return `${val}n`;
          if (typeof val === "object" && val !== null) {
            if (seen.has(val)) return "[Circular]";
            seen.add(val);
          }
          return val;
        },
        2
      );
    } catch {
      return String(v);
    }
  }
  const _origLog = console.log;
  const _origError = console.error;
  const _origWarn = console.warn;
  const _origInfo = console.info;
  const ipcMode = process.env.APPWIRE === "1";
  function intercept(level, orig) {
    return (...args) => {
      if (activeLogWriter && currentEvalId) {
        activeLogWriter({
          id: currentEvalId,
          type: "log",
          level,
          args: args.map((a) => typeof a === "string" ? a : safeStringify(a))
        });
      } else if (!ipcMode) {
        orig(...args);
      }
    };
  }
  console.log = intercept("log", _origLog);
  console.error = intercept("error", _origError);
  console.warn = intercept("warn", _origWarn);
  console.info = intercept("info", _origInfo);
  const userRequire = (0, import_module.createRequire)((0, import_path.resolve)(process.cwd(), "package.json"));
  const appwireContext = import_vm.default.createContext({
    process,
    console,
    Buffer,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    setImmediate,
    clearImmediate,
    queueMicrotask,
    require: userRequire,
    $env: process.env,
    $app: null,
    $fetch: globalThis.fetch ?? null
  });
  const _builtinKeys = new Set(Object.keys(appwireContext));
  global.__appwireSetContext = (key, value) => {
    appwireContext[key] = value;
  };
  let servicesProvider = null;
  let appReadyPrinted = false;
  global.__appwireSetServicesProvider = (fn) => {
    servicesProvider = fn;
    if (!appReadyPrinted) {
      appReadyPrinted = true;
      appwireLog(`appwire: app ready (${fn().length} services)`);
    }
  };
  const getServices = () => servicesProvider?.() ?? Object.keys(appwireContext).filter(
    (k) => !k.startsWith("__") && !_builtinKeys.has(k)
  );
  appwireContext.__appwireGetServices = getServices;
  appwireContext.$reload = function(modulePath) {
    const resolved = userRequire.resolve(modulePath);
    delete require.cache[resolved];
    return userRequire(modulePath);
  };
  _builtinKeys.add("$reload");
  function buildScript(code) {
    try {
      return new import_vm.default.Script(`(async () => { return (${code}) })()`, {
        filename: "<appwire>"
      });
    } catch {
    }
    const lines = code.split("\n");
    let lastIdx = lines.length - 1;
    while (lastIdx >= 0 && !lines[lastIdx].trim()) lastIdx--;
    if (lastIdx >= 0) {
      const last = lines[lastIdx].trimEnd().replace(/;$/, "");
      if (!/^(if|for|while|do\b|switch|try|const\s|let\s|var\s|function\s|class\s|return\s|throw\s|break|continue|import|export|\{)/.test(
        last.trim()
      )) {
        const modified = [...lines];
        modified[lastIdx] = `return (${last})`;
        try {
          return new import_vm.default.Script(`(async () => {
${modified.join("\n")}
})()`, {
            filename: "<appwire>"
          });
        } catch {
        }
      }
    }
    return new import_vm.default.Script(`(async () => {
${code}
})()`, {
      filename: "<appwire>"
    });
  }
  function toErrorInfo(err) {
    if (err !== null && typeof err === "object") {
      const e = err;
      return {
        name: typeof e.name === "string" ? e.name : "Error",
        message: typeof e.message === "string" ? e.message : String(err),
        stack: trimStack(typeof e.stack === "string" ? e.stack : void 0)
      };
    }
    return { name: "Error", message: String(err), stack: "" };
  }
  const DEFAULT_TIMEOUT_MS = 3e4;
  const queue = [];
  let busy = false;
  function enqueue(task) {
    queue.push(() => {
      task().finally(() => {
        busy = false;
        if (queue.length > 0) {
          busy = true;
          queue.shift()();
        }
      });
    });
    if (!busy) {
      busy = true;
      queue.shift()();
    }
  }
  function runEval(code, timeoutMs, evalId, writer) {
    return new Promise((resolve2) => {
      enqueue(async () => {
        activeLogWriter = writer;
        currentEvalId = evalId;
        const start = Date.now();
        let timerId;
        try {
          const script = buildScript(code);
          const result = await Promise.race([
            script.runInContext(appwireContext),
            new Promise((_, reject) => {
              timerId = setTimeout(
                () => reject(new Error(`Timed out after ${timeoutMs}ms`)),
                timeoutMs
              );
            })
          ]);
          writer({
            id: evalId,
            type: "result",
            value: serializeValue(result),
            duration: Date.now() - start,
            error: null
          });
        } catch (err) {
          writer({
            id: evalId,
            type: "error",
            value: null,
            duration: Date.now() - start,
            error: toErrorInfo(err)
          });
        } finally {
          clearTimeout(timerId);
          activeLogWriter = null;
          currentEvalId = "";
          resolve2();
        }
      });
    });
  }
  if (typeof process.send === "function") {
    process.on("message", (msg) => {
      const req = msg;
      if (!req || typeof req.id !== "string" || typeof req.code !== "string")
        return;
      void runEval(
        req.code,
        req.timeout ?? DEFAULT_TIMEOUT_MS,
        req.id,
        (m) => process.send(m)
      );
    });
    process.send({ type: "appwire:ready" });
  }
})();
