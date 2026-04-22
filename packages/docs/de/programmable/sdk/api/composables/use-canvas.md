---
title: useCanvas
description: CanvasKit-gestütztes Rendering an ein Canvas-Element für einen OpenPencil-Editor anbinden.
---

# useCanvas

`useCanvas()` verbindet einen Editor mit einem echten `<canvas>`-Element.

Es übernimmt:

- CanvasKit-Initialisierung
- Surface-Erstellung
- Render-Scheduling
- Größenänderungsbehandlung
- optionale Lineal-Sichtbarkeit
- Renderer-Bereitschafts-Callback

## Verwendung

```ts
import { ref } from 'vue'

import { useCanvas, useEditor } from '@open-pencil/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()

useCanvas(canvasRef, editor)
```

## Einfaches Beispiel

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

## Praktische Beispiele

### Lineale für eine eingebettete Vorschau deaktivieren

```ts
useCanvas(canvasRef, editor, {
  showRulers: false,
})
```

### Zeichenpuffer für Screenshots erhalten

```ts
useCanvas(canvasRef, editor, {
  preserveDrawingBuffer: true,
})
```

## Hinweise

- `useCanvas()` ist renderer-seitig und in der Praxis nur im Browser verfügbar
- es ist für die Live-Canvas-Pipeline verantwortlich, nicht für app-seitige Datei-Flows
- es sollte in der Regel mit `useCanvasInput()` für die Interaktionsbehandlung kombiniert werden

## Verwandte APIs

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
