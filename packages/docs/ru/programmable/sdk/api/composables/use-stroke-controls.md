---
title: useStrokeControls
description: Хелперы панели обводок для выравнивания, выбора стороны и весов обводки по сторонам.
---

# useStrokeControls

`useStrokeControls()` — компосабл свойства обводки, используемый панелями редактирования обводок.

Предоставляет:

- варианты выравнивания обводки
- пресеты сторон: все, верх, низ, лево, право, кастомные
- данные обводки по умолчанию
- хелперы для весов обводки по отдельным сторонам

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

### Задать выравнивание обводки

```ts
strokes.updateAlign('INSIDE', activeNode)
```

### Ограничить обводку одной стороной

```ts
strokes.selectSide('TOP', activeNode)
```

## Связанные API

- [PropertyListRoot](../components/property-list-root)
