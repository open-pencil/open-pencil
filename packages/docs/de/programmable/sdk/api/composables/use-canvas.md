---
title: useCanvas
description: Den CanvasKit renderer mit einem Canvas element und einem OpenPencil-Editor verbinden.
---

# useCanvas

`useCanvas()` verbindet eine Editor-Instanz mit einem `<canvas>` element.

Das composable übernimmt:

- CanvasKit initialization;
- Erstellen der Surface;
- Scheduling von Rendering;
- Resize handling;
- optionale Rulers;
- Callback nach Initialisierung des Renderer.

## Verwendung

```ts
import { ref } from 'vue'

import { useCanvas, useEditor } from '@open-pencil/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()

useCanvas(canvasRef, editor)
```

## Beispiel

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

### Rulers in einem eingebetteten Preview ausblenden

```ts
useCanvas(canvasRef, editor, {
  showRulers: false,
})
```

### Drawing buffer für Screenshots erhalten

```ts
useCanvas(canvasRef, editor, {
  preserveDrawingBuffer: true,
})
```

## Hinweise

- `useCanvas()` integriert den Renderer und ist für Browser environments vorgesehen.
- Es verwaltet den aktiven Canvas, nicht das Öffnen oder Speichern von Dateien.
- Für Pointer interactions wird es gewöhnlich mit `useCanvasInput()` kombiniert.

## Siehe auch

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
