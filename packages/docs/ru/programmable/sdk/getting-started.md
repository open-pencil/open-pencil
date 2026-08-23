---
title: Начало работы с SDK
description: Подключение @open-pencil/vue, создание редактора и настройка холста.
---

# Начало работы с SDK

## Установка

```bash
bun add @open-pencil/core @open-pencil/vue canvaskit-wasm
```

SDK находится в монорепозитории OpenPencil и опубликован как пакет `@open-pencil/vue`.

```ts
import { createEditor } from '@open-pencil/core/editor'
import { provideEditor, useCanvas } from '@open-pencil/vue'
```

## Из чего состоит приложение

В приложении на базе SDK можно выделить три уровня:

1. `@open-pencil/core` — движок редактора, не зависящий от конкретного framework;
2. `@open-pencil/vue` — компонуемые функции и компоненты без предустановленных стилей для Vue;
3. ваше приложение — оформление, маршрутизация, работа с файлами и интерфейс продукта.

## Минимальная настройка

### 1. Создайте редактор

```ts
import { createEditor } from '@open-pencil/core/editor'

const editor = createEditor({
  width: 1200,
  height: 800,
})
```

### 2. Передайте редактор дочерним компонентам Vue

```vue
<script setup lang="ts">
import { provideEditor } from '@open-pencil/vue'

import type { Editor } from '@open-pencil/core/editor'

const props = defineProps<{
  editor: Editor
}>()

provideEditor(props.editor)
</script>

<template>
  <slot />
</template>
```

`provideEditor()` делает экземпляр редактора доступным во всём расположенном ниже дереве компонентов. В документации используется прямой вызов этой функции, поскольку именно он входит в актуальный публичный API.

### 3. Подключите холст

```vue
<script setup lang="ts">
import { ref } from 'vue'

import { useCanvas, useEditor } from '@open-pencil/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()

useCanvas(canvasRef, editor)
</script>

<template>
  <canvas ref="canvasRef" class="size-full" />
</template>
```

## Использование composables

После вызова `provideEditor()` дочерние компоненты могут получать сведения о выделении и выполнять команды редактора:

```ts
import { useEditorCommands, useSelectionState } from '@open-pencil/vue'

const selection = useSelectionState()
const commands = useEditorCommands()
```

## Простой пример

```vue
<script setup lang="ts">
import { ref } from 'vue'

import { useCanvas, useEditor, useSelectionState } from '@open-pencil/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()
const { selectedCount } = useSelectionState()

useCanvas(canvasRef, editor, {
  onReady: () => {
    console.log('Canvas ready')
  },
})
</script>

<template>
  <div class="grid h-full grid-rows-[1fr_auto]">
    <canvas ref="canvasRef" class="size-full" />
    <div class="border-t px-3 py-2 text-xs text-muted">
      Selected: {{ selectedCount }}
    </div>
  </div>
</template>
```

## Что читать дальше

- [Архитектура](./architecture)
- [Справочник API](./api/)
- [useEditor](./api/composables/use-editor)
- [useCanvas](./api/composables/use-canvas)
- [useI18n](./api/composables/use-i18n)
