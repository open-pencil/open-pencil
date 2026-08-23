---
title: useViewportKind
description: Reaktywne oznaczenia widoku mobilnego i komputerowego dla własnego interfejsu.
---

# useViewportKind

`useViewportKind()` zwraca uproszczoną klasyfikację rozmiaru widoku używaną przez responsywny interfejs OpenPencil.

Użyj composable, jeśli wystarczy rozróżnienie widoku mobilnego i komputerowego bez bezpośredniej konfiguracji `useBreakpoints()`.

```ts
const { isMobile, isDesktop } = useViewportKind()
```

## Zobacz też

- [useCanvas](../composables/use-canvas)
