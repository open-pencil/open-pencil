---
title: useExport
description: Управление настройками экспорта — масштабом и форматом — для текущего выделения.
---

# useExport

`useExport()` предоставляет состояние и действия для панели экспорта выбранных объектов.

Он содержит:

- настройки экспорта;
- ID выбранных объектов;
- имя экспортируемого файла;
- доступные масштабы и форматы.

## Использование

```ts
import { useExport } from '@open-pencil/vue'

const exportState = useExport()
```

## Базовый пример

```ts
const {
  settings,
  nodeName,
  scales,
  formats,
  addSetting,
  updateScale,
  updateFormat,
} = useExport()
```

## Практические примеры

### Добавить ещё один вариант экспорта

```ts
exportState.addSetting()
```

### Изменить первый экспорт на 2x WEBP

```ts
exportState.updateScale(0, 2)
exportState.updateFormat(0, 'WEBP')
```

## Связанные API

- [useSelectionState](./use-selection-state)
- [useEditor](./use-editor)
