---
title: useTypography
description: Leggi e aggiorna famiglia di font, peso, dimensione, allineamento e formattazione per i nodi testo.
---

# useTypography

`useTypography()` è il composable di controllo delle proprietà del testo per i pannelli di modifica del testo.

Espone:

- famiglia di font
- peso del font
- dimensione del font
- stato della formattazione
- stato dei font mancanti
- helper per cambiare famiglia, peso, allineamento e decorazioni

## Utilizzo

```ts
import { useTypography } from '@open-pencil/vue'

const typography = useTypography()
```

## Esempio base

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

## Esempi pratici

### Carica e cambia una famiglia di font

```ts
const typography = useTypography({
  loadFont: async (family, style) => {
    await myFontLoader(family, style)
  },
})
```

### Attiva/disattiva la formattazione

```ts
typography.toggleBold()
typography.toggleItalic()
typography.toggleDecoration('UNDERLINE')
```

## API correlate

- [useTextEdit](./use-text-edit)
- [useSelectionState](./use-selection-state)
