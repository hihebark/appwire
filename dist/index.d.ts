interface EvalRequest {
    id: string;
    code: string;
    timeout?: number;
}
interface EvalResponse {
    id: string;
    type: "result" | "error";
    value: unknown;
    duration: number;
    error: {
        name: string;
        message: string;
        stack?: string;
    } | null;
}
interface LogStream {
    id: string;
    type: "log";
    level: "log" | "error" | "warn" | "info";
    args: string[];
}
interface ReadyMessage {
    type: "appwire:ready";
}
interface StatusMessage {
    type: "appwire:status";
    text: string;
}
type ChildMessage = EvalResponse | LogStream | ReadyMessage | StatusMessage;
type ParentMessage = EvalRequest;

interface AppwireAgentOptions {
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
declare function startAppwireAgent(options: AppwireAgentOptions): void;

export { type AppwireAgentOptions, type ChildMessage, type EvalRequest, type EvalResponse, type LogStream, type ParentMessage, type ReadyMessage, startAppwireAgent };
