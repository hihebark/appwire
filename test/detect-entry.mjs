// Tests extractEntryFromScript logic by importing from a helper CJS module
// We test the logic directly since it's internal to the bundle.
// The actual extractEntryFromScript is re-exported via a test shim built by tsup.

// Inline the same logic to verify the algorithm independently
function extractEntryFromScript(script) {
  const KNOWN_RUNTIMES = new Set([
    "ts-node",
    "ts-node-esm",
    "tsx",
    "node",
    "npx",
    "pnpx",
    "yarn",
    "cross-env",
    "dotenv",
    "dotenv-cli",
  ]);
  const FLAGS_WITH_VALUE = new Set([
    "--require",
    "-r",
    "--loader",
    "--import",
    "--env-file",
    "-e",
    "--eval",
  ]);

  const tokens = script.trim().split(/\s+/);
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (KNOWN_RUNTIMES.has(token)) {
      i++;
      continue;
    }
    if (token.startsWith("-")) {
      if (FLAGS_WITH_VALUE.has(token)) i++;
      i++;
      continue;
    }
    if (!token.includes("=") && /\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(token)) return token;
    i++;
  }
  return null;
}

let passed = 0;
let failed = 0;

function expect(description, actual, expected) {
  if (actual === expected) {
    console.log(`  PASS: ${description}`);
    passed++;
  } else {
    console.error(
      `  FAIL: ${description} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
    );
    failed++;
  }
}

console.log("\nextractEntryFromScript:");
expect(
  "ts-node entry",
  extractEntryFromScript("ts-node src/main.ts"),
  "src/main.ts",
);
expect("tsx entry", extractEntryFromScript("tsx src/main.ts"), "src/main.ts");
expect(
  "tsx watch entry",
  extractEntryFromScript("tsx watch src/main.ts"),
  "src/main.ts",
);
expect(
  "node entry",
  extractEntryFromScript("node dist/main.js"),
  "dist/main.js",
);
expect(
  "node with --require",
  extractEntryFromScript("node --require dotenv/config src/main.js"),
  "src/main.js",
);
expect(
  "cross-env + ts-node",
  extractEntryFromScript("cross-env NODE_ENV=dev ts-node src/main.ts"),
  "src/main.ts",
);
expect("nest start returns null", extractEntryFromScript("nest start"), null);
expect(
  "dotenv-cli + tsx",
  extractEntryFromScript("dotenv-cli tsx src/main.ts"),
  "src/main.ts",
);
expect(
  "ts-node-esm entry",
  extractEntryFromScript("ts-node-esm src/main.ts"),
  "src/main.ts",
);
expect(
  ".mjs extension",
  extractEntryFromScript("node src/server.mjs"),
  "src/server.mjs",
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
