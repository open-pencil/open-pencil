# OpenPencil

Open-source design editor. Opens Figma files, built-in AI, fully programmable.

> **Status:** Active development. Not ready for production use.

**[Try it online →](https://app.openpencil.dev/demo)** · [Download](https://github.com/open-pencil/open-pencil/releases/latest) · [Documentation](https://openpencil.dev)

![OpenPencil](packages/docs/public/screenshot.png)

## Installation

**macOS (Homebrew):**

```sh
brew install open-pencil/tap/open-pencil
```

Or download from the [releases page](https://github.com/open-pencil/open-pencil/releases/latest), or [use the web app](https://app.openpencil.dev) — no install needed.

## What it does

- **Opens .fig files** — read and write native Figma files, copy & paste nodes between apps
- **AI builds designs** — describe what you want in chat, 90 tools create and modify nodes. Bring your own API key
- **Fully programmable** — headless CLI, Figma Plugin API via `eval`, MCP server for AI agents
- **Real-time collaboration** — P2P via WebRTC, no server, no account. Cursors, presence, follow mode
- **Auto layout & CSS Grid** — flex and grid layout via Yoga WASM, with gap, padding, alignment, track sizing
- **Tailwind CSS export** — export any selection as HTML with Tailwind v4 utility classes
- **~7 MB desktop app** — Tauri v2 for macOS, Windows, Linux. Also runs in the browser as a PWA

## CLI

```sh
bun add -g @open-pencil/cli
```

### Inspect .fig files

Browse node trees, search by name or type, dig into properties — all without opening the editor:

```sh
open-pencil tree design.fig
open-pencil find design.fig --type TEXT
open-pencil node design.fig --id 1:23
open-pencil info design.fig
```

```
[0] [page] "Getting started" (0:46566)
  [0] [section] "" (0:46567)
    [0] [frame] "Body" (0:46568)
      [0] [frame] "Introduction" (0:46569)
        [0] [frame] "Introduction Card" (0:46570)
          [0] [frame] "Guidance" (0:46571)
```

### Export

Render to PNG, JPG, WEBP, SVG — or export as JSX with Tailwind utility classes:

```sh
open-pencil export design.fig                          # PNG
open-pencil export design.fig -f jpg -s 2 -q 90       # JPG at 2x, quality 90
open-pencil export design.fig -f jsx --style tailwind  # Tailwind JSX
```

```html
<div className="flex flex-col gap-4 p-6 bg-white rounded-xl">
  <p className="text-2xl font-bold text-[#1D1B20]">Card Title</p>
  <p className="text-sm text-[#49454F]">Description text</p>
</div>
```

### Analyze design tokens

Audit an entire design system from the terminal — find inconsistencies, extract the real palette, spot components waiting to be extracted:

```sh
open-pencil analyze colors design.fig
open-pencil analyze typography design.fig
open-pencil analyze spacing design.fig
open-pencil analyze clusters design.fig
```

```
#1d1b20  ██████████████████████████████ 17155×
#49454f  ██████████████████████████████ 9814×
#ffffff  ██████████████████████████████ 8620×
#6750a4  ██████████████████████████████ 3967×

3771× frame "container" (100% match)
     size: 40×40, structure: Frame > [Frame]

2982× instance "Checkboxes" (100% match)
     size: 48×48, structure: Instance > [Frame]
```

### Script with Figma Plugin API

`eval` gives you the full Figma Plugin API. Modify the file, write it back:

```sh
open-pencil eval design.fig -c "figma.currentPage.children.length"
open-pencil eval design.fig -c "figma.currentPage.selection.forEach(n => n.opacity = 0.5)" -w
```

### Control the running app

When the desktop app is running, omit the file argument — the CLI connects via RPC and operates on the live canvas. Useful for automation scripts, CI pipelines, or AI agents that need to interact with the editor:

```sh
open-pencil tree                               # Inspect the live document
open-pencil export -f png                      # Screenshot the current canvas
open-pencil eval -c "figma.currentPage.name"   # Query the editor
```

All commands support `--json` for machine-readable output.

## AI & MCP

### Built-in chat

Press <kbd>⌘</kbd><kbd>J</kbd> to open the AI assistant. It has 87 tools that can create shapes, set fills and strokes, manage auto-layout, work with components and variables, run boolean operations, analyze design tokens, and export assets. Bring your own OpenRouter API key — no backend, no account.

### MCP server

Connect Claude Code, Cursor, Windsurf, or any MCP client to read and write `.fig` files headlessly. 90 tools (87 core + 3 file management). [Full docs →](https://openpencil.dev/reference/mcp-tools)

**Stdio** (Claude Code, Cursor, Windsurf):

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

**HTTP** (scripts, CI):

```sh
openpencil-mcp-http   # http://localhost:3100/mcp
```

### AI agent skill

Teach your AI coding agent to use OpenPencil — inspect designs, export assets, analyze tokens, modify .fig files:

```sh
npx skills add open-pencil/skills@open-pencil
```

Works with Claude Code, Cursor, Windsurf, Codex, and any agent that supports [skills](https://skills.sh).

## Collaboration

Share a link to co-edit in real time. No server, no account — peers connect directly via WebRTC.

1. Click the share button in the top-right panel
2. Share the generated link (`app.openpencil.dev/share/<room-id>`)
3. Collaborators see your cursor, selection, and edits in real time
4. Click a peer's avatar to follow their viewport

## Why

Figma is a closed platform that actively fights programmatic access. Their MCP server is read-only. [figma-use](https://github.com/dannote/figma-use) added full read/write automation via CDP — then [Figma 126 killed CDP](https://forum.figma.com/report-a-problem-6/remote-debugging-port-not-working-in-figma-desktop-126-1-2-50858). Your design files are in a proprietary binary format that only their software can fully read. Your workflows break when they decide to ship a point release.

OpenPencil is the alternative: open source (MIT), reads .fig files natively, every operation is scriptable, and your data never leaves your machine.

## Roadmap

- 100% .fig compatibility — full rendering parity with Figma
- Shader effects (SkSL) — custom visual effects via GPU shaders
- Skewing and OkHCL color support
- Raster tile caching — instant zoom/pan for complex documents
- Component libraries — publish, share, and consume design systems
- CI tools — design linting, code export, visual regression in pipelines
- Windows code signing (Azure certificates for properly signed binaries)
- Experimental WebGPU/Graphite rendering backend

## Contributing

### Setup

```sh
bun install
bun run dev        # Dev server at localhost:1420
bun run tauri dev  # Desktop app (requires Rust)
```

### Quality gates

| Command | Description |
|---------|-------------|
| `bun run check` | Lint + typecheck |
| `bun run test` | E2E visual regression |
| `bun run test:unit` | Unit tests |
| `bun run format` | Code formatting |

### Project structure

```
packages/
  core/           @open-pencil/core — engine (scene graph, renderer, layout, codec)
  cli/            @open-pencil/cli — headless CLI
  mcp/            @open-pencil/mcp — MCP server (stdio + HTTP)
  docs/           Documentation site (openpencil.dev)
src/              Vue app (components, composables, stores)
desktop/          Tauri v2 (Rust + config)
tests/            E2E (188 tests) + unit (764 tests)
```

### Tech stack

| Layer | Tech |
|-------|------|
| Rendering | Skia (CanvasKit WASM) |
| Layout | Yoga WASM |
| UI | Vue 3, Reka UI, Tailwind CSS 4 |
| File format | Kiwi binary + Zstd + ZIP |
| Collaboration | Trystero (WebRTC P2P) + Yjs (CRDT) |
| Desktop | Tauri v2 |
| AI/MCP | OpenRouter, @modelcontextprotocol/sdk, Hono |

### Desktop builds

Requires [Rust](https://rustup.rs/) and platform-specific prerequisites ([Tauri v2 guide](https://v2.tauri.app/start/prerequisites/)).

```sh
bun run tauri build
```

## Acknowledgments

Thanks to [@sld0Ant](https://github.com/sld0Ant) (Anton Soldatov) for creating and maintaining the [documentation site](https://openpencil.dev).

## License

MIT
