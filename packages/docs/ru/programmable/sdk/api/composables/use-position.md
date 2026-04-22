---
title: usePosition
description: Чтение и обновление позиции, размера, поворота, выравнивания и отражения выбранного узла.
---

# usePosition

`usePosition()` — компосабл управления для UI, связанного с позицией.

Предоставляет значения выбранного узла:

- `x`
- `y`
- `width`
- `height`
- `rotation`

и действия:

- выравнивание
- отражение
- поворот
- скрабинг/обновление числовых свойств

## Использование

```ts
import { usePosition } from '@open-pencil/vue'

const position = usePosition()
```

## Базовый пример

```ts
const { x, y, width, height, rotation, updateProp, commitProp } = usePosition()
```

## Практические примеры

### Выровнять выбранные узлы

```ts
position.align('horizontal', 'center')
position.align('vertical', 'min')
```

### Отразить выделение

```ts
position.flip('horizontal')
position.flip('vertical')
```

### Повернуть выделение

```ts
position.rotate(90)
```

## Связанные API

- [useLayout](./use-layout)
- [useAppearance](./use-appearance)
