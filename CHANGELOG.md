# Changelog

## Unreleased

## 0.17.0-beta.2 — 2026-11-04

This is a pre-release that lists changes since 0.17.0-beta.1: npm packages are published under the `next` tag, and installed apps on the stable release do not update to it. Linux package managers see `0.17.0-beta.2` as newer than `0.17.0`, so `.deb` and `.rpm` users should remove the beta before installing the final 0.17.0.

### Breaking changes

- `sharedStylePatch` and `sharedStyleDetachPatch` move from `@open-pencil/vue/controls/shared-style` to `@open-pencil/scene-graph/shared-styles`.
- `@open-pencil/core/vector` no longer exports `evalCubic`, and `@open-pencil/scene-graph/geometry` no longer exports `geometryCommandCoordCount`; use `cubicPoint` and `readGeometryBlob` from `@open-pencil/scene-graph/geometry` (#1685).
- Plugin API nodes read Figma's node types: a page's `type` is `PAGE` instead of `CANVAS`, and `figma.root.type` is `DOCUMENT` instead of `FRAME`, in `node.type` and `toJSON()`. Scripts that compared against `CANVAS` should compare against `PAGE`.
- Cloud keeps each collaboration room's snapshot in object storage beside the documents' files instead of in PostgreSQL. Upgrading starts every document's live room over from its last saved version, so edits a room held that no saved version has yet are dropped.
- `useCanvas` from `@open-pencil/vue/canvas/surface` no longer takes `onPresented`; listen for the editor's `render:presented` event with `editor.onEditorEvent('render:presented', …)`, which fires once a frame shows the whole visible scene (#1753).

### Added

- The Eyedropper tool (I) and the color picker's eyedropper button pick any color shown on the canvas, with a loupe of the pixels under the pointer.
- The desktop app can use Cursor, signed in with `cursor-agent login`, or Grok Build, signed in with `grok login`, as the design agent.
- Choose and remember an interface size of 100%, 110%, 125%, or 150% without changing canvas zoom.
- Home lists unsaved work kept from documents closed without saving or open when OpenPencil quit, with a preview of each, in place of the recovery prompt at start.
- The AI chat compacts long conversations: the model summarizes what came before, automatically before the context window fills up, also between the steps of a long reply, from the new context meter in the chat header, or with `/compact`, and a request that is already too long offers Compact and retry. With Pi, `/compact` asks Pi to compact its own context, and the transcript shows where it did. Replies show the tokens they used on hover.
- In the desktop app and for files in storage, a file reopens on the page and at the view it was left at, as in Figma (#1675).
- Scripts create, find, apply, edit, and remove paint, text, effect, and grid styles through Figma's plugin API: `figma.createPaintStyle()` and its siblings, `getLocalPaintStylesAsync()` and its siblings, `getStyleByIdAsync()`, and `set…StyleIdAsync()` on layers. A change to a style reaches every layer and text range that uses it, and removing one leaves them its values. A style ID the document does not hold is refused, as in Figma.
- Scripts read and set more of Figma's plugin API: `guides`, `horizontalPadding` and `verticalPadding`, `booleanOperation`, a text's underline style, `leadingTrim`, and `openTypeFeatures`, component `description`, `instances`, and `getInstancesAsync()`, a set's `defaultVariant` and `variantGroupProperties`, `removeOverrides()`, `setFillsAsync()` and `setStrokesAsync()`, `getTopLevelFrame()`, and `documentColorProfile`.
- Scripts can export layers and pages with Figma's `node.exportAsync()` as PNG, JPG, SVG, or PDF, and read and set `node.exportSettings` with Figma's options, which `.fig` files keep.
- New npm package `@open-pencil/oxlint-plugin`: OpenPencil's code conventions as Oxlint rules for any TypeScript project, such as validated JSON, Valibot schema placement, no broad type casts or silent catches, and no secrets in logs or URL query strings. `@open-pencil/oxlint-plugin/recommended` is the configuration OpenPencil's repositories extend: the TypeScript, import, unicorn, promise, and Node rules they follow and the plugin's own, for a JSON `extends` path or `oxlint.config.ts`.
- Official builds offer to report an unexpected error, or a problem you describe from **File → Report a Problem…**, to the OpenPencil team, optionally with recent diagnostics and the open document; nothing is sent until you choose **Send report**, and the next launch offers the error that ended a crashed session.
- A Tab behaviour for tab triggers drawn as instances of a component, as in the shadcn/ui kit: in preview and generated Reka and Radix code, the chosen tab shows its selected variant and a tab drawn disabled cannot be chosen; design JSX writes such triggers as `Tabs.Tab` (#1710).
- Shadow colour, blur, spread and offsets, and blur radius, bind to variables, so effects follow a variable mode: apply or create a variable from each field in the effect settings, where typing a value detaches it, and `figma.variables.setBoundVariableForEffect`, `bind_variable`, effect styles, `.fig` files and the Figma clipboard carry the bindings (#1712).
- Form controls (text fields, textareas, number fields, switches, checkboxes, radios, and radio groups) have an invalid state: a behaviour binds it as a value or as an Invalid or Error variant beside Disabled, preview shows it, and generated Vue and React components take an `invalid` prop that sets `aria-invalid` (#1716).
- On desktop, a Claude Code or Codex conversation reopened from chat history continues in the agent's own session, so the agent remembers what was said, instead of being read-only.
- Vite apps serve CanvasKit's WebAssembly, the bundled fonts, and HarfBuzz's subsetter by adding `openPencil()` from `@open-pencil/core/node/vite`, and a host that does not serve one of them gets an error naming the file and the locator to set instead of a WebAssembly compile error (#1551).
- Scripts read a layer's `fillGeometry` and `strokeGeometry` and call `outlineStroke()` as in Figma, in the apps and in `open-pencil eval`.
- Release builds occasionally ask whether you would like to donate toward OpenPencil's development and infrastructure, and File → Support OpenPencil… and Settings → General link to the donation page.
- Self-hosted Cloud servers can report their errors to PostHog error tracking through an optional `[error_tracking]` table in the deployment configuration; servers without it send nothing.
- CSS, HTML and Tailwind export write a shadow or blur field bound to a variable as that variable's `var()` where the layer draws the variable's value, and design token export writes it as a reference to the variable's token, which import binds back.
- Scripts get a layer's CSS with `getCSSAsync()`, the CSS OpenPencil's HTML export writes for it.
- Editors made with `createEditor()` edit vector paths point by point, with their own undo, and continue paths with the pen: hosts open a path with `enterNodeEditMode()`, which `useCanvasInput` calls on double-click, and picking a tool other than the pen commits a pen path in progress (#1756).
- Text copied from a web page or another app pastes as one text layer, as in Figma, keeping its links. **Paste as layers**, in the Edit menu and the canvas context menu, lays the copied HTML out as layers instead, and a notice offers it after pasting a card or other laid-out part of a web page, or HTML source.

### Changed

- `batch_update` applies all of its operations or none: a missing layer, a wrong value, or an unknown prop now fails the whole call and leaves the document unchanged, where it used to apply the rest and list errors (#1651).
- Model settings open from the chat's model picker instead of a gear beside the message field.
- Zoom to fit and zoom to selection fill the canvas with the layers inside the margins Figma keeps, zooming in past 100% for small layers, and zoom to fit on an empty page shows its origin at the centre at 100%; a page opens fitted to its layers on its first visit and returns to the view it was left at after (#1675).
- The menus follow the tab in front: on Home and in a New file tab they leave out Object, Text, and Arrange and the items that need a document, and in the desktop app items that cannot act, such as Group with nothing selected, are greyed out, as in Figma.
- Document tabs show what kind of file they hold, with the pen and sticky note Home uses for designs and boards.
- Every setting with a default offers the same Reset to default, shown only while it differs, including the toolbar layout, tool access, chat, notifications, and online fonts.
- The Behaviour section labels the two variant values a control draws as on and off, so a set whose values read like the value itself, such as Checked and Unchecked, is clear to set up (#1722).
- A number field bound to a variable keeps its icon and shows its value; the variable button, now at the end of every field, names the variable on hover.
- Recent files leave the list one at a time, from Remove from recent in each file's menu, instead of a button that cleared the whole list.
- Imported HTML lands where a browser lays it out at 1440×900: CSS grid, floats, viewport units, media queries, and `body` styles place layers as on the page, and auto layout is kept wherever it reproduces the page.

### Fixed

- A component set's default variant is the one Figma picks: variants whose rows overlap read left to right, others top to bottom.
- Component sets from files that save no variant values, such as the shadcn/ui community kits, list their values in Figma's order, and a variant property's default is the value of the set's top-left variant, as in Figma, whatever default the file records, so behaviours bind to them and scripts read them as Figma does (#1699).
- Component sets made in OpenPencil open in Figma as component sets rather than frames of loose components, and sets whose variants were renamed or given new properties are saved without Figma reporting errors (#1699).
- Component sets' boolean, text, instance swap, and slot properties read from a `.fig` appear once, on the set, keep an instance's value when it switches variant, and are saved so that Figma shows them on instances, including on sets made in OpenPencil (#1737).
- Switching an instance's variant keeps its layers, their IDs and the overrides on them wherever the new variant has a layer of the same name, even one of another type, brings back the overrides of a layer the other variant lacks when the instance switches back, and undo restores the instance exactly.
- A nested instance in a `.fig` file sizes in the variable mode its outer instance sets, also when its component is edited or it is pasted from Figma, and an override that clears a collection's mode opens, edits and saves per collection.
- Duplicating or cloning an instance from a `.fig` file that holds two instances of the same component, such as a button with left and right icons, no longer makes the document fail to save (#1699).
- Duplicating a frame that holds a component and its instances gives instances of the duplicated component, as in Figma (#1699).
- A page added to a `.fig` file, such as one of the shadcn/ui kits, is saved last instead of second, and a page moved after opening is saved where it now is (#1707).
- A library no longer reports its components as changed after a `.fig` round trip with fonts loaded.
- Pasting a layer copied out of a component, while it is bound to one of the component's properties, pastes it unbound instead of failing.
- Text is always laid out in its own fonts: text whose font, script fallback, or emoji font is still loading or not available is laid out again once it arrives, instead of keeping the size of another face, which left titles, sticky notes, and imported text narrower or wider than they drew.
- Text with its leading trimmed to cap height, such as badge digits, sits where Figma puts it once its font is loaded, instead of several pixels too low.
- Text with a fractional line height in pixels, such as 22.5 px, steps its lines and takes its height as Figma does, instead of drifting a pixel every line or two.
- The first Chinese, Japanese, or Korean text in the desktop app loads one system font per script instead of every listed one and keeps a single copy of each, using hundreds of megabytes less memory, and draws in about 70 ms instead of 2 s per render while its fonts load (#1684).
- On Windows, page text in an installed font, such as interactive component previews on the canvas, draws in its bold, italic, and light faces instead of the regular one.
- A text that sizes itself outside auto layout resizes when a variable bound to its size, such as its font size, changes.
- Clicks and hover select a shape only where its fill or stroke draws, as in Figma: an unfilled line or curve is picked by its stroke, a filled ellipse or rounded rectangle by its outline, and a layer whose paints show nothing lets clicks through (#1685).
- Escape clears the selection at any depth and Enter keeps layers without children selected, as in Figma; a click takes the empty area of a component or instance whatever its fill, while a ⌘-click passes through a frame or instance whose fill does not show (#1697).
- Picking a layer in the layers panel leaves canvas clicks as clicking it on the canvas would, and the canvas no longer outlines the container a layer was reached through, as in Figma (#1700).
- Selecting another layer while a vector path is open, such as in the layers panel, leaves vector edit mode and keeps the edit, as in Figma (#1756).
- Pressing H while drawing with the pen or editing a vector path keeps the path and switches to the hand, as in Figma, instead of leaving it open under a tool that cannot edit it; holding Space still pans and lets a pen path continue (#1756).
- Removing a fill, stroke, or effect in the properties panel keeps each remaining item's variable binding on that item, instead of moving a binding onto the wrong paint or effect.
- An auto layout frame with nothing to hug keeps its size, as in Figma, rather than collapsing to its padding: a new frame keeps the size it was made at, and one that loses its last layer keeps the size it hugged to.
- Spread and Compact arrange a pile of layers the same way every time, rather than differently on each run.
- New stars have Figma's inner radius.
- A rotated frame draws its whole fill, and exports of rotated layers are no longer cropped to a shifted box (#1767).
- Opening a document keeps the loader up until its page is fully drawn where it opens, instead of showing the canvas while it still fills in (#1753).
- HTML export draws linear, radial, and angular gradient fills and every stacked fill with its blend mode, writes the colour a variable-bound paint draws, and standalone pages define the tokens their layers use. Diamond gradients are still left out.
- HTML export, Tailwind JSX, canvas islands, and `getCSSAsync()` blur layers and shadows as the canvas draws them, and text keeps its shadows; layer and background blurs were 2.3 times as strong, and text shadows were dropped. Imported CSS shadows draw as the browser draws them.
- A text or effect style bound to a variable reads back from design tokens bound to that variable, not to one with the same path in another collection; export warns when other tools could confuse the two.
- A Vue text field or textarea exported as code puts the attributes it is given, such as `name`, `required`, or `aria-invalid`, on its input rather than its wrapper, as the React components do (#1731).
- In preview, a slider's range and a progress bar's indicator follow the value when they sit inside the track, as in the shadcn/ui kit's Slider (#1706).
- A link in a text opens in a new tab in preview, instead of taking the editor away from the document (#1716).
- Plugin API underline getters read the underlined characters' value over partly underlined text, and text, paint, and effect setters word their errors as current Figma does, listing each problem of a value with several.
- The Plugin API's `componentPropertyReferences` reports the bindings of any layer in a component or instance, not only frames, text, components, and instances.
- `appendChild` in scripts moves a layer that is already a child to the end, as Figma does (#1699).
- Dashes a script sets with `dashPattern` now draw.
- `figma.flatten()` and boolean operations in `open-pencil eval` and headless CLI tools make real vectors and fit their bounds, instead of a placeholder box.
- `@open-pencil/core/figma-api` types resolve Figma's node, paint, and style types for packages that use them, without bringing in Figma's plugin sandbox globals.
- MCP tools and scripts read pages that have not been opened yet, such as `get_page_tree` on a page's ID, `query_nodes` by page name, and `get_node` or `figma.getNodeByIdAsync()` on a layer's ID, instead of finding them empty, and `page.loadAsync()` and `figma.loadAllPagesAsync()` load pages as in Figma.
- AI and MCP agents can no longer add layers inside an instance with `render`, `import_svg`, `import_mermaid`, `insert_icon`, or `insert_library_component`, which left the document unable to save as `.fig`; layers rendered into an instance's slot save too.
- PDF export works in the installed `openpencil` CLI and MCP server, which run on Node.js, instead of failing with "Cannot read properties of undefined (reading 'jsPDF')".
- The interface draws in Inter's own medium and semibold weights, and in Inter on Home, also on systems without Inter installed, such as most Linux desktops; once a document opened, every weight used to come from the regular face.
- Initials on collaborator and account avatars stay readable on light colors: the avatar darkens the person's color just enough, as the follow frame already did.
- A design or board saved to disk in the desktop app appears in recent files on Home, as a file opened from disk does.
- Browsers set to Chinese (`zh`, `zh-SG`, `zh-Hans`) open the app in Simplified Chinese instead of English.
- On Linux, Backspace and keys such as `[`, `]` and `N` type into comments and other text fields again instead of running menu commands, so Backspace no longer deletes the selected layer while you type.
- The Linux desktop app no longer exits at startup on Wayland with the NVIDIA driver when its WebKitGTK is older than 2.54.2.
- On Windows and Linux, the Software Update window no longer shows the editor menu bar (#1230).
- Cloud answers a malformed document, workspace, version, share, invitation, or upload ID in an API request with not found instead of a server error.

### Performance

- Switching a variable mode or editing a variable's value lays out bound auto layouts once instead of once per bound layer: on a frame of 1,600 bound cards, from about 36 seconds to under 0.1 seconds.
- AI and MCP agents can edit properties in documents of any size: a one-property edit copies only the layers it changes, so it takes milliseconds instead of seconds on large files and is no longer refused above 10 000 layers.
- Switching a variant in the editor, and undoing it, is faster: only what the switch changes is recorded for undo.
- Joining a collaboration room on a large document is much faster and uses far less memory.
- Cloud's collaboration relay saves only what changed in a room instead of rewriting the whole room every few seconds, so editing a large document writes far less to the database.
- Resizing the canvas, such as dragging a panel, keeps what is already drawn and renders only the newly exposed edge, instead of blanking and redrawing the whole scene (#1753).
- On Cloudflare, Cloud's collaboration relay sleeps while a room is idle and its people stay connected, instead of running for as long as anyone has the document open.

### Security

- Cloud caps how many uploads, documents, collaboration tickets, and invitations one account can request per minute across all of its documents and workspaces, not only per document or workspace.

## 0.17.0-beta.1 — 2026-11-02

This is a pre-release: npm packages are published under the `next` tag, and installed apps on the stable release do not update to it. Linux package managers see `0.17.0-beta.1` as newer than `0.17.0`, so `.deb` and `.rpm` users should remove the beta before installing the final 0.17.0.

### Breaking changes

- Shared rooms record document data in a new format, so people on this version and on earlier versions can no longer join each other's rooms, and rooms this browser saved with an earlier version are not converted. Room links use `/rooms/<room-id>` instead of `/share/<room-id>`, so links copied before no longer open.
- Layers opened from a `.fig` file keep the GUIDs the file saved them under as their IDs, instead of `0:1`, `0:2`, and so on in reading order, so an ID stays the same after a save and reopen. IDs printed by `openpencil tree` or MCP before this release no longer find their layers.
- `SceneNode.lineHeight` and `letterSpacing`, and the same style run fields, are `{ value, unit }` objects in pixels or percent; documents and rooms saved with the old numbers are not converted.
- The retained canvas renderer, the Rendering settings section with its progressive rendering switch, and the `renderer` URL parameter are removed; progressive rendering is the only canvas renderer, and a stored rendering preference is ignored. `@open-pencil/vue/i18n` no longer exports `useRenderingMessages`; the wide-gamut notice, the only rendering string left, is in the `editor` messages.
- Code in the Code tab that puts statements before its JSX ends them with `return` and the JSX, as a component's body does; the JSX alone on the last line no longer renders.
- Plugin scripts run through `eval`, the CLI, and MCP follow Figma's font rule: an edit that lays text out again (characters, size, font, spacing, case, alignment, auto-resize, and the matching `setRange…` methods) throws `Cannot write to node with unloaded font` until `figma.loadFontAsync` has loaded every font the text uses, a new font has to be loaded before it is set, and `loadFontAsync` rejects a font that cannot load or a style the family has no face of. Text in a missing font can still take a loaded font for all of its characters.
- Scripts use variables as in Figma's Plugin API: `figma.variables` creates and looks up variables and collections, variables set values with `setValueForMode`, and layers bind with `node.setBoundVariable` and paint `boundVariables`; the top-level `figma.getVariableById`, `createVariable`, `setVariableValue`, `deleteVariable` and collection methods are removed. `openpencil.bindVariable(node, field, variable)` and `openpencil.unbindVariable(node, field)` replace `figma.bindVariable` and `figma.unbindVariable`, so `figma` keeps to Figma's Plugin API.
- Scripts reach OpenPencil-only features through `openpencil`: `exposeInstanceSwap`, `getFontStatus`, `getFillOkHCL`/`setFillOkHCL` and the stroke pair, and `get`/`setLayoutDirection` and `get`/`setTextDirection` take a node; `figma.booleanOperation` and `figma.flattenNode` are removed in favour of Figma's `figma.union`, `subtract`, `intersect`, `exclude` and `flatten`.
- The plugin API takes and gives paints in Figma's shape: a paint's `gradientTransform` and `imageTransform` are two rows of three such as `[[1, 0, 0], [0, 1, 0]]`, rejecting the `{ m00, … }` object form and a gradient without a transform; image paints use `scaleMode`, `rotation`, and `scalingFactor` instead of `imageScaleMode`; and strokes refuse geometry keys such as `weight` or `align`, which belong on the node.
- Design JSX binds component properties with `property(name, default)` in a layer's `text`, `visible`, or an instance's `of`, creating them on the component; `propertyRefs` and `properties` on `<Component>` and `<ComponentSet>` are removed.
- Design JSX's `defineVars(collection, values, options)` defines a collection instead of grouping references, and the `VarDef` type is removed. `designVar` takes a variable's name or ID, or its collection and name as `designVar('Theme', 'Line')`, without a fallback value; a missing, unresolvable, or ambiguous variable is an error.
- Every public name of `@open-pencil/*` packages now has exactly one import path, and no package re-exports another's names. `@open-pencil/scene-graph`'s root holds `SceneGraph`, `generateId`, `setIdSession`, and the node types; primitives come from `/primitives` and every other domain from its own subpath, such as `/instances`, `/instances/overrides`, `/variables`, `/transfer`, `/components`, `/slots`, `/comments`, and `/fields`. `/text-direction` and `/text-picture` are now `/text/direction` and `/text/picture`, and `/types` is part of the root.
- `@open-pencil/core`'s root is the editor that `/editor` was; `/editor` and `/kiwi` are removed, and other names come from Core's subpaths or the package that declares them, such as `@open-pencil/kiwi`, `@open-pencil/fig`, and `@open-pencil/pen`.
- `@open-pencil/vue`'s root holds `provideEditor`, `useEditor`, and `EDITOR_KEY`; every other composable and primitive comes from the subpath of its source folder, such as `/canvas`, `/controls/fill`, `/editor/commands`, `/primitives/NumberField`, and `/i18n`. It no longer re-exports `createEditor`, `EDITOR_TOOLS`, `TOOL_SHORTCUTS`, or Core's editor types.
- `@open-pencil/kiwi` has no root entry, and `@open-pencil/dom-css`'s root no longer repeats `/browser`, `/export`, `/scene-graph`, or the JSX factories.
- Valibot schemas exported by the packages are named `<name>Schema` in camelCase. From `@open-pencil/core/library`, `SerializedLibraryRevisionSchema` is now `serializedLibraryRevisionSchema`, `LibrarySummarySchema` is `librarySummarySchema`, and `StoredLibraryLatestManifestSchema` is `storedLibraryLatestManifestSchema`. From `@open-pencil/fig`, `FigArchiveMetaSchema` is now `figArchiveMetaSchema`.
- `@open-pencil/pen` exports only `parsePenFile`, `readPenFile`, and the `PenDocument`, `PenNode`, and `PenOverride` types; its conversion helpers, such as `parseSize`, `applyPadding`, `convertFill`, `convertStroke`, `isVarRef`, `buildVarContext`, and `iconFontFamily`, are no longer public. `penAssets(doc).icons` lists `{ name, options }` requests, one per way an icon is drawn, instead of icon names; a host loads each with `provider.icons([name], size, options)`.
- `getCanvasKit` from `@open-pencil/core/canvaskit` loads CanvasKit's full build, which encodes WebP and JPEG, so hosts that serve the WASM themselves must serve `canvaskit-wasm/bin/full/canvaskit.wasm`. In a browser it no longer reads Vite's `BASE_URL`: it loads `/canvaskit.wasm` unless the host sets the URL with `setCanvasKitLocator` (for example `setCanvasKitLocator(() => wasmURL)` with `import wasmURL from 'canvaskit-wasm/bin/full/canvaskit.wasm?url'`) or passes `locateFile`.
- `exportFigFile` from `@open-pencil/core` takes one options object, `exportFigFile(graph, { ck, renderer, pageId, renderHeadlessThumbnail, documentName })`, instead of positional CanvasKit, renderer, page, and thumbnail arguments. `@open-pencil/core/canvas` no longer exports `withFigExportRuntime`.
- `SceneGraph.updateNode` writes fields as given and no longer detaches shared styles. An edit detaches the styles whose fields it changes before writing, with `styleDetachmentChanges` from `@open-pencil/scene-graph/shared-styles`, as the editor and the plugin API do.
- `SceneGraph.reorderChild` is removed in favor of `insertChildAt`, which takes the same arguments, and `SceneGraph.LAYOUT_AFFECTING_KEYS`, `TEXT_PICTURE_KEYS`, and `GLYPH_AFFECTING_KEYS` are now exports of `/fields` and `/text/picture`.
- `VariableValue` includes formula and color-expression objects; API consumers should resolve variables before treating non-alias objects as colors. `TokenExpression.resolved` is optional: a CSS expression on a formula or reference mode records no number, and it now outlives changes to its mode's value instead of being dropped when the value stops being a plain number.
- A vector's per-region paints live on its network: `VectorRegion` has `fills` and `fillStyleId`, and `GeometryPath` no longer has them. `cloneVectorNetwork` moved from `@open-pencil/scene-graph/vector-network` to `@open-pencil/scene-graph/copy`. `@open-pencil/fig/node-change` no longer exports `resolveStyleOverrideFills` or `resolveVectorStyleOverrideFills`, and `resolveGeometryPaths` no longer takes fills by style ID.
- Text nodes and style runs have a `fontStyle` face name, family faces carry a `style`, and `FONT_WEIGHT_NAMES` uses Google Fonts' names ("SemiBold"). `weightToStyleName`, `weightToFigmaStyle`, `styleToVariant`, and `normalizeFontStyleName` are removed, and `weightToStyle` is renamed `faceLoadKey`. The desktop `list_system_fonts` command and `setHostFontCatalog` list each face with its style, weight, and slant instead of style names; the typography SDK's `weights` is `faces` (with `faceName` and `setFace`), and `resolveParagraphFontFamilies` takes a face.
- `@open-pencil/core` replaces `state.play` and the `PlayState` type with `state.canvasView` (`CanvasView`, `{ id: 'edit' }` or `{ id: 'play', revision }`), and `state.readOnly` with `state.hostRestrictions` (`EditorRestrictions`, `{ readOnly }`, still set with `setReadOnly`), and no longer exports `READ_ONLY_TOOLS`. Read how a canvas behaves, whether it offers edits, and which tools it has from `resolveEditorProfile(state)` and its `edits` and `tools`.
- `SkiaRenderer` drops the box and corner arguments from `drawNodeFill`, `drawNodeStroke`, `drawStrokeWithAlign`, `clipNodeShape`, `makeNodeShapePath`, `renderEffects`, and `applyClippedBlur`, and removes `drawArc` and `makeRRectWithOffset`: the renderer works out the outline itself.
- `@open-pencil/core/canvas` replaces `outlineStrokeNodesToVectorProps` and `hasVisibleStrokeSourceNode` with `outlineStrokeLayer` and `layersToOutline`, and the editor's `copySelectionAsSVG` returns a promise.
- `lineArrowEndpoints` is removed from `@open-pencil/scene-graph/arrow-caps`; `lineStrokeEnds` gives the path a line's stroke runs along. `StrokeCorners` from `@open-pencil/scene-graph/geometry` is renamed `StrokeShape` and takes the layer's `type`. `clipPolygon` and `clipBoundsToPolygon` move from `@open-pencil/scene-graph/geometry` to `@open-pencil/scene-graph/clipping`, and `@open-pencil/core/io/formats/svg` no longer exports `vectorNetworkToSVGPaths`; import it from `@open-pencil/scene-graph/vector-network`.
- `createDesignJSXRenderer` from `@open-pencil/design-jsx` takes a `vectorBounds(network)` service, which measures a `<Vector>`'s path; `@open-pencil/core/design-jsx` provides it.
- `useCanvasVirtualReference` from `@open-pencil/vue/canvas/overlays` takes the view to project through (`{ zoom, panX, panY }`, as a ref or getter) instead of the editor; pass `() => editor.state` for the previous behaviour. `OpenPencilBindingProviderOptions` takes `types`, a list of variable types, instead of `type`.

### Added

- OpenPencil Cloud is ready to self-host, and to try before the hosted service opens: open the editor with `?cloud=preview`, or follow an invitation, to keep documents on your team's server and edit them together. Connect a server in **Settings → Cloud**, which also holds the hosted service's waitlist: email and password sign in, and create an account, right in the dialog, while Google, Apple, and two-step sign-in finish in the browser. Home lists the server's workspaces and the documents shared with you; every account starts with a workspace of its own and can create team workspaces whose admins invite people by email as admins, editors, or viewers and delete them once they are empty. **New design** creates in the place Home shows, **File → Save to…** saves the open document straight to the only workspace or bucket it can go to and asks only when there are several, **File → Browse files…** opens Home where you left it, and a status beside the name appears when the document is offline, couldn't save, changed in two places, with the choice to keep both versions, or is view only.
- Opening a Cloud document joins its live room, so everyone with it open sees edits and cursors as they happen while one editor saves for all. **Share** invites people by email and turns on a link that opens the document for guests, within what the workspace's plan allows; on a computer, the web editor offers to open invitations and shared links in the desktop app. In the web app the address bar shows the open Cloud document, and the version being looked at, so a reload or the address reopens it for anyone with access. A viewer's document is read-only, as in Figma: layers can be selected, copied, and exported, the toolbar keeps Move and Hand, and edits, from the canvas, panels, shortcuts, and agents alike, are refused.
- **File → Show version history** lists a Cloud document's named versions and autosaves, as in Figma: choose one to look at it read-only, then restore it for everyone in the room, duplicate it, edit or delete its info, or copy a link to it, and **File → Save to version history…** (⌥⌘S) names the document as it is now.
- A Cloud server has its own pages for signing in, account security, and administration. **Profile** changes your name and, through a link sent to the new address, your email, and uploads a picture you drag and zoom into the circle people see; **Sessions** lists where your account is signed in and its recent sign-ins and signs out any of them, and **Account settings** in Home's account menu opens them. The server emails you about a sign-in from a new address and about changes to two-step sign-in, and keeps every picture itself, copying a linked Google account's picture at sign-in, so pages never load pictures from Google or Gravatar. Its console lists people, access requests, email, and activity as searchable, filterable, paged tables: administrators open a page for each account, reset a locked-out person's two-step sign-in, give a reason when suspending someone, and take a picture down. A workspace's **Members** dialog splits into Members, Invited, and Settings tabs, showing who sent each invitation and when it expires, with **Resend**.
- Self-hosted OpenPencil Cloud installs from npm, where `npm install -g @open-pencil/cloud` provides the `openpencil-cloud` server and the `openpencil-ai-relay` AI relay commands, or runs from the published image `ghcr.io/open-pencil/cloud`, with the server and the editor it serves; `compose.self-hosted.yml` starts it on one machine with a database, storage, and email. The server, its relay, and its pages are under the Apache License 2.0, while the protocol the editor speaks to it stays MIT; `VITE_OPENPENCIL_CLOUD=off` builds the editor without Cloud.
- The AI assistant can use models through OpenPencil Cloud: choose **OpenPencil Cloud** as a model's provider in **Settings → Models** and the workspace whose plan pays for it, with the models and prices the server offers. The chat shows how many credits the workspace has left; when they run out, it offers **Manage plan** where the server bills, and on a self-hosted server says when the allowance renews. Self-hosted servers offer AI through the AI relay, which forwards requests to one OpenAI-compatible provider with your key and holds each workspace to its monthly credit allowance.
- Boards: Home and the New file tab (⌘T or + in the tab bar, as in Figma) offer Design and Board side by side; a board has FigJam's tools (sticky note, shape, connector, section, text), its keys (S, R, X), and a 16-unit snap grid, and saves and opens as a FigJam `.jam` file, which the desktop app also opens from Finder. Cloud keeps whether a document is a design or a board, and Home marks each file with its kind and filters recent files by it.
- Boards open on the canvas and their tools alone, as FigJam shows them, with no rulers, the panels a click away, and the AI chat floating over the canvas; while the panels are hidden, every selection but a lone image gets FigJam's selection toolbar, with colour, outline, text, alignment and wrap-in-section menus for sticky notes, shapes, connectors, text, sections and other layers. Boards draw FigJam's dot grid under their layers and show no pixel grid; a click inside a frame selects the frame, Shift+arrow moves to the next 16-unit grid line, R arms a square shape, a collaboration room shares that a document is a board, and boards have no design lint.
- FigJam sticky notes open from `.fig` files and paste from FigJam with their colour, text, author line, wide shape, and scale, and save back so Figma shows them as sticky notes. A sticky note tool, shown from Customize toolbar, draws notes the way frames are drawn, a note growing with the drag and its text scaling with it, or places one with a click. Their handles scale them or make them wide as in FigJam, the Design panel sets their colour, text size, and author line, scripts read and edit them as Figma's `StickyNode`, and design JSX writes and reads them as `<Sticky color="yellow" author="Ada">…</Sticky>` (#1118).
- FigJam shapes with text open from `.fig` files and paste from FigJam with their kind, colour, corners, and label, grow taller to fit their label or, once their height is set, keep it and end the label with "…", as FigJam does, save back as FigJam shapes, draw in their own outlines in SVG and PDF exports, and are written and read as `<Shape>` in design JSX. A Shape tool, shown from Customize toolbar, picks any of FigJam's 30 kinds from a searchable grid and places it as FigJam does, with its label ready to type; the Design panel switches a selected shape's kind and styles it with FigJam's palette, fill and line modes, text sizes, and typefaces, and sets its corner radius and its label's typography as Figma's Design panel does, and the Layers panel shows each kind's outline. Sticky notes take FigJam's typefaces too, and scripts create shapes with `figma.createShapeWithText()` and read or set `shapeType` and the label's `text` (#1114).
- FigJam connectors open from `.fig` files and paste from FigJam with their ends, route, caps, line style, and label, bound to the layers they join, and save back so Figma keeps them live. They route as FigJam does when the layers they join move, resize, or change, including while dragging, are deleted with those layers, and dragging a selected connector's segment, curve, or label reroutes it, which `.fig` files and the Figma clipboard keep (#616).
- A connector tool, shown from Customize toolbar, draws connectors between layers or points, attaching as in Figma Design: to the nearest side inside a layer, only within 8 px outside it, pinned at the exact point with ⌘ or Ctrl, and to the centre with Shift. Their end handles reattach them, double-click types a label, the Design panel sets their line type, end caps, and FigJam colour, weight, and dash, and scripts and agents create and edit them through `figma.createConnector()` and `create_connector`. Design JSX draws them with `<Connector from="A" to="B">`, joining layers of the same JSX by name or, where layers share a name, by a `ref()` the layer is marked with, and JSX export writes them back (#616).
- Sticky notes, shapes, and connectors keep FigJam's fixed choices: the Design panel offers only their own sections, and design lint leaves them out.
- draw.io diagrams open, in the desktop app also from the system: `.drawio` and `.dio` files and draw.io's editable PNG and SVG exports become pages of FigJam shapes with text and connectors joined to them, keeping their colours, labels, arrowheads, bend points, turns and mirroring, layers, and containers. Designs save as draw.io files: FigJam shapes, connectors, text, sections, frames, and groups as their draw.io counterparts, turned and mirrored where they are, and anything else as an image, from **File › Export selection** and the Export panel, for a selection or a page.
- Mermaid flowcharts open from `.mmd` and `.mermaid` files and paste onto the canvas as FigJam shapes, sections, and connectors laid out automatically, keeping their shapes, arrowheads, line styles, labels, and `classDef`/`style` colours; AI and MCP agents import them with `import_mermaid`.
- Text can be written in Markdown: `set_text` with `markdown: true`, `openpencil.setTextMarkdown()` in scripts, and `<Text markdown>` in design JSX turn headings, bold, italic, strikethrough, code, links, lists, and quotes into styled text, sized and set as FigJam styles typed Markdown; Mermaid labels written in Markdown keep their bold and italic.
- Arrange › Tidy Up, Pack Horizontal, and Pack Vertical work as in Figma, and the alignment row's More actions menu offers Tidy up (⌃⌥T) and the distribute commands (⌃⌥V, ⌃⌥H). An Auto Arrange submenu in the Arrange and canvas menus spreads overlapping layers apart, packs them into rows, or lays shapes out along their connectors as a flow, tree, radial map, or network. AI and MCP agents get the same as `arrange` modes: `spread` pushes overlapping layers apart and keeps each near where it was, `compact` also closes the gaps, `pack` packs screens into rows, and `flow`, `tree`, `radial`, and `network` lay shapes out along their connectors, rerouting them.
- Number and true/false variables take live formulas: references show as pills, the field shows the result, true/false formulas can compare numbers, and formulas survive undo, copy and paste, sharing and `.fig` saves. Formulas can also use text and colors, join text with `+`, and call `if()`, `text()` and `truthy()`, which Figma files save as `TERNARY`, `STRINGIFY` and `IS_TRUTHY`; text and color variables can hold formulas, and completion lists the functions. Formulas and CSS expressions are highlighted and span several lines, with Shift+Enter for a line break.
- The token stylesheet writes number formulas as `calc()` over the variables they use, and design-token files keep each formula beside its result. CSS expressions complete token names as `var()` pills, preview what the browser computes, are checked when committed, and can be added to any number mode from the value's label row. Imported Figma color and opacity expressions retain their variable references.
- A layer's visibility binds to a boolean or text variable from the Appearance panel, as in Figma: right-click the eye, or use the variable/property button on a layer inside a component. Text shows the layer unless it is empty or reads "false", "no" or "off".
- A text layer's content binds to a text or number variable from the layer header, as in Figma; a number shows as text, with two decimals for values just off a whole number such as 2.0000002, and typing over bound text detaches the variable.
- Design JSX defines variables: `defineVars` adds a collection to the file's variables table, `defineMode` adds a mode to it, and a variable used as a value makes an alias. Running the same JSX again updates them instead of adding copies, and `designVar(collection, name)` names a variable that several collections share. `mode` pins a layer's variable modes, as the Appearance panel does, and `<Icon color>` takes a variable.
- Design JSX exposes a nested instance's properties with `exposed`, and an outer instance sets that instance's variant and properties by its layer name, as in `Action={{ Label: 'Save' }}`.
- Design JSX may begin with statements, such as `const` declarations, that end with `return` and the JSX, as a component's body does.
- Design JSX `<Vector>` takes its path as SVG path data (`d`, with `fillRule`) or as Figma's `vectorPaths` (`paths`), and JSX export writes every vector's paths, so vectors and inline SVG artwork no longer render back empty.
- Design JSX draws ellipse arcs and donuts with `startAngle`, `endAngle`, and `innerRadius` on `<Ellipse>`, flips any layer with `flipX` and `flipY`, and exports both, so they survive `get_jsx`. A selected ellipse shows Figma's arc handles: drag them to cut a slice, turn the arc, change its sweep, or open a hole, with Shift rounding to 15° and tenths.
- Variable fonts draw every style they cover from one file, fonts installed locally included, at the axes Figma draws them: a style's named instance, the axes the text sets, and an optical size that follows the font size unless the text detaches it, which `.fig` files keep; `.fig` exports, copies pasted into Figma, and PDF exports keep each glyph's shape at those axes. Inter ships as its variable files, so every weight and italic draws offline.
- Set the axes of a variable font, such as its weight, width, or optical size, in the Typography section, for the whole text or the selected characters, or let the optical size follow the font size, as in Figma; a range of characters keeps its own optical size from Figma files. Plugins and the `set_font` tools read and set the axes: `fontName.variationSettings`, a `fontWeight` that follows `wght`, fonts given by axes alone taking the nearest named style, `loadFontAsync` for a whole family, and `getFontFamilyVariationAxes`. Design JSX `<Text>` and `<Span>` take `fontFeatures`, `fontVariations`, and `lang`, and `<Text>` takes `fontOpticalSizing`; JSX export keeps them instead of dropping them.
- Material Symbols icons draw from Google's variable fonts in the Outlined, Rounded, and Sharp sets, each icon at its own optical size, weight, fill, and grade. On macOS 14 and later, the desktop app's icon picker offers SF Symbols, drawn by the Mac itself at a chosen weight, scale, and monochrome or hierarchical rendering; documents keep the outlines, so they draw on every platform.
- `.pen` icons draw as pen.dev draws them: Lucide, Feather, and Phosphor from their icon sets, Material Symbols from Google's fonts at the icon's weight, and icons whose library or name is a variable in the layer's theme. `.pen` image fills draw from data URLs everywhere, and from files in the document's folder in the CLI and desktop app.
- The pen lines each new point up with the path's own points, as in Figma: within 4 pixels it snaps to their x or y and draws a red guide with a cross on every point it passes through, a point it would land on shows a cross inside its circle, and the point the next segment starts from is solid, with a blue segment to the cursor. In vector edit mode, a pen click away from the path starts a new piece of the same layer there.
- In vector edit mode, clicking a segment selects it, Shift-click adds or removes it, and dragging it moves its two points. Dragging over empty space selects the points inside the marquee and the segments between them. Delete removes the selected segments and the points they leave unconnected, so deleting the middle segment of a path splits it in two. The filled region under the pointer is hatched, as in Figma, and clicking inside it selects the region with its points, which then drag together.
- Editing text on a path works along the path, as in Figma: clicking places the caret between the characters you click, dragging, Shift-clicking and double-clicking select characters, and the caret and selection follow the curve.
- Rows in the layers panel show each vector, rectangle, ellipse, line, polygon, and star as its own outline, turned and reflected as the layer is, as in Figma. While you scroll through a top-level frame's layers, its row stays pinned at the top of the panel until the next top-level layer pushes it out.
- Copy properties and Paste properties (Alt+Cmd+C, Alt+Cmd+V, also under Copy/Paste as in the canvas menu) carry the look of one layer to others through the system clipboard, to and from Figma.
- Sections, frames, components and instances take a status from the document's own list of states, such as Draft, In review or Ready for dev, shown beside their titles on the canvas and set from there or the Design panel; a Statuses dialog edits the states and shows which layers a change affects. Figma's Ready for dev and Completed open and save as Figma's own statuses, and scripts and agents read and set any status through `openpencil.getStatus` and `openpencil.setStatus` or the `get_statuses` and `set_status` MCP tools (#1203).
- Plus darker and plus lighter blend modes for layers, fills, strokes and effects: drawn on the canvas, kept through `.fig` import and export, exported to SVG, and available in the blend mode menu, the plugin API and design JSX.
- The image fill picker sets a tile's scale and turns Fill, Fit, and Tile images by 90°, and a PNG, JPEG, or WebP file dropped on an image fill fills the layer with it. **Stock photo** searches Unsplash or Pexels and fills the layer with the photo picked, crediting its photographer and showing the service's own picks before a search; a service without a key leads to its free key in Settings, where **Test connection** checks it.
- With nothing selected, the Design panel's Document section sets how tightly a document's `.fig` is compressed: Fast, as Figma saves, Smaller, or Smallest. The choice is stored in the file, every save uses it, and Figma opens all three. Saves in the browser and of opened files on desktop now write Zstd instead of deflate, so they come out smaller at every setting.
- Home deletes storage and Cloud workspace documents from an entry's ⋯ menu or its right-click menu, after a confirmation, and stops listing storage documents deleted from another device or through the Cloud API (#1533).
- ⌃Tab and ⌃⇧Tab select the next and previous tab, wrapping through Home, as in Figma; File gains Select Next Tab and Select Previous Tab.
- Settings → General → Navigation → Zoom speed scales how far each mouse wheel step or trackpad pinch zooms the canvas, for mouse wheels that zoom too fast.
- General settings on desktop choose how many recent files to keep; the default stays at ten.
- A first visit to the `/demo` link offers the welcome and guided AI setup, as a first visit to the app does.
- The AI chat supports Agent Skills: SKILL.md folders it lists by name and description and loads when a request matches. **Settings › Skills** takes uploads as a ZIP or a SKILL.md, and in the desktop app also reads the skills folders next to the open document once you trust them, and the skills you pick from `~/.agents/skills` and `~/.claude/skills`, which AI setup offers one by one since most are coding workflows; each folder and skill can be switched on or off. Pi gets the enabled skills too.
- In the AI chat, type `@` to mention a layer, page, or skill and `/` at the start of a message to run a skill, as `/skill:name`, or an ACP agent's own command; mentions show as chips, in replies too, where the assistant names the layers it touched, and clicking one shows the layer on the canvas. The selection button mentions the selected layers.
- Messages written while the assistant works wait for it instead of being blocked: Enter sends one as soon as the current step's tool calls finish, Alt+Enter waits until all work is done, Escape stops the reply and sends what waits, and Up takes waiting messages back to edit.
- OpenPencil sends a system notification when an AI agent waits for your permission while OpenPencil is in the background or shows another document, and can also notify when a reply finishes or fails; clicking it opens that document's chat. Choose them under Settings › Notifications.
- The desktop app signs in with ChatGPT, so OpenPencil's agent can use the models of a ChatGPT plan without an API key; the model list comes from the account.
- On desktop, AI setup shows whether Claude Code, Codex, and Pi are installed and signed in, names the account Claude Code and Codex use, and signs them in from the setup screen.
- Claude Code and Codex replies can revert and restore the edits they made, the chat marks the calls you undid, and their tool cards show what each call changed, as for provider models.
- Settings → Usage counts the tokens of Claude Code, Codex, and Pi replies, shows cached input and cache writes, and lists each model's input and output tokens.
- **Vectorize** can use QuiverAI's Arrow 2 model, beside Recraft and fal.ai, with your own QuiverAI API key.
- Scripts written for Figma's dynamic-page mode can switch pages with `figma.setCurrentPageAsync()` and load a page with `page.loadAsync()`, as in Figma, instead of stopping at the first of these calls.
- Scripts can call `figma.util.rgb`, `figma.util.rgba`, `figma.util.solidPaint`, `figma.closePlugin()`, `figma.loadAllPagesAsync()`, `figma.getImageByHash()`, and `figma.createImageAsync(url)` as in Figma, and `figma.createImage` returns Figma's `Image` with `getBytesAsync()` and `getSizeAsync()`. `createImage` takes PNG, JPEG, and GIF up to 4096 pixels a side, as Figma does, and the desktop app loads `createImageAsync` URLs through its native proxy, so hosts without CORS headers work.
- MCP `list_recent_files` lists recently opened files inside the MCP root, so agents can reopen them with `open_file`.
- `openpencil convert` reports a font it cannot load and takes `--font-policy`, as `export` does.
- `@open-pencil/core/io/formats/html` exports the HTML renderer on its own, like the raster and SVG exporters, and `useCanvas` in `@open-pencil/vue` takes an `onFailed` callback for a canvas that cannot start, as when CanvasKit fails to load.

### Changed

- Home is one tab pinned first that never closes and lists places in a sidebar: Recent files, the storage bucket, and the Cloud workspaces of the server you connect each have their own page, and phones get the same places in a menu above the documents. Designs open in tabs of their own, + and ⌘N start a new design, and ⌘T shows Home.
- Recent files on Home show sharp previews of their whole cover page, centred on the page colour as in Figma's file browser, and keep them after the file is saved; designs saved without a Cover page get a preview of their first page on Home, in recent files, and in their `.fig` thumbnail, as Figma's files do.
- The canvas always renders progressively: zooming keeps rendering during the gesture and sharpens the whole viewport in one frame when it ends, instead of tile by tile, and a page first shown appears whole once its visible tiles exist.
- The layers panel lists the front-most layer first, as in Figma, and an auto layout's layers in their flow order; dropping a layer above another puts it in front of it, or before it in an auto layout.
- Lines and arrows select by their two ends, as in Figma: dragging an end turns and stretches the line, Shift holds it to 45° steps, and Alt keeps its midpoint.
- Outline stroke works as in Figma: each stroked layer is replaced by its fill and, above it, its stroke filled with the stroke's paints where the stroke is drawn, both keeping the layer's rotation, opacity, and effects; inside a selected group or frame each stroked layer is outlined in place, and stroked text becomes groups of glyph outlines (#1524).
- Selected text on a path no longer draws a filled band over its lettering: as in Figma, it shows its path, box and handles, and while its text is edited an outline around the lettering.
- Text on a path is shaped with HarfBuzz, so it keeps every kerning, ligature, and contextual form its font defines, where it used to fall back to plain advances for fonts with OpenType lookups the old parser could not apply.
- Web fonts from Google Fonts and Fontsource load as their variable files, one download per family with every axis, and Material Symbols load from Google's icon catalogue with all four axes.
- Font settings, including system font access, online font providers, fallback packs, and the downloaded font cache, moved from a popover in the Typography section to **Settings › Fonts**; the gear in Typography opens it.
- PDF exports, from the editor and `export_pdf`, embed the fonts their text uses, and keep each paragraph broken into the lines the canvas draws, instead of drawing text in a standard PDF font. Text in a variable font is embedded as a static instance at the axes it is drawn with, characters a font lacks, such as Chinese or Arabic in a Latin font, are embedded in the fallback font the canvas draws them in, and `export_pdf` reports any face that falls back to a standard PDF font.
- `.fig` files OpenPencil writes carry the `meta.json` Figma writes: the document's name, the thumbnail page's background, and the thumbnail's size and the page area it shows, instead of an OpenPencil version, app name, and creation time. The name is the `documentName` write option, else the exported file's name, else Untitled; an opened file saved unchanged under another name keeps its archive and records the new name.
- The variables list shows an alias as a pill sized to its target's name followed by the value it gives, and a value with a CSS expression keeps showing its value, marked CSS, with the expression on hover.
- JSX export, in the Code panel, `get_jsx`, and the CLI, starts with the `defineVars` and `defineMode` for the variables its layers use, so the code makes the same tokens in another file, and writes each bound value through its prop, as in `bg={theme.Surface}` and `p={density.Pad}`, instead of a literal beside a `bind` entry.
- Design JSX warns about an unknown enum value, such as `blendMode="sparkle"` or `mask="sparkle"`, and renders the rest instead of ignoring the value silently or failing.
- `arrange` spreads overlapping layers apart by default instead of placing them in a grid; pass `mode: "grid"` for the grid.
- On phones, Share sends a room link through the system share sheet (Messages, Mail, AirDrop) instead of only copying it; browsers without a share sheet still copy the link.
- The right panel opens wider by default, giving the AI chat more room; a width you set yourself is kept.
- Settings groups its pages under App, AI, and Data & privacy: snapping and the toolbar are on **Editor**, AI & agents is **Models**, and Media is **Image services**. Editors for models, media services, MCP connections, and storage show where they sit in the window title, such as **Settings › Models › Edit model**, where the earlier steps go back, slide in from their lists, and return focus to the row that opened them. A setting changed from its default shows a **Reset to default** button beside it.
- **Add model** starts by choosing what the model runs on: a coding agent, a subscription, an API account, a local or company server, or OpenPencil Cloud; the ones a saved model already uses are marked **Set up**. The model editor shows a model's capabilities, output limit, and thinking level directly instead of under **Advanced settings**.
- Settings → Models shows whether Codex, Claude Code, and Pi are connected, signed out, not installed, or unable to reach OpenPencil's tools, and an agent's settings can sign in and check the connection again. Coding agent chats send your message only once the agent has connected to OpenPencil's tools, and otherwise say why it could not.
- Tool access sets the built-in AI's tools, and the local MCP server's tools are set from the MCP page, which shows the server's status and address apart from its access settings. Tool access and Skills list their items in a compact table you can search and filter to what is on or off.
- **File → Diagnostics…** and the command palette open the Diagnostics settings, a file that fails to open offers **View diagnostics**, and the **Usage history** switch is on the **Usage** page.
- Recommended models now include Claude Haiku 5.5, used for fast work with an Anthropic key, Gemini 4 Argon, GLM-5.3-FlashX, and the free MiniMax-M3.1-Flash route on OpenRouter, which replaces the removed Qwen3.8 27B route. MiniMax recommends MiniMax-M3.1-Flash by default, with MiniMax-M3 as the other recommended model, and Flash runs at low effort when thinking is set to Off or Minimal. DeepSeek recommends DeepSeek Flash, and Z.ai lists its current models; earlier models remain available from the full model list.
- Pi replies show a run of thoughts as one, start new text after a tool call, and close their text when stopped.
- `@open-pencil/core` declares `ai` as an optional peer dependency: `toolsToAI` uses the `ai` you install instead of bundling a copy of its types.
- `fontManager.markLoaded` returns a promise that resolves once the font's glyph outlines can be read; Core's glyph readers answer as for an unloaded font until then.

### Fixed

- Opening a `.fig` file keeps image crops, rotated lines where Figma draws them, icons shown through a nested component property, content-sized layers at their anchor, rotated Hug panels inside their instances, and the colour of a swapped badge.
- Pages of a `.fig` file opened after the first keep their instance swaps, theme colours, and exact positions instead of resetting some of them to their component's, and large pages, such as those of big design kits, load once in the background instead of timing out and loading again while the editor waits.
- `.fig` files open when a layer's visibility is bound to a boolean or text variable, and the binding keeps working through page loading, variable edits, instance-specific variable modes, and saving.
- `.fig` files whose variables use expressions OpenPencil cannot evaluate yet, such as `VAR_MODE_LOOKUP`, open with the values saved in the file and keep those expressions when saved, instead of failing to open.
- Opening a `.fig` whose component contains another component with an instance inside no longer fails with a missing component error, and a component that encloses another keeps all its layers when a page using the inner component loads first.
- Documents opened from `.fig` files save and load pages again after a layer of a component is deleted, including when an instance nested in a component frame is replaced (#1425, #1427).
- Saving a `.fig` after moving a component that has an instance in slot content no longer writes the component twice, so the file opens again, and documents with vector masks, including ones imported from SVG clip paths, save as `.fig` files.
- Layer edits made by scrubbing a number field or dragging a handle in an opened `.fig` file are saved with the file instead of being dropped, and so are layers grouped or moved into a frame and the positions and hug sizes auto layout changes after an edit such as changing a gap or adding a layer.
- A change to the libraries a `.fig` document enables, such as updating one, is kept when the document is saved again.
- A rescaled instance of a component with a vector shape draws that shape at the instance size after the file is reopened, instead of at the component's size.
- A copy of a component that holds an instance keeps what it sets on that instance after the file is saved and reopened: edits to its slot content, such as a hidden or recoloured layer, and its text, boolean, and swap property values, such as an exposed button's label.
- An instance that clears a fill, stroke, effect, layout grid, or text style an intermediate component applied shows the values of the component it comes from again, instead of the intermediate component's, and a cleared text style stays cleared after the file is saved and opened again.
- A plain colour set over a variable-bound paint in an instance stays after the `.fig` file is reopened.
- Layers keep their text, fill, and stroke styles when their variable bindings resolve, on `.fig` open and save and when a variable or mode changes.
- Variable modes from a `.fig` file open in Figma's order with Figma's default mode, and keep that order through export.
- `.fig` import binds layers to component properties only through their parameter map, as Figma does, so legacy property references no longer hide or retext layers Figma draws.
- Instances renamed in OpenPencil keep their names when the file is opened in Figma, instead of showing their component's name.
- Saving a `.fig` gives a variable whose ID Figma cannot read a new one, instead of keeping an ID Figma drops the variable for.
- Layers flipped vertically keep the flip when saved as `.fig` or copied to Figma.
- Vectors whose regions have their own colors keep them, and the paint styles they come from, when pasted from Figma or saved to `.fig`, through edits that add or remove regions, and in Figma's vector edit mode after a `.fig` export.
- Vectors saved to `.fig` give every point a stroke join, so Figma can edit their points from plugins.
- Text whose first line has a line height of its own keeps the text's line height when a `.fig` file is reopened, instead of taking the first line's.
- Text in a font whose file was replaced, such as a web font fetched again for more characters, or whose glyphs were drawn from another file of the same family, such as a static face beside the variable font, saves to `.fig` files with its own letters and weight instead of reopening with other letters.
- Text keeps each font face's own style name ("Semi Bold", "Book", "Italic"), so text saved to `.fig` files or copied to Figma no longer opens there as a missing font in a plain italic or in a family whose names differ from Inter's. The plugin API's `fontName`, the style picker, and the missing fonts banner show the same names, and the banner lists faces of one weight (Avenir Book and Roman) separately.
- Text in a face that its weight alone cannot pick, such as Avenir Book, Roboto Condensed Bold, or Fira Code Retina, loads and draws in that face rather than the family's face of the same weight, keeps the weight Figma saved for it, and the style menu lists each face of a family by its name. On desktop, installed fonts are listed and loaded by the names their font files give each face.
- Text set in a style its font lacks, such as italic in a font without an italic face, draws in the face the font has, as Figma draws it, instead of a slanted or emboldened imitation that copies, saved files, and exported code did not keep; the font status lists the style as missing.
- Text in FigJam's Cute typeface, Figma Hand, which is licensed for Figma only, draws in the open Caveat font sized to Figma Hand's widths and line height instead of falling back to Inter; files keep Figma Hand, and the font notice names the substitution.
- The missing fonts banner updates as fonts finish loading after a paste or a script, instead of only after Retry fonts.
- Emoji in text from Figma draw as emoji instead of squares in the text's colour, and keep drawing in Figma after a save; the browser and desktop app use the system's emoji font, and the CLI uses Noto Color Emoji. Text typed in OpenPencil with an emoji draws its emoji and its letters in Figma after a copy or save, instead of showing blank.
- The text caret, arrow keys, Backspace, and Delete treat an emoji as one character, emoji in edited or typed text take the same width as in Figma and draw as emoji instead of missing-glyph boxes, and typed keycaps such as 1️⃣ draw as their character in a keycap frame instead of hiding their text.
- Text with a character no font has draws with a missing-glyph box for that character instead of disappearing, and draws in Figma after a copy or save.
- Japanese, Chinese, and Korean text in web fonts draws in the browser app, in a CJK family and as a fallback for other fonts, instead of drawing missing-glyph boxes or nothing. Text in Traditional Chinese loads the Traditional Chinese fallback font it draws in, and Hangul jamo, half-width katakana and Arabic Extended-B letters get their fallback fonts.
- CJK text in the desktop app and with local fonts in the browser no longer runs CanvasKit out of memory after repeated edits, saves, and exports: system fallback fonts are read once and registered once, instead of on every preparation.
- Gradient-filled text from Figma spreads its gradient across the layer as Figma does, instead of showing little more than its first colour.
- The text caret takes the colour of the character before it when that character has one solid fill, as in Figma, so it shows on light text over dark backgrounds; with a gradient, several fills, or none it stays black.
- Percent line heights and letter spacing stay a percent of the font size, as in Figma, from scripts, `.fig` files, CSS, design JSX, and `.pen` files, and the typography panel shows and edits them in their own unit; typing `%` or `px` after a value switches its unit.
- Font size, weight, colour and other text styles set from the design panel apply to every character of a text whose characters were styled in ranges, and the panel shows the style the text is drawn in.
- Auto-width text in an auto layout frame narrower than the text keeps each line whole, as in Figma, instead of wrapping inside the frame.
- A fixed-size text grown past its box draws its other lines below it, as in Figma, instead of being cut off at the box, and truncation to a fixed height counts actual laid-out line heights, including mixed-size text.
- Text flattened or used in a boolean operation wraps where it is drawn and keeps its weight in variable fonts, instead of breaking lines by the default face or turning bold text regular.
- Editing aligned text on a path lays it out from the path's text start point, as in Figma: left-aligned text starts there, centered text is centered on it and right-aligned text ends there. Text too long for its part of the path keeps the characters that fit instead of piling up at the path's ends. Opening a `.fig` keeps which segment that start point is on.
- Resizing text on a path lays it out again along the resized path at the same font size, as in Figma, instead of moving the old letters, which scattered and rotated them around corners. Text on a path pasted from Figma also keeps its path under the lettering after saving and reopening the `.fig`.
- Editing text that keeps Figma's saved glyphs draws it from the live layout while it is edited, so the caret and selection land where you click even when the loaded font is a different build than the file's; the saved glyphs return when the edit ends (#1664).
- Clicks select as in Figma: a single click inside a selected frame or group keeps it selected, each double-click or each click of a quick run goes one level down through frames and groups, a nested text is selected first and edited by the next double-click, and a top-level frame or section stays open while selected. A group's empty area no longer takes clicks, so a layer under it is selected through the gaps between its layers. After reaching a nested layer, a click on a layer elsewhere selects what a click from nothing would, and a click on the page or a section's empty area deselects (#1664).
- Entering an edit by double-click selects all of the text, and clicking another text while editing puts the caret where you clicked, as in Figma (#1664).
- Continuing a vector's path with the pen grows that same layer, which keeps its name, position, parent and style. Undo returns it to its earlier path, where before the original was deleted and a new layer was made.
- Removing a point where three or more segments meet no longer leaves the shape filled as an open path.
- Flatten keeps each layer's fill on its own part of the vector and gives it the topmost layer's stroke, as Figma does, instead of filling everything with the first layer's fill and turning strokes into shape.
- Groups span only their visible layers and refit when a layer inside is hidden or shown, as in Figma.
- Resizing a layer on the canvas keeps its stroke weight, as in Figma; imported text on a path that kept only its glyphs still scales as a whole.
- A Shift or ratio-locked resize and scaling a sticky note now snap the dragged edge to other layers and to the pixel grid, or a board's 16-unit grid, as Figma does.
- Splitting a corner radius bound to a variable, in the panel, on the canvas or from a script, keeps every corner bound to it.
- The Stroke section offers per-side weights only on rectangles, frames, components, component sets, and instances, as Figma does.
- Double-clicking a layer's expand arrow, lock, or visibility button in the layers panel no longer starts renaming the layer.
- Undoing a dragged font size, line height, or letter spacing back to where a document was saved, or every edit an AI agent or MCP client made, marks the document saved again instead of keeping it marked as edited, and the undo shortcut undoes a panel edit made while text is edited, such as a typed font size.
- Keyboard shortcuts follow the letters printed on QWERTZ, AZERTY, and other Latin layouts, so Cmd/Ctrl+Z undoes on a German keyboard, and keep their key positions on Cyrillic and other non-Latin layouts.
- Strokes with sides of their own weights are drawn as one ring, as in Figma: corners are filled and rounded by their sides, dashes are spaced side by side, and translucent strokes no longer darken where the sides meet.
- Dashed strokes are laid out as in Figma: each straight side and each rounded corner of a rectangle, frame, section, or component set holds whole dashes with half a dash at each end, sharp corners are filled, ends are capped only where dashes stop, and inside and outside strokes cap at their full weight, with round or square ends, round or bevel joins, and smoothed corners alike. A dashed ellipse, polygon, or vector no longer leaves its dash on the section or boolean drawn after it.
- A line draws its stroke above it as Figma does, instead of centred on it, keeps round and square caps and arrow heads within its length, spaces its dashes as Figma does, and draws with inside and outside alignment instead of disappearing. Line arrow and triangle arrow heads draw at Figma's size and shape, and Figma's filled triangle, diamond, and circle line caps draw instead of showing no head.
- An inside or outside stroke on a star, polygon, arc, or vector follows its outline, as in Figma, instead of showing on both sides of a star or polygon, across an arc's flat edge, or centred on a vector drawn from its path, and a vector's saved outside stroke no longer covers its fill.
- Strokes blend with what is under them by their paint's blend mode.
- A gradient stroke on a straight line, or a gradient on any layer with no width or height, draws along it instead of stopping the canvas, as in 0.15.
- An image stroke draws once its image is ready, instead of drawing black while it loads.
- Boolean operations draw as in Figma: operands with a hidden fill add only their strokes, strokes keep their alignment, colour binding, gradient or image, cap, join, and dash, reflected operands keep their orientation, vector operands take their saved fill shape, and the operation's corner radius rounds its outline.
- Drop and inner shadows are cast from everything a layer draws, as in Figma: its strokes, every child of a frame or group, and boolean operations, cut out under translucent fills and strokes unless shown behind the node, with a shape's inner shadow under its strokes.
- A shape whose fills are all at 0% opacity casts no drop shadow and takes no inner shadow, as in Figma, and a frame with a 0% fill shadows its children instead of its own bounds; shadows on stars, polygons, and vectors ignore their spread.
- A boolean's background blur stays inside its shape, and an inner shadow over a curved edge no longer lets the fill show through it, as in Figma.
- Layers with opacity below 100% or a blend mode draw whole when rotated or inside a rotated frame, instead of being cut off.
- Ellipse arcs without stored outlines, such as ones set from design JSX or the plugin API, draw their cut edges back to the centre or across the ring instead of as a straight chord.
- Tiled images from Figma draw at their own size and tile scale, and Fill, Fit, and Tile images keep their rotation; switching to Crop starts from the Fill framing, as in Figma. An image fill's swatch in the properties panel shows its image instead of black.
- Flashes and AI highlights outline a layer inside a rotated or flipped frame where it is drawn.
- Shader covers on openpencil.dev and in the `/demo` tour show their first frame instead of a blank square, the editor keeps a shader's saved frame instead of replacing it with a blank one in a browser whose WebGPU cannot draw, and the code panel runs `shader()` paints, which failed there with "Unknown Design JSX helper".
- SVG import keeps content hidden by `visibility` or `display` as hidden layers, as Figma does, instead of painting it, and icons, inline SVG in design JSX, and image vectorization leave it out (#1166). An SVG rounded rectangle imports with its outline closed on its first point, and scaled SVG artwork preserves nearly closed arcs when coordinate rounding makes their endpoints coincide.
- HTML and draw.io import read a quoted `font-family`, such as `'Noto Sans KR'` or `"Foo, Bar"`, as the font family instead of keeping the quotes in its name or cutting it at a comma.
- SVG export sets text on the lines and baselines the canvas draws, wrapped paragraphs and each explicit line included, keeps text outside styled character ranges, no longer adds a space where a text changes style, and draws a whole donut's outer edge and hole (#1520, #1521).
- SVG and PDF exports write text in the case it is set to show (upper, lower, or title case), keep inside and outside strokes on their side of the outline, and keep arrow heads and rounded corners on arrows (#1520, #1521).
- SVG export keeps solid fill and stroke opacity in sRGB, including the alpha of a `.pen` paint and of a text fill, a tinted solid fill keeps its opacity in a Display P3 SVG, written beside `currentColor`, and a layer keeps its stroke when its topmost fill, such as noise, has no SVG paint.
- Exporting a layer that blends or blurs its background leaves out the layers around and above it, as in Figma.
- WEBP and JPEG export work on macOS desktop and in Safari.
- Strokes, gradients, blend modes, blurs, and disabled effects of current `.pen` files draw as in pen.dev, and a `.pen` file whose strokes are lists of paints opens instead of failing (#1324).
- Turned, mirrored, and grouped layers of `.pen` files land where pen.dev draws them, polygons keep their sides, ellipses their arcs and rings, and paths their view box and even-odd fill; paths and icons that fill or fit their container draw at their laid-out size instead of at 100 px.
- `.pen` text keeps its font weight, italic, fixed-size wrapping, and justified or middle alignment, and `.pen` auto layout keeps space-between, space-around, and absolutely positioned layers.
- `.pen` variables resolve in every theme a layer and its parents set, across several theme axes, with aliases and boolean visibility.
- `.pen` instances keep their component's layout and paints when they override only some of them, their overrides reach layers inside nested instances or replace layers, and the fields their `ref` sets and their property overrides, such as a changed label or a hidden layer, survive a sync and saving as `.fig`.
- `.pen` documents save as `.fig` when instance overrides replace layers, a nested instance replaced by another component being swapped, as in Figma, and an instance whose layers an override replaces otherwise opening detached. `.pen` icons inside components open as instances of icon components on an "Icons" page, so instances that change an icon's glyph, colour, or size save too, and a swapped icon keeps its layer name.
- Scripts edit variant properties as Figma's Plugin API does: renaming or adding a variant property on a component set renames every variant and instances follow, renaming a variant updates the set's values, deleting a variant property fails as in Figma, and `variantProperties` reads a variant's or an instance's values. An instance's `componentProperties` reports its own variant for VARIANT properties.
- Inserting and deleting characters through the plugin API, `openpencil eval` or MCP keeps each colour and other character style on the letters it was applied to, and `insertCharacters` takes Figma's `useStyle` to copy the style of the character before or after. Setting `characters` resets range styles to the first character's, as in Figma. A position outside the text is refused instead of corrupting the styles.
- Paints scripts set in Figma's shape draw as in Figma: image paints with `scaleMode`, `rotation`, or `scalingFactor` take effect, invalid paints throw Figma's validation messages, and solid paints read back with an RGB `color` and the alpha in `opacity`.
- Scripts can set a polygon or star's `pointCount`, a star's `innerRadius`, and an ellipse's `arcData`, which did nothing before, and saving a document whose gradients a script set no longer fails. Setting a stroke's weight or alignment through the plugin API keeps the layer's stroke style.
- A script resizing a layer inside an instance leaves it as it is, as in Figma, instead of recording a size Figma drops, `resize()` keeps every side at least 0.0001, except a line's height of 0, and resizing an imported SVG vector scales its geometry to the requested dimensions.
- Text changed by AI agents, MCP tools, or scripts to a font that had not loaded yet takes its real size, including text outside auto layout, so exported images match the sizes the agent reads back, and `openpencil eval` and tool calls measure the text a script edits in the fonts the document uses.
- Node reads and `get_components` include component property definitions, and Design JSX export writes components, component sets, and instances with their `property()` bindings, property values, and layer overrides, so they render back as linked components; an instance whose changes JSX cannot write still exports as the frame it draws.
- Instance `overrides` find layers among the instance's children by the names they had before any rename, accept layer names with a colon, ignore tree fields, and reject a name several layers share instead of changing the first.
- Design JSX rejects an instance variant value the set does not have and an instance that would put a component inside itself instead of drawing the first variant or a plain frame, warns about skipped `overrides` keys, and leaves no property definitions behind when a render fails.
- Design JSX takes a gradient's `transform`, and a paint's `gradientTransform` and `imageTransform`, as Figma's rows such as `[[0, 1, 0], [-1, 0, 1]]` as well as the matrix fields, refuses any other shape instead of drawing nothing, and exports them as rows.
- Design JSX export of several layers is one JSX expression, wrapped in a fragment, so code editors and other JSX tools read it; labels styled in ranges export with `<Span>` and `<Paragraph>` and read back the same.
- Library components keep their instances' overrides and instance-swap defaults when inserted into a document, and libraries published to a CLI catalog keep overrides and vector shapes. `openpencil libraries publish` gives a component without an asset key a valid one made from its name instead of failing, and keeps those keys in the `.fig` source with `--write`.
- The color contrast lint rule measures text against what is painted under it: every visible solid fill of the text, its ancestors, and layers beside it such as a background shape, composited in paint order. It skips fully transparent text, text with no opaque background, text such a layer covers only in part, and text where a gradient or image shows in its fills or its background.
- The touch-target-size lint rule checks the controls in a row named in the plural, such as `Footer links`, instead of reporting the row as one target.
- In a shared room, comments, replies, review statuses, and file settings that several people change at once all keep their changes instead of one replacing the others, and enabled libraries and the document's color space now reach everyone in the room.
- AI chat and ACP agents are told to draw on the canvas rather than write HTML or run terminal commands, to name the document they mean when several are open, and to revert their own changes with undo.
- Claude Code, Codex, and Gemini CLI chats end when the agent finishes its turn, instead of staying busy until the agent exits; their OpenPencil tool calls show under the tools' names with their results instead of as failed, a run of thoughts shows as one, and an MCP server that fails to start shows its error instead of spinning.
- Coding agent chats start the agent in a folder of OpenPencil's own instead of your home folder, so it no longer reads project settings kept there or may write across it.
- Off and Minimal thinking no longer fail on OpenRouter models that always reason, which now use the lowest effort OpenRouter lists, or on GLM-5.3, GLM-5.3-Flash, or Gemini 3.1 Pro, and no longer run GPT-6.1 Sol and GPT-6 Astra at their default effort: these models use low, the lowest each accepts.
- Claude models used through OpenRouter mark the chat's prompt for caching, also with a thinking level set, so repeated turns can be billed at the cached-input rate when the provider has the prompt cached.
- Images from tools reach MiniMax and OpenAI-compatible Chat Completions models as images instead of Base64 text, and a resized WebP image attached in the chat on macOS desktop or in Safari is sent with its actual PNG type.
- The image drop overlay in AI chat no longer stays on screen after a drag from apps such as Yoink.
- The Harness companion loads Pi's MCP adapter on Node.js 26 instead of failing on its TypeScript sources.
- The MCP HTTP server no longer runs out of sessions after failed initializations, session-less GET requests, or cancelled tool calls, and closes sessions idle for 15 minutes (`OPENPENCIL_MCP_SESSION_IDLE_TIMEOUT_MS`).
- The desktop app waits up to 20 seconds for a slow-starting MCP server instead of giving up after five, and stopping the server from the app, or quitting the app, now ends the server process too, so a leftover server no longer keeps answering after the app lets go of it (#1167).
- MCP tools whose `path` is their own data, such as `create_vector` and `path_set`, no longer fail on long paths or create folders, and `export_pdf` writes the file its `path` names. `open_file`, `save_file`, and `new_document` work with paths in the browser app: files are read from and copies saved to the MCP root through the server.
- `export_image` says why it returned no image: an ID that is not in the document, layers that are all hidden, a render that came back empty, or, in the desktop app, a document whose canvas has no renderer, instead of always answering "No visible nodes to export".
- `@open-pencil/dom-css`, `@open-pencil/design-jsx`, `@open-pencil/emit`, and `@open-pencil/cli` load under Bun 1.3 again, and so does `@open-pencil/core/io`, which imports Design JSX; their internal imports named files without an extension, which Bun 1.3 does not add (#1397).
- The CLI saves a `.fig` with a rendered thumbnail, as `openpencil export` does, instead of a blank 1×1 placeholder: `convert`, `import`, `lint --fix`, and `eval`, `tool call`, and `diff apply` with `--write` or `--output`. These commands replace the file only once it is fully written, so a failed save keeps the previous file.
- `open-pencil export -f pdf` exports PDFs instead of failing with "DOMParser is not defined", and exporting a PNG from the command line on Windows no longer fails to find the CanvasKit binary.
- `open-pencil export --node` checks the fonts of a text layer exported on its own: `--font-policy strict` and `warn` used to find no fonts to check and let a substituted face through.
- `openpencil convert` measures the text of a `.pen` or draw.io file in its own fonts, so converted tags, buttons and labels keep their width.
- Text a CLI script writes in characters its font had not loaded yet, such as Japanese, is saved with its glyphs and at its size, instead of with missing-glyph boxes in a box of the wrong size.
- A document still opening when you switch to another tab, or opened on a slow connection, no longer fails with "The operation was timed out"; it finishes opening and is drawn when you return to its tab or once the canvas loads.
- Safari keeps each tab on its own document; after a few tab switches, every tab showed the canvas and layers of the tab before it.
- In Safari, the canvas cursor keeps changing after a drag, so resize and rotate cursors show over handles again.
- A document that fails to open from Home leaves Home in place instead of an empty tab.
- A document opened from a link in the browser saves with Cmd+S by download and is covered by crash recovery, which it could not before, and keeps its name when the name has spaces or non-Latin letters instead of showing it percent-encoded.
- Saving a file in a browser that shows the save picker but will not write to the chosen file now downloads it under that name instead of failing.
- Storage downloads that take longer than 20 seconds finish instead of failing; only a transfer that stops for 20 seconds fails. The storage list keeps showing previews and errors while it refreshes instead of flashing blank.
- Documents opened from disk in the Windows desktop app are named by their file, not by their whole path.
- On Linux, the desktop app caches recent file previews and downloaded fonts instead of loading them anew each time.
- On the desktop, links in chat replies and collaboration rooms open in the browser, and links such as **Get API key** no longer show a "shell.open not allowed" error.
- View → Variables… opens the variables dialog in the desktop app.
- Home in a narrow desktop window keeps mouse-sized controls and focuses its search; only touch screens get the larger touch controls.
- The startup splash uses the app's theme, so it no longer changes colour as the app starts on a light system, and stops animating when the system asks for reduced motion.
- Dialogs keep their content still while they open and close, instead of redrawing a cleared name, the other choice's labels, or emptied fields as they fade out, and open on their loaded content rather than filling in after.
- Choosing from a menu that showed a placeholder, such as Move to in a dialog, no longer leaves the dialog hidden from screen readers.
- In Settings, the model and provider fields, such as a model's name and API keys, use the same fill as the selects beside them, every switch row and description uses the same text sizes, and selects in Settings and in the share, workspace members, and statuses dialogs are as tall as the fields and buttons beside them.
- Leaving a model you haven't changed no longer asks to discard changes.
- The variable picker no longer shows an empty divider at its bottom when nothing is bound, and switching tokens in the variables dialog no longer animates the inspector.
- Dates in the recovery dialog, font settings and the diagnostics log follow the language the app is set to, not the browser's.

### Performance

- Progressive rendering settles a changed canvas in tens of milliseconds instead of over a second, keeps exact tiles on screen while panning, scales downsampled copies of what was rendered into place while zooming out and keeps the page covered at any window size, stays on for documents that draw image previews, sharpening them for the zoom, and redraws only the text a newly loaded font affects.
- Adding, removing, or moving a layer on a large page no longer re-renders the whole page: only the tiles it touched render again.
- Large pages record faster: a layer costs fewer renderer calls, a chunk clips to its frames with one call, and a boolean operation keeps its result between draws.
- Pages with thousands of text layers draw and record faster: shaped text stays prepared across frames, a text's fonts are checked once per frame, emoji share the text's paragraph, and saved text with styled runs makes one paint per style run instead of one per glyph, with a dotted underline drawn in one call.
- Laying out a document with many repeated text layers measures each distinct text once, instead of shaping it again for every copy.
- Typing into a page of tens of thousands of layers no longer stalls at every keystroke: the font status follows the edited layer instead of walking the page, and the page's coarse copies rebuild once the edit pauses.
- Selection chrome, rulers, labels, and issue markers draw with fewer calls per frame: outlines, dashes, colours, and label widths are kept between frames and the rulers' ticks draw as one batch. Design issue markers are staged once per document change and only placed per frame, so panning or zooming a page with a thousand marked layers costs about 1.5 ms per overlay frame instead of 11 ms.
- Shadows of a frame or group render about four times faster when its only content is one rotated or flipped layer, or when it has no fill and its layers stand apart, as in rows of cards or buttons.
- Resizing and selecting text on a path no longer stutters: laying the text along its path is about 50 times faster.
- Large documents keep a bounded amount of vector path memory, and drawing vectors no longer leaks memory on every edit or frame.
- Opening a `.fig` reads its record index up to 1.7× faster, with the Kiwi schema compiled once into tables, and its data decompresses with the same Zstd that saves it, about 3× faster than before in browsers and the desktop app.
- Pages of a `.fig` file opened after the first load faster, about a quarter faster on a large design kit page, and layers inside instances share the layout settings Figma saved with their component's layers, so such a page takes less memory.
- A `.fig` document read without the background worker, as the CLI and the MCP server read it, frees the file's decoded records once every page is loaded and the document is saved, instead of keeping them while it stays open; on a large design kit that was hundreds of megabytes.
- Switching pages is faster on large documents: the design check copies only the layers it checks and runs once per page switch, after the page is shown, the hidden Lint panel builds no rows and the visible one only the rows it shows, and a revisited page that nothing changed keeps its layout, layers list, font status, and Lint results.
- The editor downloads and compiles CanvasKit once when it opens instead of twice, and starts loading it as the app starts, so a document opened on a slow connection shows sooner.
- Images from tools such as `export_image` go to Anthropic, OpenAI, Google Gemini, and DeepSeek models as WebP, about a third the size of PNG for renders with imagery; other connections still get PNG.

## 0.16.0 — 2026-10-14

OpenPencil 0.16 adds comments, shared rooms with voice calls and agents you can follow, slots, component properties, and components that behave like real controls in Preview, plus shader fills, a Lint tab, variable modes on layers, a pencil tool, and Vue and React code in the Code tab. `.fig` files open and save much closer to Figma, saving only what an edit changed, and selection, pasting, auto layout, text, and trackpad navigation follow Figma. The desktop app needs macOS 13 or later, and `openpencil-mcp` must be updated together with the app.

### Breaking changes

- The desktop app requires macOS 13 or later; the web app supports Chrome 111, Edge 111, Firefox 128, and Safari 16.4 or later.
- Shared rooms record the layer tree in a new format, so people on this version and on earlier versions can no longer join each other's rooms. A room this browser saved with an earlier version converts when you open it again.
- Update `openpencil-mcp` together with the app: the app renders `render` JSX itself and no longer accepts the pre-rendered tree earlier versions send. AI and MCP tools reject arguments they do not declare: `defineTool` from `@open-pencil/core/tools` takes a `v.strictObject` input. `close_file` fails on unsaved changes unless `unsaved` is `"save"` or `"discard"`, and `diff_create` and `diff_show` patches list JSX attributes such as `-rounded={8}`, with `diff_show` taking `attributes` instead of a JSON `props` object, so patches in the old format no longer apply. `openpencil documents` is now a command group: list open documents with `openpencil documents list`.
- `design_to_tokens` writes CSS custom properties named from each variable's code syntax or Tailwind namespace: its `tailwind` format is a Tailwind v4 `@theme`, the `json` format is removed, aliases stay `var()` references, and non-default modes go under their condition (`[data-theme="dark"]` by default).
- A paint's `gradientTransform` follows Figma's convention everywhere, so gradients made in OpenPencil before this release draw differently. Build gradients with `linearGradientTransform` and `ellipticalGradientTransform` from the new `@open-pencil/scene-graph/gradient`, where `isGradientFill` and `GradientFillType` moved from `@open-pencil/core/geometry`; `linearGradientEndpoints` is removed.
- `.fig` files store colour-variable bindings in Figma's `colorVar`. A paint bound through the old `colorVariableBinding` field, which only OpenPencil wrote, reopens unbound. `VariableBinding`, `colorVariableBinding`, `encodeNodeChangeWithVariables`, `encodePaintWithVariableBinding`, and `encodeVarint` are removed from `@open-pencil/core` and `@open-pencil/core/kiwi`.
- `computeImageHash` from `@open-pencil/core` and `@open-pencil/scene-graph` returns the hex SHA-1 of the bytes, the name Figma gives an image, instead of an OpenPencil-only hash of the same length. New images are stored under that name, so `.fig` files and the Figma clipboard carry it as it is; images in documents saved before keep their names.
- In scripts, a text node's `fontSize`, `fontName`, `fontWeight`, `fills`, `letterSpacing`, `lineHeight`, `textDecoration`, `textCase`, `textStyleId`, and `fillStyleId` read `figma.mixed` while its characters differ, as in Figma, and setting one restyles every character. `fills` is typed `readonly Fill[] | symbol`, so scripts that index it narrow it first.
- Design JSX moved from `@open-pencil/core` to the new `@open-pencil/design-jsx` package. Import elements, helpers, variables, `JSX_REFERENCE`, `buildComponent`, `sceneNodeToJSX`, and `selectionToJSX` from there; `@open-pencil/core` and `@open-pencil/core/design-jsx` keep only `renderJSX` and `renderTree`, `renderTreeNode` is removed in favor of `renderTree`, and the `@open-pencil/core/io/formats/jsx` subpath is gone.
- JSX export writes only OpenPencil JSX: `JSXFormat` and `JSXExportOptions` are removed, and Tailwind JSX comes from `sceneNodesToTailwindJSX(graph, nodeIds)` in `@open-pencil/dom-css` or `@open-pencil/dom-css/export`. `@open-pencil/dom-css` no longer requires `@open-pencil/core`, and `exportHTMLBundle` takes a font resolver in `fonts` instead of `'assets'`; build one on `exportWebFontFaceAssets` from `@open-pencil/core/text/web-font/assets` to keep font files in standalone exports.
- Shared primitives moved to `@open-pencil/scene-graph`: color conversion and management to `/color`, text and layout direction to `/text-direction`, `randomHex`, `randomInt`, and `randomIndex` to `/random`, `fractionalPosition` to `/order-keys`, and `@open-pencil/scene-graph/layout-guides` is now `/layout`. `@open-pencil/core/bytes` is removed in favor of `js-base64`; the `@open-pencil/core` root exports are unchanged.
- `SceneNode` has new required keys `textParagraphs`, `listSpacing`, `paragraphSpacing`, `paragraphIndent`, `hangingList`, `targetAspectRatio`, `isExposedInstance`, `strokeWeight`, `strokeAlign`, and `booleanOperation` (which may be `undefined`), so code that builds `SceneNode` objects itself must include them. `Stroke` extends `Fill`, so every stroke states a paint `type`, usually `'SOLID'`.
- `SceneNode.primaryAxisSizing` and `counterAxisSizing` are `AxisSizingMode` (`'FIXED' | 'HUG'`): fill is stored on the child, as `layoutGrow` and `layoutAlignSelf: 'STRETCH'`, as Figma stores it. Read and change per-axis sizing with `layoutSizing`, `layoutSizingOptions`, and `layoutSizingUpdates` from `@open-pencil/scene-graph`.
- `.fig` reading moved to one reader. `importNodeChanges` and `importClipboardNodes` are replaced by `parseFigFile` and `parseFigmaClipboard`, `populateLazyFigImportRoots` and `populateAllLazyFigImportRoots` by `populateFigPage` and `populateAllFigPages` from `@open-pencil/core/io/formats/fig`, and `populateAndApplyOverrides` by `interpretInstance` with `materializeInstance`; `assertFigPackageReady()` is gone and `FIG_PACKAGE_STATUS` reads `document-reader`. `.fig` export takes text shaping from a runtime: `buildDerivedTextDataV4` is removed, `sceneNodeToKiwi` needs the `runtime` that `withFigExportRuntime(graph, canvasKit, write)` passes to its callback, and `FigNodeChangeExportRuntime` takes `shapeText(node)` instead of `getGlyphOutlineMetrics`.
- OpenPencil's plugin-data keys are defined once in `OPEN_PENCIL_PLUGIN_DATA` from `@open-pencil/scene-graph` and read or replaced with `readPluginData` and `withPluginData`. `@open-pencil/fig/node-change` drops `OPEN_PENCIL_PLUGIN_ID` (now in `@open-pencil/scene-graph`), the `*_PLUGIN_KEY` constants, `upsertPluginData`, `removePluginData`, and `getOpenPencilPluginValue` in favor of `readNodeChangePluginData`; `SourceLibraryPublication` moved to `@open-pencil/scene-graph` and `SOURCE_LIBRARY_PUBLICATION_PLUGIN_KEY` is gone.
- Every process mints layer, variable, and collection IDs in a random session, so `generateId()` no longer starts at `0:1` in the CLI, MCP, or scripts. Code that needs fixed IDs calls `setIdSession`, which now returns the previous session, or passes the `SceneGraph` its own generator (#770).
- Editor state gains required `canvasVersion`, which the canvas redraws on (call `requestRender()` instead of bumping `sceneVersion`), `shapeHandleHover`, and `selectionTheme`, which replaces `RulerTheme.label`. `remoteCursors` is now `presenceCursors` (`PresenceCursor[]`, each with a `kind` of `'person'` or `'agent'`), and the `Tool` type, `EDITOR_TOOLS`, and `TOOL_SHORTCUTS` include `'COMMENT'` on <kbd>C</kbd>.
- Canvas and constants APIs changed: `SceneGraph.hitTestFrame` is now `hitTestDropTarget`, `adoptNodesIntoSection` is now `adoptCoveredLayers`, and `SkiaRenderer.hitTestFrameTitle` no longer takes selected IDs. `SkiaRenderer.buildParagraph` returns a `TextLayout` that draws with `draw(canvas, x, y)`. `AUTO_LAYOUT_BREAK_THRESHOLD`, `CORNER_ROTATE_ZONE`, `getDefaultCanvasBgColor`, and `CANVAS_BG_COLOR_DARK` are removed: the selection's resize and rotation zones are `TRANSFORM_ZONE` and `transformZoneAt` in `@open-pencil/core/geometry`, which also owns the `HandlePosition` and `CornerPosition` types, `SECTION_DEFAULT_FILL` is replaced by `SECTION_DEFAULT_FILLS`, and new pages use `PAGE_DEFAULT_BACKGROUNDS`, both keyed by interface theme. Icons come from an `IconProvider`: `fetchIcon`, `fetchIcons`, `searchIcons`, `searchIconsBatch`, and `clearIconCache` are replaced by the default `iconify` provider, `createIconifyProvider()`, and `placeIcon`, and `VectorizedPath` from `@open-pencil/core/vector` replaces `clipNetworks` with `clips`.
- `@open-pencil/vue` composables act on the whole selection: `useStrokeControls` and `useEffectsControls` no longer take a node, `useTypography` edits every selected text layer and its `weights` (also the `TypographyControlsRoot` slot prop) is a computed list of the families' weights, read with `.value`, and `usePosition` reports `x`, `y`, and `rotation` as Figma's panel does. `useCanvasInput` returns `autoLayoutValueEdit` with `updateAutoLayoutValueEdit`, `commitAutoLayoutValueEdit`, and `cancelAutoLayoutValueEdit` in place of the padding-only `autoLayoutPaddingEdit` and its functions; the edit names its `field` (a padding or `itemSpacing`), and `autoLayoutValueAnchor` places its editor. `useVariables().collections` returns copies and `addVariable` returns the new ID; `useVariablesEditor`, `useVariablesTable`, `useVariablesDialogState`, and the `@tanstack/vue-table` dependency are removed. `useFlatReorderDrag` takes `operations` and `onCombine`, and the `updates` messages replace the system update dialog strings with the Software Update window's.

### Added

- Comment on designs, as in Figma: the **Comment** tool (<kbd>C</kbd>) pins threads to layers, with replies, resolving, rich text, and a searchable, filterable list in the sidebar. Comments are saved in the `.fig` file, so they travel through storage and shared rooms, and scripts, the AI chat, and MCP clients read, add, reply to, and resolve them.
- Be in several shared rooms at once, each in its own tab and syncing in the background, and talk with the people in a room in a peer-to-peer voice call from the headphones beside the avatars. Join from Home with **Join room…** or a pasted link, open a browser room in the desktop app with **Open in desktop app**, and join right away under a generated name such as *Teal Fox*. Everyone in a room sees and edits the document's variables and the overrides of its instances.
- Follow collaborators and AI agents: avatars count each person's agents and show what they are doing, clicking follows them, and your own agents are followed while they work. Agents from the AI chat, ACP and Pi harness chats, and MCP clients show labeled cursors at the layers they touch and leave the canvas when their reply ends, and the Pages panel and command palette show who is on each page. The command palette also lists recent pages and **Go to page…**.
- Create and fill slots, as in Figma, from the canvas, the properties panel, scripts, and AI and MCP tools: slots have names, limits, and preferred components, instances show each slot as Default or Modified, and **Reset slot** brings back the component's content.
- Create and edit component properties and variants from the properties panel, as in Figma (#847): link text, visibility, and swapped components to text, boolean, and instance swap properties, expose nested instances, reorder properties, and turn a component into a set with **Add variant**.
- Make components behave like real controls: the Behaviour section turns a component or set into a Button, Switch, Checkbox, Slider, Tabs, Text field, or another of 15 Reka UI-style controls, and **View → Preview** (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>↩</kbd>) lets you use them live without changing the document, drawn as the canvas draws them, in its variable modes. Scripts, AI and MCP tools, and design JSX build them too.
- Fill layers with shaders from the open-source [`shaders`](https://shaders.com) library: the fill picker's Shader tab stacks effects with generated controls and takes presets copied from shaders.com. The canvas shows the first frame and preview plays it where WebGPU is available; `.fig` files and the Figma clipboard keep the frame as an image and the shader's preset, so Figma still opens them.
- Apply a variable mode to layers and pages from Appearance, or the Page section with nothing selected, as in Figma: choose Auto or a mode for each collection the layers use. Layers set to a mode show it after their name in Layers.
- Draw freehand with the pencil tool (<kbd>⇧</kbd><kbd>P</kbd>): strokes become smoothed, editable vector paths, with <kbd>Shift</kbd> for straight lines, as Figma's pencil does.
- Bulleted and numbered lists in text, as in Figma, with nesting, list and paragraph spacing, indents, and hanging markers, set from the Typography section or with <kbd>⇧</kbd><kbd>⌘</kbd><kbd>8</kbd> and <kbd>⇧</kbd><kbd>⌘</kbd><kbd>7</kbd>. Lists round-trip through `.fig` files, the Figma clipboard, HTML, design JSX, and scripts.
- Style selected characters while editing text, as in Figma: the Fill and Typography fields show and change the selection, and any range of characters keeps its own case, link, text and fill styles, and variable bindings. The canvas draws each range in its own case, `.fig` files and the Figma clipboard keep them, apart from font weight bindings, and HTML, Tailwind, Vue, and React exports keep character styles, links as `<a href>`, cases as `text-transform`, and lists; HTML import reads them back. Scripts style ranges with `getStyledTextSegments` and the `getRange`/`setRange` methods, including `getRangeTextCase`, `getRangeHyperlink`, `getRangeTextStyleId`, `getRangeFillStyleId`, and `getRangeBoundVariable` with their setters, and the text's `hyperlink`. Design JSX writes `<Span>` and `<Paragraph>` with decoration style, colour, thickness, offset, skip ink, `textCase`, and `href`.
- Edit shapes on the canvas, as in Figma: gradient end points and stops while a gradient's picker is open, corner radius handles on rectangles, polygons, and stars, a polygon's or star's point count and inner ratio, also in the properties panel, and auto layout padding and gaps, which open for editing on a double-click.
- Switch a frame, group, or section to another of them from the layer type menu in the properties panel header, as in Figma. A frame becomes a group that keeps its layers, effects, and opacity and fits them; a group becomes a frame of its bounds that clips. A frame or group on the page or in a section becomes a section that keeps its fill, strokes, corners, and layers where they are, and a section becomes a frame.
- Lock a layer's aspect ratio beside its width and height, as in Figma; the lock survives `.fig` files and the clipboard and is available in the plugin API.
- Show the pixel grid when zoomed in, toggled with **View → Pixel Grid** or <kbd>⇧</kbd><kbd>'</kbd>, and snap moves, resizes, and drawing to whole pixels with **Snap to Pixel Grid** (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>'</kbd>).
- Figma's navigation keys move through layers and the document: Enter selects children, or opens a selected vector's path for editing, Shift+Enter or \ selects the parent, Tab and Shift+Tab select siblings, N and Shift+N zoom to the next or previous frame, Page Down and Page Up switch pages, and Shift+0 zooms to 100%.
- Rearrange auto layout as in Figma: drag several layers along a row or column as one block, move a layer one slot with the arrow keys, take it out with **Ignore auto layout**, and see the layout's children outlined on hover.
- Edit several layers at once: a multi-selection gets Layout, Typography, corner radius, and stroke sections, plus **Selection colors**, which recolours a colour everywhere it is used. The layout guides of several frames list and edit together while they match, and Add gives each frame one new guide.
- Check designs in the new Lint tab: issues are grouped by rule, marked on the canvas and in the Layers panel, and many have one-click fixes such as binding colours to matching variables. `openpencil lint --fix` and the `lint` and `lint_fix` tools apply the same fixes outside the app.
- Edit variables in a redesigned variables dialog: collections and groups in a sidebar, search across names and values, inline editing, drag to reorder, multi-select, CSS names and expressions, per-mode conditions written in plain words, and a live stylesheet preview. Collections copied from a library are marked, with a warning on variables Figma won't show.
- Import and export variables, text styles, and effect styles as W3C design tokens, in the shape Figma imports, from the variables dialog, by dropping `.tokens`, `.tokens.json`, or `.resolver.json` files on the editor, with `openpencil tokens --format dtcg`, and with the `import_design_tokens` tool. Copy variables as CSS or a Tailwind v4 theme, or print them with `openpencil tokens`.
- Insert icons from Iconify's open-source sets with an icon picker in the toolbar, Object menu, and command palette. Placed icons keep their name, so the Icon section can swap or recolour them, and exports write them as icons.
- See the selection as a Vue or React component in the Code tab, styled with CSS or Tailwind, and see which layer the cursor's element draws, with design issues underlined in the code.
- Export components to Storybook with `openpencil export -f storybook`: one story file per component for React, Vue, or HTML, with variant controls, and with `--framework vue` or `--framework react`, working Reka UI or Radix UI components (#727). Export HTML and Tailwind JSX from the app and the CLI (`-f tailwind-jsx`), with vector shapes as inline SVG, and choose PPTX in the Export panel.
- Open a `.fig`, `.pen`, or other supported document by dragging it onto the window, paste SVG markup copied as text, such as Figma's Copy as SVG, and open HTML files in CLI commands such as `openpencil tree` and `openpencil convert`.
- Save the open document to cloud storage with **File → Save to storage…**; the tab stays bound to the stored copy, so Save and auto-save write to the bucket. A new Cloud Storage guide covers setup, and Settings → Cloud storage offers the OpenPencil Cloud waitlist.
- Set up AI in a few steps with guided setup: on first launch, pick a coding agent on this computer, an API account, or a local server. The desktop app installs or updates agents, adapters, the MCP server, and the Harness companion with one click, through Bun when Bun installed them, tests each connection, and proposes models; where npm's global folder needs administrator rights, setup says so and offers the `sudo` command, Bun, or a prompt for your agent. The MCP server and Harness companion print their version with `--version`; sign in to OpenRouter instead of pasting a key.
- Choose how much an AI model thinks for each message, from Off to Extra high, attach images by dropping them on the chat, and watch designs appear on the canvas while direct providers stream JSX.
- Review and undo AI edits from the chat: each tool call shows a summary, its input and output, and a before-and-after image with a JSX diff. Revert a reply's edits, restore them, regenerate the last reply, retry a failed message, or edit and resend it; undoing an edit tells the AI on the next message. The conversation menu saves a chat's trace as a JSON file, with every message, reasoning step, tool call, and request.
- Control the running app from the CLI and MCP: `openpencil documents`, `undo`, `redo`, and `settings`, the matching MCP tools, `openpencil tool list`, `describe`, and `call` to run any MCP tool from the shell, and `openpencil diff` with the `diff_visual` and `diff_apply` tools to compare and replay changes. Share only the selected layers with MCP clients from **Settings → MCP → Local server** or `OPENPENCIL_MCP_SCOPE=selection`.
- Diagnose failures from **Settings → Diagnostics**: errors, failed AI chats, and broken tool calls are recorded with scrubbed messages and stacks, filterable, copyable with the app version, and saved as a JSON file.
- Choose an accent color in **Settings → General → Appearance**, and customize the toolbar in **Settings → Toolbar** or from its right-click menu: hide, reorder, and regroup tools on desktop and mobile.
- Official builds send one anonymous ping a day, with the app version, operating system, architecture, desktop or web, and whether usage stats are shared, and no ID; turn it off in Settings → Privacy or with `OPENPENCIL_TELEMETRY=0` or `DO_NOT_TRACK=1` in the desktop app's environment. Usage stats (launches, file formats opened and exported, and which AI provider answered) are sent only after you agree in a one-time prompt after the welcome screen. The [privacy page](https://openpencil.dev/overview/privacy) lists every field.
- Use more of the Figma plugin API: `instance.swapComponent()`, `detachInstance()`, `figma.getNodeByIdAsync()`, `getMainComponentAsync()`, and an instance's `overrides` with `resetOverrides()`. OpenPencil's own `openpencil` script global adds comments and controls.
- Write design JSX with more of the document: `visible`, `locked`, `constraints`, `italic`, full stroke props, and component properties set by name on `<Instance>` (#750). JSX export writes them back with every fill, effect, mask, and variable binding, and TSX can use `@open-pencil/design-jsx` as its JSX import source.
- New SDK entry points: pass an ID generator to `new SceneGraph()`, place pasted content with `resolvePasteTarget` from `@open-pencil/core/editor`, compute Flatten and Outline stroke with `flattenNodesToVectorProps` and `outlineStrokeNodesToVectorProps` from `@open-pencil/core/canvas`, import `designDocumentToSceneGraph` from `@open-pencil/dom-css/scene-graph` in browser builds, and tell `FontManager.setBundledFontLocator()` where a bundler put the fonts from the new `@open-pencil/core/assets` export.
- New npm packages: `@open-pencil/design-jsx` for writing and exporting design JSX, and `@open-pencil/emit`, which it and the exporters use to print source code.
- openpencil.dev opens on live editor demos of design, AI, code export, the CLI, the SDK, and collaboration, in every docs language, with a short roadmap, and a download page offers the installer for the visitor's system and lists every installer with Homebrew and the web app.

### Changed

- Selecting, dragging, drawing, duplicating, and pasting follow Figma: clicks select a top-level frame's direct children and double-clicks go deeper, a click up to 3.5 screen pixels outside a shape selects it, a click on a section's empty area selects the section, dragged layers land in the frame under the cursor, groups and locked frames never take a drop, and Space, Shift, and Control change how a drag reparents. A layer leaves auto layout once its edge is about 5 px past the frame instead of after the cursor travels 96 px, and a duplicate is stacked directly above its original.
- A selected layer resizes and rotates where Figma's does: every edge resizes along its whole length within 7.5 px outside it and up to a tenth of the side inside it, corners within 7.5 px, and the area outside a corner within 16 px rotates; a frame's name takes a press before rotation but not before resizing. A selection draws Figma's four corner handles, without the edge midpoints, and layers under 10 px on both sides show no handles or size label.
- Pasted layers keep how they were turned and flipped on the canvas, as in Figma, and land where Figma puts them: layers copied out of a frame or section keep their offset from its box, move into the frame only when they start past its far edge or miss it, and paste back where they were when nothing is selected, or in the middle of the view when that place is out of view.
- Trackpads and mouse wheels pan and zoom the canvas as in Figma: a two-finger pan moves the canvas twice as far, up to 120 px per scroll event, a pinch zooms as far in the desktop app and Safari as in other browsers, also over Preview's controls and comment pins, and on Windows each mouse wheel notch pans 16 px, speeding up to 120 px when notches come less than 50 ms apart.
- Layers move and turn as in Figma, on the canvas and in scripts: the properties panel shows X and Y of a turned layer's box and a counterclockwise rotation, children of groups report positions in their container, and groups and booleans refit to their contents.
- New layers, pages, and sections look as in Figma: white frames that clip, #D9D9D9 shapes, black 1 px lines, theme-aware page backgrounds and sections, numbered names such as "Rectangle 2", and Figma's results for Group, Frame selection, Create component, booleans, and Combine as variants.
- Tool shortcuts and cursors follow Figma: Section moves to Shift+S and Frame also answers to A, and the pen, comment, and hand tools show their own cursors, with the hand closing while panning.
- The font weight list offers only the weights the text's family has, as in Figma. Switching family keeps the weight and italic where the new family has them, otherwise the nearest weight with the same slant.
- The Layout guide section follows Figma: each guide is a row with a summary such as "5 columns" or "Grid 10px" that switches between grid, columns, and rows, and its settings open from the row's icon with Count, Type, Width or Height, Margin or Offset, Gutter, and Color fields. The section now sits after Selection colors.
- A layer keeps its stroke weight and alignment without strokes, as in Figma, and strokes take the same paints fills have, including gradients and images (#797).
- Layers inside components and instances are outlined in purple, and bound variables show as a neutral chip instead of purple text.
- Import SVG as editable layers, as pasting into Figma does: groups, one vector per shape, text layers, and clip path groups instead of one merged vector (#734).
- The plugin API follows Figma inside instances: it refuses to move, rotate, constrain, or mask a layer an instance takes from its component, or to change a vector's path there, with Figma's errors, while slot content stays editable, and setting a layer to the value it already has makes no override. `setProperties` switches an instance's variant, alongside its other properties, and fails without changing anything when no variant has the values; `resize` places a frame's layers by their constraints while `resizeWithoutConstraints` leaves them; a new frame or component hugs along its main axis once auto layout is on, and `resize` fixes a hugging auto layout frame's size.
- Popovers, menus, selects, and pickers share one look and motion, selects open over their field, every section adds and removes items with + and −, and variables, styles, and swap components come from one searchable list. Menus taller than the window scroll.
- **Settings…** (<kbd>⌘</kbd><kbd>,</kbd>) is in the **OpenPencil** menu on macOS and at the end of the **File** menu elsewhere, instead of under **View → Preferences**.
- The demo at `/demo` is a tour of one player card in eight chapters stacked on one canvas, each showing one thing with a numbered card that says what to try and draws the piece of the app to click: preview, the artwork slot, the controls' behaviours, the theme's modes, shader fills, the Code tab, Lint on a card with planted issues, and sharing and opening your own files. It opens instantly, built ahead of time, on the first chapter, and follows the app's light or dark theme. The welcome dialog on first launch offers it next to AI setup, and **File → Open the Tour** opens it any time.
- The desktop app shows updates in a Software Update window with formatted release notes and cancellable download progress (#743). On macOS and Linux you choose when to restart, and restarting asks about unsaved documents first.
- Design lint reports far fewer false positives, checks touch targets against WCAG 2.2 AA in the Recommended preset, asks 3:1 contrast of large text as WCAG AA does, and reports unbound colours and off-scale spacing as suggestions.
- HTML and Tailwind export write variable-bound values as their tokens, such as `var(--color-primary)` or `bg-primary`, and Tailwind JSX uses the same class mapping as Tailwind HTML.
- The AI chat starts with comment, variable, lint, page, and image export tools on, keeps working on the page where it started, and recommends the latest models, with Claude Sonnet 5.5 and GPT-6.1 Sol as the new defaults. Saved profiles keep their model.
- Settings → MCP shows the local server in the desktop app and WebMCP in the browser, where each works, and Tool access lists the local server's tools while it is stopped.
- Invalid tool arguments from the AI chat, CLI, or WebMCP name the tool and list every problem with its location.
- Run Pi with the providers and default model you signed in to in the Pi CLI, and see what to fix when its Harness companion or MCP server is missing or out of date. Codex install instructions point at `@agentclientprotocol/codex-acp`, which replaces `@zed-industries/codex-acp`.
- `get_selection` returns the selected layers with their direct children by default and takes a `depth`, and `openpencil eval` prints the value of a script's last expression.
- Opening a share link opens the room in its own tab, so an open document is never changed, and leaving a room keeps its file as a local copy.
- Text in both themes meets the WCAG AA contrast ratio of 4.5:1.
- The Linux AppImage no longer bundles `xdg-open` and relies on the system's `xdg-utils`.

### Fixed

- Instances follow their component as in Figma: style overrides from `.fig` files survive component edits, every field an instance does not override follows the component, restructured component layers move their instance copies with overrides, and properties set on nested instances show and stay set when pages load on their own (#849). Resizing an instance no longer turns its layers' sizes into overrides, copies that size themselves to their content keep their size through component edits and reopen at their saved size, and a path edited in a component reaches its instances, scaled with each copy.
- Save `.fig` files that open correctly in Figma: overrides beyond text and fill colour, exposed nested instances, slot content, blend modes, bound variable values, variable metadata, fill-sizing, ordering keys, and stable layer IDs (#890). An opened `.fig` stays unchanged until edited, saves before its first edit, and saves variable-only edits.
- Saving an opened `.fig` file writes only what an edit changed in a layer or variable and keeps the rest as Figma saved it, including data OpenPencil does not model, an instance's library link and saved overrides, and text's letter spacing in percent and font names. A variable's new value reaches every layer that uses it, through an alias too, variables that alias library variables still point at the library, and a collection's modes keep their order in Figma.
- Shared and library styles survive `.fig` files: the properties panel shows the styles layers use in opened files, styles made in OpenPencil save as styles and reopen, layers that use a library style keep it in Figma, and a style an instance has cleared stays cleared.
- Figma shows images in `.fig` files OpenPencil writes, stored under the SHA-1 of their bytes, the only name Figma reads. Instances pasted into Figma keep their names and no longer carry their component's library identity, and fill and stroke bindings to variables made in OpenPencil survive the paste as remote variables.
- Importing design tokens adds them to the file's own collections, never to a collection copied from a library, where Figma did not show them.
- `.fig` files whose text content is bound to a number or boolean variable open instead of failing with "Unsupported variable expression STRINGIFY", and saving keeps the binding (#1110). Rounded points in imported vectors keep their own corner radius and join, layout guides save, show as columns or rows, and draw an Auto count as Figma does, and a file's thumbnail shows its page's own background.
- Showing or hiding a layer of an instance that a boolean component property drives sets the property, as in Figma, so every layer it drives follows.
- Text saved to `.fig` or copied to Figma keeps its wrapping, alignment, line height, ligatures, and decorations there (#914), and shows there when drawn in a fallback, missing, or variable font, truncated, or with an empty line. Auto line height stays auto when `.fig` files are opened and saved, and a pixel line height shorter than the font opens as set.
- Lines of text that mix font sizes or line heights are spaced as in Figma: each line is as tall as the tallest line height on it, with its largest font centred in it, instead of stacking the tallest parts of every style on it.
- Auto layout behaves as in Figma: Fill children in Hug frames keep their size, frames from `.fig` files reflow when edited, absolute children follow constraints, Hug frames grow while typing, a row that hugs its height around a stretched layer keeps it in Figma, and undo puts back everything an auto layout change moved.
- Draw like Figma: gradients from Figma files and pastes no longer run backwards, blurs and shadows use Figma's falloff, masks apply their opacity and blur, layers masked by a group show, polygons and stars keep their rounded corners, point count, and inner ratio, also when copied to Figma, and the corners of a stroked path take its join, with caps only at its ends.
- Underlines and strikethroughs follow the font's metrics and Figma's styles, outlined or flattened text keeps its glyph positions, text on a path turns each character along the stretch it covers, and fonts load reliably: styles of variable fonts and macOS font collections, CJK and Arabic fallbacks, and a clear notice for unsupported outlines such as PingFang (#746, #752).
- Undo covers more: hiding, locking, renaming, and moving layers to another page, and layers MCP clients, the CLI, and AI chat create, delete, or move, including on other pages and in variables. Hiding or locking several layers is one step, undo and redo work while a colour picker is open, and undoing back to the last save shows the document as saved.
- The pen tool redoes a path with its points, fill, and stroke, Escape keeps the path drawn so far, and the distance for closing a path no longer changes with zoom. Path editing closes when its vector is deleted or another document opens, and editing a vector's points no longer leaks memory.
- Dragging a layer down the layers panel drops it where the line shows, and moving a layer into a frame or group from the panel keeps it where it's drawn on the canvas.
- Opening a page also loads the pages holding the component sets its instances use, so the variant picker can switch to any variant of a set kept on a page not opened yet.
- Import HTML and CSS laid out as a browser lays it out, with correct shadows, borders, and `box-sizing`, in `openpencil import`, the app, and the Code tab's preview (#788).
- Import SVG files with an XML declaration or a byte-order mark, `fill-opacity`, `stroke-opacity`, open filled subpaths, and stroke caps and joins that survive saving. SVG export, and the drawings built on it, draw a vector's open strokes beside its filled regions.
- Design JSX lays out `justifyContent`, `alignItems`, grid `repeat()` tracks, fill sizes in grids, and `box-shadow` lists as written, applies props it used to ignore, reports bad gradient arguments, warns about ignored paint and effect options (#736), and keeps line breaks when exporting multi-line text.
- HTML export keeps grid layouts, rotation, every shadow and blur, flex grow, right-to-left direction, sections, and the positions of layers outside auto layout, declares `box-sizing: border-box`, and names a JPEG, GIF, or WebP image fill by its own type.
- The plugin API reads and writes `lineHeight`, `letterSpacing`, effects, paints, page backgrounds, `layoutGrids`, and `componentPropertyReferences` in Figma's shapes, updates geometry and text size immediately, and refuses invalid sizing and component cycles as Figma does (#786). `openpencil eval -o` saves a script's edits laid out, and CLI `eval` and tools measure text in the document they edit; `@open-pencil/core/figma-api` exports `flushPendingLayout` for hosts that save scripts' results.
- AI, MCP, and CLI tools reject arguments they do not take (#977), keep variable bindings through stdio `render` (#830), size groups and booleans to their contents (#738), work on pages other than the one on screen, run XPath queries under Node (#787), judge text contrast by its WCAG ratio (#735), and report failed saves as errors.
- AI chat replies stop cleanly, survive switching pages, accept `eval` results of any shape, use a newly saved API key right away, and keep your message when the chat cannot start. In the desktop app, replies stream and keep going past 30 seconds, a request that cannot reach the provider is retried, and scrolling back to the bottom resumes following. Pi chats start with OpenPencil's MCP tools on Node 22.15 or later, resume cleanly, and stop a reply without losing the session.
- In the desktop app, Select All, Undo, and Redo typed in a text field such as the chat input act on the field instead of the canvas, and other canvas shortcuts no longer reach the canvas from a text field.
- Shared rooms keep one consistent layer tree when people move, reorder, or add layers at the same time (#888, #889).
- Storage keeps working: browser storage saves after Safari suspends a tab, in Private Browsing, and for documents over 127 MiB; crash recovery and autosave run after edits instead of on redraws, which froze Safari; S3 storage works with servers that answer range reads with `200`, such as `rclone serve s3`; and when saved credentials are paused, the home screen offers **Retry access**.
- Memory stays flat during long AI and MCP sessions (#587), image-heavy `.fig` files open without running out of memory (#924), and closing a tab releases its document.
- Show a clear message instead of a blank window when the browser or WebView is too old, and start on macOS 13 with older WebKit (#744).
- Picking an OkHCL colour no longer overwrites a layer's other plugin data, including other plugins' data and its export settings.
- Warnings and errors show in the theme's colors: library update and diagnostics warnings, errors on the home screen and when renaming layers, publishing a library or authoring variants, and chat errors, copy confirmations, and error toasts in the light theme.
- Smaller fixes: layers keep their place when moved into or out of a rotated or flipped parent (#737), the Vue SDK's `CanvasSurface` starts, `.pen` text sizes from its font, whole-step number field drags, ⌘Z after nudges, ⇧-resizing, Paste here in transformed frames, zooming to a fixed level, the font picker's starting position and search order, section and frame titles, tab and menubar overflow, the mobile file menu's labels, tooltips, full hex and opacity values, component set borders at every zoom, the caret in empty text, imported page backgrounds, `.fig` thumbnails in recent files, the canvas context menu closing on a quick second right-click, model pickers in Settings → Models closing while the editor slides in, and screen reader labels.
- Ship the MIT license text in every npm package, with READMEs for `@open-pencil/core`, `@open-pencil/cli`, and `@open-pencil/mcp`.

### Performance

- Open large `.fig` files with a fraction of the memory: the Nuxt UI design kit takes 0.7 GB instead of 2.2 GB, and pages share unchanged component data and JavaScriptCore object layouts.
- Save an edited `.fig` by rewriting only what changed, off the main thread in the browser: the 109 MB Preline UI kit saves in about 3 seconds instead of over two minutes, with about 1.5 GB less memory on large kits.
- Open multi-page `.fig` documents, lay out pages with many text layers and instances, and edit text selections and variables without long freezes or full redraws.
- Joining a shared room is faster: the document a person receives on joining is compressed, about a twelfth of its size before (480 KB instead of 5.7 MB for the demo tour), and edits travel in Yjs's more compact encoding.

### Security

- Limit what the desktop app may write and run: no writes to startup locations, shell profiles, global package folders, or MCP discovery files, and only the exact command lines of supported agents, the MCP server, and the Harness companion.
- Update to Tauri 2.12, which binds large IPC responses to the requesting webview (GHSA-w28w-mhc8-qvjv), and install desktop updates only when the signature names the announced version.
- Evaluate `calc` through `jsep` and an arithmetic allowlist instead of `expr-eval`, which had an unpatched code-execution advisory (GHSA-q9v2-7m5w-4693); `calc` now supports `**` and nothing it does not document.
- Escape layer names and text in JSX and Tailwind JSX export, so document text cannot inject attributes or expressions into `render` and `replace`.
- Validate collaborator cursors and names, clipboard data, component library revisions, and MCP and automation messages before using them, and update `@xmldom/xmldom` to 0.9.12, which fixes quadratic parsing of crafted SVG and XML.

## 0.15.1 — 2026-09-18

### Added

- Configure built-in AI and local MCP tool access independently on a Tool access page, including optional extended AI tools, searchable read-only and side-effect groups, and per-target defaults (#584).
- Set the built-in AI's maximum steps per message in Chat settings, including a custom number, with consistent stopping and remaining-step warnings (#573).
- Open documents and jump to a named layer from `openpencil://open?file=&node=` links, resolving the file against open tabs or a one-time file picker. Path segments match the way the filesystem does: case-insensitively on macOS and Windows, exactly on Linux.
- Open documents and jump to a named layer in the web app from `?file=&node=` links, fetching the file from an `https:` URL without credentials, ignoring the URL fragment, and refusing a document larger than 64 MiB — a ceiling the automation bridge's `openFile` now shares.

### Changed

- Create new documents with the sRGB colour profile, so Display P3 is reserved for documents that declare it.
- Export diagnostics from Settings only, with a retention count you choose. AI requests and tool activity now carry conversation and request identifiers, while chat no longer offers a separate diagnostic log or includes transcript content.
- Replace the demo's legacy reference page with a component library on the first page, including component sets, linked instances, component properties, and the variable collections, and show the standard canvas loading overlay and tab indicator while it is generated instead of an empty canvas.

### Fixed

- Store colours edited in the colour picker in the document's colour profile, and convert them on the way to the display, so a Display-P3 document no longer looks different on an sRGB display than on a wide-gamut one.
- Keep Display-P3 documents rendering correctly in wide gamut where the browser supports it and in sRGB elsewhere, fixing the black rectangles and incorrect blend colours, with a dismissible notice when wide gamut is unavailable.
- Classify MCP `open_file` and `close_file` operations as read-only hints, and close opened document tabs through the new `close_file` tool with the usual unsaved-change prompt.
- Let the desktop app use an MCP server you started yourself by allowing the app's own origin by default, instead of requiring `OPENPENCIL_MCP_CORS_ORIGIN`.
- Explain why the local MCP server did not start — a missing `@open-pencil/mcp` install, a denied command, an early exit, or an unreachable address — with translated guidance, and find a globally installed server when the desktop app is launched from the system shell.
- Animate the AI chat tool-call disclosure, which expanded and collapsed without motion because its animation classes were misspelled.
- Mark unsaved documents and ask whether to save before closing a tab, the desktop window, or the application, rather than relying on recovery alone.
- Defer AI provider connections and system credential reads until you send a message or use a connected feature, so opening documents and browsing chat history no longer trigger unexpected credential prompts.
- Save and recover documents whose text uses disabled numeric, fraction, or small-caps OpenType features, which previously failed to write a `.fig` file.
- Update instance text properties on the canvas while typing, with grouped undo for rapid edits.
- Point Homebrew installation instructions to the official `openpencil` cask and document separate CLI installation.
- Reach the custom model option in the model picker for providers with large model catalogs instead of requiring a search for it.

### Performance

- Reduce editor pauses while generating recovery snapshots and exporting text-heavy `.fig` documents.
- Recompute layout only for the pages an edit affects, instead of every page, when editing a component or its instances.

## 0.15.0 — 2026-09-16

### Breaking changes

- Use MCP SDK v2 server/client types for programmatic MCP integrations. Define custom tools with native Valibot `input` schemas and execution metadata instead of `params`, `ParamDef`, or `paramToZod()`.
- Replace Scene Graph `overrides` records with `instanceOverrides`, using separate `self` and `descendants` maps. Rename `figmaDerivedLayout`, `figmaDerivedTextGlyphs`, and `FigmaDerivedTextGlyph` to `derivedLayout`, `derivedTextGlyphs`, and `DerivedTextGlyph`.
- Update custom Vue SDK binding providers to implement `getBindingId()` and handle `unresolved`. Replace `setValue()` with `prepareEdit()`, returning a stable edit key, captured value, setter, and restoration callback.
- Replace Vue SDK `useDialogMessages()`, `dialogMessages`, and their catalog keys with the corresponding product-domain message composables and catalogs.
- Use Vue 3.5.41 or newer within Vue 3 for the Vue SDK, and CanvasKit 0.41.1 or newer when supplying its optional CanvasKit peer. Update custom CanvasKit integrations to use `PathBuilder` and immutable `Path` operations.

### Added

- Expose design inspection and undoable layer-property and variable edits to browser agents through experimental WebMCP in supporting browsers, with explicit Off, Inspect, and Edit access controls in Settings.
- Control custom tool exposure independently through `mcp`, `ai`, and `webmcp` exclusions. Tools are included by default, subject to execution support and user permissions.
- Bind Design JSX spacing, sizing, corners, and typography directly to numeric document variables.
- Define component properties and assign instance values in Design JSX using stable property IDs.
- Save AI conversations and attachment previews locally, switch between chats, rename or delete them, and browse saved transcripts across documents. Choose whether reasoning stays collapsed, expands while thinking, or stays expanded, with animated disclosure controls that respect reduced motion.
- Add a searchable command palette for editor and application actions.
- Search current AI provider catalogs from model pickers, with curated recommendations, recent compatible models, and offline fallbacks.
- Render triangle and line arrow stroke caps on lines and open vector paths, and choose them from the stroke cap picker.
- Expose component properties and instance-swap targets through the Figma API and automation.
- Create, select, move, duplicate, transfer, and delete canvas and frame guides directly from rulers, with undoable edits, measurements, context-menu actions, and `.fig` round-trip fidelity.
- Open to a unified home with recent and configured storage documents in grid or list layouts, and open multiple selected design files in separate tabs.
- Snap vector points, moved layers, and resized edges to nearby geometry, guides, frame and canvas bounds, and whole-pixel coordinates, with visible alignment guides and persistent snapping preferences.
- Run Pi through AI SDK HarnessAgent as a configurable desktop provider with saved model profiles, secure credentials, existing MCP design tools, and per-profile thinking and permission settings.
- Combine components into variant sets through Figma API scripts and automation.
- Add local AI usage and technical diagnostics, including token telemetry, provider/model summaries, recent failures, configurable retention, export, and clear controls (#588).
- Import, render, edit, resize, select, and export Figma text-on-path layers while preserving their curved glyph layout.
- Show temporary Figma-style distance measurements between selected and Option/Alt-hovered layers (#491).
- Edit Design JSX and HTML/CSS previews in CodeMirror, with theme-aware highlighting, Tailwind viewing, completion, diagnostics, bounded execution, and session-level undo (#130).
- Set provider-specific reasoning effort on supported AI model profiles (#454).
- Show unavailable or substituted document fonts with affected-layer selection and retry actions, and expose font fidelity through the Figma API, MCP, and `openpencil fonts [file] --json`. Choose `warn`, `strict`, or `allow` font-substitution policies for file-backed CLI raster and PDF exports with `--font-policy` (#503, #625).
- Add reusable remote MCP connections for ACP agents, with Streamable HTTP endpoints and credential-backed bearer tokens.
- Author and manage multidimensional component variants and published component libraries, including revision previews, linked-instance updates, stable library identities, offline catalogs, storage-backed catalogs, and read-only library definitions (#239).
- Recover unsaved and pathless documents locally, including after closing their tabs, with options to disable recovery and restore or discard retained snapshots (#487, #505, #574).
- Inspect selected designs with a configured Vision model and attach images to AI chat with bounded analysis and previews (#232, #471).
- Pin selected layers as explicit AI chat context, show collapsible reasoning, copy individual responses, and grow the composer with multiline prompts (#13).

### Changed

- Refresh the OpenPencil mark across the editor, documentation, browser tabs, installed web apps, and desktop icons, with small-size and dark-background adaptations.
- Explore editable component, typography, and paint comparisons in the demo, with the original examples preserved on a reference page.
- Use compact desktop Home search actions with consistent responsive layout and control sizing.
- Keep pixel-grid rounding invisible while showing alignment guides only for real geometry, objects, and canvas/layout guides.
- Embed images when copying selections into Figma, and preserve geometry, text sizing, component links, variables, modes, and shared styles when pasting within OpenPencil.
- Choose the app theme and whether animations follow the system or stay off under Appearance in General Settings, with live updates and persistent preferences.
- Simplify property panels with fill and stroke style pickers in section headers, concise effect style rows, and collapsed equal corner fields when all four share a variable. Preserve applied and missing styles and remove the redundant Dimensions heading for text layers.
- Open variable pickers below their trigger when space permits, flipping above near the viewport edge.
- Keep AI chat preferences with the model overview and edit models in a fixed-size Settings pane with explicit Save and Cancel actions.
- Match page-list density to the layer tree and add subtle, reduced-motion-aware dialog transitions.
- Fade in streaming Markdown list items and code lines without animating completed responses.
- Vertically center shaped section titles and allow renaming a section by double-clicking its canvas label.
- Load supported online fonts before revealing imported pages, preserve substituted text during editing, and shape canvas labels with Inter typography and shared Arabic/CJK font fallback.
- Complete translated app, accessibility, font, color, file, clipboard, collaboration, chat, vectorization, storage, recovery, component-library, and connection feedback across supported locales, and synchronize document language with the selected locale.
- Separate local MCP server controls, browser WebMCP access, and remote connections in Settings, with inline searchable tool permissions.
- Show translated field errors, hints, and consistent contextual alerts in Settings forms, focus the first invalid field on submission, and explain missing requirements instead of silently disabling Save or Test.
- Pan horizontally with Shift+wheel while preserving native horizontal trackpad movement.

### Fixed

- Render four-point diamond gradients, preserve text layout across fill types, and keep image colors accurate on sRGB displays.
- Keep newly created and edited objects visible during zoom instead of replaying outdated scene content.
- Keep property fields and paint previews live during editing, rotated selection labels readable and aligned, and object edges stable when previews settle.
- Show compact bordered section labels with inset nested titles and clearer hover feedback.
- Keep Undo and Redo commands available as edit history changes, without requiring another scene edit.
- Avoid recursive desktop HTTP proxy requests when font downloads intercept Tauri IPC traffic.
- Keep FIT image fills proportional, centered, and fully visible without stretching or cropped edges.
- Preserve edited instance text, including cleared labels, when saving and reopening `.fig` files.
- Honor `.pen` frame layout defaults and sizing and padding shorthands so imported auto-layout frames keep their computed dimensions and child positions (#564).
- Avoid macOS Keychain prompts during credential status checks and pause repeated credential access after failures until explicitly retried from Settings.
- Honor explicit Design JSX instance dimensions and preserve authored overrides through component synchronization.
- Route browser Command/Ctrl plus and minus shortcuts to canvas zoom instead of page zoom.
- Resolve `$name` references in imported `.pen` fills, stroke fills, font families, dimensions, and spacing without requiring a `--` prefix (#563).
- Resolve bound fields in each layer’s mode, keep variable edits scoped and undoable, and make broken bindings visible and recoverable.
- Display letter spacing in pixels and support explicit automatic line height.
- Prevent the stock photo tool from replacing text, lines, structural layers, or containers with content while supporting closed shape geometry.
- Preserve imported Figma text alignment metadata, explicit normal blend modes on text and vectors, and implicit fixed text sizing in auto-layout frames across save and reload.
- Render imported Figma strokes with odd-length dash patterns correctly.
- Stop showing a misleading desktop-only warning when web font loading or catalog lookup fails.
- Resolve fallback fonts reliably for cached characters, mixed-language text, and text-case transformations.
- Preserve imported Figma divider-line geometry during auto-layout recomputation, preventing half-pixel shifts on save and reload.
- Resolve package imports under Node and Bun from ordinary tarballs while preserving Bun source-first workspace execution (#663).
- Use the user's home directory as the default MCP file root on Windows, avoiding the caller's unreliable working directory.
- Open legacy raw `.fig` files that store the Kiwi document and thumbnail without a ZIP wrapper (#582).
- Preserve a frame's auto-layout HUG sizing, variable bindings, and variable modes when converting it into a component through the Figma API or automation (#595).
- Run `openpencil import` on Node so npm-installed CLI users no longer encounter `Bun is not defined` (#575).
- Generate recent-file previews from the conventional `Cover` page without modifying the source file.
- Resolve Vue SDK semantic test selectors correctly in non-browser runtimes (#397).
- Commit vector vertex and Bézier-handle edits when the pointer is released and keep transformed vector-edit overlays aligned (#586).
- Preserve app-created component properties and instance-swap targets across `.fig` save and reload cycles (#548).
- Reconnect desktop automation to an already-running MCP server through its discovery file (#546).
- Keep text-editing carets, hit testing, and selection highlights aligned with vertically centered or bottom-aligned text (#539).
- Match AI chat code-block colors and backgrounds to the active theme, and let desktop users select and copy chat text without replacing it with canvas layers (#537, #538).
- Restore visible above, below, and child drop feedback while dragging layers in the Layers panel.
- Place editor-created instances beside nested source components in world space, including transformed parents.
- Prevent malformed collaboration updates from corrupting synchronized nodes or derived text rendering.
- Transfer native `.fig` exports over binary Tauri IPC, preventing large desktop saves from being truncated or exhausting WebView memory (#484).
- Decode zstd-compressed FIG containers and reject invalid compressed payloads (#397).
- Compose caller CSS with Tailwind defaults when importing DOM/CSS documents (#397).
- Preserve desktop HTTP timeout, abort, and empty-response semantics (#397).
- Report whether missing Figma clipboard images were actually fetched (#397).
- Report exhausted provider credit, request failures, and output-token limits through localized chat toasts and copied diagnostics (#451, #454).
- Prevent Windows desktop crashes when loading large system fonts for non-Latin text.
- Preserve open vector segments when the same vector network also contains filled regions (#450).
- Match Figma Plugin API behavior for `rescale()`, page `backgrounds`, and nullable visual `absoluteRenderBounds` (#442).
- Keep imported and pasted Figma instances linked to their remapped source components so later component edits update existing instances (#385).
- Restore native copy, cut, and paste shortcuts in desktop text inputs while preserving design clipboard handling on the canvas.
- Preserve committed desktop text input when the WebView supplies text through the input event before updating the hidden text field (#607).
- Preserve selected layers when browser clipboard serialization fails during cut operations, and fall back to the session clipboard when system clipboard access is unavailable (#568).
- Treat MCP tool results with an omitted `isError` field as successful while preserving explicit MCP errors (#583).
- Preserve effective nested instance text overrides when importing complex Figma component hierarchies (#102).
- Preserve SVG clip paths, including clip shapes referenced through `<use>`, when importing editable vectors.
- Preserve circles, ellipses, rectangles, lines, polylines, and polygons supplied as JSX children of inline SVG elements (#452).
- Stop local MCP servers after the app disconnects instead of leaving orphaned background processes (#494).
- Prevent unbounded instance duplication when editing Figma-imported or pasted components with serialized or renamed children, keep extra instance children in their intended order, and avoid pasted instances re-linking pre-existing instances during clipboard import.

### Performance

- Reduce pauses after repeated frame creation without leaving hidden property edits or popups active.
- Reduce repeated text shaping and scene invalidation while moving and resizing objects, and reuse fitting canvas labels during zoom.
- Reduce unnecessary layout work after automation and Figma API edits by updating only affected layers and containers.
- Keep rapid trackpad zoom reversals and effect-heavy document navigation responsive by cancelling obsolete reconstruction and reusing safe raster snapshots.
- Show the FIG page list from a lightweight Kiwi scan before materializing the full document.
- Avoid redundant collaboration writes when synchronized node fields have not changed.
- Release completed streaming-response state to reduce retained chat memory (#544).
- Open large documents faster by reducing repeated position calculations when finding layers under the pointer (#527).
- Avoid redundant autosaves while a `.fig` export is in progress, while ensuring newer edits are saved afterward (#528).
- Defer JSX generation and syntax highlighting until the Code panel is active, keeping large canvas selections responsive (#500).
- Paste large, flat Figma selections faster by avoiding repeated scans of clipboard layers (#500).
- Reduce peak memory during `.fig` export by sharing immutable binary resources with the isolated export graph.

### Security

- Protect new real-time collaboration sessions with stronger invitation credentials.

## 0.14.0 — 2026-08-10

### Breaking changes

- **Core SDK:** Import scene graph types, geometry, coordinate, matrix, snapping, undo, and path helpers from `@open-pencil/scene-graph`; import `.pen` parsing from `@open-pencil/pen`; import synchronous Kiwi decompression from `@open-pencil/kiwi` instead of the `@open-pencil/core` compatibility barrel; use uppercase acronym casing in exported identifiers, including `JSONObject`, `JSONArray`, `JSONValue`, `RPCCommand`, and `executeRPCCommand`; and use the renamed tool exports `importSVG`, `exportSVG`, `exportPDF`, `getJSX`, `diffJSX`, and `setPexelsAPIKey`.
- **Vue SDK:** Replace the removed color-picker model helpers with `useColorModel()`; replace the deprecated `FillPickerRoot` and `useFillPicker()` APIs with `FillRoot`, `FillSwatch`, `useFill()`, and a consumer-owned popover; rename `FontPickerUi` to `FontPickerUI`; and remove the exported `testId` prop helper types in favor of semantic component anatomy.
- **CLI and MCP SDKs:** Use uppercase acronym casing in exported identifiers, including `AppTargetCLIArgs`, `appTargetRPCArgs`, `loadRPCData`, `prepareDocumentForRPC`, `RPCSender`, `createBrowserRPCBridge`, `createMCPSessionManager`, and `createStdioRPCBridge`.

### Added

- Export selections, pages, and documents as editable PowerPoint (`.pptx`) files from the File menu, CLI, and SDK. Text, rectangles, ellipses, and lines remain editable; visually complex layers are embedded as images.
- Import HTML, CSS, Tailwind, and JSX as editable documents from the app, CLI, and SDK, and export standalone browser-ready HTML with compiled CSS and optional external assets.
- Drag image files into the desktop app and paste Figma layers with their remote image fills.
- Import dropped SVG files as editable vector layers, preserving compatible multi-color fills and transparent paints. (#386, #392, #394, #446).
- Convert image layers into editable vectors with Recraft or fal.ai from the canvas context menu. (#322).
- Browse document components as thumbnails or a list in the Assets panel, group them by page, and drag instances directly onto the canvas. (#424).
- Create centered frames from Figma-style device and asset presets, or resize selected frames to a preset while preserving their names. (#418).
- Manage pages by renaming, deleting, and dragging to reorder them in the Pages panel.
- Create text by dragging a fixed-size text box or clicking for auto-width text.
- Create and edit layout grids for frames and components, including columns, rows, counts, gutters, margins, visibility, and grid size.
- Inspect and edit constraints, stroke caps and joins, corner smoothing, shared styles, component properties, blend modes, masks, advanced typography, text resizing, and per-node export settings from the Design panel.
- Edit solid fill colors by entering hex values directly in the Design panel.
- Use Figma-style number-key opacity shortcuts: `1`–`9` set 10%–90%, `0` sets 100%, and two-digit sequences set exact values.
- Access more common design actions from the browser and desktop menus, including visibility, locking, masks, flipping, components, z-order, distribution, selection, rulers, multiplayer cursors, and Settings.
- Find overlapping layers and overflowing children from the CLI, AI tools, and MCP.
- Target a specific open document and page from live CLI and MCP automation, including sessions with multiple documents.
- Connect local MCP clients through automatically discovered private Unix sockets on macOS and Linux, with localhost TCP fallback. (#338).
- Test OpenAI-compatible provider connections from AI settings with clearer setup errors.
- Configure separate Design, Review, Fast, and Vision models, providers, endpoints, and credentials from AI settings.
- Manage AI, agent, media, and storage credentials from unified Settings, using the system credential store on desktop and encrypted browser storage by default, with a session-only browser option.
- Connect an S3-compatible storage workspace with local-first saves, background synchronization, embedded `.fig` previews loaded without downloading full documents, and automatic refresh while the workspace is active.
- Add Japanese localization and improve menu translations across the existing supported languages. (#367).
- Author richer Design JSX with components, instances, variables, gradients, structured fills, shadows, blur effects, masks, and inline SVG vectors.
- Build custom property panels and document workspaces with new Vue SDK number fields, bindable values, property sections, responsive grids, segmented controls, property lists, color models, fill controls, gradient primitives, and the headless `useDocumentWorkspace()` composable.
- Use `useColorModel()` in the Vue SDK for extensible color formats and shared RGB, HSL, HSB, and OkHCL channel behavior.
- Add dedicated SceneGraph, Pen, Kiwi, Fig, and DOM/CSS packages with documented public entry points for building on OpenPencil.

### Changed

- Simplify AI model setup with clearly separated model, connection, and advanced settings, automatic compatibility and output-limit defaults for recognized models, and an explicit custom-model option.
- Redesign the editor chrome and Design panel with denser, better-aligned controls, clearer selection and section states, improved menus and overlays, consistent light/dark theming, and better keyboard and screen-reader support.
- Choose Freeform, vertical, horizontal, or grid flow directly from the contextual Layout section, with sizing controls grouped alongside it.
- Choose Auto width, Auto height, or Fixed size directly from the Layout section for text layers.
- Scale the Layers panel to documents with thousands of nodes through virtualized rows, faster incremental updates, stable expansion, range selection, and scroll-to-selection.
- Open and save large `.fig` documents substantially faster while preserving original metadata and user edits, and switch between large pages with fewer Layers panel stalls. (#420).
- Resolve fonts before text appears, with language-aware CJK and Arabic fallbacks, character-specific remote subsets, and more reliable rendering as fonts load.
- Use MiniMax M3 as the default model for MiniMax AI connections. (#431).
- Center empty and setup states consistently across panels, dialogs, and workspaces.

### Fixed

- Keep desktop startup clean when optional MCP automation is unavailable, retain startup diagnostics for MCP-dependent features, and load JSX syntax highlighting without browser globals.

- Preserve Figma’s imported glyph outlines through layout and appearance updates so text keeps its intended weight and shape.
- Keep swapped image avatars and thin stepper dividers at their effective imported size and position.
- Scale proportion-constrained `.fig` instance geometry through fixed wrapper layers so imported logos and icons retain their intended size.
- Match Figma auto-layout spacing, padding, min/max constraints, scalar variable bindings, CanvasKit-shaped generated text, imported text bounds, and nested instance geometry more closely.
- Match Figma Plugin API vector path and network editing, including bounds, transforms, winding rules, region fills, validation, and handle mirroring. (#444).
- Let AI and MCP tools create arbitrary vectors from SVG path data, validating input without leaving blank layers behind. (#440).
- Improve AI design accuracy by exposing every supported shape, including visible stroke colors and weights in visual descriptions, and accepting supported inline SVG attributes without false warnings. (#445, #447, #448).
- Restore Anthropic AI connections in the web app instead of failing with a browser endpoint error. (#438).
- Reconnect live CLI and automation sessions automatically after an unexpected bridge disconnection.
- Keep MCP file access inside its configured root when paths contain symlinks, and strengthen local authentication token checks. (#338).
- Start globally installed ACP agents correctly on Windows instead of reporting them as unavailable. (#361).
- Resume pending cloud saves after restarting the app or temporarily losing credentials, without reviving deleted documents or overwriting newer local changes.
- Handle S3 object listings, pagination, and escaped names more reliably, and explain required CORS setup without modifying bucket rules.
- Show HTML, CSS, Tailwind, and JSX import errors instead of failing silently.
- Preserve inline SVG attributes, nested transforms, and explicit icon dimensions when rendering Design JSX artwork.
- Save auto-layout frames that stretch their children to `.fig` without failing. (#427).
- Preserve nested instance text, visibility, paint, geometry, clipping, variable modes, and component swaps in `.fig` files.
- Improve `.fig` import and rendering fidelity for groups, booleans, instances, rotated vectors, complex text fills, auto-sized text, layout grids, page guides, patterns, noise effects, masks, and canvas backgrounds.
- Preserve pages, components, prototype and library metadata, export settings, unsupported effects, and other unrelated Figma data when editing and resaving `.fig` files.
- Prevent duplicate generated IDs from corrupting `.fig` round trips.
- Preserve the whole document when exporting FIG unless a page is explicitly requested, populate unopened pages for file-mode CLI inspection, and expose vector paths and variable modes to Plugin API scripts.
- Report corrupted compressed `.fig` data as an error instead of opening it as valid content.
- Match Figma auto-layout reflow after deleting children, hiding optional instance slots, or syncing component changes.
- Make group and boolean-operation children scale with their parent during resize.
- Edit vectors in opened documents at the correct position, with live fill updates and working undo and redo. (#390).
- Keep duplicated layers independent instead of sharing mutable fills, strokes, bindings, overrides, or vector data, and remove stale bindings when paints are deleted.
- Keep desktop text visible across scene and overlay canvases, refresh it after local fonts load, and preserve rendering when an italic face is unavailable. (#395).
- Vertically center text correctly when an explicit line height adds space above and below its glyphs. (#422).
- Preserve Hangul IME composition while editing text.
- Restore desktop copy, cut, and paste when browser clipboard events are unavailable.
- Finish pasting Figma layers promptly even when remote images are slow or unavailable, and hydrate their image fills when downloads complete.
- Reuse the existing tab when reopening a file through its desktop path or browser file handle, avoiding duplicate watchers and conflicting saves. (#297).
- Share public app links from the desktop collaboration panel and send the current document to newly joined collaborators.
- Show only the most specific tooltip when property controls contain nested actions.
- Match regional browser languages to supported locales without selecting a lower-priority language. (#417).
- Improve Simplified Chinese translations and correct localized menu terminology.
- Resolve published package types correctly for TypeScript consumers and keep file-backed CLI commands working under Node.

### Security

- Update the collaboration WebSocket dependency to address a protocol-length advisory.

## 0.13.2 — 2026-05-30

### Changed

- Update the Homebrew install command to use the published `openpencil` cask.

### Fixed

- Fix the published MCP package so global installs include the `openpencil-mcp` and `openpencil-mcp-http` launchers required by desktop app integrations.

## 0.13.1 — 2026-05-29

### Fixed

- Fix the npm package contents for the CLI so Bun installs include the built `openpencil` binary and runtime bundle.

## 0.13.0 — 2026-05-29

### Fixed

- Fix the published CLI package so Bun global installs run the built `openpencil` binary instead of raw TypeScript sources.

- Greatly improve importing Figma `.fig` files with complex component systems: badges, avatars, icons, links, input fields, lists, date pickers, nested instances, component swaps, and variant properties now open much closer to their original Figma appearance.
- Fix missing or white content in imported `.fig` files caused by unresolved Figma variable bindings, including image/avatar badges, icon colors, text colors, and variable-backed component overrides.
- Preserve more Figma document details when opening and saving `.fig` files, including internal component pages, component ordering, page metadata, canvas backgrounds, text layout, glyph rendering, vector geometry, effects, shadows, and instance overrides.
- Keep user edits after opening an imported `.fig` file: changing size, position, fills, text, or layout now wins over preserved Figma round-trip data when the document is saved again.
- Fix `.fig` exports so files reopened in Figma or OpenPencil keep their pages, components, instances, text wrapping, icons, avatars, and preview thumbnail intact.
- Fix live canvas updates during move/resize/edit previews so visible scene changes repaint immediately.
- Fix accidental duplicate creation when Alt-clicking without dragging.
- Fix MCP startup in the browser.
- Fix CanvasKit loading outside the browser when project paths contain spaces.
- Render imported Figma layer and fill blend modes such as multiply, screen, overlay, difference, hue, saturation, color, and luminosity.
- Render common imported Figma mask stacks so visible layers above alpha, vector, or luminance masks are clipped by the mask shape, including consecutive mask layers.
- Render Figma-style smoothed rectangle corners, including independent corner radii, and effect blend modes from imported Figma files.
- Improve imported tiled image fills by applying Figma image transforms when repeating image patterns.
- Keep imported Figma boolean operations editable as boolean-operation nodes instead of flattening them to vectors.
- Apply imported variable font axes from Figma `fontVariations` when rendering text.
- Render more imported Figma visual metadata, including text decoration styles, leading trim, pattern fills, layout grids, page guides, and deterministic fallbacks for raw noise effects.

### Performance

- Open large `.fig` files faster by deferring work for pages you have not viewed yet while still preparing all needed content before export.
- Improve canvas responsiveness during zooming, panning, dragging, and editing by reusing cached scene backing where safe.
- Speed up `.fig` export for documents with many preserved Figma paint and variable payloads.

## 0.12.2 — 2026-05-19

### Added

- Allow OpenRouter users to enter any model ID from provider settings with cached autocomplete suggestions for tool-capable models, while keeping the curated dropdown as the default when no custom model is set.

### Changed

- Use localized app tooltips instead of native browser titles across editor controls, panels, and menus.
- Update Claude Code MCP setup documentation and the docs landing screenshot.
- Ignore non-source Markdown files in the app dev watcher so documentation edits do not reload the running editor.

### Fixed

- Route Claude Code stdio MCP requests through the live OpenPencil app connection, including immediate disconnected errors when no document is connected.
- Keep MCP disconnected guidance focused on starting OpenPencil and opening a document.
- Improve agent-rendered JSX compatibility with Figma-style text, alignment, and rotation aliases; strip HTML comments; and report unsupported props from render tools.
- Load exact text font styles after MCP and AI tool mutations so newly created bold/weighted text renders immediately.
- Include text style fields in MCP `get_node` output so agents can verify generated text accurately.
- Keep provider settings tooltip/popover composition working in WebKit.

## 0.12.1 — 2026-05-19

### Fixed

- Fix `.fig` round-trips for OpenPencil component sets and variable bindings, and recompute imported layouts after opening documents.
- Report desktop/MCP package version mismatches explicitly and include package-manager-aware install guidance from the MCP server.
- Support scoped MCP `save_file({ path })` workflows while keeping file saving in the desktop app.
- Use native Tauri path handling for save parent directories so Unicode and Windows paths are handled correctly.
- Fix the web font picker so Google Fonts remain available in Safari, local font access is requested on first open when supported, font sources are labeled, and Google font previews load lazily for visible rows.
- Fix background blur rendering so it blurs the backdrop behind a layer instead of applying a no-op content filter, and keep effect parameter controls visible in the properties panel.

## 0.12.0 — 2026-05-18

### Added

- Assets panel — browse, search, and insert document components directly from the left sidebar.
- Component variants — switch instance variants from the right inspector; default variant respects property definitions.
- Figma library metadata — component keys, source libraries, version IDs, descriptions, and docs links are preserved on import/export.
- Desktop file associations — double-click `.fig` or `.pen` files in Finder/Explorer to open them in OpenPencil.
- Auto-update — startup update checks and a Check for Updates menu item on desktop.
- Light theme with theme-aware canvas rulers.
- PDF export — available in the export panel, CLI (`--format pdf`), and MCP.
- SVG import tool for automation workflows.
- DeepSeek AI provider.
- Variable modes — create, rename, duplicate, delete, and set defaults per collection.
- Variable binding controls for fills, strokes, sizing, min/max, and typography fields.
- Auto-layout inspector controls for min/max dimensions, auto gap, wrap gap, and two-axis padding.
- Stroke dash/gap controls.
- Font settings — local font access, fallback predownloads, and downloaded font cache management.
- Editor commands for frame selection, paste to replace, Boolean operations, flatten, outline text, and outline stroke.
- Boolean operations panel control and canvas context-menu entries for flattening and outlining supported selections.

### Changed

- Smaller domain modules across core, app, Vue SDK, CLI, MCP, docs, and desktop with enforced package boundaries.
- Separate scene and overlay canvas layers — rulers, labels, and selections no longer cause scene redraws.
- Shared menu schema between browser and native Tauri menus.
- Editor command metadata now drives shortcut display across browser menus, native menus, tooltips, and context menus.
- Text-to-vector conversion now uses shared loaded-font outline geometry across Boolean, flatten, and outline commands.

### Fixed

- Fix `.fig` export of component variant properties and text stretch alignment so designs round-trip correctly through Figma.
- Fix CJK and Arabic text rendering — fallback fonts now load before the first paint instead of showing blank text.
- Fix large `.fig` files freezing on open — parsing runs in a worker, and the viewport fits to content after loading.
- Improve Figma import fidelity — variable aliases, nested instances, avatar swaps, badge internals, and input text alignment are preserved.
- Improve Figma export fidelity — flipped vectors, stroke geometry, visual overflow, and stroked-shape drop shadows are preserved.
- Fix variant switching so instances update their contents, not just the component reference.
- Fix text editing inside components and instances on double-click.
- Fix paste into selected containers and entered frames.
- Fix clipboard parsing to safely ignore invalid data.
- Fix undo/redo for duplicate, state restore, and modifier-key release.
- Prevent browser from intercepting app-level undo/redo shortcuts.
- Fix font loading and bundled font resolution.
- Show the startup loader until fonts load and the first render completes.
- Improve light theme polish and canvas ruler colors.
- Normalize browser zoom speed.
- Fix variable picker popovers and color binding swatches.
- Fix dashed strokes on vector nodes and gradient fills on text.
- Fix inner shadow rendering on text nodes.
- Fix imported Figma-derived underlined text rendering.
- Fix exponential `.fig` file growth on repeated save/load cycles.
- Fix opening large `.fig` files so every page populates component instances, preventing missing nested content when switching pages.
- Fix canvas size badges scaling with zoom.
- Fix layout inspector dropdown anchoring and spacing/padding icon clarity.
- Fix section drawing and color input forwarding in the property panel.
- Fix asset insertion coordinates inside entered containers.
- Fix MCP stdio handshake and eval return values.
- Fix `@open-pencil/vue` npm imports referencing an unexported core subpath.
- Fix Figma clipboard text compatibility — pasted OpenPencil text keeps editable fixed bounds, line wrapping, baselines, glyph offsets, and Figma edit-mode layout.
- Fix local font matching so requested upright and weighted faces do not fall back to italic or regular faces.
- Fix CanvasKit paragraph rendering to preserve requested text weights and slants.
- Fix nested text editing interactions — drill double-click enters nested text edit mode, and clicking another text node switches edit targets while editing.
- Fix auto-height text edit commits so text bounds and undo state stay in sync.
- Fix Boolean, flatten, and outline operations to reject unsupported image/complex-script sources safely instead of silently dropping geometry.
- Fix outline stroke enablement for stroked descendants inside groups and containers.

### Performance

- Event-driven canvas rendering — scene and overlay layers only repaint when their inputs change, replacing continuous polling.
- Shared RAF scheduler coalesces scene and overlay frames into a single animation frame per editor.
- Font-family fallback arrays and downloaded remote fonts are cached to avoid repeated work.
- WebGL draw-call instrumentation only runs while the profiler is active.
- Instance override resolution is cached and `.fig` pages load lazily for large files.
- Live drag/resize uses repaint-only previews to skip layout during interaction.

## 0.11.8 — 2026-04-23

### Fixed

- Fix MCP server not spawning on Windows — use `cmd /c` to resolve `.cmd` wrappers from npm global installs.
- Fix MCP server and automation WebSocket not connecting on Windows/Linux — inline `__TAURI_INTERNALS__` check at call time instead of using stale module-level `IS_TAURI` constant.
- Fix shell PATH not inherited by GUI app on macOS/Linux — add `fix-path-env-rs` to read shell config.

## 0.11.7 — 2026-04-22

### Added

- Add stdio transport for MCP server — `openpencil-mcp` now works as a proper stdio MCP server for Claude Code, Cursor, etc. HTTP server available as `openpencil-mcp-http`.
- Default canvas background to dark when system prefers dark color scheme.
- Add `list_available_fonts` MCP tool for font discovery.
- Copy node ID / XPath from context menu; CLI selection command.
- Arrow key nudge for selected nodes (1px, Shift+arrow for 10px).
- JSX renderer: `position="absolute"`, `top`, `left` props for absolute children inside auto-layout containers.
- MCP server sends `notifications/tools/list_changed` when the desktop app connects or disconnects.
- Headless text measurement via opentype.js per-glyph advance widths — no CanvasKit needed.
- Add `open_file` and `new_document` MCP tools with `OPENPENCIL_MCP_ROOT` path scoping.
- Optional `path` param on `export_image`, `export_svg`, `get_jsx` — write output to disk instead of returning base64/string.
- Multi-root JSX support — multiple top-level elements auto-wrapped in a fragment.
- `Component` and `Instance` tag aliases in JSX renderer.
- JSX prop reference doc — copy to clipboard via book icon in Code panel.
- Prompts (`CODEGEN_PROMPT`, `JSX_REFERENCE`) moved from embedded strings to markdown files.

### Fixed

- Fix Backspace not deleting selected nodes after clicking on canvas — canvas now receives focus on click so keyboard shortcuts aren't blocked by stale input focus.
- Support Cmd/Ctrl+click for additive multi-select in layers panel (previously only Shift+click worked).
- Fix macOS Tauri build — move `NSAllowsLocalNetworking` ATS config from invalid `tauri.conf.json` property to a proper `Info.plist` file.
- Fix tab order and keyboard handling in inspector panel.
- Fix design token variables not resolved before passing to yoga-layout.
- Suppress keyboard shortcuts while editing property panel inputs.
- Fix tooltip competing with popover trigger on Windows.
- Fix hit area for nodes with rotated parents.
- Error toasts auto-dismiss, deduplicate, and cap stack at 5.
- Bump yoga-layout to 3.3.0-grid.3 with `Node.free()` support.
- Bump PWA precache limit for canvaskit-webgpu.
- Fix color picker dragging flooding the undo stack — fill/stroke/effect color and opacity drags now collapse into a single undo entry per interaction via debounced batching in `PropertyListRoot`.
- Fix .fig import crash on alias variables without a GUID.
- Fix `save_file` crash on vectors with missing tangent control points — default to straight segments.
- Validate `create_vector` path JSON upfront with clear error messages for malformed input.
- Fix MCP/AI tools rejecting string-encoded numeric arguments from MCP clients (`"42"` → `42`).
- Fix "Create Instance" context menu item always grayed out — inverted disabled flag.
- Show "Create Instance" instead of "Create Component" in context menu when a component is selected.
- Fix headless layout: use stored .fig dimensions instead of rough text size estimates (26K → 11K mismatches on material3.fig).
- Fix `--help` output with huge vertical gaps between commands — remove inline examples from query description.
- Fix `openpencil-mcp` npm package missing `dist/stdio.js` — explicitly list entry points in tsconfig.
- Show toast when MCP server fails to start instead of silently swallowing the error.
- Fix provider settings popover not appearing — tooltip wrapper broke floating-ui positioning.
- Fix `set_font_range` producing invalid style runs that crash `.fig` export — use `applyStyleToRange`, apply color and fontWeight from style name.
- Fix MCP "app not connected" error — message now instructs the agent to stop and inform the user.
- Fix external links in AI panel blocked by Tauri ACL — use opener plugin instead of shell.

## 0.11.6 — 2026-04-08

### Fixed

- Switch `@open-pencil/core` build from `tsgo` + `fix-esm-import-path` to `tsdown` — fixes bare directory imports that broke Node.js and Bun consumers.

## 0.11.5 — 2026-04-08

### Fixed

- Fix published npm packages resolving to TypeScript source instead of compiled JavaScript — `publishConfig.exports` overrides are now applied during CI publish.
- Fix Windows CI build failures caused by backslash file paths in custom lint rules.

## 0.11.4 — 2026-04-08

### Fixed

- Fix `@open-pencil/core` published package containing stale import paths from before the domain module restructuring — CLI and MCP installs from npm now resolve correctly.
- Add `save_file` MCP tool for saving the current document to disk.
- Clipboard text export now writes richer v4 `derivedTextData` payloads with glyph outlines for better paste fidelity.

## 0.11.3 — 2026-04-08

### Fixed

- Show actionable install errors in the chat panel when a required local AI CLI is missing.
- Fix inline layer rename so clearing the name restores the default name, and Backspace/Delete inside rename inputs no longer delete the layer.
- Fix rotated frame hit testing, hover highlights, and selection overlays so interactive areas and overlay labels stay aligned during rotation.
- Fix text edit undo so it restores both the original text and `styleRuns`.
- Pressing Enter with a selected text node now starts text editing and selects all text.
- Fix `ScrubInput` Enter handling so committing a value no longer triggers a second blur-based commit that overwrites it.
- Show the auto-layout panel for `COMPONENT`, `COMPONENT_SET`, and `INSTANCE` nodes.
- Fix missing layout direction icons in the auto-layout controls.
- Fix nested text selection inside gradient cards.
- Unify the size control into a single inline sizing input/dropdown with shorter localized labels to prevent overflow.

## 0.11.2 — 2026-03-30

### Fixed

- Stabilize npm publishing with isolated temp publish directories instead of mutating tracked package manifests in CI.
- Strip build-time scripts and dev dependencies from generated publish manifests so tarballs pack from verified artifacts only.
- Fix `@open-pencil/mcp` release packaging so the published npm tarball includes its built `dist/` CLI and server entrypoints deterministically.
- Fix `@open-pencil/core` release build configuration so CI publish jobs include Node and Bun ambient types when compiling package artifacts.

## 0.11.1 — 2026-03-30

### Fixed

- Fix npm publishing pipeline to publish packed tarballs instead of raw package folders.
- Attempt to fix `@open-pencil/mcp` npm package contents so the published CLI includes its built `dist/` entrypoints.
- Fix `@open-pencil/vue` npm package metadata and build output so the published package resolves from `dist/` while local workspace development keeps using source aliases.

## 0.11.0 — 2026-03-30

### Added

- Lock and visibility toggle buttons in layers panel (hover to reveal, always shown when active).
- Figma-style selection scope — double-click to enter groups/frames/components, Escape to exit.
- Nested container navigation — each double-click goes one level deeper.
- Dashed border around entered container for visual feedback.
- Layer panel click syncs canvas scope automatically.
- Vue SDK internationalization primitives — `useI18n()`, locale detection, persisted locale selection, lazy-loaded locale JSON files, and exported locale metadata for custom editor shells.
- Vue SDK docs and public API audit — documented advanced exports (`useOkHCL()`, variables helpers, viewport and locale APIs), aligned docs with the actual `provideEditor()` injection model, and expanded release-ready SDK guidance.
- npm release pipeline now publishes `@open-pencil/core`, `@open-pencil/cli`, `@open-pencil/mcp`, and `@open-pencil/vue` together on version tags.
- App language picker in the menu bar — switch UI locale without reloading.
- Added a vector curve editor and improved drawing experience with the pen tool.
- Resume pen drawing from existing open path endpoints — click an endpoint to continue the curve.
- Close open paths by dragging one endpoint to the other.
- Align selected anchor points relative to each other in vector edit mode — the standard alignment buttons in the position panel now operate on selected vertices when 2 or more are selected.
- Unified core IO format registry — `.fig` is now modeled as the native document format alongside shared export adapters for PNG, JPG, WEBP, SVG, and JSX.
- Export selection or current page as `.fig` from the app export UI and app menu.
- New CLI commands: `open-pencil convert` for document conversion, `open-pencil formats` to inspect readable/writable/exportable formats, and `open-pencil lint` for design consistency, structure, and accessibility checks.
- CLI export now supports `.fig` output and routes PNG/JPG/WEBP/SVG/JSX/`.fig` through the shared IO layer.
- `Open…` now supports `.pen` Pencil documents through the shared document reader pipeline while keeping `.fig` as the native save format.
- Display‑P3 document color space pipeline — documents now default to Display‑P3, `.fig` import/export preserves document color profiles, the live canvas requests P3 surfaces with sRGB fallback, and raster/SVG export paths accept explicit color-space targets.
- Color picker overhaul — unified `RGB` / `HSL` / `HSB` / `OkHCL` field formats, slider-space-aware track/thumb previews, and better neutral-color editing behavior for fills, strokes, gradient stops, and component fills.
- OkHCL metadata now round-trips through `.fig` plugin data and integrates directly into the main fill/stroke color workflow with preview gamut diagnostics.
- Vue SDK now exposes reusable color-picker model helpers and solid fill/stroke commit helpers for custom editor shells.
- Update built-in Z.ai and MiniMax model lists — Z.ai now uses the Anthropic-compatible endpoint for GLM coding models, adds GLM-5.1, and MiniMax adds M2.7 / M2.7-highspeed.
- Arabic and RTL support across text rendering, editing, layout, export, and AI tooling — text nodes support `Auto`/`LTR`/`RTL`, auto-layout frames support `Auto`/`LTR`/`RTL` flow, and JSX/AI prompts/tools can now generate and edit both explicitly.

### Fixed

- Fix shortcuts, now work on non-English keyboard layouts.
- Fix imported `.fig` file open and page-switch regressions — loaded documents now keep graph/store state in sync, remap imported canvas/page children correctly, and recompute imported auto-layout descendants when switching pages.
- Fix first canvas render happening before fonts load — wait for fonts before the initial draw to avoid Safari and text measurement glitches.
- Preserve `fig-kiwi` version on `.fig` roundtrip — imports keep the original header version instead of rewriting everything to a hardcoded value; new files default to version 101.
- Normalize auto-layout text export for Figma — text children inside auto-layout frames now serialize with `NONE` auto-resize to match Figma behavior and avoid overflow on reimport.
- Fix keyboard editing regressions after the refactor — canvas shortcuts no longer fire while editing text, and Delete/Backspace no longer delete nodes during text entry.
- Fix MCP page switching persistence — `switch_page` now survives across tool calls in the same session.
- Improve CJK font fallback coverage — load multiple Google Fonts for broader Han/Japanese/Korean text support.
- Normalize more visible UI strings for localized app chrome — menus, panels, variables dialog, code panel, chat setup, and editor controls now respect the selected locale instead of falling back to English in common flows.
- Fix imported text rendering in browser and headless export — preserve stored bounds until fonts are ready, restore missing font-loaded guards, use natural width for `WIDTH_AND_HEIGHT` text, and clip text to node bounds.
- Fix browser/headless rendering mismatch for imported toolbar/instance content by correcting runtime imported layout recomputation instead of diverging browser rendering behavior.
- Fix `set_layout` tool not defaulting to HUG sizing when enabling auto-layout — frames now shrink/grow to fit children instead of keeping fixed dimensions.
- Normalize font family names on `.fig` export — strip optical size suffixes (e.g. "DM Sans 9pt" → "DM Sans") so Figma recognizes the font.
- TEXT nodes now default to a solid black fill — previously exported with no fill, making text invisible when opened in Figma.
- Fix save crash when COLOR variable is missing alpha channel.
- Fix console error spam on deployed web app from automation WebSocket reconnect loop.
- Fix headless CLI font fallback — bundled Inter font now ships with `@open-pencil/core` and loads without a web server.
- Locked nodes now block move, resize, rotate, and delete on canvas.
- Locked containers block double-click enter.
- Marquee selection skips locked and hidden nodes.
- COMPONENT/INSTANCE containers are now enterable via double-click.
- Replaced the alignment and reflection icons with the correct ones.

## 0.10.0 — 2026-03-15

### Added

- ACP agent support — use Claude Code, Codex, or Gemini CLI as AI assistants in the desktop chat panel.
- Permission confirmation dialog — ACP agents request user approval for file/shell operations, MCP design tools auto-approved.
- Unified MCP server — single HTTP + WebSocket proxy replaces Vite SSR bridge.
- Stock photo integration — `stock_photo` tool fetches images from Pexels or Unsplash and applies to design nodes. Provider adapter supports custom providers.
- Skeleton-first AI workflow — 4-phase design process (plan → skeleton → content fill via `replace_id` → polish) for more reliable AI-generated layouts.
- Batched AI tools — `calc` accepts arrays of expressions, `stock_photo` fetches all images in parallel, `batch_update` applies multiple property changes in one call, `describe` accepts `ids` array for multi-node inspection.
- AI visual feedback — blue pulsing border on nodes being modified, green flash on completion.
- Auto-depth `describe` — adapts inspection depth to subtree size (small block → deeper, large page → shallower).
- `set_fill` gradient support — linear gradients with `color_end` and `gradient` direction params.
- `render` tool `replace_id` — atomically swap skeleton placeholders with real content.
- MCP `export_image_file` tool for headless PNG rendering.
- Grid layout in AI chat — JSX renderer supports `grid`, `columns`, `rows`, `gap` props.
- Configurable max output tokens in AI provider settings (default 16384).
- Z.ai AI provider with GLM-5, GLM-4.7, GLM-4.6, GLM-4.5 model families.
- MiniMax AI provider with M2.5, M2.1, M2 models.

### Fixed

- Resolve variable-bound fill colors through alias chains.
- Fix SCALE constraint resizing for auto-layout instances.
- Propagate SCALE constraints through instance clone chains.
- Skip self-referencing symbolOverrides on nodes with explicit kiwi properties.
- Fix DSD resolution for swapped instance children.
- Fix instance swap override propagation through clone chains.
- Fix component property override resolution through clone chains.
- Fix text/property overrides clobbered by second transitive sync.

- Fix text rendering with wrong fonts on file open — all font weights (including default family) are now loaded before the first render.
- Fix `weightToStyle` mapping: weight 400 now correctly maps to "Regular" instead of "Medium".
- Fix detached ArrayBuffer crash when switching pages after saving — export worker now copies image buffers before transferring.
- Show warning toast when fonts fail to load, error toast when file open fails.
- Fix FillPicker crash when selecting image fills (missing `ref` import from #92).
- Fix Google Fonts TLS/network errors not cached — failed families no longer retry on every render.
- Fix CJK text garbled when font is unavailable — fallback now renders through paragraph shaper instead of raw `drawText`, preserving CJK characters via the fallback font chain.
- Fix auto-layout overflow in AI-generated designs — text wrapping, min/max constraints, absolute positioning, and FILL sizing now work correctly.
- Fix `layoutAlignSelf` limited to STRETCH — full range supported (CENTER, MAX, MIN, BASELINE).
- Fix hidden auto-layout children losing their dimensions on layout recompute.
- Fix ProviderSettings popover not visible in AI chat.
- Fix paste/copy/cut intercepted by canvas in AI chat input.
- Strip TypeScript casts from AI-generated JSX (`as any`, `as const`).
- Fix parsing complex .fig files crashing on missing GUIDs in component overrides.
- Fix headless text layout using 100×100 default size instead of estimated dimensions — multi-line wrapping now estimated correctly.
- Fix clipboard roundtrip losing properties — clipsContent, constraints, arcData, strokeCap/Join, layoutAlignSelf, textAutoResize, autoRename now preserved in Figma Kiwi serialization.
- Fix MCP headless export crashing on `window.queryLocalFonts` in non-browser runtimes (Bun/Node).
- Fix MCP `export_image` rendering blank text — fonts now loaded before rasterization.
- Fix text always using paragraph rendering with Inter fallback chain (no more missing-font garbling).
- Clip children to rounded corners when `clipsContent` is true.
- Use child shape for drop shadows on transparent containers.
- Treat `FOREGROUND_BLUR` as layer blur wrapping children.
- Fix radial, angular, and diamond gradient rendering.
- Fix .fig export roundtrip: variable GUIDs colliding with document.
- Fix file open dialog not working on first click in Safari.
- Skip variable fonts from local font access, use Google Fonts instead.
- Disable autosave by default.

### Performance

- Offload .fig parsing (unzip + Kiwi decode) to a Web Worker — main thread stays responsive during file open.
- Offload .fig compression to a Web Worker during save (was blocking 450ms+).
- Add instance index (`componentId → Set<nodeId>`) — `getInstances()` is O(1) instead of scanning all nodes.
- Defer graph event subscription until after layout computation during file open — eliminates redundant `syncInstances` calls.
- Cache label collection (sections/components) per scene mutation instead of walking the full tree every frame.
- Blocking font loading — fonts load before first render to ensure correct glyphs.

## 0.9.0 — 2026-03-09

### Added

- XPath query command — `open-pencil query design.fig "//FRAME[@width < 300]"` to find nodes by type, attributes, and tree structure using XPath selectors.
- CSS Grid layout mode — select a frame, click the grid icon in the auto layout toolbar to switch from flex to grid. Configure column/row tracks (fr, fixed px, auto), column and row gaps, and per-side padding. Powered by a [Yoga fork](https://github.com/open-pencil/yoga/tree/grid) with cherry-picked CSS Grid PRs from upstream.
- JSX and Tailwind CSS export for grid layouts — `grid grid-cols-N`, `gap-x-*`/`gap-y-*`, child `col-start-*`/`row-start-*`/`col-span-*`/`row-span-*`.
- Multi-provider AI support — connect to Anthropic, OpenAI, Google AI, or any OpenAI-compatible endpoint directly, in addition to OpenRouter. Per-provider API key storage, provider settings popover, automatic migration from single OpenRouter key.
- Anthropic-compatible provider for custom API endpoints.
- New AI tools: `get_jsx` (JSX roundtrip view), `diff_jsx` (structural diff), `describe` (semantic role, visual style, layout, design issues).
- AI visual verification — `export_image` returns image content to the model for vision-based review.
- API type toggle (Completions/Responses) for OpenAI-compatible providers.
- Figma zoom shortcuts — ⌘0 (100%), ⌘1 (zoom to fit), ⌘2 (zoom to selection), ⇧1/⇧2 alternatives.
- XPath query tool — `query_nodes` for AI/MCP with attribute selectors, tree traversal, and type filtering.

### Changed

- Padding on a frame auto-enables vertical auto-layout.
- AI tools run `computeAllLayouts` after execution — layout updates immediately.
- Enhanced AI system prompt with full JSX prop reference and verification workflow.
- Chat panel preserves messages when toggling UI visibility.
- SceneGraph event bus (nanoevents) — `node:created`, `node:updated`, `node:deleted`, `node:reparented`, `node:reordered` events replace monkey-patching in collab sync and manual render invalidation.
- Replace esbuild-wasm (14 MB) with sucrase (201 KB) for JSX transform — `buildComponent()` and `renderJSX()` now synchronous and browser-compatible.
- `useMagicKeys` keyboard shortcut system — replaces tinykeys with VueUse built-in, cross-platform Meta/Control handling, modifier exclusion for combo conflicts.
- Dev-only debug toolbar for copying chat logs.
- Auto-layout icons in layer tree — vertical (rows), horizontal (columns), and grid icons for auto-layout frames; components keep their purple diamond.
- Frame titles on canvas are now draggable — clicking a selected top-level frame's name label starts a drag.
- Compact layout controls — icon-based gap (↔/↕) and padding (T/R/B/L) inputs instead of text labels.
- Auto-detect horizontal vs vertical direction when wrapping in auto layout (Shift+A).
- Fix alignment grid for vertical layouts — visual positions now match spatial axes.
- Fix grid switch from HUG-sized frames — frame expands to fit children.
- Remove unwanted white fill when wrapping in auto layout.

### Fixed

- Serialize variables, collections, and bindings to `.fig` files — previously lost on save (#65).
- Text nodes created via MCP now render in Figma — emit `derivedTextData` with font metadata and layout size (#64).
- Double-click on layer tree no longer toggles expand/collapse — use the chevron instead.
- Page rename input matches layer rename styling.
- Fix `w="fill"`/`h="fill"` in JSX renderer — now direction-aware based on parent flex axis.
- Fix text auto-resize defaulting to fixed 100×100 — text without explicit width uses `WIDTH_AND_HEIGHT`.
- Fix `clipsContent` not propagated to Yoga — frames with clip enabled now set `Overflow.Hidden`.
- Fix `COUNTER_ALIGN_MAP` mapping stretch to `MIN` instead of `STRETCH`.
- Fix JSX export omitting x/y for absolute-positioned children.
- Fix JSX export ignoring `textAutoResize` for text sizing.
- Fix drag terminating on mouseleave — drags now continue outside the canvas.
- Fix `export_image` stack overflow on large nodes — chunked base64 encoding.
- Undo support for auto-layout reorder, layer tree reorder, and drag reparent.
- Page snapshot undo for AI tool mutations.
- Fix collab sync for same-parent reorder — `node:reordered` events now propagated to Yjs peers.
- Fix orphaned instances on clipboard paste — detach to FRAME when component is missing.
- Fix text typography lost on Figma clipboard import — preserve fontFamily, fontWeight, fontSize, lineHeight.
- Fix `copyFill` missing `gradientTransform` and `imageTransform` — gradient fills now round-trip correctly.

### Performance

- Event-driven rendering and component sync — `SceneGraph` emits typed events on mutations; `requestRender()` calls reduced from 94 to 22, component instance sync uses microtask batching with deduplication.
- Replace `structuredClone` with typed copy helpers for fills, strokes, effects, and style runs (~24× faster in hot paths).
- Filter .fig unzip to only decompress canvas and image entries, skipping metadata cruft.

## 0.8.0 — 2026-03-07

### Added

- Mobile layout & PWA — responsive editor with touch-optimized toolbar, swipeable bottom drawer (layers/properties/design/code), HUD overlay, and installable PWA with icons and service worker.
- Tailwind CSS v4 JSX export — export selections as HTML with Tailwind utility classes (`<div className="flex gap-4 p-3">`) from the Code panel, CLI (`bun open-pencil export --format jsx --style tailwind`), or programmatically via `sceneNodeToJSX(id, graph, 'tailwind')`. Supports layout, sizing, colors, border radius, opacity, rotation, overflow, shadows, blur, and typography. Uses v4 spacing semantics (px/4 multiplier) with automatic fallback to arbitrary values.
- Code panel format toggle — switch between OpenPencil (custom components) and Tailwind (HTML + utility classes) output.
- Homebrew tap — `brew install open-pencil/tap/open-pencil` for macOS (arm64 + x64), auto-updated on each release.
- Double-click to rename layers — inline rename in layer panel, shared `useInlineRename` composable.
- New AI/MCP tools: `analyze_colors`, `analyze_typography`, `analyze_spacing`, `analyze_clusters`, `diff_create`, `diff_show`, `get_components`, `get_current_page`, `arrange`, `node_to_component`.
- CLI-to-app RPC bridge — all CLI commands work against the running app when no file is specified. Start the app, then run `bun open-pencil tree` to inspect the live document.
- VitePress docs site — user guide, reference, architecture, and development docs at openpencil.dev with 6 locales (en, de, fr, es, it, pl), SEO (OG tags, hreflang, JSON-LD, sitemap), and dark theme.

### Changed

- Refactor mobile drawer tabs, layout sizing dropdowns, and inline rename to use Reka UI primitives.
- Add shared UI style helpers with tailwind-variants for menus, selects, buttons, and surfaces.
- Unified tool definitions — define once in `packages/core/src/tools/`, automatically available in AI chat, CLI, and MCP.
- Harden FigmaAPI — hide internals via Symbols, freeze arrays, fix `layoutSizing`, 30+ new properties and methods.
- Split tools into domain files (read, create, modify, structure, variables, vector, analyze) — easier to navigate and extend.
- Replace inline type definitions with named types (`Color`, `Vector`, `SceneNode`) across the codebase.
- Split 3200-line `renderer.ts` into `packages/core/src/renderer/` with 10 focused files (scene, overlays, fills, strokes, shapes, effects, rulers, labels).
- Centralize all color utilities in `packages/core/src/color.ts` — `colorToHex8`, `colorToCSSCompact`, `normalizeColor`, `colorDistance`; remove 5 duplicate implementations across the codebase.
- Add `geometry.ts` with shared rotation math (`degToRad`, `radToDeg`, `rotatePoint`, `rotatedCorners`, `rotatedBBox`).
- Extract `isArrayMixed()` helper for multi-selection property panels.

- Add `motion-v` for declarative animations — used in mobile drawer (spring-animated height with pan gestures) and toolbar (layout-animated category switching with directional slide transitions).
- Mobile drawer: replace `useSwipe` + manual rAF animation with `motion.div` `:animate` + `@pan`/`@panEnd`; always-on tab state (no more null `activeRibbonTab`); content stays rendered when closed.
- Mobile toolbar: replace manual `scrollWidth` measuring + inline CSS transitions with `motion.div layout` + `AnimatePresence` directional slide variants.
- Mobile UI cleanup: extract shared `colorToCSS` util to core, `initials` to `src/utils/text`, `toolIcons` to `src/utils/tools`; replace hand-rolled dropdowns with reka-ui Popover/DropdownMenu; narrow `mobileDrawerSnap` type to string union; move magic numbers to constants; disable PWA service worker in dev mode.
- 83 new E2E tests (57 → 140): design panel, code panel, components, copy/paste, multi-page, text editing, keyboard shortcuts, context menu.
- 150 new unit tests (588 → 738): color, undo, snap, vector, style-runs, text-editor.
- 48 new E2E tests (9 spec files) + 26 mutation unit tests + store/canvas test helpers.
- Add `data-test-id` attributes to AppearanceSection, LayoutSection, TypographySection, VariablesDialog, EditorView.

### Fixed

- Fix drawer animation jump on close — single spring transition instead of two-phase.
- Fix `ALL_TOOLS` registry missing newer tools (`analyzeColors`, `diffCreate`, `exportImage`, `arrangeNodes`).
- Fix `renderJSX` typo in tool definitions (`renderJsx` → `renderJSX`).
- Fix all oxlint warnings and tsgo errors — replace `!` non-null assertions in `use-collab.ts` with local const captures.
- Fix broken test imports — stale `../../src/engine/` paths updated to `@open-pencil/core`.
- Fix flaky E2E tests: layers panel navigates to `/demo`, zoom-to-fit test zooms in first, snapshot rendering stabilized with `workers: 1` and `colorScheme: dark`.
- Fix bogus .fig import mappings for `expanded` and `strokeMiterLimit` fields.
- Fix PWA manifest error in dev mode, handle invalid font data gracefully.
- Fix eval response unwrapping and `export_jsx` page selection in RPC bridge.
- Fix automation commands not recomputing layouts after mutations.
- Fix workspace dependency not resolved when installing from npm (switch CI to pnpm publish).

## 0.7.0 — 2026-03-05

### Added

- SVG export — export selections as SVG from the export panel, context menu, CLI (`bun open-pencil export --format svg`), or MCP/AI tools (`export_svg`). Supports rectangles, ellipses, lines, stars, polygons, vectors, text with style runs, gradients, image fills, effects, blend modes, clip paths, and nested groups (#46).
- Copy/Paste as submenu in context menu — Copy as text, Copy as SVG, Copy as PNG (⇧⌘C), Copy as JSX.
- Stroke align (Inside/Center/Outside) with clip-based rendering matching Figma behavior.
- Individual stroke weights per side (Top/Right/Bottom/Left) with side selector dropdown.
- Google Fonts fallback — automatically loads fonts from Google Fonts API when not available locally.
- Auto-save toggle in File menu — disable to prevent automatic writes to the opened .fig file.
- Renderer profiler with in-canvas HUD overlay, GPU timing, and phase instrumentation.

### Changed

- Replace custom color picker with Reka UI Color components (ColorArea, ColorSlider, ColorField) — adds keyboard navigation and accessibility to the color area, hue, and alpha controls.

### Fixed

- CJK text rendering — load a system CJK font (PingFang SC, Microsoft YaHei, Noto Sans CJK) as fallback; falls back to Noto Sans SC from Google Fonts when no system font is available (#48).
- Font registration errors no longer cache invalid font data — `loadFont` only caches after successful CanvasKit registration.
- Fix `render` tool failing on Windows + Bun with "Cannot find module" error (#43).
- Fix hover highlighting nodes from internal component pages — scope hit-test to current page.
- Fix hit-testing on transparent frames and groups — empty containers without fills or strokes are now click-through, clipping parents reject hits outside their bounds, matching Figma behavior.
- Fix instance overrides on .fig import and clipboard paste — resolve guidPaths by overrideKey, handle component swaps (`overriddenSymbolID`), propagate through nested clone chains. Import and paste now share a single override engine.
- Apply Figma component property assignments on import — boolean visibility toggles and instance swaps via `componentPropRefs`/`componentPropAssignments`.
- Apply `derivedSymbolData` sizes on import — containers now shrink correctly when component properties hide children.
- Fix override resolution for nested instance targets — check the current node before searching descendants.
- Fix component property assignments for nested instances — resolve scoped `componentPropAssignments` inside `symbolOverrides` via guidPath, handle `guidValue` for instance swaps, reorder phases so transitive sync doesn't clobber visibility.
- Pixel-perfect vector rendering using pre-computed `fillGeometry`/`strokeGeometry` blobs from .fig files — eliminates white gaps between adjacent stroked shapes.
- Stroke outlines on clipboard paste — convert vectorNetwork paths to filled outlines via CanvasKit when geometry blobs are unavailable.
- Apply `derivedSymbolData` transforms and geometry during import — instance children render at correct scale and position.
- Fix internal pages becoming visible after .fig round-trip — preserve `internalOnly` flag on export.
- Scope layout recomputation to current page for paste/undo/font-load (major speedup on large multi-page files).
- Show loading overlay until all document fonts are loaded (no more partially rendered text).
- Load fonts when switching pages (previously only loaded for the first page).
- Always show visibility toggle on fill, stroke, and effect rows (matches Figma).
- Fix renderer crash on double destroy when closing files quickly.
- Fix .fig page ordering — use deterministic byte comparison for fractional index positions.
- Fix text truncation using `textTruncation` field instead of `textAutoResize`.
- Fix horizontal scrollbar on design and pages panels.
- Style scrollbars for Tauri (thin dark overlay instead of default OS chrome).
- Enable file watcher in Tauri — `watch` feature was missing from `tauri-plugin-fs`.

## 0.6.0 — 2026-03-04

### Added

- Multi-selection properties panel — edit position, size, appearance, fill, stroke, and effects across multiple selected nodes.
- Shared values display normally, differing values show "Mixed".
- W/H inputs in multi-selection mode.
- Flip horizontal/vertical using scale transform instead of rotation.
- Single-node alignment aligns to parent frame bounds.
- ACP agent package — Agent Communication Protocol server for AI coding tools, reusing core ToolDefs.

### Changed

- Apple code signing and notarization for macOS builds.
- Git LFS storage moved from GitHub to Cloudflare R2.

### Fixed

- Fix Figma clipboard paste: extract shared kiwi→SceneNode conversion, fixing broken auto-layout, missing gradient/image fills, effects, style runs, and text properties.
- Fix vector rendering on paste — scale path coordinates from Figma's normalizedSize to actual node bounds.
- Fix pasted instances having no children — populate from component via symbolData when both are in clipboard.
- Detect component sets on import — promote FRAME nodes with VARIANT componentPropDefs to COMPONENT_SET.
- Skip internal canvas on paste — components on Figma's hidden internal page populate instances but are not pasted as visible nodes.
- Apply instance overrides on paste — text content, fills, visibility, layoutGrow, and textAutoResize from symbolOverrides.
- Fix auto-layout child ordering — sort by geometric position instead of z-order position strings.
- Load fonts on paste and .fig import — collect font families from text nodes and load into CanvasKit.
- Text measurement in auto-layout — use CanvasKit paragraph metrics for WIDTH_AND_HEIGHT text nodes.
- Recompute layouts after font loading completes.
- Fix PERCENT line height conversion — was stored as raw value instead of pixels.
- Fix InvalidCharacterError when copying nodes with non-ASCII text.
- Load all font weight/style variants needed by pasted text nodes.
- Fix font loading not registering in core cache.
- Fix halfLeading applied to text measurement — enable only for rendering.
- Clear hover on zoom/pinch to keep scene picture cache valid.
- Fix flip buttons using rotation math instead of actual mirroring.
- Fix flip transform encoding — scale first matrix column only (was incorrectly producing 180° rotation).
- Decode flip state from .fig transform matrix on import.

## 0.5.1 — 2026-03-03

### Fixed

- Fix File → Save crash when document has layer blur effects.

## 0.5.0 — 2026-03-03

### Added

- Effects rendering: drop shadow, inner shadow, shadow spread, layer blur, background blur, foreground blur.
- Text shadows render on glyphs instead of bounding box.
- Multi-file tabs — open multiple documents in tabs within a single window.
- Tab bar with close buttons, middle-click to close, and new tab (+) button.
- Keyboard shortcuts: ⌘N/⌘T new tab, ⌘W close tab, ⌘O opens in new tab.
- Native Tauri menu: File → New and File → Close Tab wired to tab actions.
- Render text from SkPicture cache when fonts are missing — pixel-perfect display without the font installed.
- Missing font indicator (⚠) next to font picker in the sidebar.
- Right-click context menu on layers panel — same actions as the canvas context menu.
- 40+ new AI/MCP tools ported from figma-use:
  - Granular set tools: `set_rotation`, `set_opacity`, `set_radius`, `set_minmax`, `set_text`, `set_font`, `set_font_range`, `set_text_resize`, `set_visible`, `set_blend`, `set_locked`, `set_stroke_align`
  - Node operations: `node_bounds`, `node_move`, `node_resize`, `node_ancestors`, `node_children`, `node_tree`, `node_bindings`, `node_replace_with`
  - Variable CRUD: `get_variable`, `find_variables`, `create_variable`, `set_variable`, `delete_variable`, `bind_variable`
  - Collection CRUD: `get_collection`, `create_collection`, `delete_collection`
  - Boolean operations: `boolean_union`, `boolean_subtract`, `boolean_intersect`, `boolean_exclude`
  - Vector path tools: `path_get`, `path_set`, `path_scale`, `path_flip`, `path_move`
  - Create tools: `create_page`, `create_vector`, `create_slice`
  - Viewport: `viewport_get`, `viewport_set`, `viewport_zoom_to_fit`, `page_bounds`
  - Misc: `flatten_nodes`, `list_fonts`
- `set_text_properties` tool: alignment, auto-resize, decoration.
- `set_layout_child` tool: sizing, grow, align_self, positioning.
- 13 MCP server integration tests via `InMemoryTransport`.

### Changed

- Resizable pages/layers split in left panel with reka-ui Splitter.
- Layers tree auto-expands and scrolls to reveal selected node.
- Loading overlay on canvas while opening .fig files.
- Hide internal-only pages (e.g. "Internal Only Canvas" in design systems).
- Render page dividers — pages named with only dashes/asterisks/spaces show as horizontal lines.
- Only show component labels for COMPONENT and COMPONENT_SET, not instances.
- Replace all native `<select>` dropdowns with reka-ui `AppSelect` component.
- Smoother trackpad pinch-to-zoom with `Math.exp` curve and deltaMode normalization.
- Fix font picker dropdown truncating long font names.
- Show explanation in font picker when Local Font Access API unavailable (Safari/Firefox).

- Auto-populate GitHub Release notes from CHANGELOG.md via `ffurrer2/extract-release-notes@v2`.
- Skip already-published npm versions on CI re-runs instead of failing.
- Exclude non-app directories from Vite file watcher.

- Extract shared color constants (`BLACK`, `TRANSPARENT`, `DEFAULT_SHADOW_COLOR`) — replaces 8 inline literals across core.
- Extract shared `NodeContextMenuContent` component to avoid menu duplication.
- Fix `@open-pencil/core` dep in MCP package: `workspace:*` for local dev (pnpm resolves at publish time).
- Replace store thunks with a late-binding proxy.

- Clipboard roundtrip tests: encode to Figma Kiwi binary → decode → verify.
- 9 visual regression snapshot tests for effects rendering.
- Zoom/pan E2E tests and pipeline benchmark.
- MCP server edge-case tests for `find_nodes` and Zod validation.
- 6 unit tests for absolute position cache.

### Fixed

- Fix drop shadow rendering on top of fills — shadow now draws behind opaque content.
- Fix effect property changes not recorded in undo/redo history.
- Fix active tab text invisible against same-color background.
- Fix clipboard "Outside int range" error — `pasteID` used unsigned int exceeding Kiwi's signed 32-bit field.
- Error toasts are now sticky (don't auto-dismiss), with selectable text, copy button, and close button.
- Truncate long node names in export button.

### Performance

- Per-node SkPicture cache for effect rendering — unchanged shadow/blur nodes replay from cache on scene redraws.
- Drop shadows use `MaskFilter` direct draw instead of `saveLayer` offscreen buffers.
- Cached `ImageFilter`, `MaskFilter`, reusable effect paint — zero per-frame WASM allocations for effects.
- Reuse GL context on panel resize — swap surface without recreating renderer, preserving all caches.
- Per-frame absolute position cache — avoids repeated parent-chain walks during rendering.
- Optimize zoom/pan smoothness with `shallowReactive`, `useRafFn`, and input coalescing.

## 0.4.2 — 2026-03-02

### Changed

- Import additional properties from Figma clipboard: `layoutAlignSelf`, `clipsContent`, `fontWeight`, `italic`, `letterSpacing`, `lineHeight`.
- Convert `letterSpacing` PERCENT units to pixels based on font size.

- 7 new clipboard import unit tests (14 total).

### Fixed

- Fix Figma clipboard paste: skip non-visual node types (variables, widgets, stickies, connectors).
- Fix text not rendering after paste — `letterSpacing` from Figma is a `{value, units}` object, was passed as-is → `NaN` broke CanvasKit paragraph layout.
- Fix undo/redo for Figma paste — no undo entry was recorded; redo duplicated `childIds`.
- Center pasted Figma content in viewport instead of using original coordinates.
- Compute auto-layouts after clipboard paste (same as .fig import and demo creation).

## 0.4.1 — 2026-03-02

### Changed

- Highlight copy & paste with Figma in README and feature docs.
- Replace "fig-kiwi" format name with "Kiwi binary" — the format is shared between .fig files and clipboard.

### Fixed

- Fix text disappearing after hover when SkPicture cache was recorded before fonts loaded.
- Invalidate scene picture cache on font load to prevent stale fallback text.

## 0.4.0 — 2026-03-02

### Added

- MCP server (`@open-pencil/mcp`) — 29 tools for headless .fig editing via stdio (Claude Code, Cursor, Windsurf) or HTTP (Hono + Streamable HTTP with sessions).
- `openpencil-mcp` and `openpencil-mcp-http` binaries — install globally via `bun add -g @open-pencil/mcp`.

### Changed

- All packages emit JS via tsgo + fix-esm-import-path — `@open-pencil/core` and `@open-pencil/mcp` work on Node.js without Bun.
- Core package exports: `bun` condition → src (dev), `import` condition → dist (npm consumers).
- `@open-pencil/mcp` added to CI publish workflow.

## 0.3.2 — 2026-03-02

### Changed

- Visual regression tests for SkPicture cache: hover on/off cycle, multiple cycles, mouse hover, scene change + hover.
- Type `window.__OPEN_PENCIL_STORE__` globally, remove ad-hoc casts from tests.

### Performance

- Re-apply SkPicture scene caching for ~7x faster pan/zoom (0.98ms vs 6.8ms per frame at 500 nodes).

## 0.3.1 — 2026-03-02

### Fixed

- Fix text disappearing after hovering a frame (revert SkPicture scene caching).
- Fix macOS startup hang: async font loading, show window on reopen.

## 0.3.0 — 2026-03-01

### Fixed

- Fix npm publish: use pnpm for workspace dependency resolution with provenance.
- CLI version now reads from package.json instead of hardcoded value.
- Update README: accurate app size (~7 MB), streamlined feature list, current project structure.

### Performance

- SkPicture scene caching — pan/zoom replays cached display list instead of re-rendering all nodes.
- Cache vector network paths — avoid rebuilding WASM paths every frame.
- Cache ruler and pen overlay paints — eliminate 10 WASM Paint allocations per frame.
- Only enable `preserveDrawingBuffer` in test mode.
- Hoist URL param parsing out of render loop.

## 0.2.1 — 2026-03-01

### Changed

- Panel header with app logo, editable document name, and sidebar toggle.
- ⌘\\ to toggle side panels for distraction-free canvas.
- Panels hidden by default on mobile (< 768px).
- Floating bar with logo, filename, and restore button when panels hidden.
- Always show local user avatar in collab header.
- Touch support for pan and pinch-zoom on iOS.

### Performance

- Stubbed shiki to remove 9MB of unused language grammars (20MB → 11MB bundle).

## 0.2.0 — 2026-03-01

### Added

- Real-time P2P collaboration via Trystero (WebRTC) + Yjs CRDT.
- Peer-to-peer sync — no server relay, zero hosting cost.
- WebRTC signaling via MQTT public brokers.
- STUN (Google, Cloudflare) + TURN (Open Relay) for NAT traversal.
- Awareness protocol: live cursors, selections, presence.
- Figma-style colored cursor arrows with name pills.
- Click peer avatar to follow their viewport, click again to stop.
- Stale cursor cleanup on peer disconnect.
- Local persistence via y-indexeddb — room survives page refresh.
- Share link at `/share/<room-id>` with vue-router.
- Secure room IDs via `crypto.getRandomValues()`.
- Removed Cloudflare Durable Object relay server (`packages/collab/`).

### Changed

- Toast notifications via Reka UI Toast — top-center blue pill for info, red for errors.
- Global error handler (window.error + unhandledrejection) shows errors as toasts.
- Link copied toast on share and copy link actions.
- HsvColorArea extracted as shared component (ColorPicker + FillPicker).
- Scrollable app menu without visible scrollbar.
- Selection broadcasting to remote peers.

## 0.1.0-alpha — 2026-03-01

First public alpha. The editor is functional but not production-ready.

### Added

- Canvas rendering via CanvasKit (Skia WASM) on WebGL surface.
- Rectangle, Ellipse, Line, Polygon, Star drawing tools.
- Pen tool with vector network model (bezier curves, open/closed paths).
- Inline text editing on canvas with phantom textarea for input/IME.
- Rich text formatting: bold, italic, underline per-character via style runs.
- Font picker with system font enumeration (font-kit on desktop, Local Font Access API in browser).
- Auto-layout via Yoga WASM (direction, gap, padding, justify, align, child sizing).
- Components, instances, component sets with live sync and override preservation.
- Variables with collections, modes, color bindings, alias chains.
- Undo/redo for all operations (inverse-command pattern).
- Snap guides with rotation-aware edge/center snapping.
- Canvas rulers with selection range badges.
- Marquee selection, multi-select, resize handles, rotation.
- Group/ungroup, z-order, visibility, lock.
- Sections with title pills and auto-adoption of overlapping nodes.
- Multi-page documents with independent viewport state.
- Hover highlight following node geometry (ellipses, rounded rects, vectors).
- Context menu with clipboard, z-order, grouping, component, and visibility actions.
- Color picker with HSV, gradients (linear, radial, angular, diamond), image fills.
- Properties panel: position, appearance, fill, stroke, effects, typography, layout, export.
- ScrubInput drag-to-change number controls.
- Resizable side panels via reka-ui Splitter.

- .fig file import via Kiwi binary codec (194 definitions, ~390 fields).
- .fig file export with Kiwi encoding, Zstd compression, thumbnail generation.
- Figma clipboard: copy/paste between OpenPencil and Figma.
- Round-trip fidelity for supported node types.

- Built-in AI chat in properties panel (⌘J).
- Direct browser → OpenRouter communication, no backend.
- Model selector: Claude, Gemini, GPT, DeepSeek, Qwen, Kimi, Llama.
- 10 AI tools: create_shape, set_fill, set_stroke, update_node, set_layout, delete_node, select_nodes, get_page_tree, get_selection, rename_node.
- Streaming markdown responses (vue-stream-markdown).
- Tool call timeline with collapsible details.

- JSX export of selected nodes with Tailwind-like shorthand props.
- Syntax highlighting via Prism.js.
- Copy to clipboard.

- `info` — document stats, node types, fonts.
- `tree` — visual node tree.
- `find` — search by name/type.
- `export` — render to PNG/JPG/WEBP at any scale.
- `node` — detailed properties by ID.
- `pages` — list pages with node counts.
- `variables` — list design variables and collections.
- `eval` — run scripts with Figma-compatible plugin API.
- `analyze colors` — color palette usage.
- `analyze typography` — font/size/weight distribution.
- `analyze spacing` — gap/padding values.
- `analyze clusters` — repeated patterns.
- All commands support `--json`.

- Scene graph with flat Map storage and parentIndex tree.
- FigmaAPI with ~65% Figma plugin API compatibility.
- JSX renderer (TreeNode builder functions with shorthand props).
- Kiwi binary codec (encode/decode).
- Vector network blob encoder/decoder.

- Tauri v2 (~5 MB).
- Native menu bar, save/open dialogs.
- System font enumeration via font-kit.
- Zstd compression in Rust.
- macOS and Windows builds via GitHub Actions.

- Runs at [app.openpencil.dev](https://app.openpencil.dev).
- No installation required.
- File System Access API for save/open (Chrome/Edge), download fallback elsewhere.

- [openpencil.dev](https://openpencil.dev) — VitePress site with user guide, reference, and development docs.
- Deployed via Cloudflare Pages.
