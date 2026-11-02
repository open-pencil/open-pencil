# Lawha · لوحة

Design editor for interfaces, print and social media, with a complete Arabic interface and built-in AI. Runs in the browser and as a desktop app (Tauri v2).

> **Status:** active development, not yet released.

## What it does

- **Design files:** open, edit and save `.fig` (Figma) and `.pen` files, and import HTML, SVG and draw.io. Export to PNG, JPG, WEBP, SVG, PDF, PPTX, HTML, JSX/Tailwind and design tokens.
- **Arabic first:** full Arabic interface with a mirrored (right-to-left) layout, correct Arabic shaping and bidirectional text, and visual text alignment that matches the alignment buttons.
- **Google Fonts built in:** the whole Google Fonts catalogue is listed and downloaded on demand, including Arabic families such as Cairo, Tajawal, Almarai, Amiri and IBM Plex Sans Arabic.
- **Adapt a design in one click** (Design panel → *Adapt design*):
  - **Screens:** mobile, tablet and desktop copies resized to each width so auto layout reflows them.
  - **Social media:** Instagram, Story, X, LinkedIn, YouTube and more at each platform's size.
  - **Print, ready for the press:** 23 products (business cards, flyers, posters, folded brochures, cards, stickers, envelope, folder, tuck-end box, roll-up) with real sizes, bleed and safe area. The die-line is generated on a locked layer: cut path `CutContour` in magenta, folds in dashed cyan.
- **Mockups:** present a design inside a phone, tablet, laptop, monitor, browser window or watch.
- **AI and automation:** built-in chat with 100+ editing tools, an MCP server for coding agents, a CLI, and a Figma Plugin API–compatible scripting API.
- **Collaboration:** peer-to-peer rooms over WebRTC.
- **Private by default:** no usage pings, no hosted cloud and no auto-update unless this project turns them on with its own servers and signing key.

## Development

```sh
bun install
bun run dev          # Web editor at http://localhost:1420
bun run tauri dev    # Desktop app (requires Rust and the Tauri v2 prerequisites)
```

Quality gates: `bun run check`, `bun run test:unit` and `bun run test`. [AGENTS.md](AGENTS.md) maps the repository and links the guide inside each package; [CONTRIBUTING.md](CONTRIBUTING.md) covers setup and commits.

### Tech stack

| Layer         | Tech                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------- |
| Rendering     | Skia (CanvasKit WASM)                                                                    |
| Layout        | Yoga WASM (flex + grid via [fork](https://github.com/open-pencil/yoga/tree/grid))        |
| UI            | Vue 3, Reka UI, Tailwind CSS 4                                                           |
| File format   | Kiwi binary + Zstd + ZIP                                                                 |
| Collaboration | Trystero (WebRTC P2P) + Yjs (CRDT)                                                       |
| Desktop       | Tauri v2                                                                                 |
| AI/MCP        | Vercel AI SDK (multi-provider, bring your own key), MCP SDK, Hono                        |

## Origin and license

Lawha is an independent product built on [OpenPencil](https://github.com/open-pencil/open-pencil) by Danila Poyarkov and the OpenPencil contributors, used under the MIT License. It is not affiliated with or endorsed by the OpenPencil project. The original copyright notice is kept in [LICENSE](./LICENSE), as the license requires.

Lawha is licensed under the [MIT License](./LICENSE). The optional Cloud package (`packages/cloud`) remains under the [Apache License 2.0](./LICENSES/Apache-2.0.txt); [`REUSE.toml`](./REUSE.toml) lists the exact paths.
