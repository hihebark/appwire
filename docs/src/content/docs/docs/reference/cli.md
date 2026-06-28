---
title: CLI Reference
description: All appwire CLI commands, REPL dot-commands, eval context variables, and session variables.
---

## `appwire`

Start your app with the agent injected via `--require` and open an IPC REPL.

```bash
appwire
appwire --entry src/main.ts
appwire --entry apps/backend/
appwire --version
```

| Flag             | Description                                                       |
| ---------------- | ----------------------------------------------------------------- |
| `--entry <path>` | Entry point file or directory (auto-detected from `package.json`) |
| `--version`      | Print version and exit                                            |

---

## `appwire-mcp`

Start Appwire as a [Model Context Protocol](https://modelcontextprotocol.io) server. Spawns your app the same way `appwire` does and exposes three tools to any MCP client.

```bash
appwire-mcp
APPWIRE_ENTRY=src/main.ts appwire-mcp
```

| Env var      | Description                                    |
| ------------ | ---------------------------------------------- |
| `APPWIRE_ENTRY` | Entry point path (auto-detected if omitted)    |

See [MCP server](/docs/guides/mcp/) for client configuration.

---

## REPL dot-commands

Available from inside any `appwire` session.

| Command              | Description                                                   |
| -------------------- | ------------------------------------------------------------- |
| `.timeit [N] <expr>` | Time an expression. N runs shows avg/min/max. Default: 1.    |
| `.doc <expr>`        | Inspect class name, methods, and properties of a value.       |
| `.services`          | List services / context keys available in the current session |
| `.vars`              | List session variables assigned with `$name = expr`           |
| `.reload`            | Restart the app process and reconnect                         |
| `.editor`            | Enter multi-line block mode (Ctrl+D to run, Ctrl+C to cancel) |
| `.history`           | Show the last 20 REPL entries                                 |
| `.clear`             | Clear the terminal                                            |
| `.help`              | Show available commands                                       |
| `.exit`              | Quit                                                          |

### `.timeit [N] <expr>`

Time any expression. With N=1 (default) shows a single `time:` line. With N>1 shows aggregate stats.

```
appwire > .timeit await $app.get(UserService).findAll()
[{ id: 1, ... }]
  time: 14ms

appwire > .timeit 100 $app.get(CacheService).get('session:abc')
{ userId: 42, ... }
  runs: 100  avg: 1ms  min: 0ms  max: 3ms
```

### `.doc <expr>`

Introspect any value: constructor name, prototype methods with parameter signatures, own enumerable properties.

```
appwire > .doc $app.get(UserService)
  UserService
  Methods:
    findAll()
    findById(id)
    create(dto)
    update(id, dto)
    remove(id)
  Properties:
    prisma
    logger
```

### `.vars`

List all session variables assigned with `$name = expr` in the current session.

```
appwire > .vars
  $users
  $svc
```

### `.editor`

Enter multi-line block mode. Type or paste multiple lines, then `Ctrl+D` to run or `Ctrl+C` to cancel.

```
appwire > .editor
// Entering editor mode. Ctrl+D to run, Ctrl+C to cancel.
const users = await $app.get(UserService).findAll()
for (const u of users) {
  console.log(u.email)
}
^D
alice@example.com
bob@example.com
undefined  42ms
```

---

## Eval context variables

Always available in REPL expressions.

| Variable  | Description                                                           |
| --------- | --------------------------------------------------------------------- |
| `$app`    | Framework DI container (NestJS) or context object (plain Node)        |
| `$env`    | `process.env`                                                         |
| `$fetch`  | Global `fetch` (Node.js 18+)                                          |
| `$reload` | Evict a module from `require.cache` and re-require it                 |
| `require` | CommonJS require, resolved from the app's working directory           |

---

## Session variables

Assign any result to a `$`-prefixed variable to keep it for the rest of the session:

```
appwire > $users = await $app.get(UserService).findAll()
[{ id: 1, email: 'alice@example.com' }, ...]  18ms

appwire > $users[0].email
'alice@example.com'  0ms

appwire > $svc = $app.get(UserService)
UserService {}  0ms

appwire > $svc.findById(1)
{ id: 1, email: 'alice@example.com' }  4ms
```

- Variables survive across multiple evals in the same session.
- Tab completion includes them alongside `$app`, `$env`, etc.
- `.vars` lists all variables set so far.
