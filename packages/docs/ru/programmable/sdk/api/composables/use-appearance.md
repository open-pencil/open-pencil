---
title: useAppearance
description: Управление видимостью, прозрачностью и радиусом углов текущего выделения.
---

# useAppearance

`useAppearance()` — компосабл управления, ориентированный на внешний вид, для панелей свойств.

Предоставляет производный от выделения UI-состояние для:

- видимости
- прозрачности
- радиуса углов
- независимых радиусов углов

## Использование

```ts
import { useAppearance } from '@open-pencil/vue'

const appearance = useAppearance()
```

## Базовый пример

```ts
const {
  visibilityState,
  opacityPercent,
  cornerRadiusValue,
  toggleVisibility,
  toggleIndependentCorners,
} = useAppearance()
```

## Практические примеры

### Переключить видимость выделения

```ts
appearance.toggleVisibility()
```

### Редактировать радиус каждого угла отдельно

```ts
appearance.updateCornerProp('topLeftRadius', 12)
appearance.commitCornerProp('topLeftRadius', 12, 8)
```

## Связанные API

- [Обзор SDK API](../)
- [useLayout](./use-layout)
- [useTypography](./use-typography)
