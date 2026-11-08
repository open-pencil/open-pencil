---
title: usePosition
description: Odczytywanie i zmiana położenia, rozmiaru, obrotu, wyrównania i odbicia zaznaczonego obiektu.
---

# usePosition

`usePosition()` udostępnia `panelProp(key)` dla `'x'`, `'y'`, `'width'`, `'height'` i `'rotation'`: wartość pola zaokrągloną do dwóch miejsc po przecinku, jak w panelu Figmy, albo `MIXED`, gdy zaznaczone warstwy się różnią. Warstwy zachowują dokładne wartości. Udostępnia też działania wyrównania, odbicia, obrotu oraz podglądu i zapisu właściwości liczbowych.

```ts
const position = usePosition()
const x = position.panelProp('x')

position.align('horizontal', 'center')
position.flip('horizontal')
position.rotate(90)
```

## Zobacz też

- [useLayout](./use-layout)
- [useAppearance](./use-appearance)
