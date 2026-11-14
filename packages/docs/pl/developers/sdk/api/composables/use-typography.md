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

### Ustawianie osi czcionek zmiennych

`axes` wymienia osie zmiennej czcionki zaznaczonego tekstu, każdą z `tag`, `name`, zakresem i `value`, w jakiej jest rysowana (`MIXED`, gdy warstwy się różnią); lista jest pusta dla czcionki statycznej lub warstw z różnych rodzin. `previewAxis` pokazuje wartość podczas przeciągania, `setAxis` ustawia ją w jednym kroku cofania, a `setOpticalSizeAuto` każe rozmiarowi optycznemu podążać za rozmiarem czcionki albo go zatrzymuje. Zmiana grubości, pochylenia lub rodziny przywraca osie danej odmiany.

```ts
typography.setAxis('wght', 560)
typography.setOpticalSizeAuto(false)
```

## Zobacz też

- [useTextEdit](./use-text-edit)
- [useSelectionState](./use-selection-state)
