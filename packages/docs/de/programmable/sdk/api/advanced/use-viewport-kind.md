---
title: useViewportKind
description: Grobe Mobile- und Desktop-Viewport-Flags für responsive Editor-Shells lesen.
---

# useViewportKind

`useViewportKind()` gibt einfache Responsive-Flags zurück, die von der OpenPencil-Editor-UI verwendet werden.

Verwenden Sie es, wenn Ihre Shell eine leichte Abstraktion über Breakpoints anstatt einer direkten `useBreakpoints()`-Verdrahtung benötigt.

## Verwendung

```ts
import { useViewportKind } from '@open-pencil/vue'

const { isMobile, isDesktop } = useViewportKind()
```

## Rückgabewerte

- `isMobile`
- `isDesktop`

## Verwandte APIs

- [useCanvas](../composables/use-canvas)
