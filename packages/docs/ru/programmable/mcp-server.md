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

Security defaults (HTTP transport):

- Binds to `127.0.0.1` by default (`HOST` to override)
- `eval` tool is disabled
- File operations are limited to `OPENPENCIL_MCP_ROOT` (defaults to current working directory)
- CORS is disabled by default; set `OPENPENCIL_MCP_CORS_ORIGIN` to allow one origin
- Optional auth token: `OPENPENCIL_MCP_AUTH_TOKEN` (client sends `Authorization: Bearer <token>` or `x-mcp-token`)

Server starts on port 7600 (override with `PORT` env var). Endpoints:

- `GET /health` — server status
- `POST /mcp` — MCP Streamable HTTP (SSE). Sessions via `mcp-session-id` header.

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
