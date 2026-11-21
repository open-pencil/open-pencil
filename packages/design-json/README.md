# @open-pencil/design-json

A design's layers as JSON, with everything the document knows about them. `designToJSON(graph, nodeIds, options)` writes:

- `layers`: every field the design keeps for each layer, its children nested, its box on the canvas (`worldBounds`), and `computed`: the variable mode it is in for each collection, the values its variables resolve to there, and the IDs of the comment threads pinned to it.
- `components`: the main components of the instances among the layers, and those their own instances use.
- `styles`: the shared styles the layers use (fill, stroke, text, effect, grid), by the style ID they link them by.
- `variables` and `variableCollections`: the variables the layers, components, and styles use, those they alias, and their collections.
- `images`: the images their paints draw, by hash.
- `comments`: every comment thread in the document, with its replies, resolved and deleted ones included.
- `document`: the root ID, kind, color space, pages (the internal page shared styles live on included), and enabled libraries; with `figSchema: true`, also the Kiwi schema of the `.fig` file it was read from, which describes the file format rather than the design.

```ts
import { designToJSON } from '@open-pencil/design-json'

const json = designToJSON(graph, [...selectedIds], {
  omit: ['fillGeometry', 'strokeGeometry'],
  bytes: 'length',
  images: 'summary',
  transform: (layer) => (layer.visible === false ? null : layer)
})
```

| Option | Default | What it does |
| --- | --- | --- |
| `pick` | all fields | The fields each layer keeps; `id`, `type`, and `name` always stay. |
| `omit` | none | Fields each layer leaves out, after `pick`; `computed` and `worldBounds` count as fields. |
| `depth` | unlimited | Levels of children nested; `0` writes the layers alone, with their `childIds`. |
| `bytes` | `'base64'` | Bytes (path geometry, text pictures, the `.fig` schema) as `{ byteLength, base64 }`, `{ byteLength }`, or left out. |
| `images` | `'data-url'` | Images with a data URL, with their type and size alone, or left out. |
| `worldBounds` | `true` | Adds each layer's axis-aligned box on the canvas. |
| `computed` | `true` | Adds each layer's variable modes, resolved variable values, and pinned comment threads. |
| `references` | `true` | Fills `components`, `styles`, `variables`, `variableCollections`, and `images`. |
| `comments` | `true` | Fills `comments`. |
| `figSchema` | `false` | Adds the `.fig` file's Kiwi schema to `document`. |
| `transform` | none | Rewrites each layer after its children; `null` leaves it out. |

The output is plain JSON, so `JSON.stringify` writes it as is. Its `format` and `version` fields name the shape; a change to it raises `version`.

What the renderer works out on its own, such as where text breaks into lines, is not in the document and so not in the JSON; the glyphs a `.fig` file saved are, in `derivedTextGlyphs`.

## Tokens

Both views carry `tokens`: every variable in the document, used by the layers or not, by collection. Each collection lists its mode names, default first, and whether it is a library's copy. Each token has its name, type, description, and `codeSyntax`, and `values` by mode name, resolved through aliases, with colors as hex (`#RRGGBB`, or `#RRGGBBAA` when translucent). `aliases` names the token each mode takes its value from. `designTokens(graph)` writes the same list on its own, and `tokens: false` leaves it out of `designToJSON`.

## Compact

`compactDesign(graph, nodeIds, options)` writes the structure of the layers in brief, as something that renders them needs it, for an index or summary of a design rather than everything it keeps. Hidden layers are left out.

- `roots`: each layer's `kind` (`frame`, `text`, `image`, `instance`, `shape`, `vector`...), its `box` relative to its parent, and only what it sets: `layout` for auto layout, `style` (fills, border, radius, opacity, effects), `text` (content, font, color), each color as `{ value, name }`: its hex value, or the kind of gradient, and the name of the variable it is bound to, such as `color/black`,, `images` (hashes), `vector` for a vector (its `width`, `height`, and `paths`, each SVG path data `d` in the layer's own coordinates with its `fillRule`, `none` for an open path), `variables` for its other fields bound to variables (each variable's name, keyed as the design binds the field, such as `itemSpacing` or `cornerRadius`), and `component` for an instance (the main component and its property values), with its `children`.
- `images`: each image by hash, with its type, size, and the layers that draw it.
- `summary`: how many layers of each kind, how deep the tree goes, the fonts, colors, and components it uses, and how many layers were nested by inference.

With `inferNesting: true`, siblings that their parent does not lay out itself are nested as a reader would see them: a layer drawn wholly inside one below it becomes that layer's child (`inferred: 'contained'`), and layers that still overlap are wrapped in a group (`inferred: 'overlap'`). A layer without `inferred` sits where the design put it.

`vectorSVG(node)` writes a compact vector as a standalone SVG file, painted with its first fill and its border, ready to save; it gives `null` for a layer without a `vector`.

What each layer keeps is decided in one place, `compactLayer` in `src/compact/layer.ts`.
