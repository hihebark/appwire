export interface AppwireAgentOptions {
  /** Arbitrary values to inject into the REPL evaluation context */
  context: Record<string, unknown>;
}

/**
 * Zero-framework agent. Pass anything you want accessible in the REPL.
 *
 * Usage:
 *   import { startAppwireAgent } from 'appwire'
 *   startAppwireAgent({ context: { db, config, utils } })
 */
export function startAppwireAgent(options: AppwireAgentOptions): void {
  const g = global as Record<string, unknown>;
  if (!g.__appwire) return;

  for (const [key, value] of Object.entries(options.context)) {
    (g.__appwireSetContext as Function)(key, value);
  }

  (g.__appwireSetServicesProvider as Function)(() => Object.keys(options.context));
}
