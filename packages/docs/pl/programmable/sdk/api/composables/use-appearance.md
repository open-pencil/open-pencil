---
title: useAppearance
description: Zarządzanie widocznością, przezroczystością i promieniem narożników bieżącego zaznaczenia.
---

# useAppearance

`useAppearance()` udostępnia stan i działania dotyczące wyglądu zaznaczonych obiektów: widoczność, przezroczystość, wspólny promień narożników i promienie niezależne.

```ts
const {
  visibilityState,
  opacityPercent,
  cornerRadiusValue,
  toggleVisibility,
  toggleIndependentCorners,
} = useAppearance()
```

## Zobacz też

- [useLayout](./use-layout)
- [useTypography](./use-typography)
