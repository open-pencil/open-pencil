# Inkly

Open-source design editor. Opens `.fig` and `.pen` design files, includes built-in AI, and ships as a programmable toolkit with a headless Vue SDK for building custom editors.

> **Status:** Active development. Not ready for production use.
>
> **Note:** There is another open-source project with the same name — [Inkly by ZSeven-W](https://github.com/ZSeven-W/inkly), focused on AI-native design-to-code workflows. This project focuses on Figma-compatible visual design with real-time collaboration.

**[Try it online →](https://app.inkly.dev/demo)** · [Download](https://github.com/cardene777/open-pencil/releases/latest) · [Documentation](https://inkly.dev) · [llms.txt](https://inkly.dev/llms.txt)

![Inkly](packages/docs/public/screenshot.png)

## Installation

**macOS (Homebrew):**

```sh
brew install inkly
```

Or download from the [releases page](https://github.com/cardene777/open-pencil/releases/latest), or [use the web app](https://app.inkly.dev) — no install needed.

## What it does

- **Opens `.fig` and `.pen` files** — read and write native Figma files, open supported Pencil documents from the app or OS file browser, copy & paste nodes between apps
- **AI builds designs** — describe what you want in chat, 90+ tools create and modify nodes. Connect OpenRouter, Anthropic, OpenAI, Google AI, Z.ai, MiniMax, or compatible endpoints
- **Fully programmable** — headless CLI, XPath queries, Figma Plugin API via `eval`, MCP server for AI agents, and desktop agent integrations for Claude Code, Codex, and Gemini CLI
- **Lint, convert, and extract tokens** — inspect documents, lint naming/layout/accessibility, convert between supported formats, analyze colors/typography/spacing/clusters, and extract design tokens
- **Components and variants** — create reusable components, group variants into component sets, insert local assets as instances, and switch variants from the inspector
- **Design-to-code export** — export selections as JSX/Tailwind, generate token outputs, and map designs into component-oriented code workflows
- **Vue SDK for custom editors** — headless components and composables for embedding Inkly into other apps or building workflow-specific editing surfaces. [Read the SDK docs →](https://inkly.dev/programmable/sdk/)
- **Real-time collaboration** — P2P via WebRTC, no server, no account. Cursors, presence, follow mode
- **Notification inbox for signed-in users** — unread badges and a notification center for board invites, team invites, and mentions
- **Auto layout & CSS Grid** — flex and grid layout via Yoga WASM, with gap, padding, alignment, track sizing
- **~7 MB desktop app** — Tauri v2 for macOS, Windows, Linux. Also runs in the browser as a PWA

## CLI

```sh
npm install -g @inkly/cli
# or: bun add -g @inkly/cli
```

### Inspect design files

Browse node trees, search by name or type, dig into properties — all without opening the editor:

```sh
inkly tree design.fig
inkly find design.pen --type TEXT
inkly node design.fig --id 1:23
inkly info design.fig
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

Use XPath selectors to find nodes by type, attributes, and structure:

```sh
inkly query design.fig "//FRAME"                              # All frames
inkly query design.fig "//FRAME[@width < 300]"                # Frames under 300px
inkly query design.fig "//TEXT[contains(@name, 'Button')]"     # Text with 'Button' in name
inkly query design.fig "//*[@cornerRadius > 0]"               # Rounded corners
inkly query design.fig "//SECTION//TEXT"                       # Text inside sections
```

### Export

Render to PNG, JPG, WEBP, SVG, `.fig`, or JSX — or export selections/pages as `.fig` and convert whole documents between supported formats:

```sh
inkly export design.fig                           # PNG
inkly export design.fig -f jpg -s 2 -q 90        # JPG at 2x, quality 90
inkly export design.fig -f fig --page "Page 1"   # Export a page as .fig
inkly export design.fig -f jsx --style tailwind   # Tailwind JSX
inkly convert design.pen output.fig               # Convert between document formats
```

```html
<div className="flex flex-col gap-4 p-6 bg-white rounded-xl">
  <p className="text-2xl font-bold text-[#1D1B20]">Card Title</p>
  <p className="text-sm text-[#49454F]">Description text</p>
</div>
```

### Lint design files

Catch naming, layout, structure, and accessibility issues from the terminal:

```sh
inkly lint design.fig
inkly lint design.pen --preset strict
inkly lint design.fig --rule color-contrast
inkly lint design.fig --list-rules
```

### Analyze and extract design tokens

Audit an entire design system from the terminal — find inconsistencies, extract the real palette, and spot components waiting to be extracted:

```sh
inkly analyze colors design.fig
inkly analyze typography design.fig
inkly analyze spacing design.fig
inkly analyze clusters design.fig
inkly variables design.fig
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
inkly eval design.fig -c "figma.currentPage.children.length"
inkly eval design.fig -c "figma.currentPage.selection.forEach(n => n.opacity = 0.5)" -w
```

### Control the running app

When the desktop app is running, omit the file argument — the CLI connects via RPC and operates on the live canvas. Useful for automation scripts, CI pipelines, or AI agents that need to interact with the editor:

```sh
inkly tree                               # Inspect the live document
inkly export -f png                      # Screenshot the current canvas
inkly eval -c "figma.currentPage.name"   # Query the editor
```

All commands support `--json` for machine-readable output.

## AI & MCP

### Built-in chat

Press <kbd>⌘</kbd><kbd>J</kbd> to open the AI assistant. It has 100+ tools that can create shapes, set fills and strokes, manage auto-layout, work with components and variables, run boolean operations, analyze design tokens, and export assets. Bring your own API key for OpenRouter, Anthropic, OpenAI, Google AI, Z.ai, MiniMax, or compatible endpoints. No backend, no account.

### Coding agents (desktop)

Use Claude Code, Codex, or Gemini CLI directly in the chat panel. The agent connects to the editor's MCP server and uses all 100+ design tools. Requires the desktop app and the agent CLI installed locally.

**Setup (Claude Code):**

1. Install the ACP adapter: `npm install -g @agentclientprotocol/claude-agent-acp`
2. Add MCP permission to `~/.claude/settings.json`:
   ```json
   {
     "permissions": {
       "allow": ["mcp__inkly__*"]
     }
   }
   ```
3. Open the desktop app → <kbd>Ctrl</kbd><kbd>J</kbd> → select **Claude Code** from the provider dropdown

### MCP server

Connect Claude Code, Cursor, Windsurf, or any MCP client to inspect, modify, and export design documents headlessly. 100+ tools. [Full docs →](https://inkly.dev/reference/mcp-tools)

**Stdio** (Claude Code, Cursor, Windsurf):

```sh
npm install -g @inkly/mcp
claude mcp add --scope user inkly -- inkly-mcp
```

For other MCP clients:

```json
{
  "mcpServers": {
    "inkly": {
      "command": "inkly-mcp"
    }
  }
}
```

**HTTP** (scripts, CI):

```sh
inkly-mcp-http   # http://localhost:3100/mcp
```

**File access:** Set `INKLY_MCP_ROOT` to scope file operations (`open_file`, `new_document`, export `path` param) to a directory. Defaults to the current working directory.

### AI agent skill

Teach your AI coding agent to use Inkly — inspect designs, export assets, analyze tokens, modify .fig files:

```sh
npx skills add inkly/skills@inkly
```

Works with Claude Code, Cursor, Windsurf, Codex, and any agent that supports [skills](https://skills.sh).

For documentation-aware agents, the docs site publishes [llms.txt](https://inkly.dev/llms.txt), [llms-full.txt](https://inkly.dev/llms-full.txt), and per-page Markdown files generated from the VitePress docs.

## Collaboration

Share a link to co-edit in real time. No server, no account — peers connect directly via WebRTC.

1. Click the share button in the top-right panel
2. Share the generated link (`app.inkly.dev/share/<room-id>`)
3. Collaborators see your cursor, selection, and edits in real time
4. Click a peer's avatar to follow their viewport

## Why

Figma is a closed platform that actively fights programmatic access. Their MCP server is read-only. [figma-use](https://github.com/dannote/figma-use) added full read/write automation via CDP — then [Figma 126 killed CDP](https://forum.figma.com/report-a-problem-6/remote-debugging-port-not-working-in-figma-desktop-126-1-2-50858). Your design files are in a proprietary binary format that only their software can fully read. Your workflows break when they decide to ship a point release.

Inkly is the alternative: open source (MIT), reads .fig files natively, every operation is scriptable, and your data never leaves your machine.

See the [roadmap](https://inkly.dev/development/roadmap) for product direction and current Figma compatibility gaps.

## Contributing

### Setup

```sh
bun install

# 推奨 — API server (3001) + Vite (1420) を 1 コマンドで起動
cp .env.local.example .env.local   # 初回のみ
bun run dev:full
```

`bun run dev:full` は `scripts/dev.sh` 経由で API server と Vite の両方を並行起動し、`Ctrl+C` で一括停止する。
Editor は `http://localhost:1420/` または `http://localhost:1420/editor` の両方で起動する。
`.env.local` のテスト値は本番では使わない (ダミー dev 値)。

#### 個別に起動したい場合

```sh
bun run dev        # Vite のみ (localhost:1420)
bun run dev:api    # API server のみ (localhost:3001)
bun run tauri dev  # Desktop app (Rust 必要)
```

API を立てずに Vite だけで動かすと `/dashboard` `/boards` 等の auth 必須画面で「Failed to load session」エラーになる。Editor (`/` または `/editor`) は API なしでも閲覧できる。

### DB

ローカル開発は SQLite ファイル (`.context/api-data/inkly.db`) で完結する。
テストは `INKLY_API_DB_MODE=memory` で in-memory にリセット可能。
本番は `.env.local` に `TURSO_DATABASE_URL=libsql://...` (+ optional `TURSO_AUTH_TOKEN`) を設定すると Turso (libSQL remote) に自動切替する。

Turso のセットアップ:

```sh
# Turso CLI install (macOS)
brew install tursodatabase/tap/turso

# プロジェクト DB 作成
turso db create pencil-editor-prod
turso db show pencil-editor-prod --url        # → TURSO_DATABASE_URL
turso db tokens create pencil-editor-prod     # → TURSO_AUTH_TOKEN

# migration (SQL は packages/api/src/db/migrations/)
bun run packages/api/src/db/migrate.ts
```

### Google ログイン

ローカルで本物の Google OAuth を試したい場合のみ設定する (試さないなら未設定で OK、 Google ログインボタンは "Google login is not configured" を返す)。

1. [GCP Console](https://console.cloud.google.com) でプロジェクト作成
2. 「APIs & Services」→「Credentials」→「Create OAuth 2.0 Client ID」(type: Web application)
3. 承認済みリダイレクト URI に `http://localhost:3001/api/auth/callback/google` を追加
4. 取得した Client ID / Client Secret を `.env.local` に書く:

```sh
INKLY_API_GOOGLE_CLIENT_ID=...
INKLY_API_GOOGLE_CLIENT_SECRET=...
```

5. `bun run dev:full` を再起動 → Dashboard で「Google でログイン」が動く

### Quality gates

| Command | Description |
|---------|-------------|
| `bun run check` | Lint + typecheck |
| `bun run test` | E2E visual regression |
| `bun run test:unit` | Unit tests |
| `bun run coverage:unit` | Unit coverage (`.context/coverage/unit/lcov.info`) |
| `bun run coverage:e2e:demo` | Demo E2E coverage for `dashboard.interaction.spec.ts` (`.context/coverage/e2e/`) |
| `bun run coverage:report` | Run unit + demo E2E coverage and print a merged summary |
| `bun run format` | Code formatting |

### Coverage

Coverage artifacts are written under `.context/coverage/` and are intentionally git-ignored.

```sh
bun run coverage:unit
bun run coverage:e2e:demo
bun run coverage:report
```

- Unit coverage uses Bun's native LCOV reporter and writes `.context/coverage/unit/lcov.info`
- Bun threshold enforcement is configured in `bunfig.toml` with an initial baseline of 60% lines / 60% functions / 60% statements
- Bun 1.3.14 does not emit branch data in LCOV, so branch coverage is reported as `n/a` in the merged summary until Bun exposes branch records
- Demo E2E coverage is opt-in and intentionally scoped to `tests/e2e/interaction/dashboard.interaction.spec.ts`; it also copies Playwright trace zips into `.context/coverage/e2e/traces/`
- Prioritize uncovered files with the largest uncovered line counts in the merged report before tightening thresholds

### Project structure

```
packages/
  core/           @inkly/core — engine (scene graph, renderer, layout, file formats, tools)
  vue/            @inkly/vue — headless Vue SDK
  cli/            @inkly/cli — headless CLI
  mcp/            @inkly/mcp — MCP server (stdio + HTTP)
  docs/           Documentation site (inkly.dev)
src/              Vue app (components, composables, stores)
desktop/          Tauri v2 (Rust + config)
tests/            E2E (188 tests) + unit (764 tests)
```

### Tech stack

| Layer | Tech |
|-------|------|
| Rendering | Skia (CanvasKit WASM) |
| Layout | Yoga WASM (flex + grid via [fork](https://github.com/inkly/yoga/tree/grid)) |
| UI | Vue 3, Reka UI, Tailwind CSS 4 |
| File format | Kiwi binary + Zstd + ZIP |
| Collaboration | Trystero (WebRTC P2P) + Yjs (CRDT) |
| Desktop | Tauri v2 |
| AI/MCP | Multi-provider (Anthropic, OpenAI, Google AI, OpenRouter), MCP SDK, Hono |

### Desktop builds

Requires [Rust](https://rustup.rs/) and platform-specific prerequisites ([Tauri v2 guide](https://v2.tauri.app/start/prerequisites/)).

```sh
bun run tauri build
```

## Acknowledgments

Thanks to [@sld0Ant](https://github.com/sld0Ant) (Anton Soldatov) for creating and maintaining the [documentation site](https://inkly.dev).

## License

MIT
