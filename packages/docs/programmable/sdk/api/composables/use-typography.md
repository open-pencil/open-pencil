---
title: useTypography
description: Read and update font family, weight, size, alignment, and formatting for text nodes.
---

# useTypography

`useTypography()` is the text-property control composable for text editing panels.

It exposes:

- font family
- font weight
- font size
- formatting state
- missing-font status
- helpers for changing family, weight, alignment, and decorations

## Usage

```ts
import { useTypography } from '@inkly/vue'

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
} = useTypography()
```

## Practical examples

### Load and switch a font family

```ts
const typography = useTypography({
  loadFont: async (family, style) => {
    await myFontLoader(family, style)
  },
})
```

### Toggle formatting

```ts
typography.toggleBold()
typography.toggleItalic()
typography.toggleDecoration('UNDERLINE')
```

## Related APIs

- [useTextEdit](./use-text-edit)
- [useSelectionState](./use-selection-state)
