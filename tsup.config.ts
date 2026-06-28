import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { cli: "src/cli/index.ts", mcp: "src/mcp.ts" },
    format: ["cjs"],
    target: "node18",
    outDir: "dist",
    banner: { js: "#!/usr/bin/env node" },
    clean: true,
    sourcemap: true,
    shims: true,
    outExtension: () => ({ js: ".cjs" }),
  },
  {
    entry: { bootstrap: "src/bootstrap.ts" },
    format: ["cjs"],
    target: "node18",
    outDir: "dist",
    bundle: true,
    noExternal: [/.*/],
    sourcemap: false,
    minify: false,
    outExtension: () => ({ js: ".cjs" }),
  },
  {
    entry: { index: "src/index.ts" },
    format: ["cjs", "esm"],
    target: "node18",
    outDir: "dist",
    dts: true,
    sourcemap: true,
    outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".mjs" }),
  },
]);
