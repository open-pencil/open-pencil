---
title: useEditor
description: Доступ к экземпляру редактора OpenPencil, переданному через provideEditor.
---

# useEditor

`useEditor()` возвращает экземпляр редактора OpenPencil, переданный ближайшим вызовом `provideEditor()`.

Это основная точка входа для composables и компонентов без встроенного оформления, которым нужен редактор.

## Использование

`useEditor()` должен вызываться внутри поддерева, где уже был вызван `provideEditor(editor)`.

```ts
import { useEditor } from '@open-pencil/vue'

const editor = useEditor()
```

## Пример

```vue
<script setup lang="ts">
import { computed } from 'vue'

import { useEditor } from '@open-pencil/vue'

const editor = useEditor()
const pageId = computed(() => editor.state.currentPageId)
</script>

<template>
  <div>Текущая страница: {{ pageId }}</div>
</template>
```

## Примеры

### Чтение выделенных объектов

```ts
const editor = useEditor()
const selected = editor.getSelectedNodes()
```

### Вызов команд

```ts
const editor = useEditor()
editor.zoomToFit()
editor.undoAction()
```

## Поведение при ошибках

Если вызвать `useEditor()` вне дерева компонентов, в котором был вызван `provideEditor()`, функция выдаст понятную ошибку. Это позволяет сразу обнаружить отсутствие контекста редактора.

## Связанные API

- [provideEditor](./provide-editor)
- [useCanvas](./use-canvas)
- [useSelectionState](./use-selection-state)
- [useEditorCommands](./use-editor-commands)

## Тип

```ts
function useEditor(): Editor
```
