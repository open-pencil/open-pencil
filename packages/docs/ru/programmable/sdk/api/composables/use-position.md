---
title: usePosition
description: Чтение и изменение положения, размера, поворота, выравнивания и отражения выделенного объекта.
---

# usePosition

`usePosition()` предоставляет панелям положения и размера значения выделения: `panelProp(key)` для `'x'`, `'y'`, `'width'`, `'height'` и `'rotation'` возвращает значение поля, округлённое до двух знаков, как в панели Figma, или `MIXED`, если у выделенных слоёв значения различаются. Сами слои сохраняют точные значения.

Также доступны действия:

- выравнивание;
- отражение;
- поворот;
- предварительное и окончательное изменение числовых свойств.

## Использование

```ts
import { usePosition } from '@open-pencil/vue/controls/position'

const position = usePosition()
```

## Пример

```ts
const { panelProp, updateProp, commitProp } = usePosition()
const x = panelProp('x')
const width = panelProp('width')
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
