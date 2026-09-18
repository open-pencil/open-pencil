---
title: MCP Server
description: Connect Claude Code, Cursor, Windsurf, and other MCP clients to OpenPencil for AI-assisted design inspection and editing.
---

# MCP Server

OpenPencil includes an MCP (Model Context Protocol) server that lets AI coding tools — Claude Code, Cursor, Windsurf, etc. — read and modify designs through the running app.

Two transports: **stdio** for MCP clients, and **Streamable HTTP** for browser extensions and scripts. On macOS and Linux, local clients prefer a private Unix domain socket; Windows and unavailable sockets fall back to localhost TCP.

Tool definitions own native Valibot input schemas, execution/mutation metadata, capabilities, and optional interface exposure exclusions. Tools are included by default; `exposure: { mcp: false, ai: false, webmcp: false }` can exclude them independently from each adapter. Exposure does not bypass execution support or user permissions: WebMCP still requires supported execution and explicit Off, Inspect, or Edit access. AI and MCP consume the same schema through Standard Schema; WebMCP derives its JSON Schema from that input. Numeric strings are accepted consistently across adapters, while non-finite values are rejected. Programmatic integrations use MCP SDK v2; custom tools replace the former `params`/`ParamDef` contract with `input` and execution metadata.

## Tool access settings

Use **Settings → Tool access** (select **Local MCP**) to search and toggle the local server's tools, individually or by read-only/side-effect group. Group switches affect all group members, even during search. **Restore defaults** enables the configurable MCP tools again. Existing MCP preferences are preserved separately from the **Built-in AI** settings.

Restart the MCP server, then reconnect stdio clients, to apply changes. For an externally managed server, restart its owning process. The list reflects the tools discovered from the server; disabling a dedicated tool does not prevent an enabled script tool from performing the same operation. These switches are not a sandbox and do not configure remote MCP servers or WebMCP.

## Browser-native WebMCP (experimental) {#webmcp}

WebMCP is **off by default**. Open **Settings → MCP → WebMCP** and choose **Inspect** for read-only access or **Edit** to also allow scoped, undoable changes. **Off** unregisters all browser tools; changing modes revokes the previous registrations immediately. This preference is independent of local MCP authentication, tool switches, and outbound connections.

For local testing, use a Chrome version exposing `document.modelContext`, enable `chrome://flags/#enable-webmcp-testing`, and relaunch the browser. Open a document, enable access in Settings, and connect a WebMCP-capable browser agent or the [Model Context Tool Inspector](https://developer.chrome.com/docs/ai/webmcp). Settings shows browser support and registration status. See the [Chrome WebMCP guide](https://developer.chrome.com/docs/ai/webmcp) for current availability.

In supported browsers, OpenPencil registers the selected reviewed set of tools directly in the workspace. Browser agents can inspect nodes, JSX, variables, components, and design patterns, and edit existing layer properties and variable values without installing or connecting an MCP server.

Tools target the document and page active when the call starts. Switching tabs does not redirect an in-flight call. Closing the workspace unregisters the tools. Tool inputs are validated and large inspection results require a narrower query. Oversized editing results are omitted with a committed-edit notice rather than reporting a successful edit as failed.

Edits to geometry, paints, layout, text, and variable bindings/values commit synchronously as individual undoable operations. Failed edits roll back, and undo targets the original document/page even after a page switch. Cancellation prevents an edit from starting; cancellation after commit does not reverse it. Font loading finishes separately without holding a mutation transaction open. Atomic editing currently requires a document with at most 10,000 nodes and variables combined; this shared limit also applies when the same editing tools run through app AI/MCP.

This surface does **not** expose structural creation/deletion, arbitrary JavaScript/JSX execution, image loading, filesystem operations, or credentials. Those tools retain their existing AI/MCP paths. WebMCP is an evolving browser proposal, not universally available; unsupported browsers continue to use OpenPencil normally. The stdio and HTTP integrations below remain independent.

## Install

```sh
npm install -g @open-pencil/mcp
```

## Stdio (Claude Code, Cursor, etc.)

The stdio server discovers the running OpenPencil app automatically. It prefers the app's Unix domain socket on macOS and Linux and falls back to localhost TCP when needed. Make sure the desktop app is open with a document loaded.

### Claude Code

Install the MCP package and register it with Claude Code:

```sh
npm install -g @open-pencil/mcp
claude mcp add --scope user open-pencil -- openpencil-mcp
```

Check the connection:

```sh
claude mcp list
```

Claude Code asks before using each MCP tool unless you allow the server's tools. To auto-approve OpenPencil tools only, add this to `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["mcp__open-pencil__*"]
  }
}
```

This is narrower than `--permission-mode bypassPermissions`, which skips prompts for every tool. You can also approve tools interactively from Claude's prompt by choosing “Yes, and don't ask again”.

Example prompt:

```text
Use the open-pencil MCP server to inspect the current page and create a small hero section on the canvas.
```

### Other MCP clients

Add to your MCP config (for example `.cursor/mcp.json`):

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

Security defaults:

- Unix socket and discovery files are created with owner-only permissions on macOS and Linux.
- TCP binds to `127.0.0.1` and uses port 7600 by default.
- Authentication is enabled by default with a generated token stored in the private discovery file.
- `eval` is disabled.
- File operations are limited to `OPENPENCIL_MCP_ROOT` (defaults to the current working directory) and reject symlink escapes.
- Only the desktop app's own origin (`tauri://localhost` and its `http(s)://tauri.localhost` variants) is allowed by default, so a server you start yourself works from the app without extra configuration. Set `OPENPENCIL_MCP_CORS_ORIGIN` to a comma-separated list to allow other origins, such as a worktree dev server.

Set `PORT=0` to disable TCP on macOS and Linux. Windows requires TCP. Set `OPENPENCIL_MCP_SOCKET` to override the Unix socket path, or `OPENPENCIL_MCP_DISCOVERY_PATH` to override the discovery file location. To provide a stable token, set `OPENPENCIL_MCP_AUTH_TOKEN`; an explicitly empty value disables authentication and should only be used with a trusted local socket.

Endpoints are available over both active transports:

- `GET /health` — server and app connection status; never returns the auth token.
- `POST /rpc` — authenticated live-app automation.
- `POST /mcp` — MCP Streamable HTTP. Sessions use the `mcp-session-id` header.

## Workflow

1. **Discover targets** — call `list_documents` first when more than one document or page may be open. It returns stable `document_id` and page IDs.
2. **Open** — `open_file` to load an existing `.fig`, or `new_document` for a blank canvas. These return target metadata for the opened or created document.
3. **Read** — `get_page_tree`, `find_nodes`, `get_node`, `list_pages`
4. **Create** — `create_shape`, `render` (JSX)
5. **Modify** — `set_fill`, `set_stroke`, `set_layout`, `update_node`, `set_effects`
6. **Structure** — `reparent_node`, `group_nodes`, `clone_node`, `delete_node`
7. **Save** — `save_file` to write back to `.fig`
8. **Close** — `close_file` to close an open document tab; it prompts to save unsaved changes.

Most tools accept optional `document_id` and `page_id` fields. Pass them explicitly for agent workflows instead of relying on the visible active tab/page. `create_page` only creates a page; call `switch_page` separately when the workflow should change the active page.

## AI Agent Skill

Teach your AI coding agent to use OpenPencil tools:

```sh
npx skills add open-pencil/open-pencil
```

Works with Claude Code, Cursor, Windsurf, Codex, and any agent that supports [skills](https://skills.sh). The skill covers the CLI, MCP tools, JSX rendering, eval, and the running app's automation bridge.

## Tools

OpenPencil currently registers 100+ shared design tools, plus MCP-only document and prompt operations when applicable.

### Document

| Tool | Description |
|------|-------------|
| `open_file` | Open a `.fig` file for editing |
| `close_file` | Close an open document tab, prompting to save unsaved changes |
| `save_file` | Save the current document to a `.fig` file |
| `new_document` | Create a new empty document |
| `list_documents` | List open app documents/tabs and their pages |

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
| `list_available_fonts` | List font families the current host can render |
| `get_font_status` | Report requested faces, loaded sources, active substitutions, and affected nodes |
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
