---
title: useViewportKind
description: Реактивные признаки мобильной и настольной области просмотра для собственного интерфейса.
---

# useViewportKind

`useViewportKind()` возвращает упрощённую классификацию размера области просмотра, используемую адаптивным интерфейсом OpenPencil.

Используйте composable, если достаточно различать мобильный и настольный режимы без прямой настройки `useBreakpoints()`.

```ts
const { isMobile, isDesktop } = useViewportKind()
```

## См. также

- [useCanvas](../composables/use-canvas)
