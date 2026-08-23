---
title: useStrokeControls
description: Zarządzanie wyrównaniem, bokami i grubością obwiedni w panelu właściwości.
---

# useStrokeControls

`useStrokeControls()` dostarcza warianty wyrównania obwiedni, wybór wszystkich lub wybranych boków, wartość domyślną oraz funkcje niezależnej zmiany grubości każdego boku.

```ts
const { alignOptions, sideOptions, currentAlign, currentSides, selectSide } = useStrokeControls()

strokes.updateAlign('INSIDE', activeNode)
strokes.selectSide('TOP', activeNode)
```

## Zobacz też

- [PropertyListRoot](../components/property-list-root)
