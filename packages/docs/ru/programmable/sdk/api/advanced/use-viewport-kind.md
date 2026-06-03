---
title: useViewportKind
description: Грубые флаги мобильного и десктопного вьюпорта для адаптивных оболочек редактора.
---

# useViewportKind

`useViewportKind()` возвращает простые адаптивные флаги, используемые UI редактора Inkly.

Используйте его, когда оболочке нужна лёгкая абстракция поверх брейкпоинтов вместо прямого подключения `useBreakpoints()`.

## Использование

```ts
import { useViewportKind } from '@inkly/vue'

const { isMobile, isDesktop } = useViewportKind()
```

## Возвращает

- `isMobile`
- `isDesktop`

## Связанные API

- [useCanvas](../composables/use-canvas)
