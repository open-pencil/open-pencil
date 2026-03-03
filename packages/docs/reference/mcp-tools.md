# MCP Server

OpenPencil includes an MCP (Model Context Protocol) server that lets AI coding tools — Claude Code, Cursor, Windsurf, etc. — read and modify `.fig` files headlessly.

Two transports: **stdio** for MCP clients, **HTTP** for everything else.

## Install

```sh
bun add -g @open-pencil/mcp
```

## Stdio (Claude Code, Cursor, etc.)

Add to your MCP config (e.g. `~/.claude/settings.json` or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "open-pencil": {
      "command": "openpencil-mcp"
    }
  }
}
```

Or run from source without installing:

::: code-group
```json [Bun]
{
  "mcpServers": {
    "open-pencil": {
      "command": "bun",
      "args": ["/path/to/open-pencil/packages/mcp/src/index.ts"]
    }
  }
}
```
```json [Node.js]
{
  "mcpServers": {
    "open-pencil": {
      "command": "npx",
      "args": ["tsx", "/path/to/open-pencil/packages/mcp/src/index.ts"]
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

Or from source: `bun packages/mcp/src/http.ts` / `npx tsx packages/mcp/src/http.ts`

Security defaults (HTTP transport):

- Binds to `127.0.0.1` by default (`HOST` to override)
- `eval` tool is disabled
- File operations are limited to `OPENPENCIL_MCP_ROOT` (defaults to current working directory)
- CORS is disabled by default; set `OPENPENCIL_MCP_CORS_ORIGIN` to allow one origin
- Optional auth token: `OPENPENCIL_MCP_AUTH_TOKEN` (client sends `Authorization: Bearer <token>` or `x-mcp-token`)

Server starts on port 3100 (override with `PORT` env var). Endpoints:

- `GET /health` — server status
- `POST /mcp` — MCP Streamable HTTP (SSE). Sessions via `mcp-session-id` header.

## Workflow

1. **Open** — `open_file` to load an existing `.fig`, or `new_document` for a blank canvas
2. **Read** — `get_page_tree`, `find_nodes`, `get_node`, `list_pages`
3. **Create** — `create_shape`, `render` (JSX)
4. **Modify** — `set_fill`, `set_stroke`, `set_layout`, `update_node`, `set_effects`
5. **Structure** — `reparent_node`, `group_nodes`, `clone_node`, `delete_node`
6. **Save** — `save_file` to write back to `.fig`

## Tools (29)

### Document

| Tool | Description |
|------|-------------|
| `open_file` | Open a `.fig` file for editing |
| `save_file` | Save the current document to a `.fig` file |
| `new_document` | Create a new empty document |

### Read

| Tool | Description |
|------|-------------|
| `get_selection` | Get currently selected nodes |
| `get_page_tree` | Get the full node tree of the current page |
| `get_node` | Get detailed properties of a node by ID |
| `find_nodes` | Find nodes by name pattern and/or type |
| `list_pages` | List all pages |
| `list_variables` | List design variables |
| `list_collections` | List variable collections |

### Create

| Tool | Description |
|------|-------------|
| `create_shape` | Create a shape (FRAME, RECTANGLE, ELLIPSE, TEXT, LINE, STAR, POLYGON, SECTION) |
| `render` | Render JSX to design nodes — create entire component trees in one call |
| `create_component` | Convert a frame/group into a component |
| `create_instance` | Create an instance of a component |

### Modify

| Tool | Description |
|------|-------------|
| `set_fill` | Set fill color (hex) |
| `set_stroke` | Set stroke color, weight, alignment |
| `set_effects` | Add shadow or blur effects |
| `update_node` | Update position, size, opacity, corner radius, text, font |
| `set_layout` | Set auto-layout (flexbox) — direction, spacing, padding, alignment |
| `set_constraints` | Set resize constraints |

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

### Navigation

| Tool | Description |
|------|-------------|
| `switch_page` | Switch to a page by name or ID |

### Escape Hatch

| Tool | Description |
|------|-------------|
| `eval` | Execute JavaScript with full Figma Plugin API access |

Note: `eval` is available over stdio, but disabled in HTTP mode for security.
