import { fork } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bootstrapPath = resolve(__dirname, "../dist/bootstrap.cjs");
const fakeApp = resolve(__dirname, "fake-app.js");

const child = fork(fakeApp, [], {
  execArgv: ["--require", bootstrapPath],
  stdio: ["inherit", "inherit", "inherit", "ipc"],
  env: { ...process.env, NODE_ENV: "development" },
});

let gotReady = false;
let gotAck = false;

child.on("message", (msg) => {
  if (msg.type === "appwire:ready" && !gotReady) {
    gotReady = true;
    console.log("PASS: received appwire:ready");
    child.send({ id: "test-1", code: "1+1" });
  }
  if (
    msg.id === "test-1" &&
    (msg.type === "result" || msg.type === "ack") &&
    !gotAck
  ) {
    gotAck = true;
    console.log("PASS: received ACK for eval request");
    child.kill();
    process.exit(0);
  }
});

child.on("error", (err) => {
  console.error("FAIL: child error", err.message);
  process.exit(1);
});

setTimeout(() => {
  console.error("FAIL: timeout — did not receive expected messages");
  child.kill();
  process.exit(1);
}, 5000);
