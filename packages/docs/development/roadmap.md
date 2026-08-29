---
title: Roadmap
description: OpenPencil product roadmap and Figma compatibility tracking.
---

# Roadmap

OpenPencil is moving toward production-grade Figma compatibility while keeping design documents programmable, local-first, and fast on large files.

## Current focus

- Improve `.fig` import/export fidelity against real Figma files and Figma's own rendering.
- Make saves, recovery, storage synchronization, and automation resilient to crashes, interrupted writes, expired credentials, and temporary provider failures.
- Keep large design systems responsive in the browser and desktop app.
- Make international text reliable across platforms, starting with non-Latin font discovery, Arabic/Persian shaping, RTL layout, and broader CJK fixtures.
- Treat the scene graph as a programmable design document: every important read, write, export, diff, and validation operation should be reachable through UI, CLI, MCP, and SDK surfaces.
- Keep local files and local-first workflows first-class while making an optional OpenPencil Cloud backend and self-hosted deployments practical.

## Recently delivered

v0.14.0 established several foundations that earlier versions of this roadmap treated as future work:

- A searchable Assets panel, component details, instance insertion, frame presets, richer component properties, layout grids, constraints, and deeper typography controls.
- A local-first Storage Workspace for S3-compatible providers with background synchronization and remote document previews.
- Editable PowerPoint export; editable HTML, CSS, Tailwind, JSX, SVG, and image-vectorization workflows.
- Private local MCP transport discovery, an installable OpenPencil agent skill, and stronger CLI/MCP support for large and multi-document sessions.
- Published `@open-pencil/scene-graph`, `@open-pencil/pen`, `@open-pencil/kiwi`, `@open-pencil/fig`, `@open-pencil/dom-css`, and `@open-pencil/vue` packages with documented public boundaries.

## Near-term work

### Figma fidelity

- Preserve and round-trip more Figma metadata safely.
- Add visual regression coverage for full multi-page `.fig` documents. `bun tools/visual-oracles/src/cli.ts export-fixtures` exports current smoke fixture pages to `/tmp` for manual comparison without committing large images; `tests/fixtures/figma-oracles/visual-comparison-report.json` records the current Figma-vs-OpenPencil oracle diff findings.
- Close high-impact renderer gaps: remaining mask edge cases, blend isolation, pattern fills, and broader variable-font fixtures.
- Improve boolean operation editing/export now that imported Figma `BOOLEAN_OPERATION` nodes remain boolean operations.

### Editor depth

- Complete variable inspector coverage for common numeric/text/layout fields.
- Improve component and instance authoring: component-set definitions, override inspection, slots, and shared-library workflows. Common variant, text, boolean, and instance-swap properties are already editable on instances.
- Treat variables, styles, components, and libraries as governed design-system assets with proposal, review, publish, update, migration, and conformance workflows.
- Complete page-guide creation/editing and layout-grid style parity. Layout-grid rendering and common inspector editing are already supported.
- Add Figma-style inspection aids for distances, spacing, bounds, and alignment, including modifier-key measurement between selected and hovered layers.
- Expand vector editing workflows without regressing imported vector fidelity.

### Reliability and international text

- Make document saves atomic and recoverable, including unsaved documents created through MCP and interrupted local or remote writes.
- Surface provider, model-budget, renderer, and automation failures with actionable recovery paths instead of silent stalls.
- Make desktop automation recover from orphaned processes and renderer crashes without manual cleanup.
- Prevent non-Latin font discovery and rendering crashes across platforms; add Arabic/Persian shaping and RTL layout, then broaden CJK and mixed-script visual fixtures.
- Define a portable-font strategy for reproducible documents across machines, including curated redistributable fonts, embedded or linked document fonts, licensing metadata, fallback visibility, and agent-readable font availability ([#502](https://github.com/open-pencil/open-pencil/issues/502), [#503](https://github.com/open-pencil/open-pencil/issues/503)).

### Cloud and self-hosting

- Provide an optional OpenPencil Cloud backend for account-based workspace sync, sharing, collaboration, comments, and managed team libraries without making cloud accounts mandatory for the editor.
- Support organizations and teams with invitations, viewer/editor/admin roles, link-sharing policies, service accounts, API tokens, and enterprise identity through standard OIDC/SSO integrations.
- Publish documented backend APIs and webhooks for workspace, document, membership, comment, version, and automation events so Cloud and self-hosted deployments integrate with existing developer workflows.
- Add workspace organization for projects, folders, templates, search, indexing, and server-generated previews while preserving stable document identity.
- Add version history with automatic snapshots, named checkpoints, restore, retention controls, and an auditable record of important document and membership changes.
- Provide a durable collaboration relay for deterministic initial sync, presence, reconnects, and restricted-network environments while keeping direct local/P2P workflows available where practical.
- Publish a production-ready self-hosted deployment for teams that need their own storage, identity, network boundary, data location, and retention policy.
- Make self-hosting maintainable with guided deployment, upgrades, backups, health monitoring, observability, and documented recovery procedures.
- Provide explicit data-governance controls for export, deletion, encryption, retention, auditability, and deployment-region or residency requirements.
- Keep AI and media capabilities BYOK so Cloud and self-hosted users connect and control their own model and provider credentials.
- Let documents move between device-only, OpenPencil Cloud, self-hosted, and user-owned storage without losing identity or history.
- Add explicit conflict, offline, sync-health, migration, backup, quota, and recovery UX for every remote deployment mode.

### Agent workflows

- Polish the official `SKILL.md` guidance for OpenPencil so agents use the full inspect → act → render/measure → compare → iterate loop instead of relying on one-shot prompting.
- Publish tested AI workflow recipes for common tasks: create from prompt, edit a selected design, compare against a screenshot or Figma reference, fix visual regressions, extract tokens, and batch-migrate files.
- Accept screenshots and reference images as first-class agent inputs, and return selection/page/viewport renders as native image content to vision-capable MCP and chat clients.
- Support opt-in web retrieval, external MCP connectors, and sandboxed code execution through explicit capability and permission boundaries rather than granting every model ambient access.
- Make structured node-tree diffs a first-class, Git-friendly review artifact for UI, CLI, MCP, SDK, and CI edits instead of relying only on screenshot comparisons.
- Expand design lint findings with expected/actual evidence and safe autofixes; measure rule precision before enabling lint rules as blocking gates.
- Keep deterministic golden renders and replayable edit-operation histories so regressions can be reproduced from document state and actions, not only from final pixels.
- Make agent workflows measurable by default: every substantial operation should be able to produce a render, structured diff, lint result, or comparison artifact.
- Keep MCP, CLI, and SDK operations aligned so agent skills can run the same workflow in desktop, browser, CI, or headless file mode.

### Tooling and API parity

- Maintain a public tool/API reference that maps editor operations to CLI commands, MCP tools, SDK APIs, and Figma Plugin API-compatible eval usage.
- Add coverage tests that detect when a core editor capability exists in the UI but is missing from CLI/MCP/SDK, or vice versa.
- Keep tool outputs structured enough for agents to chain safely: node IDs, bounds, diffs, render artifacts, diagnostics, and machine-readable error details.
- Improve deterministic CLI/MCP export and comparison tools for CI.
- Add more design linting and migration helpers for batch `.fig` and `.pen` workflows.
- Make `.pen` a first-class editable save target across app, CLI, MCP, and SDK workflows rather than an import-only or automation-specific format.
- Extend HTML, CSS, Tailwind, and JSX support from editable import toward URL-based website capture, direct JSX paste/edit workflows, and component-aware design↔code updates that preserve intentional code structure instead of regenerating whole files.
- Provide an adapter contract for additional design sources such as Stitch and Pixso, prioritizing formats with documented or testable semantics over brittle UI scraping.
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

### SDK and embedded editor

- Expand the documented Vue SDK and core package platform with complete example applications for custom editor shells, embedded design surfaces, and automation-specific UIs.
- Provide maintained examples for read-only previews, editable canvases, design review surfaces, and agent-controlled editors.
- Ship an official VS Code/Cursor extension ([#81](https://github.com/open-pencil/open-pencil/issues/81)) for previewing and opening `.fig`/`.pen` documents, connecting to the running editor, invoking CLI/MCP workflows, handing selections between code and canvas, and navigating between generated code and design nodes. Reuse the app, SDK, and automation bridge rather than implementing a second editor inside the extension.
- Define public API stability and migration expectations across the reusable npm packages.
- Keep the renderer, editor core, and tool registry framework-agnostic enough for headless and embedded use.

### Product depth

- Prototyping: frame connections, triggers, overlays, transitions, preview mode, and AI/JSX-authorable interaction definitions.
- Motion: reusable code-authored animation presets, timelines, easing, and deterministic playback/export that compose with prototype interactions and shader inputs.
- Tables and data grids: structured rows, columns, headers, resizing, merged cells, and normal scene nodes inside cells instead of drawing tables as unrelated rectangles.
- Comments: pins, threads, resolution state, and collaboration-aware display.
- Shared libraries: publish, consume, and update components/styles across files.
- Platform asset libraries: use licensed system-native and third-party icon sources, including SF Symbols where platform and redistribution rules allow, alongside the existing Iconify/Lucide workflow.
- Figma Slides (`.deck`) interoperability: import/export, slide editing, presentation, speaker notes, and filmstrip workflows. This ranks below core Figma Design fidelity, reliability, Cloud/self-hosting, and international-text work.
- Platform polish: Windows code signing, PWA support, packaged updater improvements, and desktop-side MCP bundling.

## Non-goals

- Mandatory accounts or a cloud-only document model. OpenPencil Cloud, self-hosted backends, and user-owned remote storage must remain optional alongside local files.
- A hosted service that requires OpenPencil to proxy users' AI provider keys; AI and media integrations remain BYOK even when a backend provides identity, sync, or collaboration.
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
| Component sets / variants                            |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Variant, text, boolean, and instance-swap properties are editable on instances; definition authoring remains incomplete.                                                                                                                                                                        |
| Instances / overrides                                |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Component-property refs and typed assignments are modeled and editable; raw symbol overrides and derived data remain preserved for fidelity.                                                                                                                                                                           |
| Slots                                                |      ↩ |      ◐ |       — |                 ↩ |       — | Some component property payloads may survive round-trip, but Figma slots are not a first-class workflow.                                                                                                                                           |
| Connectors                                           |      ◐ |      ◐ |       — |                 ◐ |       ◐ | Type exists, but Figma connector semantics are weak.                                                                                                                                                                                               |
| Shape-with-text / FigJam shapes                      |      ◐ |      ◐ |       — |                 ◐ |       ◐ | Type exists, but not a full FigJam feature implementation.                                                                                                                                                                                         |
| Slices                                               |      ◐ |      — |       ◐ |                 ◐ |      ✅ | Slice-like export regions exist via tooling, not as true Figma slice nodes.                                                                                                                                                                        |
| FigJam / Slides / Code / CMS / Buzz node families    |      ↩ |      — |       — |                 ↩ |       — | Current Kiwi schema recognizes many newer Figma node families (`TABLE`, `SLIDE`, `CODE_COMPONENT`, `CMS_RICH_TEXT`, `REPEATER`, `WEBPAGE`, etc.), but OpenPencil only preserves/round-trips them where safe; they are not first-class scene nodes. |
| Solid fills                                          |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Color variables supported for common fill cases.                                                                                                                                                                                                   |
| Gradients                                            |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Linear/radial/angular/diamond support; Figma edge cases may differ.                                                                                                                                                                                |
| Image fills                                          |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Fill/fit/crop/tile support exists; imported crop/tile affine transforms are applied, but exact Figma parity is still partial.                                                                                                                      |
| Pattern / noise / custom fills                       |     ✅ |      ◐ |       — |                ✅ |       — | Schema metadata imports/exports; Figma pattern fills with a referenced source node render as repeated source tiles with scale, spacing, alignment, and basic hex offsets. Noise/custom paints still render with a solid fallback pending real paint payload samples; Figma-authored noise/texture/glass effect payloads are captured separately. |
| Video/GIF/media fills                                |      ↩ |      — |       — |                 ↩ |       — | Kiwi schema includes media paint/export enums, but OpenPencil has no video/GIF playback or media layer support.                                                                                                                                    |
| Layer/fill/effect blend modes                        |     ✅ |      ◐ |      ✅ |                ✅ |      ✅ | Appearance, fill, and effect controls are exposed; Canvas applies common modes, while Figma isolation edge cases remain partial.                                                                                                                                        |
| Opacity                                              |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Node opacity uses save layers in the renderer.                                                                                                                                                                                                     |
| Strokes                                              |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Weight, alignment, dashes, and side weights are supported.                                                                                                                                                                                         |
| Stroke caps / joins / miter limit                    |     ✅ |     ✅ |       ✅ |                ✅ |      ✅ | Inspector controls support mixed cap/join/miter editing; CanvasKit rendering and `.fig` roundtrips preserve miter limits.                                                                                                                                                                                    |
| Effects: shadows and blurs                           |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | `showShadowBehindNode` is rendered but not exposed in UI.                                                                                                                                                                                          |
| Fill / stroke / effect styles                        |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Imported local definitions are modeled and selectable with undo-safe detach; creating and publishing styles still needs a style manager.                                                                                                                                                                                                            |
| Corner radius                                        |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Uniform and independent radii supported.                                                                                                                                                                                                           |
| Corner smoothing                                     |     ✅ |     ✅ |       ✅ |                ✅ |      ✅ | The inspector supports mixed smoothing percentages with undo; uniform and independent-radius corners render, while exact Figma parity still needs broader fixture tuning.                                                                                                         |
| Masks                                                |     ✅ |      ◐ |       — |                ✅ |      ✅ | Figma schema `mask`, `maskType`, and `maskIsOutline` fields import and export; common sibling alpha/vector/luminance mask stacks render, including consecutive mask layers. UI controls and deeper Figma edge cases remain incomplete.             |
| Auto layout: vertical/horizontal                     |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Yoga-backed layout.                                                                                                                                                                                                                                |
| Auto layout: wrap                                    |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | UI toggle exists.                                                                                                                                                                                                                                  |
| Auto layout: grid                                    |     ✅ |      ◐ |       ◐ |                ✅ |      ✅ | CSS-grid-like support is partial; newer schema fields for grid child alignment and auto tracks are not fully exposed.                                                                                                                              |
| Padding / gaps / alignment                           |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Common flex controls are exposed.                                                                                                                                                                                                                  |
| Hug / fill / fixed sizing                            |     ✅ |     ✅ |      ✅ |                ✅ |      ✅ | Min/max support is partial in UI.                                                                                                                                                                                                                  |
| Ignore auto layout / absolute positioning            |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Mode is modeled; UI coverage is partial.                                                                                                                                                                                                           |
| Strokes included in layout                           |     ✅ |      ◐ |       — |                ✅ |      ✅ | Stored/exported and used in layout paths, but no obvious panel control.                                                                                                                                                                            |
| Reverse z-index / align-content                      |     ✅ |      ◐ |       — |                ✅ |      ✅ | Modeled and exported; UI is limited.                                                                                                                                                                                                               |
| Constraints                                          |     ✅ |      ◐ |      ✅ |                ✅ |      ✅ | Horizontal and vertical pin, center, stretch, and scale modes are editable; imported edge-case parity remains partial.                                                                                                                             |
| Layout grids / guides                                |     ✅ |     ✅ |       ◐ |                ✅ |      ✅ | Layout grids render and common column, row, and square-grid geometry is editable. Imported page guides render, but guide creation/editing and full grid-style management remain incomplete.                                                         |
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
| Variables bound to text/layout/visibility/effects    |      ◐ |      ◐ |       ◐ |                 ◐ |      ✅ | Some bindings exist; not full Figma property coverage.                                                                                                                                                                                             |
| Variables in prototypes / expressions / conditionals |      — |      — |       — |                 — |       — | Depends on prototype system, which is not implemented.                                                                                                                                                                                             |
| Libraries / publish / update review                  |      ↩ |      — |       ◐ |                 ↩ |       — | Metadata can survive round-trip; no full library workflow.                                                                                                                                                                                         |
| Prototype flows / starting points                    |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Prototype hotspots / triggers / actions              |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Prototype overlays / scroll-to                       |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Smart animate / easing / spring / duration           |      — |      — |       — |                 — |       — | Not modeled.                                                                                                                                                                                                                                       |
| Interactive components                               |      — |      — |       — |                 — |       — | Component-level prototype connections are not supported.                                                                                                                                                                                           |
| Dev Mode inspect / measurements / annotations        |      — |      — |       — |                 — |       ◐ | OpenPencil has CLI/MCP inspection, but not Figma Dev Mode UI.                                                                                                                                                                                      |
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
6. **Layout grids and guides** — complete page-guide creation/editing and fuller grid style parity; common imported layout grids already render and have inspector controls.
7. **Full component property and slot workflows** — support authoring, not just preserving imported payloads.
8. **Prototype/media/interaction metadata** — schema now includes more interaction, media runtime, animation, and slide fields; start by preserving flows/connections/runtime metadata before building playback.

## Code map

| Concern                      | Files                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Scene graph fields           | `packages/scene-graph/src/types.ts`                                                                            |
| Source edit tracking         | `packages/scene-graph/src/source-metadata.ts`                                                                  |
| `.fig` metadata policy       | `packages/fig/src/source-metadata.ts`                                                                           |
| Kiwi import mapping          | `packages/fig/src/node-change/convert.ts`                                                                       |
| Kiwi export mapping          | `packages/fig/src/node-change/export-node.ts`, `packages/fig/src/node-change/serialize.ts`                    |
| Kiwi schema                  | `packages/kiwi/src/fig/schema/fig.kiwi`, `tests/engine/io/fig/import/schema-coverage.test.ts`                   |
| Renderer dispatch            | `packages/core/src/canvas/scene.ts`                                                                            |
| Fills / images / gradients   | `packages/core/src/canvas/fills.ts`                                                                            |
| Strokes                      | `packages/core/src/canvas/strokes.ts`                                                                          |
| Effects / shadows            | `packages/core/src/canvas/shadows.ts`                                                                          |
| Text rendering               | `packages/core/src/canvas/text.ts`, `packages/core/src/canvas/text-derived.ts`                                 |
| Layout engine                | `packages/core/src/layout/**`                                                   |
| Property panels              | `src/components/properties/**`, `packages/vue/src/controls/**`                                                 |
| CLI                          | `packages/cli/src/index.ts`, `packages/cli/src/commands/**`                                                    |
| MCP/tools                    | `packages/core/src/tools/**`, `packages/mcp/src/tool/registration.ts`                                          |
