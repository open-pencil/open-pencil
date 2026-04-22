---
title: useExport
description: Zarządzaj ustawieniami eksportu jak skala i format dla bieżącej selekcji.
---

# useExport

`useExport()` to kompozyt panelu eksportu dla zaznaczonych węzłów.

Zarządza:

- wierszami ustawień eksportu
- id zaznaczonych węzłów
- etykietowaniem nazw eksportu
- obsługiwanymi skalami i formatami

## Użycie

```ts
import { useExport } from '@open-pencil/vue'

const exportState = useExport()
```

## Podstawowy przykład

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

## Przykłady praktyczne

### Dodaj kolejne ustawienie eksportu

```ts
exportState.addSetting()
```

### Zmień pierwszy eksport na 2x WEBP

```ts
exportState.updateScale(0, 2)
exportState.updateFormat(0, 'WEBP')
```

## Powiązane API

- [useSelectionState](./use-selection-state)
- [useEditor](./use-editor)
