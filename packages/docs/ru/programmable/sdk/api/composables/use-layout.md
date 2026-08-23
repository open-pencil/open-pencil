---
title: useLayout
description: Управление автоматической компоновкой, размерами, отступами, выравниванием и дорожками сетки.
---

# useLayout

`useLayout()` предоставляет состояние и действия для панелей компоновки:

- выбор между flex и grid;
- режимы ширины и высоты;
- отступы;
- выравнивание;
- изменение дорожек grid template.

## Использование

```ts
import { useLayout } from '@open-pencil/vue'

const layout = useLayout()
```

## Базовый пример

```ts
const {
  isGrid,
  isFlex,
  widthSizing,
  heightSizing,
  setAxisSizing,
  updateAxisSize,
  commitAxisSize,
} = useLayout()
```

## Практические примеры

### Переключение между единым и раздельным отступом

```ts
layout.toggleIndividualPadding()
```

### Изменить дорожки grid

```ts
layout.updateGridTrack('gridTemplateColumns', 0, { sizing: 'FIXED', value: 240 })
layout.addTrack('gridTemplateRows')
```

### Изменение выравнивания

```ts
layout.setAlignment('CENTER', 'MAX')
```

## Связанные API

- [usePosition](./use-position)
- [useEditor](./use-editor)
