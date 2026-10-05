# OpenPencil

[![MIT license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![npm](https://img.shields.io/npm/v/@open-pencil/cli?label=%40open-pencil%2Fcli)](https://www.npmjs.com/package/@open-pencil/cli)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/4wXc9fuZfm)
[![GitHub Discussions](https://img.shields.io/github/discussions/open-pencil/open-pencil?logo=github&label=Discussions)](https://github.com/open-pencil/open-pencil/discussions)

Open-source design editor. Opens `.fig` and `.pen` design files, includes built-in AI, and ships as a programmable toolkit with a headless Vue SDK for building custom editors.

> **Status:** Active development. Usable today, with some rough edges as features evolve.

**[Try it online →](https://app.openpencil.dev/demo)** · [Download](https://github.com/open-pencil/open-pencil/releases/latest) · [Documentation](https://openpencil.dev) · [Roadmap](https://openpencil.dev/development/roadmap) · [llms.txt](https://openpencil.dev/llms.txt)

![OpenPencil](packages/docs/public/screenshot.png)

## Installation

**macOS (Homebrew):**

```sh
brew install --cask openpencil
```

Or download from the [releases page](https://github.com/open-pencil/open-pencil/releases/latest), or [use the web app](https://app.openpencil.dev) — no install needed.

Requires macOS 13 or later with current Safari updates, Windows 10 or later, or Linux with WebKitGTK 2.40+; the web app needs Chrome 111, Edge 111, Firefox 128, or Safari 16.4 or later. See [system requirements](https://openpencil.dev/getting-started#system-requirements).

## What it does

- **Opens `.fig` and `.pen` files** — read and write native Figma files, open supported Pencil documents from the app or OS file browser, copy & paste nodes between apps
- **AI builds designs** — describe what you want in chat, 100+ tools create and modify nodes. Connect OpenRouter, Anthropic, OpenAI, Google AI, DeepSeek, Z.ai, MiniMax, or compatible endpoints
- **Fully programmable** — headless CLI, XPath queries, Figma Plugin API plus an `openpencil` API via `eval`, MCP server for AI agents, and desktop agent integrations for Claude Code, Codex, and Gemini CLI
- **Lint, convert, and extract tokens** — inspect documents, lint naming/layout/accessibility, convert between supported formats, analyze colors/typography/spacing/clusters, and extract design tokens
- **Components and variants** — create reusable components, group variants into component sets, insert local assets as instances, and switch variants from the inspector
- **Working controls** — give a component a Reka UI behaviour (switch, slider, tabs, text field, …) and preview it live over the canvas, with real inputs, focus, and keyboard
- **Image vectorization** — convert image layers into editable vector layers with Recraft or fal.ai
- **Design-to-code export** — export selections as JSX/Tailwind, generate token outputs, and map designs into component-oriented code workflows
- **Vue SDK for custom editors** — headless components and composables for embedding OpenPencil into other apps or building workflow-specific editing surfaces. [Read the SDK docs →](https://openpencil.dev/programmable/sdk/)
- **Real-time collaboration** — P2P via WebRTC, no server, no account. Cursors, presence, follow mode
- **Auto layout & CSS Grid** — flex and grid layout via Yoga WASM, with gap, padding, alignment, track sizing
- **~15 MB desktop app** — Tauri v2 for macOS, Windows, Linux. Also runs in the browser as a PWA

## CLI

```sh
npm install -g @open-pencil/cli
# or: bun add -g @open-pencil/cli
```

### Inspect design files

Browse node trees, search by name or type, dig into properties — all without opening the editor:

```sh
openpencil tree design.fig
openpencil find design.pen --type TEXT
openpencil node design.fig --id 1:23
openpencil info design.fig
```

```
[0] [page] "Getting started" (0:46566)
  [0] [section] "" (0:46567)
    [0] [frame] "Body" (0:46568)
      [0] [frame] "Introduction" (0:46569)
        [0] [frame] "Introduction Card" (0:46570)
          [0] [frame] "Guidance" (0:46571)
```

### Query with XPath

Find nodes by type, attributes, and structure:

```sh
openpencil query design.fig "//FRAME[@width < 300]"  # Frames under 300px
openpencil query design.fig "//SECTION//TEXT"        # Text inside sections
```

### Export, convert, and import

Render to PNG, JPG, WEBP, SVG, PDF, PPTX, HTML, JSX, Storybook stories, or `.fig`, convert between document formats, and turn HTML/CSS into editable layers:

```sh
openpencil export design.fig                  # PNG
openpencil export design.fig -f jpg -s 2      # JPG at 2x
openpencil export design.fig -f tailwind-jsx  # Tailwind JSX
openpencil export design.fig -f storybook     # Storybook stories per component
openpencil convert design.pen design.fig      # Between document formats
openpencil import card.html --css card.css    # HTML/CSS → editable .fig
```

### Lint and analyze

Catch naming, layout, and accessibility issues, and audit a design system's real palette, type scale, spacing, and repeated components:

```sh
openpencil lint design.fig --preset strict  # Naming, layout, accessibility
openpencil analyze colors design.fig        # Also typography, spacing, clusters
openpencil variables design.fig             # Variables and collections
```

```
#1d1b20  ██████████████████████████████ 17155×
#49454f  ██████████████████████████████ 9814×
#ffffff  ██████████████████████████████ 8620×
#6750a4  ██████████████████████████████ 3967×
```

### Script with the Figma Plugin API

`eval` runs JavaScript against the document with Figma's Plugin API; `-w` writes the result back:

```sh
openpencil eval design.fig -c "figma.currentPage.selection.forEach(n => n.opacity = 0.5)" -w
```

### Control the running app

Omit the file argument and the CLI works on the document open in the editor:

```sh
openpencil tree                                 # Inspect the live document
openpencil documents list                       # Also open, new, save, close, activate
openpencil tool call get_selection              # Run any MCP tool
openpencil undo                                 # Undo the newest automation change
openpencil settings set appearance.theme light  # Change editor settings
```

Every command supports `--json`. See the [CLI reference](https://openpencil.dev/reference/cli) for all commands and options.

## AI & MCP

### Built-in chat

Press <kbd>⌘</kbd><kbd>J</kbd> (<kbd>Ctrl</kbd><kbd>J</kbd> on Windows and Linux) to open the AI assistant. It has 100+ tools that can create shapes, set fills and strokes, manage auto-layout, work with components and variables, run boolean operations, analyze design tokens, and export assets. Bring your own API key for OpenRouter, Anthropic, OpenAI, Google AI, DeepSeek, Z.ai, MiniMax, or compatible endpoints. No backend, no account.

Not every provider works in the browser, and not every model streams tool calls correctly. See [BYOK provider & model compatibility](packages/docs/programmable/byok-provider-compatibility.md) for measured results — contributions welcome.

### Coding agents (desktop)

Use Claude Code, Codex, or Gemini CLI directly in the chat panel. The agent connects to the editor's MCP server and uses all 100+ design tools. Requires the desktop app and the agent CLI installed locally.

Pi works too: install `@open-pencil/harness` globally, then add a **Pi** model profile in **Settings → AI & agents**.

**Setup (Claude Code):**

1. Install the ACP adapter: `npm install -g @agentclientprotocol/claude-agent-acp`
2. Add MCP permission to `~/.claude/settings.json`:
   ```json
   {
     "permissions": {
       "allow": ["mcp__open-pencil__*"]
     }
   }
   ```
3. Open the desktop app → <kbd>⌘</kbd><kbd>J</kbd> → select **Claude Code** from the provider dropdown

### MCP server

Connect Claude Code, Cursor, Windsurf, or any MCP client to inspect, modify, and export design documents headlessly. 100+ tools. [Full docs →](https://openpencil.dev/programmable/mcp-server)

**Stdio** (Claude Code, Cursor, Windsurf):

```sh
npm install -g @open-pencil/mcp
claude mcp add --scope user open-pencil -- openpencil-mcp
```

For other MCP clients:

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
openpencil-mcp-http   # Unix socket on macOS/Linux + http://127.0.0.1:7600/mcp
```

Set `OPENPENCIL_MCP_ROOT` to limit file access to one directory; it defaults to the current working directory.

### [AI agent skill](skills/open-pencil/SKILL.md)

Teach your AI coding agent to use OpenPencil — inspect designs, export assets, analyze tokens, modify .fig files:

```sh
npx skills add open-pencil/open-pencil
```

Works with Claude Code, Cursor, Windsurf, Codex, and any agent that supports [skills](https://skills.sh).

For documentation-aware agents, the docs site publishes [llms.txt](https://openpencil.dev/llms.txt), [llms-full.txt](https://openpencil.dev/llms-full.txt), and per-page Markdown files generated from the VitePress docs.

## Collaboration

Share a link to co-edit in real time. No server, no account — peers connect directly via WebRTC.

1. Click the share button in the top-right panel
2. Share the generated link (`app.openpencil.dev/share/<room-id>`)
3. Collaborators see your cursor, selection, and edits in real time
4. Click a peer's avatar to follow their viewport

## Why

Figma is a closed platform that actively fights programmatic access. Their MCP server is read-only. [figma-use](https://github.com/dannote/figma-use) added full read/write automation via CDP — then [Figma 126 killed CDP](https://forum.figma.com/report-a-problem-6/remote-debugging-port-not-working-in-figma-desktop-126-1-2-50858). Your design files are in a proprietary binary format that only their software can fully read. Your workflows break when they decide to ship a point release.

OpenPencil is the alternative: open source (MIT), reads .fig files natively, every operation is scriptable, and your data never leaves your machine.

See the [roadmap](https://openpencil.dev/development/roadmap) for product direction and current Figma compatibility gaps.

## Community

- **[Discord](https://discord.gg/4wXc9fuZfm)** — chat, quick questions, and showing a problem live
- **[GitHub Discussions](https://github.com/open-pencil/open-pencil/discussions)** — [Q&A](https://github.com/open-pencil/open-pencil/discussions/categories/q-a) for help, [Ideas](https://github.com/open-pencil/open-pencil/discussions/categories/ideas) for feature proposals, [Show and tell](https://github.com/open-pencil/open-pencil/discussions/categories/show-and-tell) for what you built; maintainers post [Announcements](https://github.com/open-pencil/open-pencil/discussions/categories/announcements) there
- **[Issues](https://github.com/open-pencil/open-pencil/issues)** — reproducible bugs; report security problems through a [private advisory](https://github.com/open-pencil/open-pencil/security/advisories/new)

## Contributing

```sh
bun install
bun run dev:portless  # Web editor at https://open-pencil.localhost
bun run tauri dev     # Desktop app (requires Rust)
```

[CONTRIBUTING.md](CONTRIBUTING.md) covers setup, quality gates, pull requests, and commits. [AGENTS.md](AGENTS.md) maps the repository and links the guide inside each package. Desktop builds need [Rust](https://rustup.rs/) and the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/); run `bun run tauri build`.

### Tech stack

| Layer         | Tech                                                                              |
| ------------- | --------------------------------------------------------------------------------- |
| Rendering     | Skia (CanvasKit WASM)                                                             |
| Layout        | Yoga WASM (flex + grid via [fork](https://github.com/open-pencil/yoga/tree/grid)) |
| UI            | Vue 3, Reka UI, Tailwind CSS 4                                                    |
| File format   | Kiwi binary + Zstd + ZIP                                                          |
| Collaboration | Trystero (WebRTC P2P) + Yjs (CRDT)                                                |
| Desktop       | Tauri v2                                                                          |
| AI/MCP        | Vercel AI SDK (multi-provider BYOK), MCP SDK, Hono                                |

## Acknowledgments

Thanks to [@sld0Ant](https://github.com/sld0Ant) (Anton Soldatov) for creating and maintaining the [documentation site](https://openpencil.dev).

## License

OpenPencil is licensed under the [MIT License](./LICENSE).

Copyright (c) 2026 Danila Poyarkov and OpenPencil contributors.
