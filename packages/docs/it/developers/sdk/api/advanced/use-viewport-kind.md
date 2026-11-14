---
title: useViewportKind
description: Indicatori reattivi per viewport mobile e desktop in un’interfaccia personalizzata.
---

# useViewportKind

`useViewportKind()` restituisce una classificazione semplificata della dimensione del viewport usata dall’interfaccia reattiva di OpenPencil.

Usalo quando basta distinguere mobile e desktop senza configurare direttamente `useBreakpoints()`.

```ts
const { isMobile, isDesktop } = useViewportKind()
```

## Vedi anche

- [useCanvas](../composables/use-canvas)
