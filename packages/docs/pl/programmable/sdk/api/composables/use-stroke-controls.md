---
title: useStrokeControls
description: Pomocniki panelu obrysu dla wyrównania, wyboru strony i grubości obrysów per strona.
---

# useStrokeControls

`useStrokeControls()` to kompozyt właściwości obrysu używany przez panele edycji obrysów.

Udostępnia:

- opcje wyrównania obrysu
- predefiniowane strony: wszystkie, góra, dół, lewa, prawa, niestandardowe
- domyślne dane obrysu
- pomocniki dla grubości ramki per strona

## Użycie

```ts
import { useStrokeControls } from '@open-pencil/vue'

const strokes = useStrokeControls()
```

## Podstawowy przykład

```ts
const { alignOptions, sideOptions, currentAlign, currentSides, selectSide } = useStrokeControls()
```

## Przykłady praktyczne

### Ustaw wyrównanie obrysu

```ts
strokes.updateAlign('INSIDE', activeNode)
```

### Ogranicz obrys do jednej strony

```ts
strokes.selectSide('TOP', activeNode)
```

## Powiązane API

- [PropertyListRoot](../components/property-list-root)
