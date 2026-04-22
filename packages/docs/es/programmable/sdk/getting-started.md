---
title: Primeros pasos con el SDK
description: Configura @open-pencil/vue con createEditor, provideEditor y un canvas.
---

# Primeros pasos con el SDK

## Instalación

```bash
bun add @open-pencil/core @open-pencil/vue canvaskit-wasm
```

El SDK vive en el monorepo hoy en día y también se publica como `@open-pencil/vue`.

```ts
import { createEditor } from '@open-pencil/core/editor'
import { provideEditor, useCanvas } from '@open-pencil/vue'
```

## Modelo mental

Hay tres capas:

1. `@open-pencil/core` — motor del editor independiente del framework
2. `@open-pencil/vue` — composables de Vue y primitivos headless
3. tu app — estilos, enrutamiento, flujos de archivos, UI específica del producto

## Configuración mínima

### 1. Crear un editor

```ts
import { createEditor } from '@open-pencil/core/editor'

const editor = createEditor({
  width: 1200,
  height: 800,
})
```

### 2. Proporcionarlo a Vue

```vue
<script setup lang="ts">
import { provideEditor } from '@open-pencil/vue'

import type { Editor } from '@open-pencil/core/editor'

const props = defineProps<{
  editor: Editor
}>()

provideEditor(props.editor)
</script>

<template>
  <slot />
</template>
```

Puedes pensar en esto como la capa proveedora del árbol del editor. La documentación prefiere usar `provideEditor()` directamente porque esa es la superficie de API real actual.

### 3. Adjuntar un canvas

```vue
<script setup lang="ts">
import { ref } from 'vue'

import { useCanvas, useEditor } from '@open-pencil/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()

useCanvas(canvasRef, editor)
</script>

<template>
  <canvas ref="canvasRef" class="size-full" />
</template>
```

## Usar composables

Una vez que el editor está disponible, los componentes hijo pueden leer la selección y emitir comandos:

```ts
import { useEditorCommands, useSelectionState } from '@open-pencil/vue'

const selection = useSelectionState()
const commands = useEditorCommands()
```

## Ejemplo básico

```vue
<script setup lang="ts">
import { ref } from 'vue'

import { useCanvas, useEditor, useSelectionState } from '@open-pencil/vue'

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
      Seleccionados: {{ selectedCount }}
    </div>
  </div>
</template>
```

## Siguientes pasos

- [Arquitectura](./architecture)
- [Referencia de API](./api/)
- [useEditor](./api/composables/use-editor)
- [useCanvas](./api/composables/use-canvas)
- [useI18n](./api/composables/use-i18n)
