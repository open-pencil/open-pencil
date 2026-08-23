---
title: useTypography
description: Font family, Style, Size, Alignment und Formatting von Text objects lesen und ändern.
---

# useTypography

`useTypography()` stellt Text-Panels bereit:

- Font family;
- Font style;
- Font size;
- aktives Formatting;
- Informationen über fehlende Fonts;
- Functions zum Ändern von Family, Style, Alignment und Decoration.

## Verwendung

```ts
import { useTypography } from '@open-pencil/vue'

const typography = useTypography()
```

## Beispiel

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

### Font family laden und wählen

```ts
const typography = useTypography({
  loadFont: async (family, style) => {
    await myFontLoader(family, style)
  },
})
```

### Formatting

```ts
typography.toggleBold()
typography.toggleItalic()
typography.toggleDecoration('UNDERLINE')
```

## Siehe auch

- [useTextEdit](./use-text-edit)
- [useSelectionState](./use-selection-state)
