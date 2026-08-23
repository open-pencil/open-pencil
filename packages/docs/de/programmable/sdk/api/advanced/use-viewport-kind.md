---
title: useViewportKind
description: Reaktive Kennzeichen für mobile und Desktop-Ansicht einer eigenen Editoroberfläche.
---

# useViewportKind

`useViewportKind()` gibt eine vereinfachte Einordnung der Ansichtsgröße zurück.

Verwenden Sie das Composable, wenn nur zwischen mobiler und Desktop-Ansicht unterschieden werden muss, ohne `useBreakpoints()` direkt zu konfigurieren.

```ts
const { isMobile, isDesktop } = useViewportKind()
```

## Siehe auch

- [useCanvas](../composables/use-canvas)
