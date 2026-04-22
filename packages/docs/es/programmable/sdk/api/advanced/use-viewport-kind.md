---
title: useViewportKind
description: Lee indicadores de viewport de móvil y escritorio para shells de editor responsivos.
---

# useViewportKind

`useViewportKind()` devuelve indicadores responsivos simples usados por la interfaz del editor de OpenPencil.

Úsalo cuando tu shell necesite una abstracción ligera sobre breakpoints en lugar de conectar `useBreakpoints()` directamente.

## Uso

```ts
import { useViewportKind } from '@open-pencil/vue'

const { isMobile, isDesktop } = useViewportKind()
```

## Devuelve

- `isMobile`
- `isDesktop`

## APIs relacionadas

- [useCanvas](../composables/use-canvas)
