import readline from "readline";
import type { AppwireTransport } from "../transport/types.js";
import type { EvalResponse, LogStream } from "../protocol/types.js";
import { isUndefinedResult } from "../protocol/types.js";
import {
  prompt,
  displayValue,
  displayError,
  displayLog,
  displayDuration,
  colors as c,
} from "./pretty.js";
import { loadHistory, saveHistory, addEntry } from "./history.js";
import { enterEditorMode } from "./editor.js";

const COMMANDS = [
  ".editor",
  ".clear",
  ".history",
  ".services",
  ".vars",
  ".reload",
  ".timeit",
  ".doc",
  ".help",
  ".exit",
];

const BUILTINS = ["$app", "$env", "$fetch", "$reload"];

export interface ReplOptions {
  appLabel?: string;
  onReconnect?: () => Promise<AppwireTransport>;
}

export async function startRepl(
  initialTransport: AppwireTransport,
  options: ReplOptions = {},
): Promise<void> {
  let activeTransport = initialTransport;
  let reloading = false;
  const history = await loadHistory();
  const userVars = new Set<string>();

  function trackAssignments(code: string) {
    // (?!=) excludes == and ===
    for (const m of code.matchAll(/(^|\n)\s*(\$\w+)\s*=(?!=)/g)) {
      userVars.add(m[2]);
    }
  }

  // Service name cache — populated in background, used for tab completion.
  let cachedServices: string[] = [];

  function refreshServices() {
    const t = activeTransport;
    t.getServices()
      .then((s) => {
        if (t === activeTransport) cachedServices = s;
      })
      .catch(() => {});
  }

  refreshServices();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 1000,
    completer: (line: string) => {
      if (line.startsWith(".")) {
        const hits = COMMANDS.filter((c) => c.startsWith(line));
        return [hits.length ? hits : COMMANDS, line];
      }
      // Complete $-prefixed identifiers: builtins + $app.get('ServiceName')
      const dollarMatch = line.match(/\$(\w*)$/);
      if (dollarMatch) {
        const prefix = "$" + dollarMatch[1];
        const candidates = [
          ...BUILTINS,
          ...userVars,
          ...cachedServices.map((s) => `$app.get('${s}')`),
        ].filter((c) => c.startsWith(prefix));
        return [candidates, prefix];
      }
      return [[], line];
    },
  });

  (rl as unknown as { history: string[] }).history = [...history].reverse();

  rl.setPrompt(
    prompt(
      options.appLabel
        ? `${initialTransport.mode}:${options.appLabel}`
        : initialTransport.mode,
    ),
  );
  rl.prompt();

  function printStatus(text: string) {
    process.stdout.write(`\r\x1b[2K${text}\n`);
    rl.prompt(true);
  }

  function registerStatus(t: AppwireTransport) {
    t.onStatus?.(printStatus);
  }

  function registerDisconnect(t: AppwireTransport) {
    t.onDisconnect(async () => {
      if (t !== activeTransport || reloading) return;
      process.stdout.write(`\n${c.yellow}appwire: disconnected${c.reset}\n`);
      if (!options.onReconnect) return;
      reloading = true;
      try {
        process.stdout.write(`${c.dim}appwire: reconnecting...${c.reset}\n`);
        const newTransport = await options.onReconnect();
        activeTransport = newTransport;
        registerStatus(newTransport);
        registerDisconnect(newTransport);
        refreshServices();
        process.stdout.write(`${c.green}appwire: reconnected${c.reset}\n`);
        (process.stdin as { setRawMode?: (v: boolean) => void }).setRawMode?.(true);
        rl.prompt();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stdout.write(
          `${c.red}appwire: reconnect failed: ${msg}${c.reset}\n`,
        );
        process.stdout.write(`${c.dim}Type .exit to quit${c.reset}\n`);
        rl.prompt();
      } finally {
        reloading = false;
      }
    });
  }
  registerStatus(activeTransport);
  registerDisconnect(activeTransport);

  // Named for removal in editor mode — editor takes over input handling.
  async function onLine(input: string) {
    const line = input.trim();
    if (!line) {
      rl.prompt();
      return;
    }
    // Pause before the first await so a second rapid line can't start a
    // concurrent eval before rl.pause() would otherwise be called inside runEval.
    rl.pause();
    addEntry(history, line);
    if (line.startsWith(".")) {
      await handleCommand(line);
    } else {
      trackAssignments(line);
      await runEval(line);
    }
    rl.resume();
    // Restore raw mode: child process exit may reset the TTY via OS cleanup.
    (process.stdin as { setRawMode?: (v: boolean) => void }).setRawMode?.(true);
    if (!reloading) rl.prompt();
  }
  rl.on("line", onLine);

  // Named for removal in editor mode — editor handles Ctrl+C directly.
  let lastSigInt = 0;
  function onSigInt() {
    const now = Date.now();
    if (now - lastSigInt < 1_000) {
      process.stdout.write("\n");
      saveHistory(history).then(() => process.exit(0)).catch(() => process.exit(1));
      return;
    }
    lastSigInt = now;
    process.stdout.write("\n(Press Ctrl+C again or type .exit to quit)\n");
    rl.prompt();
  }
  rl.on("SIGINT", onSigInt);

  // Named for removal in editor mode — Ctrl+D submits code there instead of closing.
  async function onClose() {
    await saveHistory(history);
    process.exit(0);
  }
  rl.on("close", onClose);

  async function runEval(code: string): Promise<void> {
    try {
      const response = await activeTransport.evaluate(
        code,
        30_000,
        (log: LogStream) => {
          process.stdout.write(displayLog(log.level, log.args) + "\n");
        },
      );
      printResponse(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`${c.red}connection error: ${msg}${c.reset}\n`);
    }
  }

  async function handleCommand(line: string): Promise<void> {
    const [cmd] = line.split(/\s+/);

    switch (cmd) {
      case ".exit":
        await saveHistory(history);
        process.exit(0);
        break;

      case ".clear":
        process.stdout.write("\x1b[2J\x1b[H");
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
            "",
          ].join("\n"),
        );
        break;

      case ".history":
        if (history.length === 0) {
          process.stdout.write(`${c.dim}(no history)${c.reset}\n`);
        } else {
          history.slice(-20).forEach((entry, i) => {
            process.stdout.write(`  ${c.dim}${i + 1}${c.reset}  ${entry}\n`);
          });
        }
        break;

      case ".vars": {
        if (userVars.size === 0) {
          process.stdout.write(`${c.dim}(no variables assigned yet — use $name = expr)${c.reset}\n`);
        } else {
          for (const v of userVars) {
            process.stdout.write(`  ${c.cyan}${v}${c.reset}\n`);
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
              `${c.dim}(no services registered)${c.reset}\n`,
            );
          } else {
            process.stdout.write("\r\x1b[2K");
            services.forEach((s) =>
              process.stdout.write(`  ${c.cyan}${s}${c.reset}\n`),
            );
          }
        } catch {
          process.stdout.write(
            `\r\x1b[2K${c.red}could not fetch services${c.reset}\n`,
          );
        }
        break;
      }

      case ".reload": {
        if (!options.onReconnect) {
          process.stdout.write(
            `${c.yellow}Reload not available in this mode${c.reset}\n`,
          );
          break;
        }
        if (reloading) {
          process.stdout.write(`${c.yellow}Already reconnecting...${c.reset}\n`);
          break;
        }
        process.stdout.write(`${c.dim}reloading...${c.reset}\n`);
        reloading = true;
        try {
          const newTransport = await options.onReconnect();
          activeTransport = newTransport;
          registerStatus(newTransport);
          registerDisconnect(newTransport);
          refreshServices();
          process.stdout.write(`${c.green}reloaded${c.reset}\n`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          process.stdout.write(`${c.red}reload failed: ${msg}${c.reset}\n`);
          process.stdout.write(`${c.dim}Type .reload to try again${c.reset}\n`);
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
          process.stdout.write(`Usage: .timeit [N] <expression>  (N must be >= 1)\n`);
          break;
        }
        if (!expr) {
          process.stdout.write(`Usage: .timeit [N] <expression>\n`);
          break;
        }
        const durations: number[] = [];
        let failed = false;
        for (let i = 0; i < n; i++) {
          try {
            const res = await activeTransport.evaluate(
              expr,
              30_000,
              i === 0
                ? (log: LogStream) => { process.stdout.write(displayLog(log.level, log.args) + "\n"); }
                : () => {},
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
            process.stdout.write(`${c.red}connection error: ${msg}${c.reset}\n`);
            failed = true;
            break;
          }
        }
        if (!failed) {
          if (n === 1) {
            process.stdout.write(`  time: ${durations[0]}ms\n`);
          } else {
            const avg = durations.reduce((a, b) => a + b, 0) / n;
            process.stdout.write(
              `  runs: ${n}  avg: ${avg.toFixed(0)}ms` +
              `  min: ${Math.min(...durations)}ms` +
              `  max: ${Math.max(...durations)}ms\n`,
            );
          }
        }
        break;
      }

      case ".doc": {
        const expr = line.slice(".doc".length).trim();
        if (!expr) {
          process.stdout.write(`Usage: .doc <expression>\n`);
          break;
        }
        const docCode =
          `(async function(v){` +
          `if(v&&typeof v.then==='function')v=await v;` +
          `if(v===null||v===undefined)return{name:String(v)};` +
          `const name=v?.constructor?.name??typeof v;` +
          `const methods=[];const props=[];` +
          `const seen=new Set();` +
          `let p=Object.getPrototypeOf(v);` +
          `while(p&&p!==Object.prototype){` +
          `for(const k of Object.getOwnPropertyNames(p)){` +
          `if(k==='constructor'||seen.has(k))continue;seen.add(k);` +
          `const d=Object.getOwnPropertyDescriptor(p,k);` +
          `if(d&&typeof d.value==='function'){` +
          `const s=d.value.toString();` +
          `const _o=s.indexOf('(');let _d=0,_e=-1;for(let _i=_o;_i<s.length;_i++){if(s[_i]==='(')_d++;else if(s[_i]===')'){_d--;if(_d===0){_e=_i;break;}}}` +
          `const params=_o>=0&&_e>=0?s.slice(_o+1,_e).trim():'';` +
          `methods.push(k+'('+params+')');}}` +
          `p=Object.getPrototypeOf(p);}` +
          `for(const k of Object.keys(v))props.push(k);` +
          `return{name,methods,props};` +
          `})(${expr})`;
        try {
          const res = await activeTransport.evaluate(docCode, 5_000, () => {});
          if (res.type === "error") {
            printResponse(res);
          } else {
            const info = res.value as {
              name?: string;
              methods?: string[];
              props?: string[];
            };
            process.stdout.write(`  ${c.bold}${info.name ?? "unknown"}${c.reset}\n`);
            if (info.methods?.length) {
              process.stdout.write(`  ${c.dim}Methods:${c.reset}\n`);
              for (const m of info.methods) {
                process.stdout.write(`    ${c.cyan}${m}${c.reset}\n`);
              }
            }
            if (info.props?.length) {
              process.stdout.write(`  ${c.dim}Properties:${c.reset}\n`);
              for (const p of info.props) {
                process.stdout.write(`    ${c.dim}${p}${c.reset}\n`);
              }
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          process.stdout.write(`${c.red}connection error: ${msg}${c.reset}\n`);
        }
        break;
      }

      case ".editor": {
        // Remove outer listeners so editor mode has exclusive control:
        // - onLine: prevents each typed line from being dispatched as a command
        // - onSigInt: prevents the "To exit, type .exit" message from printing on Ctrl+C
        // - onClose: prevents Ctrl+D from calling process.exit before code is submitted
        rl.removeListener("line", onLine);
        rl.removeListener("SIGINT", onSigInt);
        rl.removeListener("close", onClose);
        let result: { code: string } | null = null;
        try {
          result = await enterEditorMode(rl);
        } finally {
          if (result !== null) {
            // Ctrl+D submitted: readline is closed (stdin at EOF); run code, save history, exit.
            if (result.code.trim()) {
              addEntry(history, result.code);
              trackAssignments(result.code);
              await runEval(result.code);
            } else {
              process.stdout.write(`${c.dim}// (nothing to run)${c.reset}\n`);
            }
            await saveHistory(history);
            process.exit(0);
          } else {
            // Ctrl+C cancel: readline still open, restore outer handlers.
            lastSigInt = 0; // reset so one Ctrl+C in editor doesn't count toward exit
            rl.on("line", onLine);
            rl.on("SIGINT", onSigInt);
            rl.on("close", onClose);
          }
        }
        // Only reached on Ctrl+C cancel (result === null).
        process.stdout.write(`${c.dim}// Cancelled${c.reset}\n`);
        break;
      }

      default:
        process.stdout.write(`${c.red}Unknown command: ${cmd}${c.reset}\n`);
        process.stdout.write(
          `Type ${c.bold}.help${c.reset} for available commands.\n`,
        );
    }
  }
}

function printResponse(res: EvalResponse): void {
  if (res.type === "error" && res.error) {
    process.stdout.write(displayError(res.error) + "\n");
  } else if (!isUndefinedResult(res.value)) {
    process.stdout.write(
      displayValue(res.value) + " " + displayDuration(res.duration) + "\n",
    );
  }
}
