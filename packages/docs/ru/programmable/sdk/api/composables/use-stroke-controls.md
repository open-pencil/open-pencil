---
title: useStrokeControls
description: Настройка расположения и толщины обводки в панели свойств.
---

# useStrokeControls

`useStrokeControls()` предоставляет панели обводок:

- варианты расположения обводки;
- варианты сторон: все, сверху, снизу, слева, справа или произвольная комбинация;
- значение новой обводки по умолчанию;
- функции для изменения толщины на отдельных сторонах.

## Использование

```ts
import { useStrokeControls } from '@open-pencil/vue'

const strokes = useStrokeControls()
```

## Базовый пример

```ts
const { alignOptions, sideOptions, currentAlign, currentSides, selectSide } = useStrokeControls()
```

## Практические примеры

### Разместить обводку внутри границы объекта

```ts
strokes.updateAlign('INSIDE', activeNode)
```

### Ограничить обводку одной стороной

```ts
strokes.selectSide('TOP', activeNode)
```

## Связанные API

- [PropertyListRoot](../components/property-list-root)
