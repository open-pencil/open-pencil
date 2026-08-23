---
title: useEffectsControls
description: Управление тенями и blur effects в панели эффектов.
---

# useEffectsControls

`useEffectsControls()` предоставляет состояние и действия для панели эффектов:

- значения новых эффектов по умолчанию;
- настройку теней и blur effects;
- состояние раскрытых элементов списка;
- предварительный просмотр значения во время перетаскивания;
- сохранение окончательного значения;
- изменение типа и цвета эффекта.

## Использование

```ts
import { useEffectsControls } from '@open-pencil/vue'

const effects = useEffectsControls()
```

## Базовый пример

```ts
const { effectOptions, createDefaultEffect, toggleExpand, scrubEffect, commitEffect } = useEffectsControls()
```

## Практические примеры

### Добавить эффект по умолчанию

```ts
const effect = effects.createDefaultEffect()
```

### Предварительно показать значение, а затем сохранить его

```ts
effects.scrubEffect(node, index, { radius: 12 })
effects.commitEffect(node, index, { radius: 12 })
```

## Связанные API

- [PropertyListRoot](../components/property-list-root)
