---
title: useAppearance
description: Controlla visibilità, opacità e stato del raggio degli angoli per la selezione corrente.
---

# useAppearance

`useAppearance()` è il composable di controllo focalizzato sull'aspetto per i pannelli proprietà.

Espone lo stato UI derivato dalla selezione per:

- visibilità
- opacità
- raggio degli angoli
- raggi degli angoli indipendenti

## Utilizzo

```ts
import { useAppearance } from '@open-pencil/vue'

const appearance = useAppearance()
```

## Esempio base

```ts
const {
  visibilityState,
  opacityPercent,
  cornerRadiusValue,
  toggleVisibility,
  toggleIndependentCorners,
} = useAppearance()
```

## Esempi pratici

### Alterna la visibilità della selezione

```ts
appearance.toggleVisibility()
```

### Modifica i raggi per angolo

```ts
appearance.updateCornerProp('topLeftRadius', 12)
appearance.commitCornerProp('topLeftRadius', 12, 8)
```

## API correlate

- [Panoramica API SDK](../)
- [useLayout](./use-layout)
- [useTypography](./use-typography)
