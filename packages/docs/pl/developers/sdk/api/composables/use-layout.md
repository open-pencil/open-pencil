---
title: useLayout
description: Zarządzanie automatycznym układem, rozmiarem, wypełnieniem, wyrównaniem i ścieżkami siatki.
---

# useLayout

`useLayout()` udostępnia stan i działania dla trybu Flex lub Grid, rozmiaru szerokości i wysokości, wypełnienia, wyrównania oraz ścieżek szablonu siatki.

```ts
const {
  isGrid,
  isFlex,
  widthSizing,
  heightSizing,
  setAxisSizing,
  updateAxisSize,
  commitAxisSize,
} = useLayout()
```

## Zobacz też

- [usePosition](./use-position)
- [useEditor](./use-editor)
