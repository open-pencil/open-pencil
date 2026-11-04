---
title: Scripting
description: Execute JavaScript with a Figma-compatible Plugin API to query, batch-modify, and generate designs.
---

# Scripting

`openpencil eval` runs JavaScript against an OpenPencil document with a Figma-compatible `figma` global. Use it for headless batch edits, inspection, fixture setup, and automation without opening the editor UI.

## Basic usage

```sh
openpencil eval design.fig -c "return figma.currentPage.children.length"
```

The `-c` flag accepts JavaScript. Its last expression is the result, so `return` is optional; `await` works at the top level. A script whose last statement is not an expression, such as a declaration, has no result and prints nothing.

```sh
openpencil eval design.fig -c "
  const frame = figma.createFrame()
  frame.name = 'Card'
  frame.resize(300, 200)
  frame.layoutMode = 'VERTICAL'
  frame.itemSpacing = 12
  return { id: frame.id, name: frame.name }
"
```

## Variable formulas

Use `openpencil.setVariableFormula(collectionName, variableName, source, modeName?)` to replace a variable's definition with a formula. It validates before changing the document and returns the resolved value. Omitting the mode name edits the collection's default mode.

```js
openpencil.setVariableFormula('Spacing', 'large', '{base} * 2')
openpencil.setVariableFormula('State', 'visible', '{viewport} > 1024 and not {loading}')
openpencil.setVariableFormula('Copy', 'greeting', 'if({compact}, "Hi", "Hello, " + {name})')
```

References use variable names or `{Collection::variable}` and are stored as stable IDs. Formulas use stored units, so lengths are in pixels. See [Variables](/user-guide/variables) for operators and export limitations.

## Variable bindings

Figma's `node.setBoundVariable(field, variable)` binds with Figma's field names and type rules. Use `openpencil.bindVariable(node, field, variable)` to bind a layer field to a variable from `figma.variables` the way the layer panel does, and `openpencil.unbindVariable(node, field)` to let it go; the field keeps the value the variable last gave it. Fields use OpenPencil's names, such as `text`, `visible`, `opacity`, `paddingLeft`, `fills/0/color` or `effects/0/radius`. Bindings follow the layer panel, which takes more than Figma's `setBoundVariable`: text content takes a text or number variable, a number shown as text, and visibility a boolean or a text variable that shows the layer unless it is empty or reads `false`, `no` or `off`.

```js
const [price] = figma.variables.getLocalVariables('FLOAT')
const label = figma.currentPage.findOne((node) => node.name === 'Price')
openpencil.bindVariable(label, 'text', price)
```

## Query nodes

```sh
openpencil eval design.fig -c "
  return figma.currentPage
    .findAll((node) => node.type === 'FRAME' && node.name.includes('Button'))
    .map((button) => ({
      id: button.id,
      name: button.name,
      width: button.width,
      height: button.height
    }))
"
```

## Modify and save

Use `--write` / `-w` to write changes back to the input file:

```sh
openpencil eval design.fig -c "
  figma.currentPage.children.forEach((node) => {
    node.opacity = 0.5
  })
" --write
```

Use `--output` / `-o` to write to a new file:

```sh
openpencil eval design.fig -c "figma.currentPage.name = 'Updated'" -o updated.fig
```

## Read scripts from stdin

```sh
cat transform.js | openpencil eval design.fig --stdin --write
```

## Live app mode

Omit the file path to run against the currently open document in the desktop app:

```sh
openpencil eval -c "return figma.currentPage.name"
```

The desktop app must be running with a document open.

## Output

By default, non-TTY output is JSON. Use `--json` to force JSON output:

```sh
openpencil eval design.fig -c "return figma.currentPage.children.map((n) => n.name)" --json
```

Use `--quiet` / `-q` to suppress output when only writing a file.

## The `openpencil` API

Next to `figma`, scripts get `openpencil`: what OpenPencil adds to the Figma Plugin API, in the same style. The same global is available to the `eval` tool and the running app's automation.

A main component or component set can [behave as a Reka UI control](/user-guide/components#behaviours-and-preview). Bind it by its own property and slot names:

```sh
openpencil eval design.fig -w -c '
  const set = figma.currentPage.findOne((n) => n.type === "COMPONENT_SET" && n.name === "Switch")
  const behaviour = openpencil.setBehaviour(set, "switch")
    .bindValue("value", "State")                          // On and Off guessed from the variants
    .bindPart("thumb", set.findOne((n) => n.name === "Thumb")) // the frame becomes a slot
  behaviour.states = "Interaction"
  behaviour.missing
'
```

- `openpencil.setBehaviour(node, kindOrSpec)` replaces a component's behaviour: a kind alone, or a spec such as `{ kind: "slider", parts: { track: "Track", thumb: "Thumb" }, numbers: { value: { min: 0, max: 10 } } }`. It returns the behaviour.
- `openpencil.getBehaviour(node)` reads one, or `null`; a variant reads its set's.
- A behaviour has `kind`, `spec` (by name), `missing` (required values and parts still unbound), and `states`, and `bindValue(valueId, property, { on, off })`, `bindPart(partId, slotNameOrFrame)`, `setNumber(valueId, { min, max, step, default })`, and `remove()`.
- `openpencil.behaviourKinds` lists every kind with the values and parts it binds.
- `openpencil.createSlot(frame)` makes a frame of a main component a slot and returns its name.

Names the component does not have fail with an error that lists the ones it has.

`openpencil.setTextMarkdown(text, markdown)` sets a text layer's text from Markdown, styled over the layer's own style as FigJam styles Markdown typed into a text: `#` and `##` headings bold at 2.5× and 1.5× its size, deeper ones bold at its size, `**bold**`, `*italic*`, `~~strike~~`, `` `code` `` in Roboto Mono, links, lists, and quotes. Load the fonts it uses first, as for `characters`; an unloaded one fails with the font to load. Over MCP, `set_text` takes `markdown: true` for the same.

```sh
openpencil eval design.fig -w -c '
  const text = figma.currentPage.findOne((n) => n.type === "TEXT" && n.name === "Notes")
  await figma.loadFontAsync({ family: "Inter", style: "Bold" })
  openpencil.setTextMarkdown(text, "## Next\n- **Ship** the beta\n- Write the post")
'
```

Comments people leave with the Comment tool are part of the document, so scripts and agents can read the feedback on a file, act on it, and answer:

```sh
openpencil eval design.fig -w -c '
  for (const comment of openpencil.getComments({ resolved: false })) {
    console.log(comment.author, comment.node?.name, comment.text)
    comment.reply("Bumped the title to 24px", { author: "Claude" }).resolve()
  }
'
```

- `openpencil.getComments(filter)` lists threads oldest first: all of them, or `{ resolved: false }` for open ones, `{ page }` for one page's, `{ author }` for those a person started or replied to.
- `openpencil.addComment(text, { node, page, x, y, author })` pins a comment on a layer, which it follows, or at a point of a page; the current page by default. `author` is `"Agent"` when left out.
- A comment has `id`, `text` (Markdown), `author`, `createdAt`, `resolved`, `page`, `node` (the top-level layer it is pinned to), `position`, and `replies`, and `reply(text, { author })`, `resolve()`, `reopen()`, and `remove()`. `openpencil.getComment(id)` finds one.

Statuses mark where a section, frame, component, or instance stands, from the document's own list such as Draft, In review, or Ready for dev:

```sh
openpencil eval design.fig -w -c '
  const checkout = figma.currentPage.findOne(n => n.name === "Checkout")
  openpencil.setStatus(checkout, "Approved")
  openpencil.statuses.map(status => status.name)
'
```

- `openpencil.statuses` lists the document's statuses in order, each with `name`, `color` (`#RRGGBB`), and `figma`, the status Figma shows for it (`READY_FOR_DEV`, `COMPLETED`, or `null`).
- `openpencil.getStatus(node)` reads the name of the status a layer shows, or `null`, also while a section around it shows its own.
- `openpencil.setStatus(node, name)` sets one by name, and `null` clears it. Only sections, frames, components, component sets, and instances directly on a page or in a section take one; anything else fails with an error that says why, and an unknown name lists the statuses there are.

Layer features Figma's API has no member for:

- `openpencil.getLayoutDirection(node)` / `setLayoutDirection(node, direction)` and `getTextDirection(node)` / `setTextDirection(node, direction)` read and set which way an auto layout or a text runs: `AUTO`, `LTR`, or `RTL`.
- `openpencil.getFillOkHCL(node, index?)` / `setFillOkHCL(node, color, index?)` and the `Stroke` pair read and set a paint's color in OkHCL, `{ h, c, l, a? }`; its RGB follows in the document's color space.
- `openpencil.exposeInstanceSwap(instances, candidates, name?)` exposes swapping those instances as one instance swap property offering the candidate components, and returns the layer that holds it.
- `openpencil.getFontStatus()` reports whether the current page's fonts are available: the faces asked for, where each loaded from, substitutions, and the layers affected.

## Supported API surface

The API is intentionally close to Figma's Plugin API, but it maps to OpenPencil's scene graph and file format.

### Document and pages

- `figma.root`
- `figma.currentPage`
- `figma.currentPage.selection`
- `figma.getNodeById(id)`
- `figma.createPage()`

### Node creation

- `figma.createFrame()`
- `figma.createRectangle()`
- `figma.createEllipse()`
- `figma.createText()`
- `figma.createLine()`
- `figma.createPolygon()`
- `figma.createStar()`
- `figma.createVector()`
- `figma.createNodeFromSvg(svg)`
- `figma.createComponent()`
- `figma.createSection()`

### Tree operations

- `node.children`
- `node.parent`
- `node.appendChild(child)`
- `node.insertChild(index, child)`
- `node.clone()`
- `node.remove()`
- `node.findAll(callback?)`
- `node.findOne(callback)`
- `node.findChild(callback)`
- `node.findChildren(callback?)`
- `node.getTopLevelFrame()` — the frame, group, section, component, or instance the node sits in directly under its page or section
- `figma.group(nodes, parent)`
- `figma.ungroup(node)`

### Components

- `figma.createComponentFromNode(node)`
- `figma.combineAsVariants(components, parent)` — properties come from names such as `State=On, Size=Large`
- On a component set, `addComponentProperty(name, 'VARIANT', value)` appends the value to every variant's name and `editComponentProperty(name, { name })` renames the property in them, which instances follow; renaming a variant updates the set's values, and `variantProperties` reads a variant's or an instance's values
- `component.createInstance()`, `component.instances`, and `component.getInstancesAsync()`
- `description` on components and component sets
- `set.defaultVariant`, the first variant reading the set across each row and then down, and `set.variantGroupProperties`
- `instance.mainComponent`
- `instance.removeOverrides()` (and its deprecated name `resetOverrides()`)

### Variables

- `figma.variables.getLocalVariables(type?)`, `getVariableById(id)`, `getLocalVariableCollections()`, `getVariableCollectionById(id)`, and their `…Async` forms
- `figma.variables.createVariableCollection(name)` and `createVariable(name, collection, resolvedType)`, which starts every mode at Figma's default
- `figma.variables.createVariableAlias(variable)`, `setBoundVariableForPaint(paint, 'color', variable)`, and `setBoundVariableForEffect(effect, field, variable)`, which binds a shadow's `color`, `radius`, `spread`, `offsetX`, or `offsetY`, or a blur's `radius`
- `variable.setValueForMode(modeId, value)`, `valuesByMode`, `resolveForConsumer(node)`, `name`, `description`, `scopes`, `codeSyntax`, and `remove()`
- `collection.addMode(name)`, `renameMode(modeId, name)`, `removeMode(modeId)`, `modes`, `defaultModeId`, `variableIds`, and `remove()`
- `node.boundVariables`, `node.setBoundVariable(field, variable)`, `node.setExplicitVariableModeForCollection(collection, modeId)`, and `node.clearExplicitVariableModeForCollection(collection)`

### Styles

- `figma.createPaintStyle()`, `createTextStyle()`, `createEffectStyle()`, and `createGridStyle()`, kept on the document's internal page as Figma keeps them
- `figma.getLocalPaintStyles()`, `getLocalTextStyles()`, `getLocalEffectStyles()`, `getLocalGridStyles()`, their `…Async` forms, and `figma.getStyleById(id)` / `getStyleByIdAsync(id)`
- `style.name`, `description`, `key`, `paints`, `effects`, `layoutGrids`, a text style's font, size, spacing, case, and decoration, `getStyleConsumersAsync()`, and `remove()`; a change to a style reaches every layer and text range that uses it, and removing it leaves them its values
- `fillStyleId`, `strokeStyleId`, `effectStyleId`, `gridStyleId`, and `textStyleId` with their `set…StyleIdAsync` setters, on the layers Figma has them on; setting one gives the layer the style's values, an empty ID takes the style off, and a style the document does not hold is refused

### Export

- `node.exportAsync(settings?)` on layers and pages writes `PNG` and `JPG` (sized by a `SCALE`, `WIDTH`, or `HEIGHT` constraint, cropped to the layer's box with `useAbsoluteBounds`), `SVG` as bytes, `SVG_STRING` as a string (with layer names as element ids when `svgIdAttribute` is set), and `PDF`. PNG and JPG need a renderer: the desktop app, the browser app, and `open-pencil eval` have one. SVG text stays `<text>` whatever `svgOutlineText` says, colour profiles are not applied, and `contentsOnly: false` exports the layer alone. A hidden or empty layer is refused with `The layer draws nothing to export`, where Figma exports a 1×1 image. OpenPencil also refuses an image at less than 0.01 or more than 1024 times the layer's size, or larger than 8192 by 8192 pixels. `JSON_REST_V1` and video formats are refused
- `node.exportSettings` reads and sets the exports a layer keeps, with Figma's options and defaults; exports in formats Figma has no setting for, such as WebP or PowerPoint, are left out

### Geometry

- `node.fillGeometry` and `node.strokeGeometry` on shapes, text, frames, components, instances, and boolean operations give Figma's `VectorPaths` in the layer's own box. `fillGeometry` is the outline of the layer's shape whatever its fills, and empty for lines and open vectors. `strokeGeometry` is the band every visible stroke covers, centred on the edge and twice the weight wide for inside and outside strokes, with dashes and per-side weights. It covers the same area as Figma's, though Figma writes a stroke as a piece per edge and corner where OpenPencil writes its outline
- `node.outlineStroke()` adds the layer's stroke as a vector filled with the stroke's paints, named `<name> (Stroke)` (a group of glyph vectors for text), at the end of the page at the layer's position in its parent, as Figma does, and keeps the layer. It returns `null` without a visible stroke
- These measure with a renderer: the canvas's in the desktop and browser apps, and a headless one in `open-pencil eval`. Before a document's canvas is ready, or on a host without a renderer, they throw `This host has no renderer to measure geometry with`

### CSS

- `node.getCSSAsync()` resolves to the CSS OpenPencil's HTML export writes for a layer, as a record of property names and values: its size, auto layout and its place in its parent's, its fills as `background-color` and `background-image` (gradients, and colours stacked above another fill, top first), borders, corner radius, effects, and for text its font and colour. Like the HTML export, it leaves out diamond gradients, draws a rotated elliptical radial gradient unrotated, since CSS cannot turn one, and leaves out an image fill, which the export draws as an `<img>` element that covers any fill above it. Bound variables are written as the custom properties of OpenPencil's token stylesheet, such as `var(--color-brand-primary)`. A hidden layer gives the CSS it would show, and pages and the document give `{}`. The values describe the same layer as Figma's Dev Mode, but are not written in its exact format

### Properties

Common node properties are readable/writable through the proxy, including:

- Geometry: `x`, `y`, `width`, `height`, `rotation`, `resize(width, height)`
- Appearance: `fills`, `strokes` (also set with `setFillsAsync` and `setStrokesAsync`), `effects`, `opacity`, `visible`, `locked`, `blendMode`, `clipsContent`. Paints take Figma's shape here, on page `backgrounds`, text ranges, and vector regions: a solid `color` is RGB with its alpha in `opacity`, and an image names `scaleMode`, `rotation`, and `scalingFactor`; a paint Figma refuses throws Figma's message
- Radius: `cornerRadius`, `topLeftRadius`, `topRightRadius`, `bottomRightRadius`, `bottomLeftRadius`
- Text: `characters`, `fontSize`, `fontName` (with `variationSettings`, every axis of a variable font), `fontWeight` (a variable font's `wght`), `fills`, `letterSpacing`, `lineHeight`, and `textDecoration` with its `textDecorationStyle`, `textDecorationOffset`, `textDecorationThickness`, `textDecorationColor`, and `textDecorationSkipInk` (null without an underline), which read `figma.mixed` while characters differ and restyle every character when set, `openTypeFeatures`, `leadingTrim`, and alignment
- Text ranges: `getStyledTextSegments(fields, start?, end?)`, and `getRange…` / `setRange…` for `FontSize`, `FontName`, `Fills`, `LetterSpacing`, `LineHeight`, `TextDecoration` with its `Style`, `Offset`, `Thickness`, `Color`, and `SkipInk`, `TextCase`, `Hyperlink` (a `{ type: 'URL' | 'NODE', value }` link, or `null`), `TextStyleId` and `FillStyleId` (set with `setRangeTextStyleIdAsync` and `setRangeFillStyleIdAsync`, which give the range the style's fields), and `getRangeBoundVariable` / `setRangeBoundVariable` for the text fields Figma binds, plus `getRangeFontWeight`, `getRangeAllFontNames`, and `getRangeOpenTypeFeatures`. Line height and letter spacing keep the unit they are set in, pixels or a percent of the font size that follows the size, as in Figma; other lengths read in pixels, and a percent given to their setters is of the font size
- Text lists and paragraphs: `getRangeListOptions` / `setRangeListOptions` for bulleted (`UNORDERED`) and numbered (`ORDERED`) items, `getRangeIndentation` / `setRangeIndentation` for nesting (1–5 for list items), `listSpacing`, `paragraphSpacing`, and `paragraphIndent` for the whole text (`figma.mixed` when paragraphs differ) or per paragraph with `getRangeListSpacing` / `setRangeListSpacing`, `getRangeParagraphSpacing` / `setRangeParagraphSpacing`, and `getRangeParagraphIndent` / `setRangeParagraphIndent`, and `hangingList`
- Auto-layout: `layoutMode`, `primaryAxisAlignItems`, `counterAxisAlignItems`, `itemSpacing`, padding (including Figma's deprecated `horizontalPadding` and `verticalPadding`), sizing, and layout positioning fields
- Guides: `guides` on pages and frames, as `{ axis: 'X' | 'Y', offset }`
- Shapes: `pointCount`, a star's `innerRadius`, an ellipse's `arcData`, and a boolean's `booleanOperation`
- Document: `figma.root.documentColorProfile`
- Stroke helpers: `strokeWeight`, `strokeAlign`, `dashPattern`
- Status: `devStatus` on sections, frames, components, component sets, and instances directly on a page or in a section, as `{ type: 'READY_FOR_DEV' | 'COMPLETED' }` or `null` (a description is not kept); it reads `null` while the layer sits where it cannot show one

### Utilities

- `figma.mixed`
- `figma.util.rgb(color)`, `figma.util.rgba(color, alphaOverride?)`, and `figma.util.solidPaint(color, overrides?)` read a hex or CSS color string (`rgb()`, `hsl()`, `lab()`, `oklab()`, `oklch()`, `color(display-p3 …)`, or a name), clipped to sRGB, or an `{ r, g, b, a? }` object with channels from 0 to 1; `solidPaint` takes its color and opacity from `color` and its other properties from `overrides`, such as an existing paint
- `figma.createImage(data)` takes a PNG, JPEG, or GIF up to 4096 pixels a side and gives Figma's `Image`: its `hash`, `getBytesAsync()`, and `getSizeAsync()`; `figma.getImageByHash(hash)` gives a stored image back
- `figma.createImageAsync(url)` loads an `http(s)://` URL or a data URI. The desktop app fetches through its native proxy, as Figma fetches through its servers; in the browser, the image's host must allow cross-origin requests
- `figma.loadFontAsync(fontName)` loads the font so text measures and draws with it; a family named without a style loads every style it has, and a variable family its named styles too. A font that cannot load rejects with Figma's `The font "Family Style" could not be loaded`
- As in Figma, an edit that lays text out again throws `Cannot write to node with unloaded font` until every font the text uses is loaded: `characters`, `insertCharacters`, `deleteCharacters`, `fontSize`, spacing, case, decoration, alignment, `textAutoResize`, truncation, and the matching `setRange…` methods. A new `fontName` has to be loaded too, but it replaces the text's own, so text in a missing font can take a loaded one. Paints, links, size, and transforms need no font
- `figma.getFontFamilyVariationAxes(family)` lists a variable family's axis tags, or `null` for a static one; unlike Figma, the family has to be loaded first
- A font set with `variationSettings` and no style, through `fontName` or `setRangeFontName`, takes the nearest named style, and an axis the family lacks throws Figma's error
- `figma.listAvailableFontsAsync()` returns host-provided fonts when available
- `figma.getNodeByIdAsync(id)` and `instance.getMainComponentAsync()` resolve to the same nodes as `figma.getNodeById(id)` and `instance.mainComponent`, for scripts written for Figma's dynamic-page mode
- `figma.setCurrentPageAsync(page)` switches pages as setting `figma.currentPage` does, and `page.loadAsync()` resolves at once because every page is already loaded, for scripts written for Figma's dynamic-page mode
- `figma.notify(message)` logs a warning in headless mode
- `figma.closePlugin(message?)` and `figma.loadAllPagesAsync()` let a script written as a Figma plugin run: nothing needs closing or loading, and `closePlugin` passes its message to `figma.notify`. Figma refuses every call after `closePlugin` while a script here keeps running, so follow it with `return` as Figma's docs do
- `instance.swapComponent(component)` points an instance at another component
- A layer inside an instance refuses `x`, `y`, `rotation`, `relativeTransform`, `constraints`, `isMask`, and `maskType` with Figma's error, such as `in set_x: This property cannot be overridden in an instance: relative-transform`; those always follow the component. Slot content keeps them, and setting one on a slot's default content makes the instance own the slot
- `component.createSlot()` adds a slot frame and its `SLOT` property; slot frames read `type: 'SLOT'`, `resetSlot()` brings back an instance slot's component content, and `limitViolations` lists the limits an instance slot breaks. `addComponentProperty` and `editComponentProperty` take a `description` and, for slots, `slotSettings`
- `figma.viewport`

## Not yet Figma-compatible

These Figma APIs are not exposed as compatible helpers yet:

- `figma.util.normalizeMarkdown()`, which fails because OpenPencil has no rich-text descriptions or annotations to normalize for
- Library variables, extended collections, and variable bindings on layout grids
- Full vector boolean operation parity

Use OpenPencil CLI export commands, core tools, or direct scene-graph helpers where available.
