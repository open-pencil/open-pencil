# AI Chat — Design Document

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Browser (Vue app)                                       │
│                                                         │
│  ChatPanel.vue ─── useChat() ──→ /api/chat (streaming)  │
│       │                              │                  │
│       │ tool results render          │                  │
│       │ in chat as timeline          ▼                  │
│       │                     Vite dev server proxy        │
│       │                              │                  │
└───────│──────────────────────────────│──────────────────┘
        │                              │
        │ tool executions              │
        │ mutate store directly        ▼
        │ (same JS context)    ┌──────────────────┐
        │                      │ Backend (Bun)     │
        │                      │                   │
        │                      │ AI SDK ToolLoop   │
        │                      │ OpenRouter        │
        │                      │ Claude Sonnet     │
        │                      └──────────────────┘
```

Key insight: tools execute **in the browser**, not on the server. The LLM runs server-side (OpenRouter), but when it calls a tool like `render`, the tool execution happens in the Vue app where the editor store lives. This is the inverse of beebro-chat where tools run server-side.

**Flow:**
1. User types in chat panel → message sent to backend
2. Backend streams LLM response via AI SDK `ToolLoopAgent`
3. When LLM calls a tool → tool call streamed to client
4. Client intercepts tool call → executes against `editorStore` → returns result
5. Result sent back to server → LLM continues
6. Text/tool results render in chat

This is the AI SDK's **client-side tool execution** pattern.

## UI Layout

Chat panel replaces the right sidebar (properties panel) when active, toggled with a keyboard shortcut or button. Properties and chat never need to be visible simultaneously — when you're chatting with AI, you're describing intent, not tweaking pixel values.

```
┌──────────┬────────────────────────┬──────────┐
│  Layers  │       Canvas           │   Chat   │
│          │                        │  Panel   │
│          │                        │          │
│          │   ┌──────────┐         │ messages │
│          │   │ selected │         │ + tools  │
│          │   │  frame   │         │          │
│          │   └──────────┘         │          │
│          │                        │──────────│
│          │                        │ [input]  │
└──────────┴────────────────────────┴──────────┘
```

Toggle: `⌘J` (matches VS Code/Cursor convention) or click AI icon in toolbar.

The `SplitterPanel` on the right switches between `<PropertiesPanel>` and `<ChatPanel>` based on state. Both share the same splitter slot — no extra panel.

## AI Workflow

Ported from figma-use's proven workflow pattern:

```
1. Read    → snapshot, get_page_tree, find_nodes, get_selection
2. Create  → render (JSX), set_*, move_node
3. Verify  → screenshot → AI inspects the image
4. Iterate → diff_create to see what changed, fix issues
5. Export  → export_jsx for developer handoff
```

The **render** tool (JSX) is the primary creation tool — not individual `create_frame`/`create_text` calls. Individual create/set tools are for surgical edits. JSX lets the AI describe an entire component tree in one call:

```jsx
<Frame name="Card" w={320} h="hug" flex="col" gap={16} p={24} bg="#FFFFFF" rounded={16}>
  <Rectangle name="Image" w="fill" h={200} bg="#E5E7EB" rounded={12} />
  <Text name="Title" size={18} weight="bold" color="#111">Card Title</Text>
  <Text name="Description" size={14} color="#6B7280">Lorem ipsum dolor sit amet</Text>
</Frame>
```

One tool call instead of 6+ sequential calls. Less noisy in the chat, fewer round-trips, better results.

## Guardrail Tools

These are verification/diff tools the AI should use in its loop — ported from figma-use:

| Tool | Purpose |
|------|---------|
| `screenshot` | Render viewport/node to PNG → AI inspects visually |
| `snapshot` | Compact accessibility-tree representation of the design (text, not image) |
| `diff_create` | Structural diff between two nodes/trees — AI sees what actually changed |
| `diff_visual` | Pixel-level diff between two nodes → image showing differences |
| `diff_show` | Preview what a property change would look like before applying |

The AI workflow becomes self-correcting:
1. AI renders JSX → creates a card
2. AI calls `screenshot` → sees the result
3. AI notices spacing is off → calls `diff_show` to preview fix
4. AI applies the fix → calls `screenshot` again to confirm

## Comments as Context

Users can pin comments on the canvas (like Figma's comment mode). These are **AI context annotations** — not the collaboration "comments" feature.

When the user sends a chat message, comments visible in the current viewport (or on selected nodes) are automatically included as context:

```
System prompt includes:
- Current page snapshot (compact tree)
- Selected nodes with properties
- Visible comments with positions and attached node IDs

User says: "make the spacing consistent"
→ LLM sees:
  Comment on Frame "Header": "This should be 16px gap"
  Comment on Frame "Cards": "Use 8px grid"
→ LLM calls set_layout tools with correct spacing
```

Comments are stored on `SceneGraph` (not individual nodes) since they can be pinned to empty canvas areas. They persist in the saved file.

## Tool Categories

### Read tools (context gathering)
| Tool | Description |
|------|-------------|
| `snapshot` | Compact accessibility-tree representation of current page |
| `get_page_tree` | Full node tree (truncated by depth) |
| `get_node` | Node properties by ID |
| `get_selection` | Currently selected nodes |
| `get_children` | Children of a node |
| `find_nodes` | Search by name/type |
| `get_comments` | All comment pins |
| `screenshot` | Render viewport/node to image (AI can inspect) |

### Create tools (JSX-first)
| Tool | Description |
|------|-------------|
| `render` | **Primary** — render JSX tree to canvas (Frame, Text, Rectangle, Ellipse, etc.) |
| `create_instance` | Create component instance by component ID |
| `create_component` | Convert selection to component |

### Modify tools
| Tool | Description |
|------|-------------|
| `set_fill` | Set fill color |
| `set_stroke` | Set stroke |
| `set_effect` | Shadow, blur |
| `set_text` | Change text content |
| `set_font` | Font family, size, weight |
| `set_layout` | Auto-layout mode, gap, padding, alignment |
| `set_radius` | Corner radius |
| `set_opacity` | Opacity |
| `set_size` | Width, height |
| `move_node` | Position |
| `rename_node` | Name |
| `set_constraints` | Resize constraints |
| `reparent_node` | Move to different parent |

### Diff / verify tools
| Tool | Description |
|------|-------------|
| `diff_create` | Structural diff between two nodes (unified patch format) |
| `diff_show` | Preview property changes before applying |
| `diff_visual` | Pixel-level diff between two nodes → image |
| `diff_apply` | Apply a diff patch to nodes |

### Organize tools
| Tool | Description |
|------|-------------|
| `delete_nodes` | Delete by IDs |
| `group_nodes` | Group selection |
| `ungroup_nodes` | Ungroup |
| `bring_to_front` | Z-order |
| `send_to_back` | Z-order |
| `select_nodes` | Set selection |
| `add_comment` | Pin a comment to canvas/node |

### Variable tools
| Tool | Description |
|------|-------------|
| `list_variables` | List variables |
| `create_variable` | Create variable |
| `bind_variable` | Bind to node property |

### Export tools
| Tool | Description |
|------|-------------|
| `export_jsx` | Export node as JSX component (developer handoff) |
| `export_node` | Export node as PNG/SVG |

## Tool Call Display

Tool calls render inline in the chat as a collapsible timeline (like beebro-chat's `ToolTimeline`):

```
User: Create a card component with title, image, and description

AI: I'll create that card for you.

  ✓ render JSX → Card (4 children)
  ✓ screenshot — verified layout
  ✓ create_component → 0:42

Here's the Card component with auto-layout, 16px spacing,
and an image placeholder at the top.
```

Each tool call shows:
- **Icon** — shape icon for render, camera for screenshot, diff icon for diffs, etc.
- **Label** — human-readable: "Render JSX" not "render"
- **Summary** — key output: node name, child count, diff percentage
- **State** — spinner while executing, ✓ when done, ✗ on error
- **Expandable** — click to see full params and result

For `screenshot` and `diff_visual`, the image renders inline as a thumbnail.
For `render`, the expanded view shows the JSX source.
For `diff_create`, the expanded view shows the unified diff with syntax highlighting.

## Stack

### Backend (new `packages/ai/`)
```
ai@6.0.0-beta          — ToolLoopAgent, streaming, tool definitions
@ai-sdk/valibot        — schema validation
@openrouter/ai-sdk-provider — model provider
valibot                — tool param schemas
```

Runs as a separate Bun process in dev (Vite proxies `/api/*`), or as a Tauri sidecar in production.

### Frontend (in app)
```
ai/vue                 — useChat() composable for Vue
```

The `useChat()` composable from AI SDK handles:
- Message state management
- SSE streaming
- Tool call/result roundtrip
- Abort/cancel

## JSX Render Pipeline

Ported from figma-use's `packages/cli/src/render/`. The JSX renderer:

1. Parses JSX string → mini-React element tree (custom JSX runtime, no real React)
2. Walks the tree → maps elements to `SceneGraph.createNode()` calls
3. Applies style shorthands: `w`, `h`, `bg`, `rounded`, `p`, `px`, `py`, `flex`, `gap`, `justify`, `items`, `size`, `weight`, `color`
4. Resolves variable references: `bg="var:Primary"` → binds to variable
5. Resolves icon references: `<Icon name="lucide:star" />` → SVG path
6. Returns created node IDs

Elements: `Frame`, `Rectangle`, `Ellipse`, `Text`, `Line`, `Star`, `Polygon`, `Vector`, `Group`, `Icon`, `Instance`, `Component`

The renderer lives in `@open-pencil/core` (no DOM deps) so it works both in-browser and headless.

## System Prompt

```
You are an AI design assistant inside OpenPencil, a design editor.

Current page: {pageName}
{snapshot — compact tree of current page}
Selected: {selectedNodesSummary}
Comments: {visibleComments}

WORKFLOW:
1. Read the design first (snapshot is above, use get_node for details)
2. Create with render (JSX) for new layouts, set_* for edits
3. Verify with screenshot after complex changes
4. Use diff_create to check what changed if unsure

GUIDELINES:
- Use auto-layout for containers (flex="col" or flex="row")
- 8px spacing grid: 8, 16, 24, 32, 48
- Name everything descriptively
- Use variables for colors when they exist (bg="var:Primary")
```

## Comment Pin Data Model

```typescript
interface CommentPin {
  id: string
  text: string
  x: number
  y: number
  nodeId?: string      // attached to a specific node
  resolved: boolean
  createdAt: number
}
```

Stored on `SceneGraph`:

```typescript
comments = new Map<string, CommentPin>()
```

## Implementation Order

1. **JSX renderer in core** — port figma-use's render pipeline to work with our SceneGraph
2. **Backend skeleton** — `packages/ai/` with Bun server, `/api/chat` endpoint, ToolLoopAgent
3. **Chat panel UI** — `ChatPanel.vue` with message list, input, tool timeline, `⌘J` toggle
4. **Core tools** — render (JSX), set_fill, set_layout, set_text, get_page_tree, get_selection, snapshot
5. **Screenshot + diff tools** — screenshot, diff_create, diff_visual, diff_show
6. **Comment system** — comment pins on canvas, included in AI context
7. **Full tool set** — remaining set_*/organize/variable/export tools
8. **Tauri integration** — bundle AI backend as sidecar
