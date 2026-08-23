---
title: useSelectionState
description: "Реактивные сведения о выделении: основной объект, количество и тип."
---

# useSelectionState

`useSelectionState()` возвращает реактивные сведения о текущем выделении.

Используйте их, если интерфейс зависит от:

- наличия выделения
- количества выделенных объектов
- основного выделенного объекта
- того, является ли выделенный объект экземпляром, компонентом или группой.

## Использование

```ts
import { useSelectionState } from '@open-pencil/vue'

const selection = useSelectionState()
```

## Пример

```vue
<script setup lang="ts">
import { useSelectionState } from '@open-pencil/vue'

const { hasSelection, selectedCount, isInstance } = useSelectionState()
</script>

<template>
  <div class="text-xs text-muted">
    <span v-if="!hasSelection">Нет выделения</span>
    <span v-else>
      {{ selectedCount }} выделено
      <span v-if="isInstance">· экземпляр</span>
    </span>
  </div>
</template>
```

## Возвращаемые значения

Полезные значения:

- `selectedIds`
- `hasSelection`
- `selectedNode`
- `selectedCount`
- `selectedNodeType`
- `isInstance`
- `isComponent`
- `isGroup`
- `canCreateComponentSet`

## Примеры

### Показывать действия только для экземпляров

```ts
const { isInstance } = useSelectionState()
```

### Разрешить создание набора компонентов

```ts
const { canCreateComponentSet } = useSelectionState()
```

## Связанные API

- [useSelectionCapabilities](./use-selection-capabilities)
- [useEditorCommands](./use-editor-commands)
- [useEditor](./use-editor)
