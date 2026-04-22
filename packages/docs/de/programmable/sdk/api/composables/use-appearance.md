---
title: useAppearance
description: Sichtbarkeit, Deckkraft und Eckradius-Zustand der aktuellen Auswahl steuern.
---

# useAppearance

`useAppearance()` ist das erscheinungsbild-fokussierte Steuerelemente-Composable für Eigenschafts-Panels.

Es gibt auswahlabgeleiteten UI-Zustand zurück für:

- Sichtbarkeit
- Deckkraft
- Eckradius
- unabhängige Eckradien

## Verwendung

```ts
import { useAppearance } from '@open-pencil/vue'

const appearance = useAppearance()
```

## Einfaches Beispiel

```ts
const {
  visibilityState,
  opacityPercent,
  cornerRadiusValue,
  toggleVisibility,
  toggleIndependentCorners,
} = useAppearance()
```

## Praktische Beispiele

### Sichtbarkeit der Auswahl umschalten

```ts
appearance.toggleVisibility()
```

### Einzelne Eckradien bearbeiten

```ts
appearance.updateCornerProp('topLeftRadius', 12)
appearance.commitCornerProp('topLeftRadius', 12, 8)
```

## Verwandte APIs

- [SDK API-Übersicht](../)
- [useLayout](./use-layout)
- [useTypography](./use-typography)
