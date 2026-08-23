---
title: useExport
description: Ustawienia scale i format eksportu bieżącego selection.
---

# useExport

`useExport()` udostępnia state i actions panelu eksportu zaznaczonych obiektów:

- ustawienia eksportu;
- IDs zaznaczonych obiektów;
- nazwę pliku wynikowego;
- dostępne scales i formats.

## Użycie

```ts
import { useExport } from '@open-pencil/vue'

const exportState = useExport()
```

## Przykład

```ts
const {
  settings,
  nodeName,
  scales,
  formats,
  addSetting,
  updateScale,
  updateFormat,
} = useExport()
```

### Dodatkowy wariant eksportu

```ts
exportState.addSetting()
```

### WEBP w skali 2×

```ts
exportState.updateScale(0, 2)
exportState.updateFormat(0, 'WEBP')
```

## Zobacz też

- [useSelectionState](./use-selection-state)
- [useEditor](./use-editor)
