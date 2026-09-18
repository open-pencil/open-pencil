---
name: open-pencil
description: Work with Figma .fig design files and the running OpenPencil editor — inspect structure, query nodes, analyze design tokens, export PNG/SVG/PDF/JSX, and modify designs programmatically. Use when asked to open, inspect, export, analyze, or edit .fig files, or to control the running OpenPencil app.
---

# OpenPencil

OpenPencil provides a CLI and MCP server for `.fig` design files and the running OpenPencil editor.

Use two modes:

- **App mode** — connect to the running OpenPencil editor by omitting the file argument.
- **Headless mode** — work with `.fig` files directly by passing a file path.

```bash
# App mode — operates on the document open in the editor
openpencil tree

# Headless mode — operates on a .fig file
openpencil tree design.fig
```

Use `openpencil --help`, per-command help, and the connected MCP server’s tool schemas to check the installed version’s capabilities. See the [CLI reference](https://openpencil.dev/reference/cli) and [MCP guide](https://openpencil.dev/programmable/mcp-server) for current documentation.

## Requirements

```bash
# CLI
bun add -g @open-pencil/cli

# MCP server used by the desktop app and external MCP clients
bun add -g @open-pencil/mcp
```

The desktop app starts `openpencil-mcp-http` automatically in production Tauri builds when `@open-pencil/mcp` is installed globally and exposes automation on:

- HTTP/RPC: `http://127.0.0.1:7600`
- WebSocket bridge: `ws://127.0.0.1:7601`
- MCP Streamable HTTP: `http://127.0.0.1:7600/mcp`

## CLI Commands

```bash
openpencil --help
```

Common commands:

- `info` — document overview: pages, node counts, fonts
- `tree` — print hierarchy with types and sizes
- `pages` — list pages
- `node` — detailed node properties by ID
- `selection` — current selection from the running app
- `find` — find nodes by name/type
- `query` — XPath selectors for node search
- `variables` — list variables and collections
- `export` — export PNG/JPG/WEBP/SVG/PDF/JSX/.fig
- `convert` — convert between supported document formats
- `analyze` — colors, typography, spacing, repeated clusters
- `lint` — consistency, structure, and accessibility checks
- `formats` — supported document/export formats
- `eval` — execute JavaScript with the Figma Plugin API

### Inspect

```bash
openpencil info design.fig
openpencil tree design.fig
openpencil tree --page "Components" --depth 3  # app mode
openpencil pages design.fig
openpencil node design.fig --id 1:23
openpencil node --id 1:23  # app mode
openpencil selection --json
openpencil variables design.fig
openpencil variables --collection "Colors" --type COLOR
```

### Search and XPath query

```bash
openpencil find design.fig --name "Button"
openpencil find --type FRAME                          # app mode
openpencil find design.fig --type TEXT --page "Home"
openpencil find design.fig --name "Card" --type COMPONENT --limit 50

openpencil query design.fig "//FRAME"
openpencil query design.fig "//FRAME[@width < 300]"
openpencil query design.fig "//TEXT[contains(@name, 'Button')]"
openpencil query design.fig "//COMPONENT[@stackMode]"
openpencil query design.fig "//COMPONENT//FRAME//TEXT"
openpencil query "//FRAME[@width > 1000]"             # app mode
```

Common node types: `FRAME`, `TEXT`, `RECTANGLE`, `ELLIPSE`, `VECTOR`, `GROUP`, `COMPONENT`, `COMPONENT_SET`, `INSTANCE`, `SECTION`, `LINE`, `STAR`, `POLYGON`, `SLICE`, `BOOLEAN_OPERATION`.

### Export and convert

```bash
openpencil export design.fig -o hero.png
openpencil export -o hero.png                         # app mode
openpencil export design.fig --node 1:23 -s 2 -o button@2x.png
openpencil export design.fig -f jpg -q 85 -o preview.jpg
openpencil export design.fig -f svg --node 1:23 -o icon.svg
openpencil export design.fig -f pdf -o page.pdf
openpencil export design.fig -f fig -o roundtrip.fig
openpencil export design.fig -f jsx -o component.jsx
openpencil export design.fig -f jsx --style tailwind -o component.tsx
openpencil export design.fig --thumbnail --width 1920 --height 1080
openpencil export --page "Components" -o components.png

openpencil convert design.fig -o design.pen
openpencil formats
```

### Analyze and lint

```bash
openpencil analyze colors design.fig
openpencil analyze colors --similar --threshold 10     # app mode
openpencil analyze typography design.fig --group-by size
openpencil analyze spacing design.fig --grid 8
openpencil analyze clusters design.fig --min-count 3
openpencil lint design.fig
openpencil lint design.fig --json
```

### Eval (Figma Plugin API)

Execute JavaScript against the document using a Figma Plugin API-compatible runtime:

```bash
openpencil eval design.fig -c 'figma.currentPage.findAll(n => n.type === "TEXT").length'

# App mode — modifies the live document in the editor
openpencil eval -c '
  const buttons = figma.currentPage.findAll(n => n.name === "Button");
  buttons.forEach(b => { b.cornerRadius = 8 });
  buttons.length + " buttons updated"
'

# Modify and save to the same file
openpencil eval design.fig -w -c '
  const texts = figma.currentPage.findAll(n => n.type === "TEXT");
  texts.forEach(t => { t.fontSize = 16 });
'

# Save to a different file
openpencil eval design.fig -o modified.fig -c '...'

# Read code from stdin
echo 'figma.currentPage.children.map(n => n.name)' | openpencil eval design.fig --stdin
```

Every command that reports structured data supports `--json` when appropriate.

## MCP Server

### Stdio MCP clients

Use Bun by default:

```json
{
  "mcpServers": {
    "open-pencil": {
      "command": "bunx",
      "args": ["openpencil-mcp"]
    }
  }
}
```

If `@open-pencil/mcp` is installed globally, direct binaries also work:

```json
{
  "mcpServers": {
    "open-pencil": {
      "command": "openpencil-mcp"
    }
  }
}
```

### HTTP / Streamable HTTP

```bash
export PORT=7600
export OPENPENCIL_MCP_ROOT=/path/to/files     # explicitly limit filesystem access

openpencil-mcp-http
# or: bunx openpencil-mcp-http
```

Authentication is enabled by default with an automatically generated token. `OPENPENCIL_MCP_AUTH_TOKEN` can supply an explicit non-empty token; an empty value disables authentication. If browser access needs CORS, set `OPENPENCIL_MCP_CORS_ORIGIN` to a trusted origin. Never combine wildcard CORS (`*`) with disabled authentication.

The CLI defaults the filesystem root to the home directory on Windows and the current working directory elsewhere. Set `OPENPENCIL_MCP_ROOT` to an explicit narrow directory rather than relying on that default.

### MCP workflow

1. **Open/create a document** — `open_file { path }` within the effective filesystem root, or `new_document {}`.
2. **Query** — `get_page_tree`, `find_nodes`, `query_nodes`, `get_node`, `list_pages`, `get_current_page`.
3. **Inspect** — `get_jsx`, `diff_jsx`, `describe`, `export_image`, `export_svg`, `export_pdf`.
4. **Modify** — `render`, `batch_update`, `update_node`, `set_fill`, `set_layout`, `create_shape`, `import_svg`, etc.
5. **Navigate** — after creating or editing visible canvas content, call `select_nodes` and `viewport_zoom_to_fit { id }` (or `node_bounds` + `viewport_set`) so the user can see the result in the running editor.
6. **Save/export** — `save_file`, `export_image`, `export_svg`, `export_pdf`, or CLI `export`.
7. **Close** — `close_file { document_id }` closes a document tab after the workflow; it prompts to save unsaved changes.

### Browser-native WebMCP (experimental)

WebMCP is off by default. In **Settings → MCP → WebMCP**, choose **Inspect** for read-only tools or **Edit** for scoped changes. These controls are independent of local MCP settings. Supporting browsers expose inspection and undoable existing-layer/property and variable edits directly from the OpenPencil workspace through `document.modelContext`, without an MCP server connection. Discover this browser surface separately: it excludes structural creation/deletion, arbitrary JS/JSX execution, external assets, filesystem operations, and credentials.

Calls capture the active document/page. Cancellation prevents an edit from starting but does not reverse an already committed edit; use editor undo instead. Atomic edits require at most 10,000 nodes and variables combined, including when these same tools run through app AI/MCP. See the [WebMCP guide](https://openpencil.dev/programmable/mcp-server#webmcp) for scope and browser requirements.

## Tool discovery

Users configure local server tools in **Settings → Tool access** → **Local MCP**, independently from **Built-in AI** tool preferences. Local MCP changes require a server restart and stdio client reconnection; built-in AI changes apply to the next message. ACP and Pi agents use the MCP surface, not the direct-model AI tool selection. Tool switches are not a sandbox: enabled scripting tools can still perform operations whose dedicated tools are disabled.

Discover available tools and their arguments from the connected server or browser; availability varies by version and mode. Each tool's schema and execution/exposure metadata are authoritative. Numeric inputs accept numbers or numeric strings consistently, but reject non-finite values. Do not rely on a fixed tool count or a copied inventory.

> Tool availability can depend on server mode. `open_file`, `save_file`, and disk-writing export paths are scoped to the effective filesystem root; set it explicitly with `OPENPENCIL_MCP_ROOT`.

## Key tools for agents

- **`query_nodes`** — XPath selectors to find specific nodes without fetching the full tree.
- **`get_jsx`** — inspect any node as JSX in the same format accepted by `render`.
- **`diff_jsx`** — compare two nodes structurally before editing.
- **`describe`** — semantic analysis of role, visual style, layout, and design issues.
- **`batch_update`** — apply multiple node updates efficiently.
- **`export_image` / `export_svg` / `export_pdf`** — visual verification and deliverables.
- **`viewport_zoom_to_fit` / `viewport_set` / `viewport_get`** — keep the live editor focused on the created or edited design.
- **`get_codegen_prompt`** — retrieve OpenPencil's current JSX/codegen guidance.

## JSX Rendering

Read [Design authoring](references/design-authoring.md) before creating or modifying JSX designs. This bundled reference is generated from Core's authoring guidance, tested examples, and renderer metadata—the same reference used by chat and codegen prompts.

Use the `render` tool for JSX strings. Use only the APIs exposed by the installed `eval` environment; native library exports are not automatically scripting globals. The connected server's `get_codegen_prompt` provides its version's codegen and authoring guidance.

## Tips

- Omit the file path to work with the document open in the running OpenPencil editor.
- Start with `info` or `get_page_tree` to understand the document.
- Use `tree --depth 2` or `query_nodes` to avoid overwhelming output on large files.
- Export specific nodes with `--node` for faster visual checks.
- Use `export_image` after changes to verify visual quality.
- After creating a visible design, select it and zoom the editor to it: `select_nodes { ids: [id] }` then `viewport_zoom_to_fit { id }`.
- If zoom-to-fit is unavailable in a client, use `node_bounds` to calculate the center and call `viewport_set { x, y, zoom }`.
- Use `analyze colors --similar` to find near-duplicate colors.
- Use `eval` for Figma Plugin API operations not covered by a dedicated CLI/MCP tool.
- Use `--json` when piping CLI output to scripts.
- In app mode, `eval` and MCP modifications are reflected live in the editor.
