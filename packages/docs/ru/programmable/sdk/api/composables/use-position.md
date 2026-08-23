---
title: usePosition
description: Чтение и изменение положения, размера, поворота, выравнивания и отражения выделенного объекта.
---

# usePosition

`usePosition()` предоставляет панелям положения и размера значения выбранного объекта:

- `x`
- `y`
- `width`
- `height`
- `rotation`

и действия:

- выравнивание;
- отражение;
- поворот;
- предварительное и окончательное изменение числовых свойств.

## Использование

```ts
import { usePosition } from '@open-pencil/vue'

const position = usePosition()
```

## Пример

```ts
const { x, y, width, height, rotation, updateProp, commitProp } = usePosition()
```

## Примеры

### Выровнять выделенные объекты

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
