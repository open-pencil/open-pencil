---
title: Roadmap
description: OpenPencil product roadmap and Figma compatibility tracking.
---

# Roadmap

OpenPencil is moving toward production-grade Figma compatibility while keeping design workflows scriptable, local-first, and fast on large files.

## Current focus

- Improve `.fig` import/export fidelity against real Figma files and Figma's own rendering.
- Keep large design systems responsive in the browser and desktop app.
- Make every important editor operation available through the CLI, MCP server, and SDK.
- Keep files on the user's machine unless collaboration is explicitly enabled.

## Near-term work

### Figma fidelity

- Preserve and round-trip more Figma metadata safely.
- Add visual regression coverage for full multi-page `.fig` documents.
- Close high-impact renderer gaps: masks, blend modes, corner smoothing, pattern fills, and variable font axes.
- Improve boolean operation import so Figma `BOOLEAN_OPERATION` nodes remain editable where possible.

### Editor depth

- Complete variable inspector coverage for common numeric/text/layout fields.
- Improve component and instance editing: variant switching, property editing, and override inspection.
- Add first-class layout grid and guide rendering/editing.
- Expand vector editing workflows without regressing imported vector fidelity.

### Automation

- Tighten the inspect → act → render/measure → compare loop for agents.
- Improve deterministic CLI/MCP export and comparison tools for CI.
- Add more design linting and migration helpers for batch `.fig` and `.pen` workflows.
- Package desktop-side MCP integration so local agent workflows do not require global installs.

### Performance and scale

- Incremental layout and render invalidation for large documents.
- Better renderer profiling surfaces for slow nodes, effects, masks, and imported files.
- Smarter raster/retained caching that preserves fidelity during zoom and pan.

### Interactive shader layers

- Add Unicorn Studio-style shader scenes as first-class design layers: animated gradients, particles, noise fields, metaballs, lighting, displacement, and pointer-reactive backgrounds.
- Provide a preset-first editor for common generative visuals before exposing raw shader code.
- Support timeline and interaction inputs such as time, pointer position, scroll, layer bounds, colors, variables, and imported image textures.
- Render shader layers through CanvasKit/WebGL while keeping deterministic raster export for PNG/JPG/WEBP and thumbnails.
- Store shader layer configuration in OpenPencil documents and export graceful fallbacks when a target format cannot preserve the live effect.

## Later

- Prototyping: frame connections, triggers, overlays, transitions, and preview mode.
- Comments: pins, threads, resolution state, and collaboration-aware display.
- Shared libraries: publish, consume, and update components/styles across files.
- Platform polish: Windows code signing, PWA support, packaged updater improvements, and desktop-side MCP bundling.

## Non-goals

- Cloud-first storage or mandatory accounts.
- Read-only automation surfaces that cannot modify documents.
- Feature work that sacrifices `.fig` import/export fidelity for convenience.

This section tracks OpenPencil's current compatibility with Figma Design features. It is based on Figma's public Help Center feature areas and the current OpenPencil scene graph, Kiwi import/export, CanvasKit renderer, UI panels, CLI, and MCP tools.

Legend:

- **✅ Supported** — implemented for common files and expected to work directly.
- **◐ Partial** — implemented for important cases, but missing parity, UI, or edge-case behavior.
- **↩ Round-trip only** — imported/preserved/exported for `.fig` fidelity, but not rendered or editable as a first-class OpenPencil feature.
- **— Not supported** — not currently modeled or intentionally out of scope.

## Official Figma feature areas

Figma's design documentation groups features into these areas:

- Layers, frames, groups, sections, shape layers, text, vectors, and boolean operations.
- Fills, gradients, images, patterns, blend modes, strokes, effects, corner radius, and corner smoothing.
- Auto layout: vertical, horizontal, wrap, grid, padding, gap, hug/fill/fixed/min/max, and ignore auto layout.
- Components, instances, variants, component properties, slots, libraries, and library updates.
- Variables: color, number, string, boolean, collections, modes, aliases, scopes, and prototype variables.
- Prototyping: flows, hotspots, triggers, actions, overlays, smart animate, easing, conditionals, expressions, and variable actions.
- Dev Mode: inspect, measurements, annotations, Code Connect, dev resources, ready-for-dev states, and Figma MCP.
- Collaboration/file workflows: comments, version history, thumbnails, branches, library publishing, and multiplayer metadata.

## Figma compatibility matrix

| Area | Import | Render | UI edit | Export round-trip | CLI/MCP | Notes |
|---|---:|---:|---:|---:|---:|---|
| Pages / canvases | ✅ | ✅ | ✅ | ✅ | ✅ | Multi-page documents and per-page viewport are supported. |
| Frames | ✅ | ✅ | ✅ | ✅ | ✅ | Includes clipping and auto-layout container behavior. |
| Groups | ✅ | ✅ | ✅ | ✅ | ✅ | Grouping preserves visual positions. |
| Sections | ✅ | ✅ | ✅ | ✅ | ✅ | Section rendering and title pills are OpenPencil-specific approximations. |
| Rectangles / rounded rectangles | ✅ | ✅ | ✅ | ✅ | ✅ | Per-corner radii supported; corner smoothing is not rendered. |
| Ellipses / arcs | ✅ | ✅ | ◐ | ✅ | ✅ | `arcData` renders/exports; no full inspector controls. |
| Lines | ✅ | ✅ | ✅ | ✅ | ✅ | Stroke caps/joins render but are not fully exposed in UI. |
| Polygons / stars | ✅ | ✅ | ◐ | ✅ | ✅ | `pointCount` and `starInnerRadius` modeled. |
| Text | ✅ | ✅ | ◐ | ✅ | ✅ | Derived Figma glyphs improve fidelity; advanced typography is partial. |
| Vectors / vector networks | ✅ | ✅ | ◐ | ✅ | ✅ | Vector edit support exists; Figma Draw tools are not fully replicated. |
| Boolean operations | ◐ | ✅ | ◐ | ◐ | ✅ | Engine/renderer support exists, but `.fig` import currently maps Figma `BOOLEAN_OPERATION` nodes to `VECTOR`. |
| Components | ✅ | ✅ | ◐ | ✅ | ✅ | Component metadata, descriptions, links, and publish fields mostly round-trip. |
| Component sets / variants | ✅ | ✅ | ◐ | ✅ | ✅ | Variant values are usable; full component property authoring is incomplete. |
| Instances / overrides | ✅ | ✅ | ◐ | ✅ | ✅ | Raw symbol overrides and derived symbol data are preserved for fidelity. |
| Slots | ↩ | ◐ | — | ↩ | — | Some component property payloads may survive round-trip, but Figma slots are not a first-class workflow. |
| Connectors | ◐ | ◐ | — | ◐ | ◐ | Type exists, but Figma connector semantics are weak. |
| Shape-with-text / FigJam shapes | ◐ | ◐ | — | ◐ | ◐ | Type exists, but not a full FigJam feature implementation. |
| Slices | ◐ | — | ◐ | ◐ | ✅ | Slice-like export regions exist via tooling, not as true Figma slice nodes. |
| FigJam sticky/code/widget/stamp/media/highlight/washi tape | — | — | — | — | — | Not first-class scene nodes. Unsupported types generally fall back or are skipped. |
| Solid fills | ✅ | ✅ | ✅ | ✅ | ✅ | Color variables supported for common fill cases. |
| Gradients | ✅ | ✅ | ✅ | ✅ | ✅ | Linear/radial/angular/diamond support; Figma edge cases may differ. |
| Image fills | ✅ | ✅ | ◐ | ✅ | ✅ | Fill/fit/crop/tile support exists; exact Figma image transform parity is partial. |
| Pattern fills/strokes | — | — | — | — | — | Figma pattern fills are not currently modeled. |
| Video/GIF/media fills | — | — | — | — | — | No video playback or media layer support. |
| Layer/fill/effect blend modes | ✅ | ◐ | — | ✅ | ✅ | Parsed/exported, SVG export maps some modes, but Canvas rendering does not fully apply node/fill/effect blend modes. |
| Opacity | ✅ | ✅ | ✅ | ✅ | ✅ | Node opacity uses save layers in the renderer. |
| Strokes | ✅ | ✅ | ✅ | ✅ | ✅ | Weight, alignment, dashes, and side weights are supported. |
| Stroke caps / joins / miter limit | ✅ | ✅ | ◐ | ✅ | ✅ | Renderer/export support exists; inspector controls are limited. |
| Effects: shadows and blurs | ✅ | ✅ | ✅ | ✅ | ✅ | `showShadowBehindNode` is rendered but not exposed in UI. |
| Effect styles | ↩ | — | — | ↩ | — | Style IDs round-trip; no style manager. |
| Corner radius | ✅ | ✅ | ✅ | ✅ | ✅ | Uniform and independent radii supported. |
| Corner smoothing | ✅ | — | — | ✅ | ✅ | Stored/exported but rendered as ordinary rounded rectangles. |
| Masks | ✅ | ◐ | — | ✅ | ✅ | `isMask`/`maskType` exist; true Figma mask stack/type semantics are incomplete. |
| Auto layout: vertical/horizontal | ✅ | ✅ | ✅ | ✅ | ✅ | Yoga-backed layout. |
| Auto layout: wrap | ✅ | ✅ | ✅ | ✅ | ✅ | UI toggle exists. |
| Auto layout: grid | ✅ | ◐ | ◐ | ✅ | ✅ | CSS-grid-like support is partial. |
| Padding / gaps / alignment | ✅ | ✅ | ✅ | ✅ | ✅ | Common flex controls are exposed. |
| Hug / fill / fixed sizing | ✅ | ✅ | ✅ | ✅ | ✅ | Min/max support is partial in UI. |
| Ignore auto layout / absolute positioning | ✅ | ✅ | ◐ | ✅ | ✅ | Mode is modeled; UI coverage is partial. |
| Strokes included in layout | ✅ | ◐ | — | ✅ | ✅ | Stored/exported and used in layout paths, but no obvious panel control. |
| Reverse z-index / align-content | ✅ | ◐ | — | ✅ | ✅ | Modeled and exported; UI is limited. |
| Constraints | ✅ | ◐ | — | ✅ | ✅ | Tools/API expose constraints; main UI is limited. |
| Layout grids / guides | ↩ | — | — | ↩ | — | `styleIdForGrid` and `guides` are preserved only. |
| Text styles | ↩ | ◐ | — | ↩ | — | Style IDs round-trip; no style management UI. |
| Rich style runs | ✅ | ✅ | ◐ | ✅ | ✅ | Import/render/export support; editing mixed runs is partial. |
| Text auto resize | ✅ | ✅ | ◐ | ✅ | ✅ | Used by renderer/layout; UI does not expose every mode. |
| Text truncation / max lines | ✅ | ✅ | — | ✅ | ✅ | Renderer supports ending truncation; no inspector control. |
| Text case | ✅ | ◐ | — | ✅ | ✅ | Model/export/JSX support; UI missing. |
| Vertical text alignment | ✅ | ◐ | — | ✅ | ✅ | Modeled; UI/render parity needs more coverage. |
| Justified text | ✅ | ◐ | — | ✅ | ✅ | Modeled; UI does not expose it. |
| Font variations / OpenType features | ↩ | — | — | ↩ | — | `fontVariations` are preserved only. |
| Variables: collections/modes/aliases | ✅ | ◐ | ◐ | ✅ | ✅ | Color/number/string/boolean model exists; inspector coverage is still incomplete. |
| Variables bound to fills/strokes | ✅ | ✅ | ✅ | ✅ | ✅ | Common color bindings render and edit. |
| Variables bound to text/layout/visibility/effects | ◐ | ◐ | ◐ | ◐ | ✅ | Some bindings exist; not full Figma property coverage. |
| Variables in prototypes / expressions / conditionals | — | — | — | — | — | Depends on prototype system, which is not implemented. |
| Libraries / publish / update review | ↩ | — | ◐ | ↩ | — | Metadata can survive round-trip; no full library workflow. |
| Prototype flows / starting points | — | — | — | — | — | Not modeled. |
| Prototype hotspots / triggers / actions | — | — | — | — | — | Not modeled. |
| Prototype overlays / scroll-to | — | — | — | — | — | Not modeled. |
| Smart animate / easing / spring / duration | — | — | — | — | — | Not modeled. |
| Interactive components | — | — | — | — | — | Component-level prototype connections are not supported. |
| Dev Mode inspect / measurements / annotations | — | — | — | — | ◐ | OpenPencil has CLI/MCP inspection, but not Figma Dev Mode UI. |
| Code Connect / dev resources / ready-for-dev | — | — | — | — | — | Not modeled. |
| Comments | — | — | — | — | — | Not modeled. |
| Version history / branches | — | — | — | — | — | Not modeled. |
| Real-time collaboration | — | ✅ | ✅ | — | — | OpenPencil has its own P2P collaboration, not Figma-compatible metadata. |

## Raw Kiwi metadata coverage

OpenPencil deliberately preserves many Figma/Kiwi fields even when they are not rendered or editable. These live under `SceneNode.source.fig` and are applied late during `.fig` export.

| Field group | Import/export | Render | UI | Fidelity impact |
|---|---:|---:|---:|---|
| `source.fig.rawSize` | ✅ | Indirect | — | Preserves original Figma size for round-trip. Cleared when size is edited. |
| `source.fig.rawTransform` | ✅ | Indirect | — | Preserves exact Figma transform. Cleared when transform is edited. |
| `source.fig.rawNodeFields` | ✅ | Mixed | — | Late-applied to exported NodeChange for round-trip fidelity. |
| `source.fig.layout` | ✅ | ✅ | ◐ | Preserves original Figma stack metadata while using normalized layout fields. |
| `source.fig.symbolOverrides` | ✅ | Indirect | — | Important for instance override fidelity. |
| `source.fig.componentPropAssignments` | ✅ | Indirect | ◐ | Used for component property fidelity; not raw-editable. |
| `source.fig.derivedSymbolData` | ✅ | Indirect | — | Critical for instance-derived geometry/layout/text. |
| `source.fig.derivedSymbolDataLayoutVersion` | ✅ | — | — | Figma bookkeeping. |
| `source.fig.uniformScaleFactor` | ✅ | Indirect | — | Important for scaled instances. |
| Style IDs: fill/stroke/text/effect/grid | ↩ | — | — | Preserves style linkage for Figma, but OpenPencil has no style manager yet. |
| Component property refs/defs/specs | ✅ | Indirect | ◐ | Full Figma component-property authoring is incomplete. |
| State-group metadata | ↩ | — | — | Preserved only. |
| Version/sort/publish/library metadata | ↩ | — | ◐ | Assets UI shows a subset; publish/update workflow is missing. |
| Variable and parameter consumption maps | ✅ | ◐ | ◐ | Filtered/preserved for safe round-trip; normalized bindings cover common cases. |
| Page fields: background, page type, guides | ↩ | ◐ | — | Background/page type/guides mostly round-trip. Guides are not rendered/editable. |
| Text internals: `textData`, layout versions, font version, derived data | ✅ | ✅ | — | Important for text fidelity; most internals are not editable. |
| `fontVariations` | ↩ | — | — | Variable font data is preserved, not rendered. |
| Raw paint/effect/vector/geometry payloads | ✅ | ✅ | ◐ | Converted fields render; raw payloads preserve Figma import/export details. |

## Highest-priority visual gaps

These are parsed or visible in Figma docs and most likely to cause visible differences in real design files:

1. **Blend modes** — node, fill, and effect blend modes should be applied in CanvasKit rendering, not just stored/exported.
2. **Masks** — implement Figma mask stacks and `maskType` behavior beyond frame clipping.
3. **Corner smoothing** — render Figma's smooth/squircle corners instead of ordinary rounded rectangles.
4. **Pattern fills/strokes** — support Figma pattern fills and their transforms.
5. **Font variations** — apply variable-font axes from imported Figma metadata.
6. **Boolean operation import** — keep Figma `BOOLEAN_OPERATION` nodes as boolean operations where possible instead of importing them as vectors.
7. **Layout grids and guides** — render/edit page guides and Figma layout grids, or clearly keep them round-trip-only.
8. **Full component property and slot workflows** — support authoring, not just preserving imported payloads.
9. **Prototype metadata** — start by preserving prototype flows/connections even before building playback.

## Code map

| Concern | Files |
|---|---|
| Scene graph fields | `packages/core/src/scene-graph/types.ts` |
| Source metadata invalidation | `packages/core/src/scene-graph/source-metadata.ts` |
| Kiwi import mapping | `packages/core/src/kiwi/fig/node-change/convert.ts` |
| Kiwi export mapping | `packages/core/src/kiwi/fig/node-change/export-node.ts`, `packages/core/src/kiwi/fig/node-change/serialize.ts` |
| Kiwi schema | `packages/core/src/kiwi/fig/codec/schema/fig.kiwi` |
| Renderer dispatch | `packages/core/src/canvas/scene.ts` |
| Fills / images / gradients | `packages/core/src/canvas/fills.ts` |
| Strokes | `packages/core/src/canvas/strokes.ts` |
| Effects / shadows | `packages/core/src/canvas/shadows.ts` |
| Text rendering | `packages/core/src/canvas/text.ts`, `packages/core/src/canvas/text-derived.ts` |
| Layout engine | `packages/core/src/layout.ts`, `packages/core/src/layout/**` |
| Property panels | `src/components/properties/**`, `packages/vue/src/controls/**` |
| CLI | `packages/cli/src/index.ts`, `packages/cli/src/commands/**` |
| MCP/tools | `packages/core/src/tools/**`, `packages/mcp/src/tool/registration.ts` |

