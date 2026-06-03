---
title: Начало работы с SDK
description: Настройка @inkly/vue с createEditor, provideEditor и холстом.
---

# Начало работы с SDK

## Установка

```bash
bun add @inkly/core @inkly/vue canvaskit-wasm
```

SDK находится в монорепозитории и также опубликован как `@inkly/vue`.

```ts
import { createEditor } from '@inkly/core/editor'
import { provideEditor, useCanvas } from '@inkly/vue'
```

## Концептуальная модель

Три уровня:

1. `@inkly/core` — не зависящий от фреймворка движок редактора
2. `@inkly/vue` — Vue-компосаблы и headless-примитивы
3. ваше приложение — стили, маршрутизация, файловые потоки, UI под конкретный продукт

## Минимальная настройка

### 1. Создайте редактор

```ts
import { createEditor } from '@inkly/core/editor'

const editor = createEditor({
  width: 1200,
  height: 800,
})
```

### 2. Передайте его в Vue

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

Это слой-провайдер для дерева редактора. В документации предпочтителен вызов `provideEditor()` напрямую — это актуальная поверхность API.

### 3. Подключите холст

```vue
<script setup lang="ts">
import { ref } from 'vue'

import { useCanvas, useEditor } from '@inkly/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()

useCanvas(canvasRef, editor)
</script>

<template>
  <canvas ref="canvasRef" class="size-full" />
</template>
```

## Использование компосаблов

После того как редактор передан через провайдер, дочерние компоненты могут читать выделение и вызывать команды:

```ts
import { useEditorCommands, useSelectionState } from '@inkly/vue'

const selection = useSelectionState()
const commands = useEditorCommands()
```

## Базовый пример

```vue
<script setup lang="ts">
import { ref } from 'vue'

import { useCanvas, useEditor, useSelectionState } from '@inkly/vue'

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

## Следующие шаги

- [Архитектура](./architecture)
- [Справочник API](./api/)
- [useEditor](./api/composables/use-editor)
- [useCanvas](./api/composables/use-canvas)
- [useI18n](./api/composables/use-i18n)
