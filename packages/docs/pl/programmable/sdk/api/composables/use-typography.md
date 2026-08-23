---
title: useTypography
description: Odczytywanie i zmiana rodziny, odmiany, rozmiaru i wyrównania czcionki oraz formatowania tekstu.
---

# useTypography

`useTypography()` udostępnia panelom tekstu:

- rodzinę czcionki;
- odmianę;
- rozmiar;
- aktywne formatowanie;
- informacje o brakujących czcionkach;
- funkcje zmiany rodziny, odmiany, wyrównania i dekoracji.

## Użycie

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

### Ładowanie rodziny czcionki

```ts
const typography = useTypography({
  loadFont: async (family, style) => {
    await myFontLoader(family, style)
  },
})
```

### Formatowanie

```ts
typography.toggleBold()
typography.toggleItalic()
typography.toggleDecoration('UNDERLINE')
```

## Zobacz też

- [useTextEdit](./use-text-edit)
- [useSelectionState](./use-selection-state)
