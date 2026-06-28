---
title: IPC mode
description: Start your app with the appwire agent injected and connect over IPC. Zero code changes needed.
---

IPC mode starts your app with the appwire agent injected via `--require`, then opens a REPL connected over IPC.

## Usage

```bash
appwire
appwire --entry src/main.ts        # override entry point
appwire --entry apps/backend/      # point to a directory
```

## `.appwirerc`

Add a `.appwirerc` file to your project root to persist the entry point:

```json
{ "entry": "src/main.ts" }
```

Appwire reads it automatically so you don't need `--entry` every run.

## Entry detection

When `--entry` is omitted and no `.appwirerc` exists, Appwire reads `package.json` in this order:

1. `main` field
2. `scripts.start` — parses the command for the entry file
3. `scripts.dev` — same
4. Falls back to `src/main.ts` and `dist/main.js`

## TypeScript

If the entry is a `.ts` file, Appwire detects your TypeScript runtime from `devDependencies` and wraps accordingly. Supported: `tsx`, `ts-node`, `ts-node-esm`.

## Session output

```
appwire: detected entry src/main.ts (from scripts.start)
appwire: using tsx for TypeScript
appwire: starting src/main.ts ...
appwire(ipc:main.ts) > appwire: app ready (42 services)

appwire(ipc:main.ts) > $env.NODE_ENV
'development' (0ms)
```

## Auto-reconnect

If the app crashes, Appwire restarts it and reconnects:

```
appwire: disconnected
appwire: reconnecting...
appwire: restarting src/main.ts ...
appwire: reconnected
```

Use `.reload` from the REPL to manually restart:

```
appwire(ipc:main.ts) > .reload
reloaded
```
