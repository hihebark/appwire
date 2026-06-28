// Injected via --require into the child process before user code loads.
// Compiled to dist/bootstrap.cjs as a standalone bundle — no external imports.
import vm from "vm";
import { createRequire } from "module";
import { resolve } from "path";
(function appwireBootstrap() {
  const _out = process.stdout.write.bind(
    process.stdout,
  ) as typeof process.stdout.write;
  const _err = process.stderr.write.bind(
    process.stderr,
  ) as typeof process.stderr.write;
  // Send appwire status messages via IPC when available so the parent REPL can
  // print them cleanly (clear current line, print, redraw prompt).
  // Falls back to direct stdout write in adapter-only / non-IPC mode.
  function appwireLog(text: string) {
    if (typeof process.send === "function") {
      process.send({ type: "appwire:status", text });
    } else {
      _out(text + "\n");
    }
  }

  // pnpm ghost-dependency resolver — patches Module._resolveFilename to search
  // the virtual store on MODULE_NOT_FOUND, so ghost deps resolve without NODE_PATH.
  const _pnpmRoot = process.env.APPWIRE_PNPM_ROOT;
  if (_pnpmRoot) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const _M = require("module") as { _resolveFilename: Function };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const _p = require("path") as typeof import("path");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const _fs = require("fs") as typeof import("fs");
    const _pnpmDir = _p.join(_pnpmRoot, "node_modules", ".pnpm");
    const _orig = _M._resolveFilename.bind(_M);
    let _entries: string[] | null = null;

    _M._resolveFilename = function (
      request: string,
      parent: unknown,
      isMain: boolean,
      options: unknown,
    ) {
      try {
        return _orig(request, parent, isMain, options);
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== "MODULE_NOT_FOUND")
          throw err;
        if (!_entries) {
          try {
            _entries = _fs.readdirSync(_pnpmDir) as string[];
          } catch {
            _entries = [];
          }
        }
        // 'jsonwebtoken' → 'jsonwebtoken', '@nestjs/jwt' → '@nestjs+jwt',
        // '@nestjs/common/utils/x' → '@nestjs+common' (subpath: only first two segments)
        let pkg: string;
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
              ...(options as object),
              paths: [_p.join(_pnpmDir, entry, "node_modules")],
            });
          } catch {
            /* try next version */
          }
        }
        throw err;
      }
    };
  }

  if (process.env.APPWIRE === "1") {
    // Silence all app stdout/stderr — background logs never reach the terminal.
    // appwire's own output uses _out/_err directly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.stdout as any).write = () => true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.stderr as any).write = () => true;

    // Surface crash errors even though stdout is suppressed.
    process.once("uncaughtException", (err) => {
      const summary = err.message.split("\n").filter(Boolean).slice(0, 2).join("\n");
      _err(`appwire: app crashed — ${summary}\n`);
      process.exit(1);
    });

    const _net = require("net") as typeof import("net");
    // Intercept listen so the app skips binding its HTTP port — the process
    // stays alive for eval without needing a free port.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_net.Server.prototype as any).listen = function (
      this: import("net").Server,
      ...args: unknown[]
    ) {
      const port =
        typeof args[0] === "number"
          ? args[0]
          : args[0] !== null && typeof args[0] === "object"
            ? ((args[0] as Record<string, unknown>).port ?? null)
            : null;
      const cb = args.find((a) => typeof a === "function") as
        | (() => void)
        | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).address = () =>
        typeof port === "number"
          ? { address: "127.0.0.1", family: "IPv4", port }
          : null;
      process.nextTick(() => {
        this.emit("listening");
        cb?.();
      });
      return this;
    };

    // Auto-wire NestJS: intercept Module._load to patch NestFactory.create the
    // moment @nestjs/core is first required, capturing the app instance without
    // any changes to user code.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _Mod = require("module") as any;
    const _origLoad = _Mod._load.bind(_Mod);
    _Mod._load = function (request: string, parent: unknown, isMain: boolean) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = _origLoad(request, parent, isMain) as any;
      if (
        result &&
        typeof result.NestFactory?.create === "function" &&
        !result.__appwirePatched
      ) {
        result.__appwirePatched = true;
        _Mod._load = _origLoad; // restore — only needed once
        const _origCreate = result.NestFactory.create.bind(result.NestFactory);
        result.NestFactory.create = async function (...args: unknown[]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const app = (await _origCreate(...args)) as any;
          const g = global as Record<string, unknown>;

          // Build name → class-ref map so $app.get('ServiceName') works
          const tokenMap = new Map<string, unknown>();
          try {
            const container = app.container as {
              getModules: () => Map<
                unknown,
                { providers: Map<unknown, unknown> }
              >;
            };
            for (const mod of container.getModules().values()) {
              for (const key of mod.providers.keys()) {
                if (typeof key === "function")
                  tokenMap.set((key as Function).name, key);
                else if (typeof key === "string") tokenMap.set(key, key);
              }
            }
          } catch {
            /* container not accessible */
          }

          if (typeof g.__appwireSetContext === "function") {
            (g.__appwireSetContext as Function)("$app", {
              get: (token: unknown, opts?: { strict?: boolean }) => {
                // Resolve string name to class ref to avoid NestJS crashing on unknown string tokens
                const resolved =
                  typeof token === "string" && tokenMap.has(token)
                    ? tokenMap.get(token)
                    : token;
                return app.get(resolved, { strict: false, ...opts });
              },
            });
          }
          if (typeof g.__appwireSetServicesProvider === "function") {
            (g.__appwireSetServicesProvider as Function)(() =>
              [...tokenMap.keys()].sort(),
            );
          }
          return app;
        };
      }
      return result;
    };
  }

  (global as Record<string, unknown>).__appwire = true;

  // --- Stack trimming ---
  function trimStack(stack: string | undefined): string {
    if (!stack) return "";
    return stack
      .split("\n")
      .filter(
        (line) =>
          !line.includes("Script.runInContext") &&
          !line.includes("bootstrap.cjs") &&
          !line.includes("node:vm") &&
          !line.includes("node:internal"),
      )
      .join("\n");
  }

  // --- Serialization ---
  // Depth/breadth-bounded to prevent huge objects from flooding the wire.
  const SER_MAX_DEPTH = 6;
  const SER_MAX_ARRAY = 100;
  const SER_MAX_KEYS = 50;

  function serializeValue(value: unknown): unknown {
    if (value === undefined) return { __type: "undefined" };
    if (value === null) return null;
    if (typeof value === "bigint")
      return { __type: "bigint", value: value.toString() };
    if (typeof value === "function")
      return {
        __type: "function",
        name: (value as Function).name || "(anonymous)",
      };
    if (typeof value === "symbol")
      return { __type: "symbol", description: value.description };
    if (value instanceof Error) {
      return {
        __type: "error",
        name: value.name,
        message: value.message,
        stack: trimStack(value.stack),
      };
    }
    if (typeof value !== "object") return value;

    const seen = new WeakSet<object>();

    function ser(v: unknown, depth: number): unknown {
      if (v === null) return null;
      if (v === undefined) return { __type: "undefined" };
      if (typeof v === "bigint")
        return { __type: "bigint", value: v.toString() };
      if (typeof v === "function")
        return { __type: "function", name: (v as Function).name };
      if (typeof v === "symbol")
        return { __type: "symbol", description: (v as symbol).description };
      if (v instanceof Error)
        return {
          __type: "error",
          name: v.name,
          message: v.message,
          stack: trimStack(v.stack),
        };
      if (typeof v !== "object") return v;
      if (seen.has(v)) return "[Circular]";
      seen.add(v);
      if (depth >= SER_MAX_DEPTH)
        return Array.isArray(v)
          ? `[Array(${(v as unknown[]).length})]`
          : "[Object]";
      if (v instanceof Map) {
        const out: Record<string, unknown> = {};
        let i = 0;
        for (const [k, val] of v) {
          if (i++ >= SER_MAX_KEYS) {
            out["(…)"] = `${v.size - SER_MAX_KEYS} more entries`;
            break;
          }
          out[String(k)] = ser(val, depth + 1);
        }
        return out;
      }
      if (v instanceof Set) {
        const arr = [...v]
          .slice(0, SER_MAX_ARRAY)
          .map((x) => ser(x, depth + 1));
        if (v.size > SER_MAX_ARRAY)
          arr.push(`…(${v.size - SER_MAX_ARRAY} more)`);
        return arr;
      }
      if (v instanceof Date) return v.toISOString();
      if (Array.isArray(v)) {
        const out = (v as unknown[])
          .slice(0, SER_MAX_ARRAY)
          .map((x) => ser(x, depth + 1));
        if (v.length > SER_MAX_ARRAY)
          out.push(`…(${(v as unknown[]).length - SER_MAX_ARRAY} more)`);
        return out;
      }
      const keys = Object.keys(v as object);
      const out: Record<string, unknown> = {};
      for (const k of keys.slice(0, SER_MAX_KEYS)) {
        out[k] = ser((v as Record<string, unknown>)[k], depth + 1);
      }
      if (keys.length > SER_MAX_KEYS)
        out["(…)"] = `${keys.length - SER_MAX_KEYS} more keys`;
      return out;
    }

    try {
      return ser(value, 0);
    } catch {
      return String(value);
    }
  }

  // --- Console interception ---
  // activeLogWriter is set before each eval and cleared after, routing streamed
  // console output to whichever channel (IPC or HTTP) is handling that eval.
  let activeLogWriter: ((msg: unknown) => void) | null = null;
  let currentEvalId = "";

  type ConsoleFn = (...args: unknown[]) => void;

  function safeStringify(v: unknown): string {
    if (typeof v === "bigint") return `${v}n`;
    try {
      const seen = new WeakSet();
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
        2,
      );
    } catch {
      return String(v);
    }
  }

  // In HTTP adapter mode (APPWIRE≠1), stdout is active; forward to originals
  // when no eval is active so app logs reach the terminal.
  const _origLog = console.log;
  const _origError = console.error;
  const _origWarn = console.warn;
  const _origInfo = console.info;
  const ipcMode = process.env.APPWIRE === "1";

  function intercept(level: string, orig: ConsoleFn): ConsoleFn {
    return (...args: unknown[]) => {
      if (activeLogWriter && currentEvalId) {
        activeLogWriter({
          id: currentEvalId,
          type: "log",
          level,
          args: args.map((a) => (typeof a === "string" ? a : safeStringify(a))),
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

  // --- VM context ---
  const userRequire = createRequire(resolve(process.cwd(), "package.json"));

  const appwireContext = vm.createContext({
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
    $app: null as unknown,
    $fetch: (globalThis as Record<string, unknown>).fetch ?? null,
  });

  // Snapshot of built-in keys — anything added later via __appwireSetContext is a
  // user-defined service and should appear in .services.
  const _builtinKeys = new Set(Object.keys(appwireContext as object));

  (global as Record<string, unknown>).__appwireSetContext = (
    key: string,
    value: unknown,
  ) => {
    (appwireContext as Record<string, unknown>)[key] = value;
  };

  // Services provider — set by adapters so .services command can list tokens
  let servicesProvider: (() => string[]) | null = null;
  let appReadyPrinted = false;

  (global as Record<string, unknown>).__appwireSetServicesProvider = (
    fn: () => string[],
  ) => {
    servicesProvider = fn;
    if (!appReadyPrinted) {
      appReadyPrinted = true;
      appwireLog(`appwire: app ready (${fn().length} services)`);
    }
  };

  const getServices = (): string[] =>
    servicesProvider?.() ??
    Object.keys(appwireContext as object).filter(
      (k) => !k.startsWith("__") && !_builtinKeys.has(k),
    );

  (appwireContext as Record<string, unknown>).__appwireGetServices = getServices;

  // $reload(modulePath) — evicts a module from require cache and re-requires it.
  // CJS only; Node.js has no ESM cache eviction API.
  (appwireContext as Record<string, unknown>).$reload = function (
    modulePath: string,
  ) {
    const resolved = userRequire.resolve(modulePath);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (require as any).cache[resolved];
    return userRequire(modulePath);
  };
  _builtinKeys.add("$reload");

  // --- Script builder ---
  function buildScript(code: string): vm.Script {
    try {
      return new vm.Script(`(async () => { return (${code}) })()`, {
        filename: "<appwire>",
      });
    } catch {
      /* not a single expression */
    }

    const lines = code.split("\n");
    let lastIdx = lines.length - 1;
    while (lastIdx >= 0 && !lines[lastIdx].trim()) lastIdx--;
    if (lastIdx >= 0) {
      const last = lines[lastIdx].trimEnd().replace(/;$/, "");
      if (
        !/^(if|for|while|do\b|switch|try|const\s|let\s|var\s|function\s|class\s|return\s|throw\s|break|continue|import|export|\{)/.test(
          last.trim(),
        )
      ) {
        const modified = [...lines];
        modified[lastIdx] = `return (${last})`;
        try {
          return new vm.Script(`(async () => {\n${modified.join("\n")}\n})()`, {
            filename: "<appwire>",
          });
        } catch {
          /* fall through */
        }
      }
    }

    return new vm.Script(`(async () => {\n${code}\n})()`, {
      filename: "<appwire>",
    });
  }

  function toErrorInfo(err: unknown): {
    name: string;
    message: string;
    stack: string;
  } {
    if (err !== null && typeof err === "object") {
      const e = err as Record<string, unknown>;
      return {
        name: typeof e.name === "string" ? e.name : "Error",
        message: typeof e.message === "string" ? e.message : String(err),
        stack: trimStack(typeof e.stack === "string" ? e.stack : undefined),
      };
    }
    return { name: "Error", message: String(err), stack: "" };
  }

  // --- Eval queue — serializes concurrent IPC + HTTP requests ---
  const DEFAULT_TIMEOUT_MS = 30_000;
  const queue: Array<() => void> = [];
  let busy = false;

  function enqueue(task: () => Promise<void>) {
    queue.push(() => {
      task().finally(() => {
        busy = false;
        if (queue.length > 0) {
          busy = true;
          queue.shift()!();
        }
      });
    });
    if (!busy) {
      busy = true;
      queue.shift()!();
    }
  }

  function runEval(
    code: string,
    timeoutMs: number,
    evalId: string,
    writer: (msg: unknown) => void,
  ): Promise<void> {
    return new Promise((resolve) => {
      enqueue(async () => {
        activeLogWriter = writer;
        currentEvalId = evalId;
        const start = Date.now();
        let timerId: ReturnType<typeof setTimeout> | undefined;
        try {
          const script = buildScript(code);
          const result = await Promise.race([
            script.runInContext(appwireContext) as Promise<unknown>,
            new Promise<never>((_, reject) => {
              timerId = setTimeout(
                () => reject(new Error(`Timed out after ${timeoutMs}ms`)),
                timeoutMs,
              );
            }),
          ]);
          writer({
            id: evalId,
            type: "result",
            value: serializeValue(result),
            duration: Date.now() - start,
            error: null,
          });
        } catch (err) {
          writer({
            id: evalId,
            type: "error",
            value: null,
            duration: Date.now() - start,
            error: toErrorInfo(err),
          });
        } finally {
          clearTimeout(timerId);
          activeLogWriter = null;
          currentEvalId = "";
          resolve();
        }
      });
    });
  }

  // --- IPC channel (stdin/fork mode) ---
  if (typeof process.send === "function") {
    process.on("message", (msg: unknown) => {
      const req = msg as { id?: string; code?: string; timeout?: number };
      if (!req || typeof req.id !== "string" || typeof req.code !== "string")
        return;
      void runEval(req.code, req.timeout ?? DEFAULT_TIMEOUT_MS, req.id, (m) =>
        process.send!(m),
      );
    });
    process.send({ type: "appwire:ready" });
  }

})();
