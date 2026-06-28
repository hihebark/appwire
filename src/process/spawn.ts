import { fork } from "child_process";
import type { ChildProcess } from "child_process";

export interface SpawnOptions {
  entry: string;
  bootstrapPath: string;
  runtimeLoader: string | null;
  cwd: string;
  env?: NodeJS.ProcessEnv;
}

export function spawnApp({
  entry,
  bootstrapPath,
  runtimeLoader,
  cwd,
  env,
}: SpawnOptions): ChildProcess {
  const execArgv: string[] = [];

  if (runtimeLoader) {
    execArgv.push("--require", runtimeLoader);
  }
  execArgv.push("--require", bootstrapPath);

  return fork(entry, [], {
    cwd,
    env: { ...process.env, ...env },
    execArgv,
    // inherit stdio so app output goes directly to terminal; 'ipc' opens the message channel
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  });
}
