---
title: Roadmap
description: Inkly product roadmap and Figma compatibility tracking.
---

# Roadmap

Inkly is moving toward production-grade Figma compatibility while keeping design documents programmable, local-first, and fast on large files.

## Current focus

- Improve `.fig` import/export fidelity against real Figma files and Figma's own rendering.
- Keep large design systems responsive in the browser and desktop app.
- Treat the scene graph as a programmable design document: every important read, write, export, diff, and validation operation should be reachable through UI, CLI, MCP, and SDK surfaces.
- Keep files on the user's machine unless collaboration is explicitly enabled.

## Near-term work

### Figma fidelity

- Preserve and round-trip more Figma metadata safely.
- Add visual regression coverage for full multi-page `.fig` documents. `scripts/export-fixture-visuals.ts` exports current smoke fixture pages to `/tmp` for manual comparison without committing large images; `tests/fixtures/figma-oracles/visual-comparison-report.json` records the current Figma-vs-Inkly oracle diff findings.
- Close high-impact renderer gaps: remaining mask edge cases, blend isolation, pattern fills, and broader variable-font fixtures.
- Improve boolean operation editing/export now that imported Figma `BOOLEAN_OPERATION` nodes remain boolean operations.

### Editor depth

- Complete variable inspector coverage for common numeric/text/layout fields.
- Improve component and instance editing: variant switching, property editing, and override inspection.
- Add first-class layout grid and guide rendering/editing.
- Expand vector editing workflows without regressing imported vector fidelity.

### Agent workflows

- Polish the official `SKILL.md` guidance for Inkly so agents use the full inspect → act → render/measure → compare → iterate loop instead of relying on one-shot prompting.
- Publish tested AI workflow recipes for common tasks: create from prompt, edit a selected design, compare against a screenshot or Figma reference, fix visual regressions, extract tokens, and batch-migrate files.
- Make agent workflows measurable by default: every substantial operation should be able to produce a render, structured diff, lint result, or comparison artifact.
- Keep MCP, CLI, and SDK operations aligned so agent skills can run the same workflow in desktop, browser, CI, or headless file mode.

### Tooling and API parity

- Maintain a public tool/API reference that maps editor operations to CLI commands, MCP tools, SDK APIs, and Figma Plugin API-compatible eval usage.
- Add coverage tests that detect when a core editor capability exists in the UI but is missing from CLI/MCP/SDK, or vice versa.
- Keep tool outputs structured enough for agents to chain safely: node IDs, bounds, diffs, render artifacts, diagnostics, and machine-readable error details.
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
- Store shader layer configuration in Inkly documents and export graceful fallbacks when a target format cannot preserve the live effect.

## Later

### SDK and embedded editor

- Document the Vue SDK and core subpath exports as a platform for custom editor shells, embedded design surfaces, and automation-specific UIs.
- Provide examples for embedding Inkly in product tools: read-only previews, editable canvases, design review surfaces, and agent-controlled editors.
- Keep the renderer, editor core, and tool registry framework-agnostic enough for headless and embedded use.

### Product depth

- Prototyping: frame connections, triggers, overlays, transitions, and preview mode.
- Comments: pins, threads, resolution state, and collaboration-aware display.
- Shared libraries: publish, consume, and update components/styles across files.
- Platform polish: Windows code signing, PWA support, packaged updater improvements, and desktop-side MCP bundling.

## Non-goals

- Cloud-first storage or mandatory accounts.
- Read-only automation surfaces that cannot modify documents.
- Feature work that sacrifices `.fig` import/export fidelity for convenience.

This section tracks Inkly's current compatibility with Figma Design features. It is based on Figma's public Help Center feature areas and the current Inkly scene graph, Kiwi import/export, CanvasKit renderer, UI panels, CLI, and MCP tools.

Legend:

- **✅ Supported** — implemented for common files and expected to work directly.
- **◐ Partial** — implemented for important cases, but missing parity, UI, or edge-case behavior.
- **↩ Round-trip only** — imported/preserved/exported for `.fig` fidelity, but not rendered or editable as a first-class Inkly feature.
- **— Not supported** — not currently modeled or intentionally out of scope.

Support tiers used for prioritization:

1. **Visual fidelity** — fields that change pixels in normal design exports. These get real Figma oracle fixtures, renderer tests, and visual metrics first.
2. **Round-trip fidelity** — fields that should survive read → write → Figma import but do not need Inkly UI/rendering yet. These need raw-preservation and invalidation tests.
3. **Product/runtime systems** — prototypes, libraries, FigJam, Slides, Dev Mode, CMS/AI, and media timelines. These stay schema-only or raw-preserved until Inkly has matching product concepts.
4. **Unsafe/internal metadata** — fields that can corrupt Figma import or overwrite user edits when stale. These are filtered or preserved only with fixture evidence.

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

| Area                                                 | Import | Render | UI edit | Export round-trip | CLI/MCP | Notes                                                                                                                                                                                                                                              |
| ---------------------------------------------------- | -----: | -----: | ------: | ----------------: | ------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages / canvases                                     |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Multi-page documents and per-page viewport are supported.                                                                                                                                                                                          |
| Frames                                               |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Includes clipping and auto-layout container behavior.                                                                                                                                                                                              |
| Groups                                               |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Grouping preserves visual positions.                                                                                                                                                                                                               |
| Sections                                             |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Section rendering and title pills are Inkly-specific approximations.                                                                                                                                                                          |
| Rectangles / rounded rectangles                      |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Per-corner radii and smoothed corners render for fills, strokes, clips, masks, and effects.                                                                                                                                                        |
| Ellipses / arcs                                      |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | `arcData` renders/exports; no full inspector controls.                                                                                                                                                                                             |
| Lines                                                |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Stroke caps/joins render but are not fully exposed in UI.                                                                                                                                                                                          |
| Polygons / stars                                     |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | `pointCount` and `starInnerRadius` modeled.                                                                                                                                                                                                        |
| Text                                                 |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Derived Figma glyphs improve fidelity; advanced typography is partial.                                                                                                                                                                             |
| Vectors / vector networks                            |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Vector edit support exists; Figma Draw tools are not fully replicated.                                                                                                                                                                             |
| Boolean operations                                   |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Figma `BOOLEAN_OPERATION` nodes import/export as boolean operations; inspector editing remains limited.                                                                                                                                            |
| Components                                           |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Component metadata, descriptions, links, and publish fields mostly round-trip.                                                                                                                                                                     |
| Component sets / variants                            |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Variant values are usable; full component property authoring is incomplete.                                                                                                                                                                        |
| Instances / overrides                                |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Raw symbol overrides and derived symbol data are preserved for fidelity.                                                                                                                                                                           |
| Slots                                                |      ↩ |      ◐ |       — |                 ↩ |       — | Some component property payloads may survive round-trip, but Figma slots are not a first-class workflow.                                                                                                                                           |
| Connectors                                           |      ◐ |      ◐ |       — |                 ◐ |       ◐ | Type exists, but Figma connector semantics are weak.                                                                                                                                                                                               |
| Shape-with-text / FigJam shapes                      |      ◐ |      ◐ |       — |                 ◐ |       ◐ | Type exists, but not a full FigJam feature implementation.                                                                                                                                                                                         |
| Slices                                               |      ◐ |      — |       ◐ |                 ◐ |      ✅ | Slice-like export regions exist via tooling, not as true Figma slice nodes.                                                                                                                                                                        |
| FigJam / Slides / Code / CMS / Buzz node families    |      ↩ |      — |       — |                 ↩ |       — | Current Kiwi schema recognizes many newer Figma node families (`TABLE`, `SLIDE`, `CODE_COMPONENT`, `CMS_RICH_TEXT`, `REPEATER`, `WEBPAGE`, etc.), but Inkly only preserves/round-trips them where safe; they are not first-class scene nodes. |
| Solid fills                                          |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Color variables supported for common fill cases.                                                                                                                                                                                                   |
| Gradients                                            |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Linear/radial/angular/diamond support; Figma edge cases may differ.                                                                                                                                                                                |
| Image fills                                          |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Fill/fit/crop/tile support exists; imported crop/tile affine transforms are applied, but exact Figma parity is still partial.                                                                                                                      |
| Pattern / noise / custom fills                       |     ✅ |      ◐ |       — |                ✅ |       — | Schema metadata imports/exports; Figma pattern fills with a referenced source node render as repeated source tiles with scale, spacing, alignment, and basic hex offsets. Noise/custom paints still render with a solid fallback pending real paint payload samples; Figma-authored noise/texture/glass effect payloads are captured separately. |
| Video/GIF/media fills                                |      ↩ |      — |       — |                 ↩ |       — | Kiwi schema includes media paint/export enums, but Inkly has no video/GIF playback or media layer support.                                                                                                                                    |
| Layer/fill/effect blend modes                        |     ✅ |      ◐ |       — |                ✅ |      ✅ | Canvas applies node, fill, and common shadow effect blend modes; Figma isolation edge cases remain partial.                                                                                                                                        |
| Opacity                                              |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Node opacity uses save layers in the renderer.                                                                                                                                                                                                     |
| Strokes                                              |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Weight, alignment, dashes, and side weights are supported.                                                                                                                                                                                         |
| Stroke caps / joins / miter limit                    |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Renderer/export support exists; inspector controls are limited.                                                                                                                                                                                    |
| Effects: shadows and blurs                           |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | `showShadowBehindNode` is rendered but not exposed in UI.                                                                                                                                                                                          |
| Effect styles                                        |      ↩ |      — |       — |                 ↩ |       — | Style IDs round-trip; no style manager.                                                                                                                                                                                                            |
| Corner radius                                        |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Uniform and independent radii supported.                                                                                                                                                                                                           |
| Corner smoothing                                     |     ✅ |     ✅ |       — |                ✅ |      ✅ | Figma-style smoothed corners render for common uniform and independent-radius rectangles; exact parity still needs broader fixture tuning.                                                                                                         |
| Masks                                                |     ✅ |      ◐ |       — |                ✅ |      ✅ | Figma schema `mask`, `maskType`, and `maskIsOutline` fields import and export; common sibling alpha/vector/luminance mask stacks render, including consecutive mask layers. UI controls and deeper Figma edge cases remain incomplete.             |
| Auto layout: vertical/horizontal                     |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Yoga-backed layout.                                                                                                                                                                                                                                |
| Auto layout: wrap                                    |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | UI toggle exists.                                                                                                                                                                                                                                  |
| Auto layout: grid                                    |     ✅ |      ◐ |       ◐ |                ✅ |      ✅ | CSS-grid-like support is partial; newer schema fields for grid child alignment and auto tracks are not fully exposed.                                                                                                                              |
| Padding / gaps / alignment                           |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Common flex controls are exposed.                                                                                                                                                                                                                  |
| Hug / fill / fixed sizing                            |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Min/max support is partial in UI.                                                                                                                                                                                                                  |
| Ignore auto layout / absolute positioning            |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Mode is modeled; UI coverage is partial.                                                                                                                                                                                                           |
| Strokes included in layout                           |     ✅ |      ◐ |       — |                ✅ |      ✅ | Stored/exported and used in layout paths, but no obvious panel control.                                                                                                                                                                            |
| Reverse z-index / align-content                      |     ✅ |      ◐ |       — |                ✅ |      ✅ | Modeled and exported; UI is limited.                                                                                                                                                                                                               |
| Constraints                                          |     ✅ |      ◐ |       — |                ✅ |      ✅ | Tools/API expose constraints; main UI is limited.                                                                                                                                                                                                  |
| Layout grids / guides                                |      ↩ |      ◐ |       — |                 ↩ |       — | Imported layout grids and page guides render from preserved Figma metadata; style IDs round-trip, but editing UI is not exposed.                                                                                                                   |
| Text styles                                          |      ↩ |      ◐ |       — |                 ↩ |       — | Style IDs round-trip; no style management UI. Rich schema metadata such as derived text data, leading trim, decoration style/thickness/fill, and semantic font style/weight is preserved for round-trip.                                           |
| Rich style runs                                      |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Import/render/export support; editing mixed runs is partial.                                                                                                                                                                                       |
| Text auto resize                                     |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Used by renderer/layout; UI does not expose every mode.                                                                                                                                                                                            |
| Text truncation / max lines                          |     ✅ |     ✅ |       — |                ✅ |      ✅ | Renderer supports ending truncation; no inspector control.                                                                                                                                                                                         |
| Text case                                            |     ✅ |      ◐ |       — |                ✅ |      ✅ | Model/export/JSX support; UI missing.                                                                                                                                                                                                              |
| Vertical text alignment                              |     ✅ |      ◐ |       — |                ✅ |      ✅ | Modeled; UI/render parity needs more coverage.                                                                                                                                                                                                     |
| Justified text                                       |     ✅ |      ◐ |       — |                ✅ |      ✅ | Modeled; UI does not expose it.                                                                                                                                                                                                                    |
| Font variations / OpenType features                  |     ✅ |     ✅ |       — |                ✅ |       — | Imported `fontVariations`, common ligature/caps/numeric OpenType fields, and raw `toggledOnOTFeatures` / `toggledOffOTFeatures` are applied to CanvasKit text styles and exported; UI controls are not exposed.                                    |
| Variables: collections/modes/aliases                 |     ✅ |      ◐ |       ◐ |                ✅ |      ✅ | Color/number/string/boolean model exists; inspector coverage is still incomplete.                                                                                                                                                                  |
| Variables bound to fills/strokes                     |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Common color bindings render and edit.                                                                                                                                                                                                             |
| Variables bound to text/layout/visibility/effects    |      ◐ |      ◐ |       ◐ |                 ◐ |      ✅ | Some bindings exist; not full Figma property coverage.                                                                                                                                                                                             |
| Variables in prototypes / expressions / conditionals |      — |      — |       — |                 — |       — | Depends on prototype system, which is not implemented.                                                                                                                                                                                             |
| Libraries / publish / update review                  |      ↩ |      — |       ◐ |                 ↩ |       — | Metadata can survive round-trip; no full library workflow.                                                                                                                                                                                         |
| Prototype flows / starting points                    |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Prototype hotspots / triggers / actions              |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Prototype overlays / scroll-to                       |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Smart animate / easing / spring / duration           |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Interactive components                               |      — |      — |       — |                 — |       — | Component-level prototype connections are not supported.                                                                                                                                                                                           |
| Dev Mode inspect / measurements / annotations        |      — |      — |       — |                 — |       ◐ | Inkly has CLI/MCP inspection, but not Figma Dev Mode UI.                                                                                                                                                                                      |
| Code Connect / dev resources / ready-for-dev         |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Comments                                             |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Version history / branches                           |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Real-time collaboration                              |      — |     ✅ |      ✅ |                 — |       — | Inkly has its own P2P collaboration, not Figma-compatible metadata.                                                                                                                                                                           |

## Raw Kiwi metadata coverage

Inkly deliberately preserves many Figma/Kiwi fields even when they are not rendered or editable. These live under `SceneNode.source.fig` and are applied late during `.fig` export. A schema coverage test compares the current `fig.kiwi` `NodeChange` fields against modeled codec fields, raw-preserved fields, and intentionally schema-only metadata buckets so drift stays visible.

| Field group                                                             | Import/export |   Render |  UI | Fidelity impact                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------- | ------------: | -------: | --: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source.fig.rawSize`                                                    |            ✅ | Indirect |   — | Preserves original Figma size for round-trip. Cleared when size is edited.                                                                                                                                                                                                                                                                              |
| `source.fig.rawTransform`                                               |            ✅ | Indirect |   — | Preserves exact Figma transform. Cleared when transform is edited.                                                                                                                                                                                                                                                                                      |
| `source.fig.rawNodeFields`                                              |            ✅ |    Mixed |   — | Late-applied to exported NodeChange for round-trip fidelity; raw-field and schema coverage tests guard preservation drift.                                                                                                                                                                                                                              |
| `source.fig.layout`                                                     |            ✅ |       ✅ |   ◐ | Preserves original Figma stack metadata while using normalized layout fields.                                                                                                                                                                                                                                                                           |
| `source.fig.symbolOverrides`                                            |            ✅ | Indirect |   — | Important for instance override fidelity.                                                                                                                                                                                                                                                                                                               |
| `source.fig.componentPropAssignments`                                   |            ✅ | Indirect |   ◐ | Used for component property fidelity; not raw-editable.                                                                                                                                                                                                                                                                                                 |
| `source.fig.derivedSymbolData`                                          |            ✅ | Indirect |   — | Critical for instance-derived geometry/layout/text.                                                                                                                                                                                                                                                                                                     |
| `source.fig.derivedSymbolDataLayoutVersion`                             |            ✅ |        — |   — | Figma bookkeeping.                                                                                                                                                                                                                                                                                                                                      |
| `source.fig.uniformScaleFactor`                                         |            ✅ | Indirect |   — | Important for scaled instances.                                                                                                                                                                                                                                                                                                                         |
| Style IDs: fill/stroke/text/effect/grid                                 |             ↩ |        — |   — | Preserves style linkage for Figma, but Inkly has no style manager yet.                                                                                                                                                                                                                                                                             |
| Component property refs/defs/specs                                      |            ✅ | Indirect |   ◐ | Full Figma component-property authoring is incomplete.                                                                                                                                                                                                                                                                                                  |
| State-group metadata                                                    |             ↩ |        — |   — | Preserved only.                                                                                                                                                                                                                                                                                                                                         |
| Version/sort/publish/library metadata                                   |             ↩ |        — |   ◐ | Assets UI shows a subset; publish/update workflow is missing.                                                                                                                                                                                                                                                                                           |
| Variable and parameter consumption maps                                 |            ✅ |        ◐ |   ◐ | Filtered/preserved for safe round-trip; normalized bindings cover common cases.                                                                                                                                                                                                                                                                         |
| Page fields: background, page type, guides                              |             ↩ |        ◐ |   — | Background color, background paints, page type, and guides round-trip for imported pages. Guides render as editor overlays but are not editable.                                                                                                                                                                                                         |
| Text internals: `textData`, layout versions, font version, derived data |            ✅ |       ✅ |   — | Important for text fidelity; most internals are not editable. Imported derived text data, leading trim, decoration style, underline decoration paint/offset/thickness/skip-ink, semantic font metadata, and raw OpenType feature toggles are preserved for round-trip when safe; decoration style/thickness/color and leading trim now render through CanvasKit, and raster export bounds account for decoration overflow. |
| `fontVariations`                                                        |            ✅ |       ✅ |   — | Variable font axes are imported, rendered, and exported for text nodes and style runs.                                                                                                                                                                                                                                                                  |
| Raw paint/effect/vector/geometry payloads                               |            ✅ |       ✅ |   ◐ | Converted fields render; raw payloads preserve Figma import/export details, including mask, background paint, layout grid, export setting, and prototype interaction metadata where safe.                                                                                                                                                               |

## Highest-priority visual gaps

These are parsed or visible in Figma docs and most likely to cause visible differences in real design files:

1. **Masks** — tune remaining exact Figma stack semantics beyond common alpha/vector/luminance and consecutive-mask paths. `tests/fixtures/figma-oracles/masks.json` records live Figma API values for alpha, vector, and luminance masks.
2. **Corner smoothing** — expand Figma fixture comparisons and tune remaining stroke/effect edge cases.
3. **Pattern/noise/custom fills** — tune first-class pattern rendering for nested/effectful pattern sources and exact Figma hex spacing. `tests/fixtures/figma-oracles/pattern-noise-custom-paints.json` captures a real async Figma `PATTERN` payload and Figma-authored noise/texture/glass effect payloads; real `NOISE` / `CUSTOM` paint payloads remain blocked on Figma-authored samples.
4. **Variable-font and rich text fixtures** — broaden real-file coverage for variable axes, derived text data, leading trim, decoration style, underline offset/skip-ink, semantic font metadata, and raw OpenType feature metadata; `tests/fixtures/figma-oracles/rich-text-decoration.json` captures the first live Figma rich-text oracle.
5. **Boolean operation editing** — improve inspector/tooling workflows for imported boolean-operation nodes.
6. **Layout grids and guides** — add editing and fuller alignment/style parity for rendered imported page guides and Figma layout grids.
7. **Full component property and slot workflows** — support authoring, not just preserving imported payloads.
8. **Prototype/media/interaction metadata** — schema now includes more interaction, media runtime, animation, and slide fields; start by preserving flows/connections/runtime metadata before building playback.

## Code map

| Concern                      | Files                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Scene graph fields           | `packages/core/src/scene-graph/types.ts`                                                                       |
| Source metadata invalidation | `packages/core/src/scene-graph/source-metadata.ts`                                                             |
| Kiwi import mapping          | `packages/core/src/kiwi/fig/node-change/convert.ts`                                                            |
| Kiwi export mapping          | `packages/core/src/kiwi/fig/node-change/export-node.ts`, `packages/core/src/kiwi/fig/node-change/serialize.ts` |
| Kiwi schema                  | `packages/core/src/kiwi/fig/codec/schema/fig.kiwi`, `tests/engine/io/fig/import/schema-coverage.test.ts`       |
| Renderer dispatch            | `packages/core/src/canvas/scene.ts`                                                                            |
| Fills / images / gradients   | `packages/core/src/canvas/fills.ts`                                                                            |
| Strokes                      | `packages/core/src/canvas/strokes.ts`                                                                          |
| Effects / shadows            | `packages/core/src/canvas/shadows.ts`                                                                          |
| Text rendering               | `packages/core/src/canvas/text.ts`, `packages/core/src/canvas/text-derived.ts`                                 |
| Layout engine                | `packages/core/src/layout.ts`, `packages/core/src/layout/**`                                                   |
| Property panels              | `src/components/properties/**`, `packages/vue/src/controls/**`                                                 |
| CLI                          | `packages/cli/src/index.ts`, `packages/cli/src/commands/**`                                                    |
| MCP/tools                    | `packages/core/src/tools/**`, `packages/mcp/src/tool/registration.ts`                                          |
