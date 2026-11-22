---
title: Roadmap
description: OpenPencil product roadmap and Figma compatibility tracking.
---

# Roadmap

OpenPencil is moving toward production-grade Figma compatibility while keeping design documents programmable, local-first, and fast on large files.

## Current focus

- Improve `.fig` import/export fidelity against real Figma files and Figma's own rendering.
- Make OpenPencil Cloud dependable for teams: sync, rooms, sharing, version history, billing, and self-hosted operation that recover from interrupted writes, expired credentials, and provider failures.
- Keep large design systems responsive in the browser and desktop app.
- Bring OpenPencil to phones and tablets, starting with a companion app for Cloud documents.
- Add presentations as a third kind of document beside designs and boards.
- Treat the scene graph as a programmable design document: every important read, write, export, diff, and validation operation should be reachable through UI, CLI, MCP, and SDK surfaces.
- Keep local files and local-first workflows first-class beside OpenPencil Cloud and self-hosted servers.

## Recently delivered

v0.17.0 (November 2026) shipped:

- OpenPencil Cloud: workspaces, live rooms, sharing, comments, version history, Trash, plans and AI credits, an admin console, a community gallery, and a self-hosted server under the Apache License 2.0.
- Boards: FigJam's sticky notes, shapes, connectors, and sections, saved as `.jam`, with draw.io and Mermaid import, Tidy Up, and Auto Arrange.
- Opening web pages from a URL as editable layers, laid out by the same engine as HTML import.
- Variable formulas, variable fonts with Material Symbols and SF Symbols, Figma's glass, progressive blur, noise, and texture effects, image adjustments, the Scale tool, and multi-layer transforms.
- Auto layout on Taffy, PDF export through Skia, a much faster progressive canvas, and Arabic and Brazilian Portuguese with a right-to-left interface.
- Custom AI prompts, `/review` design reviews, chat compaction, Agent Skills, and coding-agent subagents.

v0.16.0 (October 2026) shipped comments, shared rooms with voice calls, slots, component properties and behaviours with a live preview, shader fills, the Lint tab, variable modes on layers, the pencil tool, W3C design tokens, and Vue and React code in the Code tab.

See the [changelog](https://github.com/open-pencil/open-pencil/blob/master/CHANGELOG.md) for everything in each release.

## Near-term work

### Mobile

- A companion app for iOS and Android: open Cloud and local documents, view and present them, follow a room live, reply to comments and mentions, and get the notifications the desktop app sends, such as an agent waiting for permission.
- Mirror the desktop selection or a frame on a phone, as a device preview while designing for mobile.
- Design on phones and tablets: the editor on Android (in progress, [#1593](https://github.com/open-pencil/open-pencil/pull/1593)) and iPadOS, with touch and pencil input, panels laid out for small screens, and saving through the system's document picker.
- Share the editor, document model, and Cloud client with the desktop and web apps through Tauri's mobile targets rather than building a separate native editor.

### Presentations

- Slides as a third kind of document beside designs and boards: a slide grid, a filmstrip, presenter view with speaker notes, and full-screen presenting from the app and a browser link.
- Slides built from the same layers, components, variables, and libraries as designs, so a deck uses the team's design system.
- Templates and themes, slide transitions, and live presenting in a Cloud room with a follow mode for the audience.
- Import and export Figma Slides (`.deck`) files, and export to PDF and PowerPoint.
- AI and MCP tools that draft a deck from an outline, a document, or a design, and keep it in the deck's theme.

### Figma fidelity

- Preserve and round-trip more Figma metadata safely.
- Add visual regression coverage for full multi-page `.fig` documents. `bun tools/generate/visual-oracles/src/cli.ts export-fixtures` exports current smoke fixture pages to `/tmp` for manual comparison without committing large images; `tests/fixtures/figma-oracles/visual-comparison-report.json` records the current Figma-vs-OpenPencil oracle diff findings.
- Close high-impact renderer gaps: remaining mask edge cases, blend isolation, pattern fills, and Display P3 documents.
- Improve boolean operation editing/export now that imported Figma `BOOLEAN_OPERATION` nodes remain boolean operations.

### Editor depth

- Complete variable inspector coverage for common numeric/text/layout fields.
- Extend component and instance authoring with deeper override inspection.
- Treat variables, styles, components, and libraries as governed design-system assets with proposal, review, publish, update, migration, and conformance workflows.
- Complete layout-grid style parity beyond existing grid geometry controls and editable page/frame guides.
- Expand vector editing workflows without regressing imported vector fidelity.

### Reliability and international text

- Make desktop automation recover from orphaned processes and renderer crashes without manual cleanup.
- Surface provider, model-budget, renderer, and automation failures with actionable recovery paths instead of silent stalls.
- Broaden right-to-left, CJK, and mixed-script visual fixtures beyond Arabic.
- Build a portable-font strategy for reproducible documents across machines, including curated redistributable fonts, embedded or linked document fonts, and licensing metadata ([#502](https://github.com/open-pencil/open-pencil/issues/502), [#503](https://github.com/open-pencil/open-pencil/issues/503)).

### Cloud and self-hosting

- Enterprise identity through standard OIDC/SSO, service accounts, and documented webhooks for workspace, document, membership, comment, and version events.
- Workspace organization with projects, folders, templates, and search, while preserving stable document identity.
- Retention controls, audit logs, and data-residency options for Cloud and self-hosted servers.
- Guided self-hosted upgrades, backups, and health monitoring.
- Let documents move between device-only, OpenPencil Cloud, self-hosted, and user-owned storage without losing identity or history.
- Keep bring-your-own-key AI available beside OpenPencil services' credits, for Cloud and self-hosted users alike.

### Agent workflows

- Polish the official `SKILL.md` guidance for OpenPencil so agents use the full inspect → act → render/measure → compare → iterate loop instead of relying on one-shot prompting.
- Publish tested AI workflow recipes for common tasks: create from prompt, edit a selected design, compare against a screenshot or Figma reference, fix visual regressions, extract tokens, and batch-migrate files.
- Design on a project's running pages, compare them with the design, and open pull requests from the app.
- Make structured node-tree diffs a first-class, Git-friendly review artifact for UI, CLI, MCP, SDK, and CI edits instead of relying only on screenshot comparisons.
- Expand design lint findings with expected/actual evidence and safe autofixes; measure rule precision before enabling lint rules as blocking gates.
- Keep MCP, CLI, and SDK operations aligned so agent skills can run the same workflow in desktop, browser, CI, or headless file mode.

### Tooling and API parity

- Maintain a public tool/API reference that maps editor operations to CLI commands, MCP tools, SDK APIs, and Figma Plugin API-compatible eval usage.
- Add coverage tests that detect when a core editor capability exists in the UI but is missing from CLI/MCP/SDK, or vice versa.
- Make `.pen` a first-class editable save target across app, CLI, MCP, and SDK workflows rather than an import-only or automation-specific format.
- Extend HTML, CSS, Tailwind, and JSX support toward component-aware design↔code updates that preserve intentional code structure instead of regenerating whole files.
- Provide an adapter contract for additional design sources such as Stitch and Pixso, prioritizing formats with documented or testable semantics over brittle UI scraping.

### Performance and scale

- Keep canvas navigation and editing responsive on the largest design systems.
- Better renderer profiling surfaces for slow nodes, effects, masks, and imported files.

## Later

### SDK and embedded editor

- Expand the documented Vue SDK and core package platform with complete example applications for custom editor shells, embedded design surfaces, and automation-specific UIs.
- Ship an official VS Code/Cursor extension ([#81](https://github.com/open-pencil/open-pencil/issues/81)) for previewing and opening `.fig`/`.pen` documents, connecting to the running editor, invoking CLI/MCP workflows, and handing selections between code and canvas.
- Define public API stability and migration expectations across the reusable npm packages.

### Product depth

- Prototyping: frame connections, triggers, overlays, transitions, and AI/JSX-authorable interaction definitions on top of the existing component preview.
- Motion: reusable code-authored animation presets, timelines, easing, and deterministic playback/export that compose with prototype interactions and shader inputs.
- Interactive shader layers: animated, pointer-reactive generative backgrounds as layers, with deterministic raster export.
- Tables and data grids: structured rows, columns, headers, resizing, merged cells, and normal scene nodes inside cells.
- Platform polish: Windows code signing and PWA support.

## Non-goals

- Mandatory accounts or a cloud-only document model. OpenPencil Cloud, self-hosted backends, and user-owned remote storage must remain optional alongside local files.
- A hosted service that requires OpenPencil to proxy users' AI provider keys: bring-your-own-key AI stays available, with OpenPencil services' credits as an option rather than the only path.
- Read-only automation surfaces that cannot modify documents.
- Feature work that sacrifices `.fig` import/export fidelity for convenience.

This section tracks OpenPencil's current compatibility with Figma Design features. It is based on Figma's public Help Center feature areas and the current OpenPencil scene graph, Kiwi import/export, CanvasKit renderer, UI panels, CLI, and MCP tools.

Legend:

- **✅ Supported** — implemented for common files and expected to work directly.
- **◐ Partial** — implemented for important cases, but missing parity, UI, or edge-case behavior.
- **↩ Round-trip only** — imported/preserved/exported for `.fig` fidelity, but not rendered or editable as a first-class OpenPencil feature.
- **— Not supported** — not currently modeled or intentionally out of scope.

Support tiers used for prioritization:

1. **Visual fidelity** — fields that change pixels in normal design exports. These get real Figma oracle fixtures, renderer tests, and visual metrics first.
2. **Round-trip fidelity** — fields that should survive read → write → Figma import but do not need OpenPencil UI/rendering yet. These need raw-preservation and invalidation tests.
3. **Product/runtime systems** — prototypes, libraries, FigJam, Slides, Dev Mode, CMS/AI, and media timelines. These stay schema-only or raw-preserved until OpenPencil has matching product concepts.
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
| Sections                                             |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Section rendering and title pills are OpenPencil-specific approximations.                                                                                                                                                                          |
| Rectangles / rounded rectangles                      |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Per-corner radii and smoothed corners render for fills, strokes, clips, masks, and effects.                                                                                                                                                        |
| Ellipses / arcs                                      |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | `arcData` renders/exports; no full inspector controls.                                                                                                                                                                                             |
| Lines                                                |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Stroke caps, joins, dashes, alignment, and miter limits render and have inspector controls.                                                                                                                                                       |
| Polygons / stars                                     |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | `pointCount` and `starInnerRadius` modeled.                                                                                                                                                                                                        |
| Text                                                 |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Case, justification, vertical alignment, truncation/max lines, common OpenType features, and derived Figma glyph fallback are supported; uncommon typography metadata remains round-trip only.                                                                                                                                                                             |
| Vectors / vector networks                            |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Vector edit support exists; Figma Draw tools are not fully replicated.                                                                                                                                                                             |
| Boolean operations                                   |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Figma `BOOLEAN_OPERATION` nodes import/export as boolean operations; inspector editing remains limited.                                                                                                                                            |
| Components                                           |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Component metadata, descriptions, links, and publish fields mostly round-trip.                                                                                                                                                                     |
| Component sets / variants                            |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Multidimensional variant definitions and common instance properties are editable; broader Figma-specific property parity remains incomplete.                                                                                                                                                                        |
| Instances / overrides                                |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Component-property refs and typed assignments are modeled and editable; raw symbol overrides and derived data remain preserved for fidelity.                                                                                                                                                                           |
| Slots                                                |      ✅ |      ✅ |       ✅ |                 ✅ |       ✅ | Slot properties, settings, and instance slot content import, render, and round-trip. The editor creates, configures, and removes slots on main components and fills them in instances; scripts do the same through `createSlot()`, `resetSlot()`, and `limitViolations`. |
| Connectors                                           |      ◐ |      ◐ |       — |                 ◐ |       ◐ | Type exists, but Figma connector semantics are weak.                                                                                                                                                                                               |
| Shape-with-text / FigJam shapes                      |      ◐ |      ◐ |       — |                 ◐ |       ◐ | Type exists, but not a full FigJam feature implementation.                                                                                                                                                                                         |
| Slices                                               |      ◐ |      — |       ◐ |                 ◐ |      ✅ | Slice-like export regions exist via tooling, not as true Figma slice nodes.                                                                                                                                                                        |
| FigJam / Slides / Code / CMS / Buzz node families    |      ↩ |      — |       — |                 ↩ |       — | Current Kiwi schema recognizes many newer Figma node families (`TABLE`, `SLIDE`, `CODE_COMPONENT`, `CMS_RICH_TEXT`, `REPEATER`, `WEBPAGE`, etc.), but OpenPencil only preserves/round-trips them where safe; they are not first-class scene nodes. |
| Solid fills                                          |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Color variables supported for common fill cases.                                                                                                                                                                                                   |
| Gradients                                            |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Linear/radial/angular/diamond support; Figma edge cases may differ.                                                                                                                                                                                |
| Image fills                                          |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Fill/fit/crop/tile support exists; imported crop/tile affine transforms are applied, but exact Figma parity is still partial. Adjustments (exposure, contrast, saturation, temperature, tint, highlights, shadows) round-trip, draw, and have sliders in the fill picker.                                                                                                                      |
| Pattern / noise / custom fills                       |     ✅ |      ◐ |       — |                ✅ |       — | Schema metadata imports/exports; Figma pattern fills with a referenced source node render as repeated source tiles with scale, spacing, alignment, and basic hex offsets. Noise/custom paints still render with a solid fallback pending real paint payload samples; Figma-authored noise/texture/glass effect payloads are captured separately. |
| Video/GIF/media fills                                |      ↩ |      — |       — |                 ↩ |       — | Kiwi schema includes media paint/export enums, but OpenPencil has no video/GIF playback or media layer support.                                                                                                                                    |
| Layer/fill/effect blend modes                        |     ✅ |      ◐ |      ✅ |                ✅ |      ✅ | Appearance, fill, and effect controls are exposed; Canvas applies common modes, while Figma isolation edge cases remain partial.                                                                                                                                        |
| Opacity                                              |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Node opacity uses save layers in the renderer.                                                                                                                                                                                                     |
| Strokes                                              |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Weight, alignment, dashes, and side weights are supported.                                                                                                                                                                                         |
| Stroke caps / joins / miter limit                    |     ✅ |     ✅ |       ✅ |                ✅ |      ✅ | Inspector controls support mixed cap/join/miter editing; CanvasKit rendering and `.fig` roundtrips preserve miter limits.                                                                                                                                                                                    |
| Effects: shadows and blurs                           |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | `showShadowBehindNode` is rendered but not exposed in UI.                                                                                                                                                                                          |
| Effects: noise and texture                           |     ✅ |      ◐ |      ✅ |                ✅ |      ✅ | Noise draws with Figma's measured statistics, as its generator is not public: exact at grain size 1, close at larger sizes, darker than Figma's for large grains at partial density. SVG export matches Figma's own SVG. |
| Fill / stroke / effect styles                        |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Imported local definitions are modeled and selectable with undo-safe detach; creating and publishing styles still needs a style manager.                                                                                                                                                                                                            |
| Corner radius                                        |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Uniform and independent radii supported.                                                                                                                                                                                                           |
| Corner smoothing                                     |     ✅ |     ✅ |       ✅ |                ✅ |      ✅ | The inspector supports mixed smoothing percentages with undo; uniform and independent-radius corners render, while exact Figma parity still needs broader fixture tuning.                                                                                                         |
| Masks                                                |     ✅ |      ◐ |       — |                ✅ |      ✅ | Figma schema `mask`, `maskType`, and `maskIsOutline` fields import and export; common sibling alpha/vector/luminance mask stacks render, including consecutive mask layers. UI controls and deeper Figma edge cases remain incomplete.             |
| Auto layout: vertical/horizontal                     |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Taffy-backed layout.                                                                                                                                                                                                                               |
| Auto layout: wrap                                    |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | UI toggle exists.                                                                                                                                                                                                                                  |
| Auto layout: grid                                    |     ✅ |      ◐ |       ◐ |                ✅ |      ✅ | CSS-grid-like support is partial; newer schema fields for grid child alignment and auto tracks are not fully exposed.                                                                                                                              |
| Padding / gaps / alignment                           |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Common flex controls are exposed.                                                                                                                                                                                                                  |
| Hug / fill / fixed sizing                            |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Min/max support is partial in UI.                                                                                                                                                                                                                  |
| Ignore auto layout / absolute positioning            |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Mode is modeled; UI coverage is partial.                                                                                                                                                                                                           |
| Strokes included in layout                           |     ✅ |      ◐ |       — |                ✅ |      ✅ | Stored/exported and used in layout paths, but no obvious panel control.                                                                                                                                                                            |
| Reverse z-index / align-content                      |     ✅ |      ◐ |       — |                ✅ |      ✅ | Modeled and exported; UI is limited.                                                                                                                                                                                                               |
| Constraints                                          |     ✅ |      ◐ |      ✅ |                ✅ |      ✅ | Horizontal and vertical pin, center, stretch, and scale modes are editable; imported edge-case parity remains partial.                                                                                                                             |
| Layout grids / guides                                |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Layout-grid geometry and page/frame guides are editable, including guide creation, movement, duplication, transfer, and removal. Full grid-style management remains incomplete.                                                         |
| Text styles                                          |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Imported local text styles are modeled, selectable, and detachable; authoring and publishing style definitions still needs a style manager.                                           |
| Rich style runs                                      |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Import/render/export support; editing mixed runs is partial.                                                                                                                                                                                       |
| Text auto resize                                     |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Used by renderer/layout; UI does not expose every mode.                                                                                                                                                                                            |
| Text truncation / max lines                          |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Ending truncation and maximum-line controls are available in the inspector.                                                                                                                                                                       |
| Text case                                            |     ✅ |      ◐ |      ✅ |                ✅ |      ✅ | Original, upper, lower, and title case are editable; broader render parity still needs fixtures.                                                                                                                                                  |
| Vertical text alignment                              |     ✅ |      ◐ |      ✅ |                ✅ |      ✅ | Top, center, and bottom alignment are editable; imported edge-case parity needs more coverage.                                                                                                                                                    |
| Justified text                                       |     ✅ |      ◐ |      ✅ |                ✅ |      ✅ | Justification is exposed in the typography inspector; render parity remains partial.                                                                                                                                                              |
| Font variations / OpenType features                  |     ✅ |     ✅ |       — |                ✅ |       — | Imported `fontVariations`, common ligature/caps/numeric OpenType fields, and raw `toggledOnOTFeatures` / `toggledOffOTFeatures` are applied to CanvasKit text styles and exported; UI controls are not exposed.                                    |
| Variables: collections/modes/aliases                 |     ✅ |      ◐ |       ◐ |                ✅ |      ✅ | Color/number/string/boolean model exists; inspector coverage is still incomplete.                                                                                                                                                                  |
| Variables bound to fills/strokes                     |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Common color bindings render and edit.                                                                                                                                                                                                             |
| Variables bound to text/layout/visibility/effects    |      ◐ |      ◐ |       ◐ |                 ◐ |      ✅ | Text content and numeric layout bindings resolve on read; colour, numeric, text, and visibility bindings also re-resolve when a variable or mode changes, font family ones do not. Effect bindings are not modelled.                                                                                                                                                                                             |
| Variables in prototypes / expressions / conditionals |      — |      — |       — |                 — |       — | Depends on prototype system, which is not implemented.                                                                                                                                                                                             |
| Libraries / publish / update review                  |      ↩ |      — |       ◐ |                 ↩ |       — | Figma library metadata survives round-trip. OpenPencil supports its own component-library publishing, catalogs, revision previews, and linked-instance updates, not synchronization with Figma-hosted libraries.                                                                                                                                                                                         |
| Prototype flows / starting points                    |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Prototype hotspots / triggers / actions              |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Prototype overlays / scroll-to                       |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Smart animate / easing / spring / duration           |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Interactive components                               |      — |      — |       — |                 — |       — | Figma's component-level prototype connections are not supported; OpenPencil's own behaviours make components run as Reka UI controls in preview.                                                                                                                                                                                           |
| Dev Mode inspect / measurements / annotations        |      — |      ◐ |       ◐ |                 — |       ◐ | OpenPencil has CLI/MCP inspection and Option/Alt distance overlays, but not Figma Dev Mode annotations or its full UI.                                                                                                                                                                                      |
| Code Connect / dev resources / ready-for-dev         |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Comments                                             |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Version history / branches                           |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Real-time collaboration                              |      — |     ✅ |      ✅ |                 — |       — | OpenPencil has its own P2P collaboration, not Figma-compatible metadata.                                                                                                                                                                           |

## Raw Kiwi metadata coverage

OpenPencil deliberately preserves many Figma/Kiwi fields even when they are not rendered or editable. These live under `SceneNode.source.fig` and are applied late during `.fig` export. A schema coverage test compares the current `fig.kiwi` `NodeChange` fields against modeled codec fields, raw-preserved fields, and intentionally schema-only metadata buckets so drift stays visible.

| Field group                                                             | Import/export |   Render |  UI | Fidelity impact                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------- | ------------: | -------: | --: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source.fig.rawSize`                                                    |            ✅ | Indirect |   — | Preserves original Figma size for round-trip. Cleared when size is edited.                                                                                                                                                                                                                                                                              |
| `source.fig.rawTransform`                                               |            ✅ | Indirect |   — | Preserves exact Figma transform. Cleared when transform is edited.                                                                                                                                                                                                                                                                                      |
| `source.fig.rawNodeFields`                                              |            ✅ |    Mixed |   — | Late-applied to exported NodeChange for round-trip fidelity; modeled edits invalidate only matching stale raw fields, while unrelated prototype/library metadata survives. Raw-field and schema coverage tests guard preservation drift.                                                                                                                                                                                                                              |
| `source.fig.layout`                                                     |            ✅ |       ✅ |   ◐ | Preserves original Figma stack metadata while using normalized layout fields.                                                                                                                                                                                                                                                                           |
| `source.fig.symbolOverrides`                                            |            ✅ | Indirect |   — | Important for instance override fidelity.                                                                                                                                                                                                                                                                                                               |
| `source.fig.componentPropAssignments`                                   |            ✅ | Indirect |   ◐ | Used for component property fidelity; not raw-editable.                                                                                                                                                                                                                                                                                                 |
| `source.fig.derivedSymbolData`                                          |            ✅ | Indirect |   — | Critical for instance-derived geometry/layout/text.                                                                                                                                                                                                                                                                                                     |
| `source.fig.derivedSymbolDataLayoutVersion`                             |            ✅ |        — |   — | Figma bookkeeping.                                                                                                                                                                                                                                                                                                                                      |
| `source.fig.uniformScaleFactor`                                         |            ✅ | Indirect |   — | Important for scaled instances.                                                                                                                                                                                                                                                                                                                         |
| Style IDs: fill/stroke/text/effect/grid                                 |             ↩ |        — |   — | Preserves style linkage for Figma, but OpenPencil has no style manager yet.                                                                                                                                                                                                                                                                             |
| Component property refs/defs/specs                                      |            ✅ | Indirect |   ◐ | Text, boolean, and instance-swap properties, their links, and exposed nested instances (`propsAreBubbled`) are authored in the panel.                                                                                                                                                                                                                   |
| State-group metadata                                                    |             ↩ |        — |   — | Preserved only.                                                                                                                                                                                                                                                                                                                                         |
| Version/sort/publish/library metadata                                   |             ↩ |        — |   ◐ | Figma metadata is preserved; OpenPencil's component-library publish/update workflow uses its own stable asset identities and revision review.                                                                                                                                                                                                                                                                                           |
| Variable and parameter consumption maps                                 |            ✅ |        ◐ |   ◐ | Filtered/preserved for safe round-trip; normalized bindings cover common cases.                                                                                                                                                                                                                                                                         |
| Page fields: background, page type, guides                              |             ↩ |        ◐ |   ◐ | Background color, background paints, page type, and guides round-trip for imported pages. Normalized page/frame guides render as overlays and support undoable editing.                                                                                                                                                                                                         |
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
6. **Layout grids and guides** — broaden grid-style parity and Figma edge-case coverage; common grid geometry and page/frame guide editing are already supported.
7. **Full component property and slot workflows** — support authoring, not just preserving imported payloads.
8. **Prototype/media/interaction metadata** — schema now includes more interaction, media runtime, animation, and slide fields; start by preserving flows/connections/runtime metadata before building playback.

## Code map

| Concern                      | Files                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Scene graph fields           | `packages/scene-graph/src/types.ts`                                                                            |
| Source edit tracking         | `packages/scene-graph/src/source-metadata.ts`                                                                  |
| `.fig` metadata policy       | `packages/fig/src/source-metadata.ts`                                                                           |
| Kiwi import mapping          | `packages/fig/src/node-change/convert.ts`                                                                       |
| Kiwi export mapping          | `packages/fig/src/node-change/export/node.ts`, `packages/fig/src/node-change/serialize.ts`                    |
| Kiwi schema                  | `packages/kiwi/src/fig/schema/fig.kiwi`, `packages/core/tests/io/formats/fig/import/schema-coverage.test.ts`                   |
| Renderer dispatch            | `packages/core/src/canvas/scene.ts`                                                                            |
| Fills / images / gradients   | `packages/core/src/canvas/fills.ts`                                                                            |
| Strokes                      | `packages/core/src/canvas/strokes.ts`                                                                          |
| Effects / shadows            | `packages/core/src/canvas/shadows.ts`                                                                          |
| Text rendering               | `packages/core/src/canvas/text.ts`, `packages/core/src/canvas/text-derived.ts`                                 |
| Layout engine                | `packages/core/src/layout/**`                                                   |
| Property panels              | `src/components/properties/**`, `packages/vue/src/controls/**`                                                 |
| CLI                          | `packages/cli/src/index.ts`, `packages/cli/src/commands/**`                                                    |
| MCP/tools                    | `packages/core/src/tools/**`, `packages/mcp/src/tool/registration.ts`                                          |
