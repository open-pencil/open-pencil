---
title: useCanvas
description: Adjunta el renderizado respaldado por CanvasKit a un elemento canvas para un editor de OpenPencil.
---

# useCanvas

`useCanvas()` conecta un editor a un elemento `<canvas>` real.

Se encarga de:

- inicialización de CanvasKit
- creación de la superficie
- programación del renderizado
- gestión del redimensionado
- visibilidad opcional de las reglas
- callback de disponibilidad del renderer

## Uso

```ts
import { ref } from 'vue'

import { useCanvas, useEditor } from '@open-pencil/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()

useCanvas(canvasRef, editor)
```

## Ejemplo básico

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

## Ejemplos prácticos

### Deshabilitar las reglas para una vista previa integrada

```ts
useCanvas(canvasRef, editor, {
  showRulers: false,
})
```

### Conservar el buffer de dibujo para capturas de pantalla

```ts
useCanvas(canvasRef, editor, {
  preserveDrawingBuffer: true,
})
```

## Notas

- `useCanvas()` está orientado al renderer y es de uso exclusivo en el navegador en la práctica
- es responsable del pipeline de canvas en vivo, no de los flujos de archivos a nivel de app
- normalmente debe combinarse con `useCanvasInput()` para el manejo de interacciones

## APIs relacionadas

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
