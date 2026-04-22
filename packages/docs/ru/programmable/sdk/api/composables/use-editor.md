---
title: useEditor
description: Доступ к текущему инжектированному экземпляру редактора OpenPencil.
---

# useEditor

`useEditor()` возвращает текущий инжектированный редактор OpenPencil.

Это главная точка входа для SDK-компосаблов и headless-примитивов, которым нужен доступ к редактору.

## Использование

`useEditor()` должен вызываться внутри поддерева, где уже был вызван `provideEditor(editor)`.

```ts
import { useEditor } from '@open-pencil/vue'

const editor = useEditor()
```

## Базовый пример

```vue
<script setup lang="ts">
import { computed } from 'vue'

import { useEditor } from '@open-pencil/vue'

const editor = useEditor()
const pageId = computed(() => editor.state.currentPageId)
</script>

<template>
  <div>Current page: {{ pageId }}</div>
</template>
```

## Практические примеры

### Чтение выбранных узлов

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

Если вызван вне дерева провайдера редактора, `useEditor()` бросит исключение с понятным сообщением.

Это намеренно — API должен громко сообщать об отсутствии контекста редактора.

## Связанные API

- [provideEditor](./provide-editor)
- [useCanvas](./use-canvas)
- [useSelectionState](./use-selection-state)
- [useEditorCommands](./use-editor-commands)

## Тип

```ts
function useEditor(): Editor
```
