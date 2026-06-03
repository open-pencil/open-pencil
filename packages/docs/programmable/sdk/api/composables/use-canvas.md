---
title: useCanvas
description: Attach CanvasKit-backed rendering to a canvas element for an Inkly editor.
---

# useCanvas

`useCanvas()` connects an editor to a real `<canvas>` element.

It handles:

- CanvasKit initialization
- surface creation
- render scheduling
- resize handling
- optional ruler visibility
- renderer readiness callback

## Usage

```ts
import { ref } from 'vue'

import { useCanvas, useEditor } from '@inkly/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()

useCanvas(canvasRef, editor)
```

## Basic example

```vue
<script setup lang="ts">
import { ref } from 'vue'

import { useCanvas, useEditor } from '@inkly/vue'

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

## Practical examples

### Disable rulers for an embedded preview

```ts
useCanvas(canvasRef, editor, {
  showRulers: false,
})
```

### Keep drawing buffer for screenshots

```ts
useCanvas(canvasRef, editor, {
  preserveDrawingBuffer: true,
})
```

## Notes

- `useCanvas()` is renderer-facing and browser-only in practice
- it is responsible for the live canvas pipeline, not app-level file flows
- it should usually be paired with `useCanvasInput()` for interaction handling

## Related APIs

- [useEditor](./use-editor)
- [useCanvasInput](./use-canvas-input)
- [useTextEdit](./use-text-edit)

## Type

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
