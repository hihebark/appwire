---
title: MCP server
description: Use appwire as an MCP server so Claude Code, Cursor, Zed, and Cline can evaluate code in your running app.
---

The `appwire-mcp` binary exposes Appwire as a [Model Context Protocol](https://modelcontextprotocol.io) server. Claude Code, Cursor, Zed, and Cline can evaluate expressions, list services, and read live state from inside your app.

`appwire-mcp` spawns your app the same way `appwire` does. No separate server or adapter needed.

## Setup

### Claude Code

Add to `.claude/settings.json` in your project:

```json
{
  "mcpServers": {
    "appwire": {
      "command": "appwire-mcp"
    }
  }
}
```

### Cursor / other clients

Add to your editor's MCP config (`.cursor/mcp.json`, `mcp.json`, etc.):

```json
{
  "mcpServers": {
    "appwire": {
      "command": "appwire-mcp"
    }
  }
}
```

## Configuration

| Env var      | Description                                    |
| ------------ | ---------------------------------------------- |
| `APPWIRE_ENTRY` | Entry point path (auto-detected if omitted)    |

If `APPWIRE_ENTRY` is not set, `appwire-mcp` detects the entry point from `package.json` in the current directory, using the same logic as `appwire`.

```bash
APPWIRE_ENTRY=src/main.ts appwire-mcp
```

## Available tools

### `evaluate`

Runs JavaScript in the app's VM context. Has access to `$app`, `$env`, `$fetch`, `require`, and any context set by the adapter.

```
evaluate({ code: "await $app.get(UserService).findAll()" })
```

Console output (`console.log`, etc.) is captured and prepended to the result.

| Argument  | Type     | Default  | Description            |
| --------- | -------- | -------- | ---------------------- |
| `code`    | `string` | required | Expression to evaluate |
| `timeout` | `number` | `10000`  | Timeout in ms          |

### `list_services`

Returns all injectable tokens registered in the DI container.

```
list_services()
→ UserService, AuthService, PrismaService, ...
```

### `ping`

Checks whether the agent is reachable. Returns `pong` or `unreachable`.

## Security

The agent only activates under `APPWIRE=1`. `appwire-mcp` sets this automatically when it spawns your app.
