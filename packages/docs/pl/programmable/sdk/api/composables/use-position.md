---
title: usePosition
description: Odczytywanie i zmiana położenia, rozmiaru, obrotu, wyrównania i odbicia zaznaczonego obiektu.
---

# usePosition

`usePosition()` udostępnia `x`, `y`, `width`, `height` i `rotation`, a także działania wyrównania, odbicia, obrotu oraz podglądu i zapisu właściwości liczbowych.

```ts
const { x, y, width, height, rotation, updateProp, commitProp } = usePosition()

position.align('horizontal', 'center')
position.flip('horizontal')
position.rotate(90)
```

## Zobacz też

- [useLayout](./use-layout)
- [useAppearance](./use-appearance)
