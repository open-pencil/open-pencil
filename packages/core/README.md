# @open-pencil/core

Editor engine for [OpenPencil](https://openpencil.dev): the CanvasKit (Skia WASM) renderer, Yoga layout, the framework-agnostic editor with undo and selection, the Figma Plugin API compatibility layer, the AI/MCP tool definitions, clipboard and vector conversion, and format-neutral document I/O.

It depends on `@open-pencil/scene-graph`, `@open-pencil/pen`, `@open-pencil/kiwi`, and `@open-pencil/fig`, and keeps browser DOM out so it runs in the app, the CLI, the MCP server, and headless scripts alike.

Import the root barrel or the targeted subpaths listed in `package.json` `exports`, for example `@open-pencil/core/io`, `@open-pencil/core/geometry`, and `@open-pencil/core/canvaskit`.

- Programmable overview and SDK docs: https://openpencil.dev/programmable/
- Source and issues: https://github.com/open-pencil/open-pencil

MIT License.
