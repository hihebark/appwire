import { fork } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bootstrapPath = resolve(__dirname, "../dist/bootstrap.cjs");
const fakeApp = resolve(__dirname, "fake-app.js");

function runTest(label, code, check) {
  return new Promise((res) => {
    const child = fork(fakeApp, [], {
      execArgv: ["--require", bootstrapPath],
      stdio: ["inherit", "inherit", "inherit", "ipc"],
      env: { ...process.env, NODE_ENV: "development" },
    });

    const logs = [];
    let done = false;

    child.on("message", (msg) => {
      if (msg.type === "appwire:ready") {
        child.send({ id: "e1", code });
        return;
      }
      if (msg.type === "log") {
        logs.push(msg);
        return;
      }
      if ((msg.type === "result" || msg.type === "error") && !done) {
        done = true;
        child.kill();
        const result = check(msg, logs);
        if (result === true) {
          console.log(`  PASS: ${label}`);
          res(true);
        } else {
          console.error(`  FAIL: ${label} — ${result}`);
          console.error("       msg:", JSON.stringify(msg));
          res(false);
        }
      }
    });

    setTimeout(() => {
      if (!done) {
        done = true;
        child.kill();
        console.error(`  FAIL: ${label} — timeout`);
        res(false);
      }
    }, 5000);
  });
}

const tests = [
  [
    "primitive: number",
    "1 + 1",
    (m) =>
      (m.type === "result" && m.value === 2) || `expected 2, got ${m.value}`,
  ],

  [
    "primitive: string",
    '"hello"',
    (m) =>
      (m.type === "result" && m.value === "hello") ||
      `expected "hello", got ${m.value}`,
  ],

  [
    "primitive: null",
    "null",
    (m) =>
      (m.type === "result" && m.value === null) ||
      `expected null, got ${m.value}`,
  ],

  [
    "undefined returns __type",
    "undefined",
    (m) =>
      (m.type === "result" && m.value?.__type === "undefined") ||
      `expected {__type:"undefined"}, got ${JSON.stringify(m.value)}`,
  ],

  [
    "top-level await",
    "await Promise.resolve(42)",
    (m) =>
      (m.type === "result" && m.value === 42) || `expected 42, got ${m.value}`,
  ],

  [
    "object",
    "({ x: 1, y: 2 })",
    (m) =>
      (m.type === "result" && m.value?.x === 1 && m.value?.y === 2) ||
      `expected {x:1,y:2}, got ${JSON.stringify(m.value)}`,
  ],

  [
    "circular ref",
    "const o = {}\no.self = o\no",
    (m) =>
      (m.type === "result" && m.value?.self === "[Circular]") ||
      `expected circular ref, got ${JSON.stringify(m.value)}`,
  ],

  [
    "thrown error",
    'throw new Error("boom")',
    (m) =>
      (m.type === "error" && m.error?.message === "boom") ||
      `expected error "boom", got ${JSON.stringify(m.error)}`,
  ],

  [
    "syntax error caught",
    "{{{{invalid",
    (m) =>
      (m.type === "error" && m.error?.name === "SyntaxError") ||
      `expected SyntaxError, got ${JSON.stringify(m.error)}`,
  ],

  [
    "rejected promise",
    'await Promise.reject(new Error("async fail"))',
    (m) =>
      (m.type === "error" && m.error?.message === "async fail") ||
      `expected "async fail", got ${JSON.stringify(m.error)}`,
  ],

  [
    "console.log streamed",
    'console.log("hi from appwire")\n99',
    (m, logs) => {
      if (logs.length === 0) return "expected a log message";
      if (logs[0].args[0] !== "hi from appwire")
        return `expected "hi from appwire", got ${logs[0].args[0]}`;
      if (m.value !== 99) return `expected return 99, got ${m.value}`;
      return true;
    },
  ],

  [
    "$env available",
    "$env.NODE_ENV",
    (m) =>
      (m.type === "result" && m.value === "development") ||
      `expected "development", got ${m.value}`,
  ],

  [
    "duration tracked",
    "1",
    (m) =>
      (m.type === "result" &&
        typeof m.duration === "number" &&
        m.duration >= 0) ||
      `expected duration number, got ${m.duration}`,
  ],

  [
    "function serialized",
    "() => {}",
    (m) =>
      (m.type === "result" && m.value?.__type === "function") ||
      `expected {__type:"function"}, got ${JSON.stringify(m.value)}`,
  ],

  [
    "timeout",
    "await new Promise(r => setTimeout(r, 99999))",
    (m) =>
      (m.type === "error" && /timed out/i.test(m.error?.message ?? "")) ||
      `expected timeout error, got ${JSON.stringify(m.error)}`,
    100,
  ],
];

let passed = 0,
  failed = 0;

// Timeout test uses a short timeout — send it with timeout: 100
async function runAll() {
  for (const [label, code, check, timeoutMs] of tests) {
    const ok = await runTest(
      label,
      timeoutMs ? `${code}` : code,
      check,
      timeoutMs,
    );
    if (ok) passed++;
    else failed++;
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Override runTest for timeout test to pass custom timeout
async function runTestWithTimeout(label, code, check, evalTimeoutMs) {
  return new Promise((res) => {
    const child = fork(fakeApp, [], {
      execArgv: ["--require", bootstrapPath],
      stdio: ["inherit", "inherit", "inherit", "ipc"],
      env: { ...process.env, NODE_ENV: "development" },
    });
    let done = false;
    child.on("message", (msg) => {
      if (msg.type === "appwire:ready") {
        child.send({ id: "e1", code, timeout: evalTimeoutMs });
        return;
      }
      if ((msg.type === "result" || msg.type === "error") && !done) {
        done = true;
        child.kill();
        const result = check(msg, []);
        if (result === true) {
          console.log(`  PASS: ${label}`);
          res(true);
        } else {
          console.error(`  FAIL: ${label} — ${result}`);
          res(false);
        }
      }
    });
    setTimeout(() => {
      if (!done) {
        done = true;
        child.kill();
        console.error(`  FAIL: ${label} — outer timeout`);
        res(false);
      }
    }, 5000);
  });
}

async function main() {
  console.log("\nPhase 2 evaluation tests:");
  for (const entry of tests) {
    const [label, code, check, evalTimeoutMs] = entry;
    let ok;
    if (evalTimeoutMs) {
      ok = await runTestWithTimeout(label, code, check, evalTimeoutMs);
    } else {
      ok = await runTest(label, code, check);
    }
    if (ok) passed++;
    else failed++;
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
