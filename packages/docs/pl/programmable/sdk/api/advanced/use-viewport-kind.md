---
title: useViewportKind
description: Odczytuj uproszczone flagi mobilnego i desktopowego widoku dla responsywnych powłok edytora.
---

# useViewportKind

`useViewportKind()` zwraca proste flagi responsywności używane przez UI edytora OpenPencil.

Użyj go, gdy twoja powłoka potrzebuje lekkiej abstrakcji nad punktami przełamania zamiast bezpośredniego okablowania `useBreakpoints()`.

## Użycie

```ts
import { useViewportKind } from '@open-pencil/vue'

const { isMobile, isDesktop } = useViewportKind()
```

## Zwraca

- `isMobile`
- `isDesktop`

## Powiązane API

- [useCanvas](../composables/use-canvas)
