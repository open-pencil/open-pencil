# OpenPencil

Open-source, AI-native design editor. Figma-compatible, AI-first, fully local.

> **Status:** Active development. Not ready for production use.

**[Try it online →](https://app.openpencil.dev)** · [Download](https://github.com/open-pencil/open-pencil/releases/latest) · [Documentation](https://openpencil.dev)

> **What's next**
>
> - Live reload when .fig file changes on disk (MCP server → desktop app workflow)
> - More AI providers (Anthropic API, Claude Code subscription, Gemini, local models via Ollama)
> - Code signing (Apple & Azure certificates for properly signed binaries)
> - Improving .fig compatibility across a larger set of files
> - CI tools — design linting, code export, visual regression in pipelines

![OpenPencil](packages/docs/public/screenshot.png)

## Why

Figma is a closed platform that actively fights programmatic access. Their [MCP server](https://www.figma.com/blog/introducing-figma-mcp-server/), launched in June 2025, was read-only — you could pull design context but not create or modify anything. [figma-use](https://github.com/dannote/figma-use) filled that gap in January 2026 with full read/write design automation via CDP. A month later, [Figma 126.1.2 started stripping `--remote-debugging-port`](https://forum.figma.com/report-a-problem-6/remote-debugging-port-not-working-in-figma-desktop-126-1-2-50858) on startup — killing CDP-based tools. Figma has since added UI-to-Figma capture via their MCP server, but it still can't programmatically create or modify design nodes.

This is a supply chain problem. Designers and developers build workflows on top of their design tool. When that tool is closed-source, the vendor controls what's possible. They can break your tooling overnight with a point release. Your design files are in a proprietary binary format that only their software can fully read.

Coding tools went through the same shift. VS Code opened the editor. LLMs opened code generation. Projects like [pi](https://github.com/mariozechner/pi-coding-agent) opened the AI coding agent. Design tools are next.

OpenPencil is:

- **Open source** — MIT license, read and modify everything
- **Figma-compatible** — opens .fig files natively, copy & paste nodes between apps
- **AI-native** — built-in chat with tool use, bring your own API key, no vendor lock-in
- **Free forever** — no account, no subscription, no internet required, ~7 MB install
- **Programmable** — headless CLI, every operation is scriptable

Your design files are yours. Your tools should be too.

## Features

- **Figma .fig file import and export** — read and write native Figma files
- **Copy & paste with Figma** — select nodes in Figma, paste into OpenPencil (and vice versa). Uses the same Kiwi binary format as .fig files
- **Real-time collaboration** — P2P via WebRTC, no server required. Cursors, presence, follow mode
- **Drawing tools** — shapes, pen tool with vector networks, rich text with system fonts, auto-layout, components with live sync, variables with modes and collections
- **AI chat** — describe what you want, the AI builds it. 75 tools wired to chat, CLI, and MCP
- **MCP server** — connect Claude Code, Cursor, or any MCP client to read/write .fig files headlessly
- **Headless CLI** — inspect, search, analyze, and render .fig files without a GUI
- **~7 MB desktop app** — Tauri v2, macOS/Windows/Linux. Also runs in the browser

## Tech Stack

| Layer | Tech |
|-------|------|
| UI | Vue 3, VueUse, Reka UI |
| Styling | Tailwind CSS 4 |
| Rendering | Skia (CanvasKit WASM) |
| Layout | Yoga WASM |
| File format | Kiwi binary (vendored) + Zstd + ZIP |
| Color | culori |
| Collaboration | Trystero (WebRTC P2P) + Yjs (CRDT) + y-indexeddb |
| Desktop | Tauri v2 |
| CLI | citty, agentfmt |
| MCP | @modelcontextprotocol/sdk, Hono |
| Testing | Playwright (visual regression), bun:test (unit) |
| Tooling | Vite 7, oxlint, oxfmt, typescript-go |

## Getting Started

```sh
bun install
bun run dev
```

## Collaboration

Share a link to co-edit in real time. No server, no account — peers connect directly via WebRTC.

1. Click the share button in the top-right panel
2. Share the generated link (`app.openpencil.dev/share/<room-id>`)
3. Collaborators see your cursor, selection, and edits in real time
4. Click a peer's avatar to follow their viewport

All sync happens peer-to-peer via [Trystero](https://github.com/dmotz/trystero). Document state is persisted locally in IndexedDB — refreshing the page keeps your work.

## CLI

Headless .fig file operations — no GUI needed:

```sh
bunx @open-pencil/cli info design.fig         # Document stats, node types, fonts
bunx @open-pencil/cli tree design.fig         # Visual node tree
bunx @open-pencil/cli find design.fig --type TEXT  # Search by name or type
bunx @open-pencil/cli export design.fig       # Render to PNG
bunx @open-pencil/cli export design.fig -f jpg -s 2 -q 90  # JPG at 2x
```

All commands support `--json` for machine-readable output.

## MCP Server

Connect AI coding tools to read and modify `.fig` files headlessly. [Full docs →](https://openpencil.dev/reference/mcp-tools)

**Stdio** (Claude Code, Cursor, Windsurf) — add to your MCP config:

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

**HTTP** (scripts, browser extensions, CI):

```sh
openpencil-mcp-http   # http://localhost:3100/mcp
```

Security defaults for HTTP transport:
- Binds to `127.0.0.1` by default (`HOST` to override)
- `eval` tool is disabled
- File access is restricted to `OPENPENCIL_MCP_ROOT` (defaults to current working directory)
- Optional auth: set `OPENPENCIL_MCP_AUTH_TOKEN` and send `Authorization: Bearer <token>` (or `x-mcp-token`)
- CORS is disabled by default; set `OPENPENCIL_MCP_CORS_ORIGIN` to allow a specific origin

75 tools: create shapes, set fills/strokes/layout, variables, vectors, boolean ops, viewport, find nodes, open/save `.fig` files, render JSX to design nodes.

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Dev server at http://localhost:1420 |
| `bun run build` | Production build |
| `bun run check` | Lint + typecheck |
| `bun run test` | E2E visual regression |
| `bun run test:update` | Regenerate screenshot baselines |
| `bun run test:unit` | Unit tests |
| `bun run tauri dev` | Desktop app (requires Rust) |

## Desktop App

Requires [Rust](https://rustup.rs/), the Tauri CLI, and platform-specific prerequisites ([Tauri v2 guide](https://v2.tauri.app/start/prerequisites/)).

```sh
bun run tauri dev                      # Dev mode with hot reload
bun run tauri build                    # Production build
bun run tauri build --target universal-apple-darwin  # macOS universal
```

Cross-compilation to other platforms requires their respective toolchains or CI (e.g. GitHub Actions).

### Platform Prerequisites

#### macOS

Install Xcode Command Line Tools:

```sh
xcode-select --install
```

#### Windows

1. Install [Rust](https://rustup.rs/) — make sure the default toolchain is `stable-msvc`:
   ```sh
   rustup default stable-msvc
   ```
2. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload (MSVC compiler + Windows SDK)
3. WebView2 is pre-installed on Windows 10 (1803+) and Windows 11. If missing, download from [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

#### Linux

Install system dependencies (Debian/Ubuntu):

```sh
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

For other distros, see the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/).

## Project Structure

```
packages/
  core/           @open-pencil/core — engine (scene graph, renderer, layout, codec)
  cli/            @open-pencil/cli — headless CLI (info, tree, find, export)
  mcp/            @open-pencil/mcp — MCP server (stdio + HTTP)
  docs/           VitePress documentation site
src/
  ai/             AI tool wiring
  components/     Vue SFCs (canvas, panels, collaboration, color picker)
  composables/    Canvas input, keyboard shortcuts, collaboration, rendering
  views/          Route views
  stores/         Editor state (Vue reactivity)
  engine/         Re-export shims from @open-pencil/core
desktop/          Tauri v2 (Rust + config)
tests/
  e2e/            Playwright visual regression
  engine/         Unit tests
```

## Acknowledgments

Thanks to [@sld0Ant](https://github.com/sld0Ant) (Anton Soldatov) for creating and maintaining the [documentation site](https://openpencil.dev).

## License

MIT
