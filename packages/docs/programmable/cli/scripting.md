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

Figma's `node.setBoundVariable(field, variable)` binds with Figma's field names and type rules. Use `openpencil.bindVariable(node, field, variable)` to bind a layer field to a variable from `figma.variables` the way the layer panel does, and `openpencil.unbindVariable(node, field)` to let it go; the field keeps the value the variable last gave it. Fields use OpenPencil's names, such as `text`, `visible`, `opacity`, `paddingLeft` or `fills/0/color`. Bindings follow the layer panel, which takes more than Figma's `setBoundVariable`: text content takes a text or number variable, a number shown as text, and visibility a boolean or a text variable that shows the layer unless it is empty or reads `false`, `no` or `off`.

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
- `figma.group(nodes, parent)`
- `figma.ungroup(node)`

### Components

- `figma.createComponentFromNode(node)`
- `figma.combineAsVariants(components, parent)` — properties come from names such as `State=On, Size=Large`
- On a component set, `addComponentProperty(name, 'VARIANT', value)` appends the value to every variant's name and `editComponentProperty(name, { name })` renames the property in them, which instances follow; renaming a variant updates the set's values, and `variantProperties` reads a variant's or an instance's values
- `component.createInstance()`
- `instance.mainComponent`

### Variables

- `figma.variables.getLocalVariables(type?)`, `getVariableById(id)`, `getLocalVariableCollections()`, `getVariableCollectionById(id)`, and their `…Async` forms
- `figma.variables.createVariableCollection(name)` and `createVariable(name, collection, resolvedType)`, which starts every mode at Figma's default
- `figma.variables.createVariableAlias(variable)` and `setBoundVariableForPaint(paint, 'color', variable)`
- `variable.setValueForMode(modeId, value)`, `valuesByMode`, `resolveForConsumer(node)`, `name`, `description`, `scopes`, `codeSyntax`, and `remove()`
- `collection.addMode(name)`, `renameMode(modeId, name)`, `removeMode(modeId)`, `modes`, `defaultModeId`, `variableIds`, and `remove()`
- `node.boundVariables`, `node.setBoundVariable(field, variable)`, `node.setExplicitVariableModeForCollection(collection, modeId)`, and `node.clearExplicitVariableModeForCollection(collection)`

### Properties

Common node properties are readable/writable through the proxy, including:

- Geometry: `x`, `y`, `width`, `height`, `rotation`, `resize(width, height)`
- Appearance: `fills`, `strokes`, `effects`, `opacity`, `visible`, `locked`, `blendMode`, `clipsContent`. Paints take Figma's shape here, on page `backgrounds`, text ranges, and vector regions: a solid `color` is RGB with its alpha in `opacity`, and an image names `scaleMode`, `rotation`, and `scalingFactor`; a paint Figma refuses throws Figma's message
- Radius: `cornerRadius`, `topLeftRadius`, `topRightRadius`, `bottomRightRadius`, `bottomLeftRadius`
- Text: `characters`, `fontSize`, `fontName` (with `variationSettings`, every axis of a variable font), `fontWeight` (a variable font's `wght`), `fills`, `letterSpacing`, `lineHeight`, and `textDecoration`, which read `figma.mixed` while characters differ and restyle every character when set, and alignment
- Text ranges: `getStyledTextSegments(fields, start?, end?)`, and `getRange…` / `setRange…` for `FontSize`, `FontName`, `Fills`, `LetterSpacing`, `LineHeight`, `TextDecoration` with its `Style`, `Offset`, `Thickness`, `Color`, and `SkipInk`, `TextCase`, `Hyperlink` (a `{ type: 'URL' | 'NODE', value }` link, or `null`), `TextStyleId` and `FillStyleId` (set with `setRangeTextStyleIdAsync` and `setRangeFillStyleIdAsync`, which give the range the style's fields), and `getRangeBoundVariable` / `setRangeBoundVariable` for the text fields Figma binds, plus `getRangeFontWeight`, `getRangeAllFontNames`, and `getRangeOpenTypeFeatures`. Line height and letter spacing keep the unit they are set in, pixels or a percent of the font size that follows the size, as in Figma; other lengths read in pixels, and a percent given to their setters is of the font size
- Text lists and paragraphs: `getRangeListOptions` / `setRangeListOptions` for bulleted (`UNORDERED`) and numbered (`ORDERED`) items, `getRangeIndentation` / `setRangeIndentation` for nesting (1–5 for list items), `listSpacing`, `paragraphSpacing`, and `paragraphIndent` for the whole text (`figma.mixed` when paragraphs differ) or per paragraph with `getRangeListSpacing` / `setRangeListSpacing`, `getRangeParagraphSpacing` / `setRangeParagraphSpacing`, and `getRangeParagraphIndent` / `setRangeParagraphIndent`, and `hangingList`
- Auto-layout: `layoutMode`, `primaryAxisAlignItems`, `counterAxisAlignItems`, `itemSpacing`, padding, sizing, and layout positioning fields
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

- `node.exportAsync()`
- `figma.util.normalizeMarkdown()`, which fails because OpenPencil has no rich-text descriptions or annotations to normalize for
- Library variables, extended collections, and variable bindings on effects and layout grids
- Figma style APIs such as `figma.createPaintStyle()` / `figma.createTextStyle()`
- Full vector boolean operation parity

Use OpenPencil CLI export commands, core tools, or direct scene-graph helpers where available.
