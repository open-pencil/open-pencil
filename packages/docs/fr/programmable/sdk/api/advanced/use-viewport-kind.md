---
title: useViewportKind
description: Flags réactifs Mobile et Desktop pour une interface d’édition personnalisée.
---

# useViewportKind

`useViewportKind()` renvoie une classification simplifiée de la Viewport size utilisée par l’UI responsive d’OpenPencil.

Utilisez le composable lorsqu’il suffit de distinguer Mobile et Desktop sans configurer directement `useBreakpoints()`.

## Utilisation

```ts
import { useViewportKind } from '@open-pencil/vue'

const { isMobile, isDesktop } = useViewportKind()
```

## Values

- `isMobile`
- `isDesktop`

## Voir aussi

- [useCanvas](../composables/use-canvas)
