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
import { useTypography } from '@open-pencil/vue/controls/typography'

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

### Achsen variabler Schriften setzen

`axes` listet die Achsen der variablen Schrift des ausgewählten Texts mit `tag`, `name`, Bereich und dem `value`, in dem sie gezeichnet wird (`MIXED`, wenn die Ebenen abweichen); bei statischen Schriften oder verschiedenen Familien ist die Liste leer. `previewAxis` zeigt einen Wert beim Ziehen, `setAxis` setzt ihn in einem Undo-Schritt, und `setOpticalSizeAuto` lässt die optische Größe der Schriftgröße folgen oder hält sie fest. Eine neue Stärke, Neigung oder Familie setzt die Achsen auf die des Schnitts zurück.

```ts
typography.setAxis('wght', 560)
typography.setOpticalSizeAuto(false)
```

## Siehe auch

- [useTextEdit](./use-text-edit)
- [useSelectionState](./use-selection-state)
