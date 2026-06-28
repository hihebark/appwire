import type { EvalResponse, LogStream } from "../protocol/types.js";

export type LogHandler = (msg: LogStream) => void;

export interface AppwireTransport {
  mode: "ipc";
  evaluate(
    code: string,
    timeout: number,
    onLog: LogHandler,
  ): Promise<EvalResponse>;
  getServices(): Promise<string[]>;
  ping(): Promise<boolean>;
  disconnect(): void;
  onDisconnect(handler: () => void): void;
  onStatus?: (handler: (text: string) => void) => void;
}

export async function evalGetServices(t: AppwireTransport): Promise<string[]> {
  const res = await t.evaluate("JSON.stringify(__appwireGetServices())", 5000, () => {});
  if (res.type === "result" && typeof res.value === "string") {
    try {
      return JSON.parse(res.value) as string[];
    } catch {
      return [];
    }
  }
  return [];
}
