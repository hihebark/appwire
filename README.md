# Appwire

Live REPL for Node.js — evaluate code inside your running process without restarting.

```
appwire(ipc:main.ts) > $users = await $app.get(UserService).findAll()
[{ id: 1, email: 'alice@example.com' }, ...]  18ms

appwire(ipc:main.ts) > $users[0].email
'alice@example.com'  0ms

appwire(ipc:main.ts) > .timeit 20 await $app.get(PrismaService).user.count()
42
  runs: 20  avg: 4ms  min: 3ms  max: 8ms

appwire(ipc:main.ts) > .doc $app.get(AuthService)
  AuthService
  Methods:
    login(dto)
    logout(userId)
    validateToken(token)
  Properties:
    jwtService
    usersService
```

## Install

```bash
npm install -g appwire
```

## Usage

```bash
cd your-project
appwire                          # entry auto-detected from package.json
appwire --entry src/main.ts      # explicit entry
appwire --entry apps/backend/    # directory — entry detected inside
```

Persist the entry with `.appwirerc` in your project root:

```json
{ "entry": "src/main.ts" }
```

## Framework Adapters

Optional. Wire your DI container into `$app`.

**NestJS** — no import needed. The bootstrap intercepts `NestFactory.create` and wires `$app` to the DI container automatically.

**Plain Node**

```typescript
import { startAppwireAgent } from 'appwire'

startAppwireAgent({ context: { db, config, redis } })
```

## REPL Commands

| Command              | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `.timeit [N] <expr>` | Time expression. N runs shows avg/min/max.               |
| `.doc <expr>`        | Inspect constructor name, methods, and properties.       |
| `.services`          | List DI services / context keys.                         |
| `.vars`              | List session variables assigned with `$name = expr`.     |
| `.reload`            | Restart the app and reconnect.                           |
| `.editor`            | Multi-line mode — `Ctrl+D` to run, `Ctrl+C` to cancel.  |
| `.history`           | Show last 20 entries.                                    |
| `.exit`              | Quit.                                                    |

## Eval Context

| Variable  | Description                                              |
| --------- | -------------------------------------------------------- |
| `$app`    | DI container (NestJS) or context object (plain Node)     |
| `$env`    | `process.env`                                            |
| `$fetch`  | Global `fetch` (Node.js 18+)                             |
| `$reload` | Evict a module from `require.cache` and re-require it    |
| `require` | CJS require resolved from the app's working directory    |

`$`-prefixed variables assigned during a session persist across evals and tab-complete automatically. Use `.vars` to list them.

## MCP server

`appwire-mcp` exposes Appwire as an MCP server so Claude Code, Cursor, Zed, and Cline can evaluate code in your running app.

```bash
appwire-mcp
APPWIRE_ENTRY=src/main.ts appwire-mcp
```

Tools: `evaluate`, `list_services`, `ping`.

## How it works

```
appwire
  └── reads package.json → detects entry → spawns app
        └── app starts with --require bootstrap.cjs
              ├── VM context: $app, $env, $fetch, $reload, require
              ├── console.* intercepted → streamed to REPL
              └── IPC channel open → waiting for eval requests

appwire REPL
  └── readline → sends { id, code, timeout }
        └── bootstrap evaluates in VM context
              └── returns { id, type, value, duration }
```

Bootstrap is a self-contained CJS bundle — no external deps, safe to `--require` into any Node process.

## Security

- `APPWIRE=1` gates the IPC channel. `appwire` sets it on spawn; your normal process never has it.
- IPC channel is process-local — only the parent `appwire` process can send messages.

## License

MIT
