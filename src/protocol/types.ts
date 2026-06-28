export interface EvalRequest {
  id: string;
  code: string;
  timeout?: number;
}

export interface EvalResponse {
  id: string;
  type: "result" | "error";
  value: unknown;
  duration: number;
  error: { name: string; message: string; stack?: string } | null;
}

export interface LogStream {
  id: string;
  type: "log";
  level: "log" | "error" | "warn" | "info";
  args: string[];
}

export interface ReadyMessage {
  type: "appwire:ready";
}

export interface StatusMessage {
  type: "appwire:status";
  text: string;
}

export type ChildMessage = EvalResponse | LogStream | ReadyMessage | StatusMessage;
export type ParentMessage = EvalRequest;

export function isUndefinedResult(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).__type === "undefined"
  );
}
