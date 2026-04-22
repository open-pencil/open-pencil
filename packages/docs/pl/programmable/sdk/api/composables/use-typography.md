---
title: useTypography
description: Odczytuj i aktualizuj rodzinę czcionek, grubość, rozmiar, wyrównanie i formatowanie węzłów tekstowych.
---

# useTypography

`useTypography()` to kompozyt kontrolek właściwości tekstu dla paneli edycji tekstu.

Udostępnia:

- rodzinę czcionek
- grubość czcionki
- rozmiar czcionki
- stan formatowania
- status brakującej czcionki
- pomocniki do zmiany rodziny, grubości, wyrównania i dekoracji

## Użycie

```ts
import { useTypography } from '@open-pencil/vue'

const typography = useTypography()
```

## Podstawowy przykład

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

## Przykłady praktyczne

### Załaduj i przełącz rodzinę czcionek

```ts
const typography = useTypography({
  loadFont: async (family, style) => {
    await myFontLoader(family, style)
  },
})
```

### Przełącz formatowanie

```ts
typography.toggleBold()
typography.toggleItalic()
typography.toggleDecoration('UNDERLINE')
```

## Powiązane API

- [useTextEdit](./use-text-edit)
- [useSelectionState](./use-selection-state)
