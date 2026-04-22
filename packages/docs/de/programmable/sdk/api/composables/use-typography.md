---
title: useTypography
description: Schriftfamilie, Schriftstärke, Größe, Ausrichtung und Formatierung für Textknoten lesen und aktualisieren.
---

# useTypography

`useTypography()` ist das Text-Eigenschafts-Steuerelemente-Composable für Textbearbeitungs-Panels.

Es gibt zurück:

- Schriftfamilie
- Schriftstärke
- Schriftgröße
- Formatierungszustand
- Status fehlender Schriftarten
- Hilfsmittel zum Ändern von Familie, Stärke, Ausrichtung und Dekorationen

## Verwendung

```ts
import { useTypography } from '@open-pencil/vue'

const typography = useTypography()
```

## Einfaches Beispiel

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

## Praktische Beispiele

### Eine Schriftfamilie laden und wechseln

```ts
const typography = useTypography({
  loadFont: async (family, style) => {
    await myFontLoader(family, style)
  },
})
```

### Formatierung umschalten

```ts
typography.toggleBold()
typography.toggleItalic()
typography.toggleDecoration('UNDERLINE')
```

## Verwandte APIs

- [useTextEdit](./use-text-edit)
- [useSelectionState](./use-selection-state)
