---
title: provideEditor
description: Передача экземпляра редактора Inkly в Vue-поддерево через инъекцию.
---

# provideEditor

`provideEditor(editor)` делает редактор Inkly доступным для дочерних компосаблов и headless-примитивов через Vue-инъекцию.

Это основа для `useEditor()`.

## Использование

```ts
import { provideEditor } from '@inkly/vue'

provideEditor(editor)
```

## Базовый пример

```vue
<script setup lang="ts">
import { provideEditor } from '@inkly/vue'

import type { Editor } from '@inkly/core/editor'

const props = defineProps<{
  editor: Editor
}>()

provideEditor(props.editor)
</script>

<template>
  <slot />
</template>
```

## Примечания

Текущий SDK использует `provideEditor()` и `useEditor()` напрямую. Некоторые старые примеры и сообщения об ошибках ещё ссылаются на компонент `InklyProvider`, но модель инъекции — это реальная поверхность API, которую следует предпочитать в документации и коде приложения.

## Связанные API

- [useEditor](./use-editor)
