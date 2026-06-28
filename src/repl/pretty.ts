import { inspect } from "util";

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
};

export { c as colors };

export function prompt(mode: string): string {
  return `${c.cyan}appwire${c.reset}${c.dim}(${mode})${c.reset} ${c.bold}>${c.reset} `;
}

export function displayValue(value: unknown): string {
  if (value === null) return c.dim + "null" + c.reset;

  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>;
    if (v.__type === "undefined") return c.dim + "undefined" + c.reset;
    if (v.__type === "function")
      return c.cyan + `[Function: ${v.name}]` + c.reset;
    if (v.__type === "bigint") return c.yellow + `${v.value}n` + c.reset;
    if (v.__type === "symbol")
      return c.green + `Symbol(${v.description ?? ""})` + c.reset;
    if (v.__type === "error") return c.red + `[Error: ${v.message}]` + c.reset;
  }

  return inspect(value, { depth: 2, colors: true, compact: false });
}

export function displayError(err: {
  name: string;
  message: string;
  stack?: string;
}): string {
  const head = `${c.bold}${c.red}${err.name}: ${err.message}${c.reset}`;
  if (!err.stack) return head;
  const stackLines = err.stack
    .split("\n")
    .slice(1) // skip the "Error: message" first line (already shown)
    .filter(Boolean)
    .map((l) => `  ${c.dim}${l.trim()}${c.reset}`)
    .join("\n");
  return stackLines ? `${head}\n${stackLines}` : head;
}

export function displayLog(level: string, args: string[]): string {
  const prefix = level === "error" ? c.red + "›" : c.dim + "›";
  return `${prefix} ${args.join(" ")}${c.reset}`;
}

export function displayDuration(ms: number): string {
  const s = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
  return `${c.dim}(${s})${c.reset}`;
}
