import type { Interface } from "readline";
import { colors } from "./pretty.js";

/**
 * Enter multi-line editor mode.
 * Ctrl+D submits; Ctrl+C cancels.
 * Safe to use readline 'close' here because the caller removes the outer 'close'
 * handler before calling this function, so only this handler fires on Ctrl+D.
 * Returns { code } on Ctrl+D submit, or null on Ctrl+C cancel.
 */
export function enterEditorMode(
  rl: Interface,
): Promise<{ code: string } | null> {
  return new Promise((resolve) => {
    process.stdout.write(
      `${colors.dim}// Entering editor mode (Ctrl+D to run, Ctrl+C to cancel)${colors.reset}\n`,
    );

    const lines: string[] = [];

    const origPrompt = rl.getPrompt();
    rl.setPrompt(`${colors.dim}...${colors.reset} `);
    rl.prompt();

    function onLine(line: string) {
      lines.push(line);
      rl.prompt();
    }

    function onClose() {
      cleanup();
      resolve({ code: lines.join("\n") });
    }

    function onSigInt() {
      cleanup();
      resolve(null);
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
