---
title: useTypography
description: Read and update font, alignment, case, truncation, and OpenType features for text nodes.
---

# useTypography

`useTypography()` is the text-property control composable for text editing panels. It works on the
text layers in the selection: `nodes` holds them, `node` is the first, and every action changes all
of them in one undo step, so a selection of text and other layers edits only the text.

It exposes:

- font family
- font style: `faces`, the faces of the selected layers' family by the names their fonts give them (Avenir's Book and Roman apart), read from installed fonts and web font providers, every standard weight while a family's faces are unknown; `faceName`, the face the layers share or `MIXED`; and `setFace(style)`, which sets a face by its name
- font size
- formatting state
- missing-font status
- horizontal and vertical alignment, including justification
- text case and direction
- ending truncation and maximum lines
- OpenType feature toggles
- variable font axes (`axes`, `opticalSizeAuto`)
- list style (`listType`, `null` when the paragraphs differ) and hanging lists
- helpers for changing family, face, weight, alignment, and decorations
- `merged(key)` and `fontFeature(tag)`, which return the shared value or `MIXED`

## Usage

```ts
import { useTypography } from '@open-pencil/vue/controls/typography'

const typography = useTypography()
```

## Basic example

```ts
const {
  fontFamily,
  fontWeight,
  fontSize,
  activeFormatting,
  setFamily,
  setFace,
  setWeight,
  setAlign,
  setVerticalAlign,
  setTextCase,
  setTruncation,
  setFontFeature,
} = useTypography()
```

## Practical examples

### Load and switch a font family

```ts
const typography = useTypography({
  fontLoader: {
    load: async (family, style) => {
      await myFontLoader(family, style)
    },
  },
})
```

### Toggle formatting

As in Figma, a family switch keeps each layer's weight and slant where the new family has them, otherwise the nearest weight with the same slant, and `toggleBold` or `toggleItalic` leave a layer alone when its family has no such face.

```ts
typography.toggleBold()
typography.toggleItalic()
typography.toggleDecoration('UNDERLINE')
typography.setTextCase('UPPER')
typography.setVerticalAlign('CENTER')
typography.setTruncation('ENDING')
typography.setFontFeature('LIGA', false)
```

### Make a list

While the text is being edited, `setListType` and `setParagraphSpacing` change the paragraphs under the caret or selection; otherwise they change the whole text. `paragraphSpacing(field)` reads `listSpacing`, `paragraphSpacing`, or `paragraphIndent` for those paragraphs, `MIXED` when they differ, and `previewParagraphSpacing` shows a value while a field is dragged without an undo step.

```ts
typography.setListType('UNORDERED')
typography.setHangingList(true)
typography.setParagraphSpacing('listSpacing', 8)
```

### Set variable font axes

`axes` lists the axes of the selected text's variable font, each with its `tag`, `name`, range, and the `value` it is drawn at (`MIXED` when the layers differ), and is empty for a static font or layers in different families. `previewAxis` shows a value while a field is dragged, `setAxis` sets it in one undo step, and `setOpticalSizeAuto` lets the optical size follow the font size or holds it. Changing weight, slant, or family puts the axes back at the style's own.

```ts
typography.setAxis('wght', 560)
typography.setOpticalSizeAuto(false)
```

## Related APIs

- [useTextEdit](./use-text-edit)
- [useSelectionState](./use-selection-state)
