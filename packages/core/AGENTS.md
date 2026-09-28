# Core

Renderer, layout, editor, Figma API, tools, clipboard, vector conversion, and document I/O. Depends on scene-graph, pen, kiwi, and fig. Framework-neutral: no Vue, no app imports, no browser DOM; guard browser globals explicitly.

Nested guides: `packages/core/src/editor/AGENTS.md`, `packages/core/src/canvas/AGENTS.md`, `packages/core/src/figma-api/AGENTS.md`.

- Public surface is the compatibility barrel plus the subpaths listed in `packages/core/package.json` `exports`; add a subpath there rather than deep-importing.
- CanvasKit runtime loading is centralized in `@open-pencil/core/canvaskit`. Headless raster export may dynamically load `canvaskit-wasm/full`; elsewhere `import type` and pass CanvasKit in.
- Drawing and input share preview-aware geometry through `@open-pencil/core/geometry`, built on Scene Graph matrices. Use it for world/screen transforms, inverses, bounds, and handle placement.

## Layout

- `@open-pencil/yoga-layout` supplies both flexbox and CSS Grid.
- Recompute layout after demo creation and for each materialized or imported page; scope computation to the affected page or subtree where possible.
- The first Hug/Fill dimension mutation switches only that axis to Fixed; focus is non-destructive, and mode/value changes share one undo transaction.

## Components and instances

- Component types use `#9747ff`.
- Component edits propagate through editor component sync in `packages/core/src/editor/components/`; never hand-copy properties in app UI. Use Scene Graph copy helpers for nested values.

## Vector conversion

- Bitmap-to-vector conversion lives in `packages/core/src/vector/vectorize/`; app provider clients, preferences, and credential resolution live under `src/app/editor/vectorize/` in the app. Bound request and response sizes and validate provider-owned download URLs before importing returned SVG.

## Tools (AI, MCP, CLI, WebMCP)

- Operations are `ToolDef`s under `packages/core/src/tools/**`; `schema.ts` defines the contract and registries expose them. Each definition owns its native Valibot `input`, execution/mutation metadata, and optional per-interface exposure exclusions (`mcp`, `ai`, `webmcp`). Exposure defaults to inclusion; adapters use `isToolExposed()`, then apply execution support and user permissions independently.
- Infer arguments from the schema; derive effects and default capabilities from execution metadata. Do not maintain parameter DSLs or tool-name lists. Add work to the nearest existing domain and the appropriate registry.
- `packages/core/src/tools/ai-adapter.ts` converts ToolDefs for Vercel AI; the app binds them to the active editor's `FigmaAPI` in `src/app/ai/tools/index.ts`. MCP v2 registration uses Standard Schema with Valibot JSON Schema conversion; AI and WebMCP adapters share the same input contract.
- `packages/core/src/editor/history/atomic-tool.ts` owns synchronous property/variable transactions; Scene Graph owns checkpoint recovery. AI, MCP, and WebMCP share this execution path. Async and structural tools cannot declare atomic property execution.
- Shared scene-authoring guidance and tested examples live under `packages/core/src/design-jsx/reference/`; `reference.ts` combines them with renderer metadata. Prompts under `packages/core/src/tools/prompts/` and the app chat/ACP prompt compose that reference rather than copying it. Run `bun run generate:authoring-reference` after changes; `check:authoring-reference` (part of `check:docs`) verifies the committed skill/docs copies. Do not edit generated reference files.
- The installable agent skill is maintained in `skills/open-pencil/`. Changes to agent-facing APIs, CLI/MCP behavior, or design authoring must update affected skill examples, prompts, and public documentation in the same change. Keep examples valid in their actual execution environment; do not advertise library exports as scripting globals unless exposed there. Prefer runtime discovery and canonical references over duplicated API/tool inventories.
- MCP-only tools and transports: `packages/mcp/AGENTS.md`. WebMCP registration and app completion: `src/AGENTS.md`.
