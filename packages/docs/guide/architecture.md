# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Tauri v2 Shell                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     Editor (Web)                           │  │
│  │                                                            │  │
│  │  Vue 3 UI                   Skia CanvasKit (WASM, 7MB)    │  │
│  │  - Toolbar                  - Vector rendering             │  │
│  │  - Panels                   - Text shaping                 │  │
│  │  - Properties               - Image processing             │  │
│  │  - Layers                   - Effects (blur, shadow)       │  │
│  │  - Color Picker             - Export (PNG, SVG, PDF)       │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │                  Core Engine (TS)                     │ │  │
│  │  │  SceneGraph ─── Layout (Yoga) ─── Selection          │ │  │
│  │  │      │                                  │             │ │  │
│  │  │  Undo/Redo ─── Constraints ─── Hit Testing           │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │              File Format Layer                        │ │  │
│  │  │  .fig import/export ── Kiwi codec ── .svg (planned)  │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  MCP Server (75+ tools, stdio+HTTP)  P2P Collab (Trystero + Yjs)   │
└──────────────────────────────────────────────────────────────────┘
```

## Editor Layout

The UI follows Figma's UI3 layout — toolbar at the bottom, navigation on the left, properties on the right:

- **Navigation panel (left)** — Layers tree, pages panel, asset library (planned)
- **Canvas (center)** — Infinite canvas with CanvasKit rendering, zoom/pan
- **Properties panel (right)** — Context-sensitive sections: Appearance, Fill, Stroke, Typography, Layout, Position
- **Toolbar (bottom)** — Tool selection: Select, Frame, Section, Rectangle, Ellipse, Line, Text, Pen, Hand

## Components

### Rendering (CanvasKit WASM)

The same rendering engine as Figma. CanvasKit provides GPU-accelerated 2D drawing with:
- Vector shapes (rect, ellipse, path, line, star, polygon)
- Text shaping via Paragraph API
- Effects (shadows, blurs, blend modes)
- Export (PNG, SVG, PDF)

The 7MB WASM binary loads at startup and creates a GPU surface on the HTML canvas.

### Scene Graph

Flat `Map<string, Node>` keyed by GUID strings. Tree structure via `parentIndex` references. Provides O(1) lookup, efficient traversal, hit testing, and rectangular area queries for marquee selection.

See [Scene Graph Reference](/reference/scene-graph) for internals.

### Layout Engine (Yoga WASM)

Meta's Yoga provides CSS flexbox layout computation. A thin adapter maps Figma property names to Yoga equivalents:

| Figma Property | Yoga Equivalent |
|---|---|
| `stackMode: HORIZONTAL` | `flexDirection: row` |
| `stackMode: VERTICAL` | `flexDirection: column` |
| `stackSpacing` | `gap` |
| `stackPadding` | `padding` |
| `stackJustify` | `justifyContent` |
| `stackChildPrimaryGrow` | `flexGrow` |

### File Format (Kiwi Binary)

Reuses Figma's proven Kiwi binary codec with 194 message/enum/struct definitions. The `.fig` import pipeline: parse header → Zstd decompress → Kiwi decode → NodeChange[] → scene graph. The export pipeline reverses the process: scene graph → NodeChange[] → Kiwi encode → Zstd compress → ZIP with thumbnail.

See [File Format Reference](/reference/file-format) for details.

### Undo/Redo

Inverse-command pattern. Before applying any change, affected fields are snapshotted. The snapshot becomes the inverse operation. Batching groups rapid changes (like drag) into single undo entries.

### Clipboard

Figma-compatible bidirectional clipboard. Encodes/decodes Kiwi binary (same format as .fig files) using native browser copy/paste events (synchronous, not async Clipboard API). Paste handles vector path scaling, instance child population from components, component set detection, and override application.

### MCP Server

`@open-pencil/mcp` exposes 75 core tools + 3 file management tools (78 total) for AI coding tools. Two transports: stdio for Claude Code/Cursor/Windsurf, HTTP with Hono + Streamable HTTP for scripts and CI. Tools are defined once in `packages/core/src/tools/schema.ts` and adapted for AI chat (valibot), MCP (zod), and CLI (eval command).

### P2P Collaboration

Real-time peer-to-peer collaboration via Trystero (WebRTC) + Yjs CRDT. No server relay — signaling over MQTT public brokers, STUN/TURN for NAT traversal. Awareness protocol provides live cursors, selections, and presence. Local persistence via y-indexeddb.

## What's Next

Current priorities and planned work, in rough order:

### More AI Providers

The AI chat currently routes through OpenRouter. Direct integrations planned: Anthropic API key (skip OpenRouter), Google Gemini, and local models via Ollama. This removes the OpenRouter dependency for users who already have API keys with individual providers.

### Full figma-use Tool Set

The MCP server currently exposes 78 tools. The reference implementation in [figma-use](https://github.com/dannote/figma-use) has 118. The remaining 40 tools cover advanced layout constraints, prototype connections, advanced component property editing, and bulk document operations — all will be ported.

### CI Design Tooling

The headless CLI already supports `analyze colors/typography/spacing/clusters`. Next: integrate these into GitHub Actions workflows for automated design linting (naming conventions, spacing consistency, accessibility contrast ratios) and visual regression in PRs via the headless PNG exporter.

### Prototyping

Frame-to-frame transitions, interaction triggers (click, hover, drag), overlay management, and a fullscreen preview mode. This is a large feature set — tracked as Phase 6 in the original roadmap.

### CSS Grid Layout

Yoga WASM currently supports flexbox only. CSS Grid support is upstream in [facebook/yoga#1893](https://github.com/facebook/yoga/pull/1893) (9 PRs merged). OpenPencil will adopt it once the Yoga release ships — no custom grid engine needed.

### PDF Export

SVG export shipped in v0.7.0. PDF export requires either a server-side headless renderer or CanvasKit's PDF canvas backend — the latter is being investigated for a client-side implementation.

### .fig Fidelity

Ongoing improvement of import/export round-trip accuracy for complex real-world files: advanced prototype connections, complex component property assignments, interaction effects, and rare node types not yet in the codec.

### Code Signing

macOS binaries are signed and notarized since v0.6.0. Windows Authenticode signing via Azure Code Signing is planned to remove the "unknown publisher" SmartScreen warning on Windows installers.
