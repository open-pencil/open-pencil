---
title: useCanvas
description: Подключение отрисовки CanvasKit к элементу canvas редактора OpenPencil.
---

# useCanvas

`useCanvas()` подключает редактор к элементу `<canvas>`.

Обрабатывает:

- инициализацию CanvasKit
- создание surface;
- постановку отрисовки в очередь;
- изменение размера;
- отображение линеек, если оно включено;
- вызов функции после готовности renderer.

## Использование

```ts
import { ref } from 'vue'

import { useCanvas, useEditor } from '@open-pencil/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()

useCanvas(canvasRef, editor)
```

## Базовый пример

```vue
<script setup lang="ts">
import { ref } from 'vue'

import { useCanvas, useEditor } from '@open-pencil/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()

useCanvas(canvasRef, editor, {
  showRulers: true,
  onReady: () => {
    console.log('Renderer ready')
  },
})
</script>

<template>
  <canvas ref="canvasRef" class="size-full" />
</template>
```

## Практические примеры

### Отключить линейки для встроенного превью

```ts
useCanvas(canvasRef, editor, {
  showRulers: false,
})
```

### Сохранить drawing buffer для снимков экрана

```ts
useCanvas(canvasRef, editor, {
  preserveDrawingBuffer: true,
})
```

## Примечания

- `useCanvas()` работает с renderer и предназначен для браузера;
- он управляет работающим холстом, но не открытием и сохранением файлов;
- для обработки действий пользователя его обычно дополняют `useCanvasInput()`.

## Связанные API

- [useEditor](./use-editor)
- [useCanvasInput](./use-canvas-input)
- [useTextEdit](./use-text-edit)

## Тип

```ts
interface UseCanvasOptions {
  showRulers?: boolean
  preserveDrawingBuffer?: boolean
  onReady?: () => void
}

function useCanvas(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor,
  options?: UseCanvasOptions,
): void
```
