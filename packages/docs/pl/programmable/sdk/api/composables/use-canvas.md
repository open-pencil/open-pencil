---
title: useCanvas
description: Podłączenie renderer opartego na CanvasKit do elementu canvas edytora OpenPencil.
---

# useCanvas

`useCanvas()` łączy edytor z elementem `<canvas>`.

Obsługuje:

- inicjalizację CanvasKit;
- tworzenie surface;
- planowanie rendering;
- zmianę rozmiaru;
- opcjonalne rulers;
- wywołanie function po przygotowaniu renderer.

## Użycie

```ts
import { ref } from 'vue'

import { useCanvas, useEditor } from '@open-pencil/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()

useCanvas(canvasRef, editor)
```

## Przykład

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

### Wyłączenie rulers w osadzonym preview

```ts
useCanvas(canvasRef, editor, {
  showRulers: false,
})
```

### Zachowanie drawing buffer dla zrzutów

```ts
useCanvas(canvasRef, editor, {
  preserveDrawingBuffer: true,
})
```

## Uwagi

- `useCanvas()` pracuje z renderer i jest przeznaczone dla browser.
- Zarządza działającym obszarem roboczym, ale nie otwieraniem ani zapisywaniem plików.
- Do obsługi działań użytkownika zwykle uzupełnia je `useCanvasInput()`.

## Zobacz też

- [useEditor](./use-editor)
- [useCanvasInput](./use-canvas-input)
- [useTextEdit](./use-text-edit)

## Typ

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
