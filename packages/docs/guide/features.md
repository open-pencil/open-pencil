# Features

## Figma .fig Files

Open and save native Figma files directly. The import/export pipeline uses the same Kiwi binary codec as Figma — 194 schema definitions, ~390 fields per node. Save with <kbd>⌘</kbd><kbd>S</kbd>, Save As with <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>.

**Copy & paste with Figma** — select nodes in Figma, <kbd>⌘</kbd><kbd>C</kbd>, switch to OpenPencil, <kbd>⌘</kbd><kbd>V</kbd>. Fills, strokes, auto-layout, text, effects, corner radii, and vector networks are preserved. Works both ways.

## Drawing & Editing

- **Shapes** — Rectangle (<kbd>R</kbd>), Ellipse (<kbd>O</kbd>), Line (<kbd>L</kbd>), Polygon, Star
- **Pen tool** — vector networks (not simple paths), bezier curves with tangent handles
- **Text** — canvas-native editing with IME support, double-click to enter edit mode
- **Rich text** — per-character bold (<kbd>⌘</kbd><kbd>B</kbd>), italic (<kbd>⌘</kbd><kbd>I</kbd>), underline (<kbd>⌘</kbd><kbd>U</kbd>), strikethrough
- **Auto-layout** — flexbox and CSS Grid via Yoga WASM: direction, gap, padding, justify, align, child sizing, grid tracks. <kbd>⇧</kbd><kbd>A</kbd> to toggle
- **Components** — create (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd>), component sets (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd>), instances with override support, live sync
- **Variables** — design tokens with collections, modes (Light/Dark), color/float/string/boolean types, variable binding
- **Sections** — organizational containers with auto-adopting children and title pills

## Properties Panel

Context-sensitive Design | Code | AI tabs:

- **Appearance** — opacity, corner radius (uniform or per-corner), visibility
- **Fill** — solid, gradient (linear/radial/angular/diamond), image
- **Stroke** — color, weight, align (inside/center/outside), per-side weights, cap, join, dash
- **Effects** — drop shadow, inner shadow, layer blur, background blur, foreground blur
- **Typography** — font picker with virtual scroll and search, weight, size, alignment, style buttons
- **Layout** — auto-layout controls when enabled
- **Export** — scale, format (PNG/JPG/WEBP/SVG), live preview

## Rendering

Skia (CanvasKit WASM) — the same rendering engine as Figma:

- Gradient fills (linear, radial, angular, diamond)
- Image fills with scale modes
- Effects with per-node caching
- Arc data (partial ellipses, donuts)
- Viewport culling and paint reuse
- Snap guides with rotation-aware alignment
- Canvas rulers with selection badges
- Hover highlight that follows actual geometry

## Undo/Redo

Every operation is undoable — creation, deletion, moves, resizes, property changes, reparenting, layout changes, variable operations. Uses an inverse-command pattern. <kbd>⌘</kbd><kbd>Z</kbd> / <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd>.

## Multi-Page Documents

Add, delete, rename pages. Each page has independent viewport state. Double-click to rename inline.

## Multi-File Tabs

Open multiple documents in tabs. <kbd>⌘</kbd><kbd>T</kbd> new tab, <kbd>⌘</kbd><kbd>W</kbd> close, <kbd>⌘</kbd><kbd>O</kbd> open file.

## Export

- **Image** — PNG, JPG, WEBP at configurable scale (0.5×–4×). Via panel, context menu, or <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd>
- **SVG** — shapes, text with style runs, gradients, effects, blend modes
- **Tailwind JSX** — HTML with Tailwind v4 utility classes, ready for React or Vue
- **Copy as** — text, SVG, PNG (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd>), or JSX via context menu

CLI: `open-pencil export design.fig -f jsx --style tailwind`

## AI Chat

Press <kbd>⌘</kbd><kbd>J</kbd> to open the AI assistant. 87 tools that can create shapes, set styles, manage layout, work with components and variables, run boolean operations, analyze design tokens, and export assets. Bring your own OpenRouter API key.

Tool calls display as collapsible timeline entries. Model selector with Claude, Gemini, GPT, DeepSeek, and others.

## MCP Server

Connect Claude Code, Cursor, Windsurf, or any MCP client to read and write `.fig` files headlessly. 90 tools (87 core + 3 file management). Two transports: stdio and HTTP.

```sh
bun add -g @open-pencil/mcp
```

```json
{
  "mcpServers": {
    "open-pencil": {
      "command": "openpencil-mcp"
    }
  }
}
```

See [MCP Tools reference](/programmable/mcp-server) for the full tool list.

## CLI

Inspect, export, and analyze `.fig` files from the terminal:

```sh
open-pencil tree design.fig          # Node tree
open-pencil find design.fig --type TEXT  # Search
open-pencil export design.fig -f png     # Render
open-pencil analyze colors design.fig    # Color audit
open-pencil analyze clusters design.fig  # Repeated patterns
open-pencil eval design.fig -c "..."     # Figma Plugin API
```

When the desktop app is running, omit the file to control the live editor via RPC:

```sh
open-pencil tree                     # Live document
open-pencil export -f png            # Screenshot canvas
```

All commands support `--json`. Install: `bun add -g @open-pencil/cli`

## Real-Time Collaboration

P2P via WebRTC — no server required. Share a link and edit together.

- Live cursors with colored arrows and name pills
- Presence avatars
- Follow mode — click a peer to follow their viewport
- Local persistence via IndexedDB
- Secure room IDs via `crypto.getRandomValues()`

## Desktop & Web

**Desktop** — Tauri v2, ~7 MB. macOS (signed & notarized), Windows, Linux. Native menus, offline, autosave.

**Web** — runs at [app.openpencil.dev](https://app.openpencil.dev), installable as a PWA on mobile with touch-optimized UI.

**Homebrew:**

```sh
brew install open-pencil/tap/open-pencil
```

## Google Fonts Fallback

When a font isn't available locally, OpenPencil fetches it from Google Fonts automatically. No manual installation needed when opening .fig files with unfamiliar fonts.
