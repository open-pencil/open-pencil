---
title: useAppearance
description: Controla la visibilidad, la opacidad y el radio de las esquinas del estado de la selección actual.
---

# useAppearance

`useAppearance()` es el composable de control orientado a la apariencia para los paneles de propiedades.

Expone el estado de UI derivado de la selección para:

- visibilidad
- opacidad
- radio de esquina
- radios de esquina independientes

## Uso

```ts
import { useAppearance } from '@open-pencil/vue'

const appearance = useAppearance()
```

## Ejemplo básico

```ts
const {
  visibilityState,
  opacityPercent,
  cornerRadiusValue,
  toggleVisibility,
  toggleIndependentCorners,
} = useAppearance()
```

## Ejemplos prácticos

### Alternar la visibilidad de la selección

```ts
appearance.toggleVisibility()
```

### Editar los radios por esquina

```ts
appearance.updateCornerProp('topLeftRadius', 12)
appearance.commitCornerProp('topLeftRadius', 12, 8)
```

## APIs relacionadas

- [Resumen de la API del SDK](../)
- [useLayout](./use-layout)
- [useTypography](./use-typography)
