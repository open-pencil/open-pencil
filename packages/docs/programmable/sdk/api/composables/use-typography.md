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
- font weight
- font size
- formatting state
- missing-font status
- horizontal and vertical alignment, including justification
- text case and direction
- ending truncation and maximum lines
- OpenType feature toggles
- list style (`listType`, `null` when the paragraphs differ) and hanging lists
- helpers for changing family, weight, alignment, and decorations
- `merged(key)` and `fontFeature(tag)`, which return the shared value or `MIXED`

## Usage

```ts
import { useTypography } from '@open-pencil/vue'

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

## Related APIs

- [useTextEdit](./use-text-edit)
- [useSelectionState](./use-selection-state)
