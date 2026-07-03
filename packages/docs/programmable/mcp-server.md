---
title: MCP Server
description: Connect AI coding tools to OpenPencil for design inspection and editing via Model Context Protocol.
---

# MCP Server

OpenPencil ships an MCP server that lets AI coding tools — Claude Code, Cursor, Windsurf, etc. — read and modify designs in the running app. Two binaries:

- **`openpencil-mcp`** — stdio transport for MCP clients
- **`openpencil-mcp-http`** — HTTP + WebSocket server for browsers, scripts, and the app's internal bridge

## Prerequisites

Before connecting any client, make sure:

1. The OpenPencil desktop app is running **with a document open**. The MCP server is useless without an app connection — it's a bridge, not a renderer.
2. The MCP package version matches the app version. The `/health` endpoint reports versions so clients can detect mismatches.

The MCP server starts automatically when you launch the desktop app (Tauri production builds spawn `openpencil-mcp-http`; dev mode uses a Vite plugin). You can also run it standalone.

## Architecture

```text
  MCP Client          MCP Server              OpenPencil App
  (Claude Code,       (openpencil-mcp-http)   (desktop / browser)
   Cursor, etc.)
                      ┌──────────────┐
  stdio ◄───────────► │  /rpc (HTTP) │ ◄──── JSON-RPC ─────► Stdio bridge
                      │              │
                      │  /    (WS)   │ ◄──── WebSocket ────► Browser tab
  (openpencil-mcp)    │              │
                      │  /mcp (HTTP) │ ◄── Streamable HTTP ──► External tools
                      │              │
                      │  /health     │
                      └──────┬───────┘
                             │
                    socket or TCP (127.0.0.1)
```

The stdio bridge (`openpencil-mcp`) connects to the HTTP server over a Unix domain socket (on macOS/Linux) or via the HTTP port from the discovery file (`httpPort`, on Windows or socket-disabled setups). It does **not** speak MCP directly to the app — it tunnels MCP tool calls through HTTP to the server, which relays them to the running app via WebSocket.

## How It Connects

The server writes a **discovery file** on startup. The stdio bridge reads this file to find the server. No manual configuration needed.

### Discovery file location

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/OpenPencil/mcp.json` |
| Linux | `$XDG_RUNTIME_DIR/openpencil/mcp.json` (fallback: `~/.openpencil/mcp.json`) |
| Windows | `%LOCALAPPDATA%\OpenPencil\mcp.json` |

`OPENPENCIL_MCP_SOCKET` overrides only the socket path — the discovery file stays at the platform path above unless `OPENPENCIL_MCP_DISCOVERY_PATH` is set.

### What's in the discovery file

```json
{
  "pid": 12345,
  "socketPath": "~/Library/Application Support/OpenPencil/mcp.sock",
  "httpPort": 7600,
  "authRequired": true,
  "authToken": "<redacted-auth-token>",
  "version": "0.13.2",
  "startedAt": "2026-06-01T12:00:00.000Z"
}
```

The discovery file is written with `0o600` permissions (owner read/write only). This prevents other OS users from reading the auth token, but any process running as **your user** can read it. That's why the socket is preferred over TCP — socket file permissions provide an additional access boundary on Unix.

### Transport selection

| Platform | Primary | Fallback |
|----------|---------|----------|
| macOS / Linux | Unix domain socket | TCP on `127.0.0.1:7600` |
| Windows | TCP on `127.0.0.1:7600` | — |

The stdio bridge prefers the socket. If the server was started with TCP only (no socket), the bridge falls back to `httpPort` from the discovery file.

## Install

```sh
npm install -g @open-pencil/mcp
```

## Stdio (Claude Code, Cursor, etc.)

The stdio bridge auto-discovers the running MCP server via the discovery file. No socket path or port configuration needed — just make sure the app is open.

### Claude Code

```sh
npm install -g @open-pencil/mcp
claude mcp add --scope user open-pencil -- openpencil-mcp
```

Verify:

```sh
claude mcp list
```

Claude Code asks before using each MCP tool. To auto-approve OpenPencil tools, add to `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["mcp__open-pencil__*"]
  }
}
```

Example prompt:

```text
Use the open-pencil MCP server to inspect the current page and create a small hero section on the canvas.
```

### Other MCP clients

Add to your MCP config (e.g. `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "open-pencil": {
      "command": "openpencil-mcp"
    }
  }
}
```

Run from source without installing:

::: code-group

```json [Bun]
{
  "mcpServers": {
    "open-pencil": {
      "command": "bun",
      "args": ["/path/to/open-pencil/packages/mcp/src/stdio.ts"]
    }
  }
}
```
```json [Node.js]
{
  "mcpServers": {
    "open-pencil": {
      "command": "npx",
      "args": ["tsx", "/path/to/open-pencil/packages/mcp/src/stdio.ts"]
    }
  }
}
```
:::

## HTTP

For browser extensions, scripts, CI, or any HTTP client:

```sh
openpencil-mcp-http
```

Or from source: `bun packages/mcp/src/index.ts` / `npx tsx packages/mcp/src/index.ts`

### Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Server status, version, install command, discovery path |
| `/rpc` | POST | Bearer token | JSON-RPC bridge to the running app |
| `/mcp` | POST, DELETE | Bearer token or `x-mcp-token` header | MCP Streamable HTTP. Sessions via `mcp-session-id` header. DELETE closes a session |

Note: The `/mcp` endpoint uses the Streamable HTTP transport only. The older SSE transport is not supported.

### Authentication

An auth token is **auto-generated on startup** (32-hex random from `crypto.randomBytes`). Clients must send it as `Authorization: Bearer <token>` for `/rpc` and `/mcp` endpoints. Token comparison uses constant-time comparison (`crypto.timingSafeEqual`) to prevent timing attacks.

| Scenario | Where the token comes from |
|----------|---------------------------|
| Stdio bridge (`openpencil-mcp`) | Reads `authToken` from the discovery file automatically |
| App-internal (Tauri/browser) | Reads discovery file via `/health` → `discoveryPath` |
| Custom HTTP client | Set `OPENPENCIL_MCP_AUTH_TOKEN` on both server and client, or read the discovery file |

To **disable** auth entirely (e.g. local development behind a firewall), set `OPENPENCIL_MCP_AUTH_TOKEN=""` before starting the server:

```sh
OPENPENCIL_MCP_AUTH_TOKEN="" openpencil-mcp-http
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7600` | TCP port. Set `0` to disable TCP (socket-only on macOS/Linux; disables all transport on Windows). ⚠️ **On Windows, `PORT=0` disables the only available transport, making the server unreachable.** |
| `OPENPENCIL_MCP_SOCKET` | Platform default | Override socket path (macOS/Linux only — Windows has no Unix socket support) |
| `OPENPENCIL_MCP_DISCOVERY_PATH` | Platform default | Override discovery file (`mcp.json`) location |
| `OPENPENCIL_MCP_TCP` | Deprecated | No effect — TCP is controlled by `PORT` (>0 = on, 0 = off) |
| `OPENPENCIL_MCP_AUTH_TOKEN` | Auto-generated | Server auth token. If unset, one is generated at startup. If set to an empty string (`""`), auth is disabled. |
| `OPENPENCIL_MCP_ROOT` | `cwd()` | Directory scope for `open_file`, `new_document`, and file-writing export tools. `save_file` is always available; path is validated against this directory when set |
| `OPENPENCIL_MCP_EVAL` | Disabled | Set `1` to enable the `eval` tool (stdio only, never HTTP) |
| `OPENPENCIL_MCP_CORS_ORIGIN` | Disabled | Allowed CORS origin for browser access |

### Security defaults

- Binds to `127.0.0.1` — not exposed to the network
- `eval` tool is disabled by default; only available over stdio, never HTTP
- File operations scoped to `OPENPENCIL_MCP_ROOT` — symlinks are resolved to prevent path traversal
- CORS is disabled by default
- Socket file permissions `0o600` on Unix — restricts access to your user
- Discovery file permissions `0o600` — same restriction

**Known limitation:** On Unix, there is a brief window between `listen()` and `chmod(0o600)` where the socket has default permissions. The auth token mitigates this — even if another process connects during the window, it still needs the token. No mitigation exists when auth is disabled (`OPENPENCIL_MCP_AUTH_TOKEN=""`) on shared machines.

## Troubleshooting

### "OpenPencil app is not connected"

The MCP server is running but no browser tab is connected to it. **Open the OpenPencil desktop app** (or navigate to the app URL in a browser) and make sure a document is loaded. The app connects to the server via WebSocket when it opens.

### "Port 7600 already in use"

Another OpenPencil instance (or another process) is using port 7600. Either:

- Close the other instance
- Set `PORT=7601` (or any free port) before starting
- Set `PORT=0` to disable TCP entirely and use socket-only transport

### "Stale socket" errors on macOS/Linux

If the app crashes without clean shutdown, the socket file may remain. The server cleans up stale sockets on startup (tests if the socket is live before removing). If cleanup fails:

```sh
rm ~/Library/Application\ Support/OpenPencil/mcp.sock
```

### Version mismatch

The `/health` endpoint returns the server's `version`. The app checks this on connection and warns if versions don't match. Fix by updating the global package:

```sh
npm install -g @open-pencil/mcp@latest
```

### Stdio bridge can't find the server

The bridge reads the discovery file to locate the server. If the discovery file is missing or stale (PID no longer alive):

1. Check the discovery file exists at the platform path above
2. If TCP is enabled (`PORT` is not `0`), verify the server is running: `curl http://127.0.0.1:${PORT:-7600}/health`
3. On Windows (TCP-only transport, no Unix socket support), verify the server's `httpPort` is reachable. Setting `PORT=0` on Windows disables the only available transport

## Workflow

1. **Open** — `open_file` to load an existing `.fig`, or `new_document` for a blank canvas
2. **Read** — `get_page_tree`, `find_nodes`, `get_node`, `list_pages`
3. **Create** — `create_shape`, `render` (JSX)
4. **Modify** — `set_fill`, `set_stroke`, `set_layout`, `update_node`, `set_effects`
5. **Structure** — `reparent_node`, `group_nodes`, `clone_node`, `delete_node`
6. **Save** — `save_file` to write back to `.fig`

## AI Agent Skill

Teach your AI coding agent to use OpenPencil tools:

```sh
npx skills add open-pencil/skills@open-pencil
```

Works with Claude Code, Cursor, Windsurf, Codex, and any agent that supports [skills](https://skills.sh). The skill covers the CLI, MCP tools, JSX rendering, eval, and the running app's automation bridge.

## Tools (90)

### Document

| Tool | Description |
|------|-------------|
| `open_file` | Open a `.fig` file for editing |
| `save_file` | Save the current document to a `.fig` file |
| `new_document` | Create a new empty document |

Note: `open_file`, `new_document`, and file-writing export tools are always available — their paths are scoped to `OPENPENCIL_MCP_ROOT`, which defaults to the current working directory (`cwd()`) when unset. `save_file` is always available; its path is validated against `OPENPENCIL_MCP_ROOT` only when the root is explicitly configured.

### Read

| Tool | Description |
|------|-------------|
| `get_selection` | Get currently selected nodes |
| `get_page_tree` | Get the full node tree of the current page |
| `get_current_page` | Get the current page name and ID |
| `get_node` | Get detailed properties of a node by ID |
| `find_nodes` | Find nodes by name pattern and/or type |
| `get_components` | List all components in the document |
| `list_pages` | List all pages |
| `list_variables` | List design variables |
| `list_collections` | List variable collections |
| `list_fonts` | List fonts used in the current page |
| `page_bounds` | Get bounding box of all objects on the current page |
| `node_bounds` | Get bounding box of a node |
| `node_ancestors` | Get ancestor chain of a node |
| `node_children` | Get direct children of a node |
| `node_tree` | Get the subtree rooted at a node |
| `node_bindings` | Get variable bindings on a node |

### Create

| Tool | Description |
|------|-------------|
| `create_shape` | Create a shape (`FRAME`, `RECTANGLE`, `ELLIPSE`, `TEXT`, `LINE`, `STAR`, `POLYGON`, `SECTION`) |
| `create_vector` | Create a vector node from a path string |
| `create_slice` | Create an export slice |
| `create_page` | Create a new page |
| `render` | Render JSX to design nodes — create entire component trees in one call |
| `create_component` | Convert a frame/group into a component |
| `create_instance` | Create an instance of a component |
| `node_to_component` | Convert an existing node into a component in-place |

### Modify

| Tool | Description |
|------|-------------|
| `set_fill` | Set fill color (hex) |
| `set_stroke` | Set stroke color, weight, alignment |
| `set_effects` | Add shadow or blur effects |
| `update_node` | Update position, size, opacity, corner radius, text, font |
| `set_layout` | Set auto-layout (flexbox) — direction, spacing, padding, alignment |
| `set_constraints` | Set resize constraints |
| `set_rotation` | Set rotation angle in degrees |
| `set_opacity` | Set opacity (0–1) |
| `set_radius` | Set corner radius (uniform or per-corner) |
| `set_minmax` | Set min/max width and height constraints |
| `set_text` | Set text content of a `TEXT` node |
| `set_font` | Set font family and weight |
| `set_font_range` | Set font properties on a character range |
| `set_text_resize` | Set text auto-resize mode (fixed/auto-width/auto-height) |
| `set_visible` | Show or hide a node |
| `set_blend` | Set blend mode |
| `set_locked` | Lock or unlock a node |
| `set_stroke_align` | Set stroke alignment (inside/center/outside) |
| `set_text_properties` | Set text layout: alignment, auto-resize, text case, decoration, truncation |
| `set_layout_child` | Configure auto-layout child: sizing, grow, alignment, absolute positioning |
| `node_move` | Move a node to a new position |
| `node_resize` | Resize a node |
| `node_replace_with` | Replace a node with another node |
| `arrange` | Align or distribute selected nodes |

### Structure

| Tool | Description |
|------|-------------|
| `delete_node` | Delete a node |
| `clone_node` | Duplicate a node |
| `rename_node` | Rename a node |
| `reparent_node` | Move a node into a different parent |
| `select_nodes` | Select nodes by ID |
| `group_nodes` | Group nodes |
| `ungroup_node` | Ungroup a group |
| `flatten_nodes` | Flatten nodes into a single vector |
| `boolean_union` | Boolean union of two or more nodes |
| `boolean_subtract` | Boolean subtraction |
| `boolean_intersect` | Boolean intersection |
| `boolean_exclude` | Boolean exclusion |

### Vector Path

| Tool | Description |
|------|-------------|
| `path_get` | Get the path data of a vector node |
| `path_set` | Set the path data of a vector node |
| `path_scale` | Scale a vector path |
| `path_flip` | Flip a vector path horizontally or vertically |
| `path_move` | Translate a vector path |

### Export

| Tool | Description |
|------|-------------|
| `export_image` | Export nodes as PNG, JPG, or WEBP. Returns base64-encoded image data |
| `export_svg` | Export nodes as SVG markup |

### Viewport

| Tool | Description |
|------|-------------|
| `viewport_get` | Get current viewport position and zoom level |
| `viewport_set` | Set viewport position and zoom |
| `viewport_zoom_to_fit` | Zoom viewport to fit specified nodes |

### Variables

| Tool | Description |
|------|-------------|
| `get_variable` | Get a variable by ID or name |
| `find_variables` | Find variables by name pattern or type |
| `create_variable` | Create a new variable in a collection |
| `set_variable` | Set a variable value in a mode |
| `delete_variable` | Delete a variable |
| `bind_variable` | Bind a variable to a node property |
| `get_collection` | Get a variable collection by ID or name |
| `create_collection` | Create a new variable collection |
| `delete_collection` | Delete a variable collection |

### Analyze

| Tool | Description |
|------|-------------|
| `analyze_colors` | Analyze color palette usage across the document |
| `analyze_typography` | Analyze font/size/weight distribution |
| `analyze_spacing` | Analyze gap and padding values |
| `analyze_clusters` | Detect repeated patterns (potential components) |

### Diff

| Tool | Description |
|------|-------------|
| `diff_create` | Create a snapshot of the current document state |
| `diff_show` | Show differences between the current state and a snapshot |

### Navigation

| Tool | Description |
|------|-------------|
| `switch_page` | Switch to a page by name or ID |

### Escape Hatch

| Tool | Description |
|------|-------------|
| `eval` | Execute JavaScript with full Figma Plugin API access |

Note: `eval` is available over stdio, but disabled in HTTP mode for security.
