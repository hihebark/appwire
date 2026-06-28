import type { ChildProcess } from "child_process";
import type {
  ChildMessage,
  ParentMessage,
} from "../protocol/types.js";

export interface IPCChannel {
  send(msg: ParentMessage): void;
  onMessage(handler: (msg: ChildMessage) => void): void;
  onReady(handler: () => void): void;
  onStatus(handler: (text: string) => void): void;
  onExit(handler: (code: number | null) => void): void;
}

export function createIPCChannel(child: ChildProcess): IPCChannel {
  const messageHandlers: Array<(msg: ChildMessage) => void> = [];
  const readyHandlers: Array<() => void> = [];
  const statusHandlers: Array<(text: string) => void> = [];
  const exitHandlers: Array<(code: number | null) => void> = [];

  const onChildMessage = (msg: unknown) => {
    const m = msg as ChildMessage;
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

  const onChildExit = (code: number | null) => {
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
    },
  };
}
