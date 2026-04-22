---
title: useAppearance
description: Kontroluj widoczność, przezroczystość i stan promienia narożnika bieżącej selekcji.
---

# useAppearance

`useAppearance()` to kompozyt kontrolek skupiony na wyglądzie dla paneli właściwości.

Udostępnia stan UI pochodny od selekcji dla:

- widoczności
- przezroczystości
- promienia narożnika
- niezależnych promieni narożników

## Użycie

```ts
import { useAppearance } from '@open-pencil/vue'

const appearance = useAppearance()
```

## Podstawowy przykład

```ts
const {
  visibilityState,
  opacityPercent,
  cornerRadiusValue,
  toggleVisibility,
  toggleIndependentCorners,
} = useAppearance()
```

## Przykłady praktyczne

### Przełącz widoczność selekcji

```ts
appearance.toggleVisibility()
```

### Edytuj promienie per narożnik

```ts
appearance.updateCornerProp('topLeftRadius', 12)
appearance.commitCornerProp('topLeftRadius', 12, 8)
```

## Powiązane API

- [Przegląd API SDK](../)
- [useLayout](./use-layout)
- [useTypography](./use-typography)
