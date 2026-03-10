---
name: open-pencil
description: Design-to-code via OpenPencil MCP server. Opens .fig files, inspects design structure, extracts tokens, analyzes patterns, and generates frontend code (Vue/React/Svelte + Tailwind/CSS). Use when user asks to convert Figma designs to code, inspect .fig files, or extract design tokens.
---

# OpenPencil MCP — Design to Code

## Prerequisites

OpenPencil MCP server must be running:

```bash
cd /mnt/f/projects/openspec/dannote/open-pencil/packages/mcp
bun src/http.ts &
```

Health check: `curl http://127.0.0.1:3100/health`

## MCP Connection

HTTP transport at `http://127.0.0.1:3100/mcp`. Session-based — initialize once, reuse session for all calls.

```bash
# Initialize
curl -s -X POST http://127.0.0.1:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -D /tmp/mcp_headers.txt \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"pi","version":"1.0"}}}'

# Extract session ID
SESSION=$(grep -i 'mcp-session-id' /tmp/mcp_headers.txt | tr -d '\r' | awk '{print $2}')

# Send initialized notification
curl -s -X POST http://127.0.0.1:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
```

### Calling Tools

```bash
curl -s -X POST http://127.0.0.1:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":NNN,"method":"tools/call","params":{"name":"TOOL_NAME","arguments":{...}}}'
```

Response is SSE — parse with: `sed 's/^event: message$//' | sed 's/^data: //'`

Result text is in: `result.content[0].text` (JSON string — parse twice for structured data).

## Pipeline: Design → Code

Follow these steps in order. Never guess — always read actual design data.

### Step 1 — Open File & Survey

```
open_file        path=<.fig file>          → opens document, returns page list
get_page_tree                               → full node hierarchy
get_components                              → reusable Figma components
design_to_tokens format="css"               → extract design variables
analyze_colors   limit=20                   → color palette with frequencies
analyze_typography                          → font stacks, sizes, weights
analyze_spacing  grid=4                     → gap/padding values, grid compliance
```

After this step you know: screen count, component inventory, token system, type scale, spacing grid.

### Step 2 — Decompose

```
analyze_clusters min_count=2                → repeated patterns → potential components
describe         id=<node>                  → semantic role, layout, visual properties
get_jsx          id=<node>                  → structural JSX (nesting, props, text content)
design_to_component_map                     → screens, components, sections overview
```

Build component map: screens (top-level frames), components (repeated patterns or COMPONENT nodes), primitives (leaf text/icon nodes).

### Step 3 — Extract Tokens

For **Tailwind** stacks — only semantic colors as CSS custom properties:

```css
:root {
  --app-bg: #0F0F1A;
  --app-surface: #1A1A2E;
  --app-accent: #7C3AED;
  --app-text: #FFFFFF;
  --app-text-dim: rgba(255, 255, 255, 0.5);
}
```

Use Tailwind utilities directly for spacing (`gap-3`, `p-4`), font sizes (`text-[13px]`), weights (`font-bold`), radius (`rounded-xl`). Do NOT create CSS variables for these — they conflict with Tailwind v4 internals.

For **CSS Modules / plain CSS** — variables for all categories with a project prefix.

### Step 4 — Generate Code

Bottom-up: primitives → components → screens. One file per component.

For each node, call `get_jsx` and `describe` to read exact structure, then translate:

| Figma concept | Code |
|---|---|
| `layoutMode: HORIZONTAL` | `flex flex-row` |
| `layoutMode: VERTICAL` | `flex flex-col` |
| `itemSpacing` | `gap-N` |
| `paddingTop/Right/Bottom/Left` | `p-N` / `px-N py-N` / `pt-N pr-N ...` |
| `primaryAxisAlign: CENTER` | `justify-center` |
| `counterAxisAlign: CENTER` | `items-center` |
| `layoutGrow > 0` | `flex-1` or `grow` |
| `cornerRadius` | `rounded-N` |
| `clipsContent: true` | `overflow-hidden` |
| `opacity < 1` | `opacity-N` |
| `layoutMode: NONE` | `relative` parent + `absolute` children |

Interactive states (buttons, cards): always add `cursor-pointer`, `hover:`, `active:`, `transition-*` even if Figma has no hover variants.

### Step 5 — Verify

Re-check generated code against design: all text present, colors match, spacing correct, hierarchy preserved.

## Tool Reference (91 tools)

### File & Navigation
| Tool | Params | Description |
|---|---|---|
| `open_file` | `path` | Open .fig/.figjam file |
| `get_page_tree` | — | Node tree of current page |
| `get_node` | `id` | Detailed node properties |
| `find_nodes` | `name?, type?` | Find by name/type |
| `get_selection` | — | Currently selected nodes |
| `query` | `xpath` | XPath node query |

### Read & Inspect
| Tool | Params | Description |
|---|---|---|
| `get_jsx` | `id` | JSX representation of node tree |
| `diff_jsx` | `from, to` | Structural diff between nodes |
| `describe` | `id` | Semantic description: role, layout, issues |

### Analysis
| Tool | Params | Description |
|---|---|---|
| `analyze_colors` | `limit?` | Color palette with frequencies |
| `analyze_typography` | — | Font families, sizes, weights |
| `analyze_spacing` | `grid?` | Gaps, paddings, grid compliance |
| `analyze_clusters` | `min_count?` | Repeated visual patterns |

### Variables & Tokens
| Tool | Params | Description |
|---|---|---|
| `list_variables` | `collection?` | All variables with values per mode |
| `list_collections` | — | Variable collections and modes |
| `get_components` | — | Component definitions |

### Codegen Pipeline
| Tool | Params | Description |
|---|---|---|
| `design_to_tokens` | `format` (css/tailwind/json) | Extract variables as code tokens |
| `design_to_component_map` | — | Screens, components, sections overview |
| `get_codegen_prompt` | — | Full codegen guidelines (6.7KB) |

### Export
| Tool | Params | Description |
|---|---|---|
| `export_svg` | `ids` | Export nodes as SVG |
| `export_png` | `id, scale?` | Export node as PNG |

### Create & Modify
| Tool | Params | Description |
|---|---|---|
| `render_jsx` | `jsx, x?, y?` | Render JSX into scene graph |
| `set_fill` | `id, color` | Set node fill |
| `set_text` | `id, text` | Set text content |
| `create_frame` | `width, height, ...` | Create frame node |

(Full list: call `tools/list` on MCP endpoint)

## Example Session

```bash
# 1. Open file
open_file path="/path/to/design.fig"

# 2. Survey
get_page_tree
analyze_colors limit=20
analyze_typography
analyze_spacing grid=4

# 3. Inspect root frame
get_jsx id="0:171"
describe id="0:171"

# 4. Inspect sections
describe id="0:189"    # Content section
get_jsx id="0:200"     # Stats component

# 5. Find patterns
analyze_clusters min_count=2

# 6. Get codegen guidelines
get_codegen_prompt

# 7. Generate code based on collected data
# → Write Vue/React components with Tailwind classes
# → Create tokens.css with semantic color variables
# → Match every measurement from the design exactly
```

## Stack-Specific Notes

### Vue 3 + Tailwind
- `<script setup lang="ts">`, `defineProps`, `<template>`
- Tailwind utility classes, no scoped styles needed
- CSS custom properties only for semantic colors in a global `tokens.css`
- Reference: `bg-[var(--app-accent)]`, `text-[var(--app-text)]`

### React + Tailwind
- Functional components, TypeScript, `className`
- Same token strategy as Vue

### Vue 3 + CSS
- `<script setup lang="ts">`, scoped `<style>`
- CSS custom properties for all token categories

### HTML + CSS
- Semantic HTML, BEM classes
- Full CSS custom property system
