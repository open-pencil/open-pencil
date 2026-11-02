---
title: provideEditor
description: Передача экземпляра редактора Lawha дочерним компонентам Vue через внедрение зависимостей.
---

# provideEditor

`provideEditor(editor)` делает редактор Lawha доступным для composables и компонентов без встроенного оформления, расположенных ниже в дереве Vue.

На этой функции основана работа `useEditor()`.

## Использование

```ts
import { provideEditor } from '@lawha/vue'

provideEditor(editor)
```

## Пример

```vue
<script setup lang="ts">
import { provideEditor } from '@lawha/vue'

import type { Editor } from '@lawha/core'

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

В актуальном SDK используются непосредственно `provideEditor()` и `useEditor()`. В некоторых старых примерах и сообщениях об ошибках упоминается компонент `LawhaProvider`, но он не относится к текущему публичному API.

## Связанные API

- [useEditor](./use-editor)
