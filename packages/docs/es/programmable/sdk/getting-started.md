---
title: Primeros pasos con el SDK
description: Conecta @lawha/vue, crea un editor y configura el lienzo.
---

# Primeros pasos con el SDK

## Instalación

```bash
bun add @lawha/core @lawha/vue canvaskit-wasm
```

El SDK se encuentra en el monorepo de Lawha y se publica como paquete `@lawha/vue`.

```ts
import { createEditor } from '@lawha/core'
import { provideEditor } from '@lawha/vue'
import { useCanvas } from '@lawha/vue/canvas/surface'
```

## Capas de la aplicación

Una aplicación basada en el SDK consta de tres capas:

1. `@lawha/core` — el motor del editor, independiente del framework;
2. `@lawha/vue` — composables y componentes sin estilos para Vue;
3. la aplicación — estilos, routing, gestión de archivos e interfaz específica del producto.

## Configuración mínima

### 1. Crea un editor

```ts
import { createEditor } from '@lawha/core'

const editor = createEditor({
  width: 1200,
  height: 800,
})
```

### 2. Proporciona el editor a los componentes descendientes

```vue
<script setup lang="ts">
import { provideEditor } from '@lawha/vue'

import type { Editor } from '@lawha/core'

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

import { useCanvas } from '@lawha/vue/canvas/surface'
import { useEditor } from '@lawha/vue'

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
import { useEditorCommands } from '@lawha/vue/editor/commands'
import { useSelectionState } from '@lawha/vue/editor/selection-state'

const selection = useSelectionState()
const commands = useEditorCommands()
```

## Ejemplo sencillo

```vue
<script setup lang="ts">
import { ref } from 'vue'

import { useCanvas } from '@lawha/vue/canvas/surface'
import { useEditor } from '@lawha/vue'
import { useSelectionState } from '@lawha/vue/editor/selection-state'

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
