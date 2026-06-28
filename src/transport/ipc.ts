import type { IPCChannel } from "../channel/ipc.js";
import type { EvalResponse, LogStream } from "../protocol/types.js";
import {
  evalGetServices,
  type AppwireTransport,
  type LogHandler,
} from "./types.js";

export function createIPCTransport(channel: IPCChannel): AppwireTransport {
  const disconnectHandlers = new Set<() => void>();
  const pending = new Map<
    string,
    {
      resolve: (r: EvalResponse) => void;
      reject: (e: Error) => void;
      onLog: LogHandler;
    }
  >();
  let seq = 0;
  let disconnected = false;

  function fireDisconnect(reason: string) {
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
      pending.get((msg as LogStream).id)?.onLog(msg as LogStream);
    } else if (msg.type === "result" || msg.type === "error") {
      const r = msg as EvalResponse;
      const p = pending.get(r.id);
      if (p) {
        pending.delete(r.id);
        p.resolve(r);
      }
    }
  });

  channel.onExit(() => { fireDisconnect("App process exited"); });

  const transport: AppwireTransport = {
    mode: "ipc",

    evaluate(code, timeout, onLog) {
      const id = `ipc-${++seq}`;
      return new Promise<EvalResponse>((resolve, reject) => {
        // Client-side fallback — bootstrap enforces its own timeout and should
        // respond with an error first; this fires only if the app is unresponsive.
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`IPC eval timed out after ${timeout}ms`));
        }, timeout + 5_000);
        pending.set(id, {
          resolve(r) {
            clearTimeout(timer);
            resolve(r);
          },
          reject(e) {
            clearTimeout(timer);
            reject(e);
          },
          onLog,
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
      let timerId: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timerId = setTimeout(() => reject(new Error("ping timeout")), 2500);
      });
      const evalPromise = new Promise<EvalResponse>((resolve, reject) => {
        pending.set(id, { resolve, reject, onLog: () => {} });
        channel.send({ id, code: "true", timeout: 2000 });
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
    },
  };

  return transport;
}
