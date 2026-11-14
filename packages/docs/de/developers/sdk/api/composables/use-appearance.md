---
title: useAppearance
description: Sichtbarkeit, Deckkraft und Eckenradius der aktuellen Auswahl verwalten.
---

# useAppearance

`useAppearance()` stellt Zustand und Aktionen für Sichtbarkeit, Deckkraft, gemeinsamen Eckenradius und unabhängige Eckenradien bereit.

```ts
const {
  visibilityState,
  opacityPercent,
  cornerRadiusValue,
  toggleVisibility,
  toggleIndependentCorners,
} = useAppearance()
```

## Siehe auch

- [useLayout](./use-layout)
- [useTypography](./use-typography)
