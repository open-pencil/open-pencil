---
title: Начало работы с SDK
description: Подключение @lawha/vue, создание редактора и настройка холста.
---

# Начало работы с SDK

## Установка

```bash
bun add @lawha/core @lawha/vue canvaskit-wasm
```

SDK находится в монорепозитории Lawha и опубликован как пакет `@lawha/vue`.

```ts
import { createEditor } from '@lawha/core'
import { provideEditor } from '@lawha/vue'
import { useCanvas } from '@lawha/vue/canvas/surface'
```

## Из чего состоит приложение

В приложении на базе SDK можно выделить три уровня:

1. `@lawha/core` — движок редактора, не зависящий от конкретного framework;
2. `@lawha/vue` — компонуемые функции и компоненты без предустановленных стилей для Vue;
3. ваше приложение — оформление, маршрутизация, работа с файлами и интерфейс продукта.

## Минимальная настройка

### 1. Создайте редактор

```ts
import { createEditor } from '@lawha/core'

const editor = createEditor({
  width: 1200,
  height: 800,
})
```

### 2. Передайте редактор дочерним компонентам Vue

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

`provideEditor()` делает экземпляр редактора доступным во всём расположенном ниже дереве компонентов. В документации используется прямой вызов этой функции, поскольку именно он входит в актуальный публичный API.

### 3. Подключите холст

```vue
<script setup lang="ts">
import { ref } from 'vue'

import { useCanvas } from '@lawha/vue/canvas/surface'
import { useEditor } from '@lawha/vue'

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
import { useEditorCommands } from '@lawha/vue/editor/commands'
import { useSelectionState } from '@lawha/vue/editor/selection-state'

const selection = useSelectionState()
const commands = useEditorCommands()
```

## Простой пример

```vue
<script setup lang="ts">
import { ref } from 'vue'

import { useCanvas } from '@lawha/vue/canvas/surface'
import { useEditor } from '@lawha/vue'
import { useSelectionState } from '@lawha/vue/editor/selection-state'

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
