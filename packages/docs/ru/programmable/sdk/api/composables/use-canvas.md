---
title: useCanvas
description: Подключение рендеринга на базе CanvasKit к элементу canvas для редактора OpenPencil.
---

# useCanvas

`useCanvas()` подключает редактор к реальному элементу `<canvas>`.

Обрабатывает:

- инициализацию CanvasKit
- создание поверхности
- планирование рендеринга
- обработку изменения размера
- опциональное отображение линеек
- коллбэк готовности рендерера

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

### Сохранять буфер рисования для скриншотов

```ts
useCanvas(canvasRef, editor, {
  preserveDrawingBuffer: true,
})
```

## Примечания

- `useCanvas()` работает с рендерером и на практике используется только в браузере
- отвечает за конвейер живого холста, а не за файловые потоки на уровне приложения
- обычно следует использовать вместе с `useCanvasInput()` для обработки взаимодействий

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
