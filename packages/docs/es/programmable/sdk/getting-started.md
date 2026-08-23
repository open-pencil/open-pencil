---
title: Primeros pasos con el SDK
description: Conecta @open-pencil/vue, crea un editor y configura el lienzo.
---

# Primeros pasos con el SDK

## Instalación

```bash
bun add @open-pencil/core @open-pencil/vue canvaskit-wasm
```

El SDK se encuentra en el monorepo de OpenPencil y se publica como paquete `@open-pencil/vue`.

```ts
import { createEditor } from '@open-pencil/core/editor'
import { provideEditor, useCanvas } from '@open-pencil/vue'
```

## Capas de la aplicación

Una aplicación basada en el SDK consta de tres capas:

1. `@open-pencil/core` — el motor del editor, independiente del framework;
2. `@open-pencil/vue` — composables y componentes sin estilos para Vue;
3. la aplicación — estilos, routing, gestión de archivos e interfaz específica del producto.

## Configuración mínima

### 1. Crea un editor

```ts
import { createEditor } from '@open-pencil/core/editor'

const editor = createEditor({
  width: 1200,
  height: 800,
})
```

### 2. Proporciona el editor a los componentes descendientes

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

`provideEditor()` permite que todos los componentes situados por debajo accedan a la instancia del editor. La documentación llama directamente a esta función porque forma parte de la API pública actual.

### 3. Conecta el lienzo

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

## Uso de composables

Después de llamar a `provideEditor()`, los componentes descendientes pueden consultar la selección y ejecutar comandos del editor:

```ts
import { useEditorCommands, useSelectionState } from '@open-pencil/vue'

const selection = useSelectionState()
const commands = useEditorCommands()
```

## Ejemplo sencillo

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
- [Referencia de la API](./api/)
- [useEditor](./api/composables/use-editor)
- [useCanvas](./api/composables/use-canvas)
- [useI18n](./api/composables/use-i18n)
