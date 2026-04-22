---
title: useCanvas
description: Collega il rendering basato su CanvasKit a un elemento canvas per un editor OpenPencil.
---

# useCanvas

`useCanvas()` connette un editor a un elemento `<canvas>` reale.

Gestisce:

- l'inizializzazione di CanvasKit
- la creazione della superficie
- la pianificazione del rendering
- la gestione del ridimensionamento
- la visibilità opzionale dei righelli
- il callback di disponibilità del renderer

## Utilizzo

```ts
import { ref } from 'vue'

import { useCanvas, useEditor } from '@open-pencil/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()

useCanvas(canvasRef, editor)
```

## Esempio base

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

## Esempi pratici

### Disabilita i righelli per un'anteprima integrata

```ts
useCanvas(canvasRef, editor, {
  showRulers: false,
})
```

### Mantieni il drawing buffer per gli screenshot

```ts
useCanvas(canvasRef, editor, {
  preserveDrawingBuffer: true,
})
```

## Note

- `useCanvas()` è rivolto al renderer ed è in pratica solo browser
- è responsabile della pipeline canvas in tempo reale, non dei flussi di file a livello di app
- dovrebbe di solito essere abbinato a `useCanvasInput()` per la gestione delle interazioni

## API correlate

- [useEditor](./use-editor)
- [useCanvasInput](./use-canvas-input)
- [useTextEdit](./use-text-edit)

## Tipo

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
