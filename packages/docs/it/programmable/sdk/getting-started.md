---
title: Primi passi con l'SDK
description: Collega @lawha/vue, crea un editor e configura l'area di lavoro.
---

# Primi passi con l'SDK

## Installazione

```bash
bun add @lawha/core @lawha/vue canvaskit-wasm
```

L'SDK si trova nel monorepo Lawha ed è pubblicato come pacchetto `@lawha/vue`.

```ts
import { createEditor } from '@lawha/core'
import { provideEditor } from '@lawha/vue'
import { useCanvas } from '@lawha/vue/canvas/surface'
```

## Livelli dell'applicazione

Un'applicazione basata sull'SDK è composta da tre livelli:

1. `@lawha/core` — il motore dell'editor, indipendente dal framework;
2. `@lawha/vue` — composable e componenti senza stile per Vue;
3. l'applicazione — stile, routing, gestione dei file e interfaccia specifica del prodotto.

## Configurazione minima

### 1. Crea un editor

```ts
import { createEditor } from '@lawha/core'

const editor = createEditor({
  width: 1200,
  height: 800,
})
```

### 2. Rendi disponibile l'editor ai componenti discendenti

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

`provideEditor()` rende l'istanza dell'editor disponibile a tutti i componenti sottostanti. La documentazione chiama direttamente questa funzione perché fa parte dell'attuale API pubblica.

### 3. Collega l'area di lavoro

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

## Utilizzare i composable

Dopo la chiamata a `provideEditor()`, i componenti discendenti possono leggere la selezione ed eseguire i comandi dell'editor:

```ts
import { useEditorCommands } from '@lawha/vue/editor/commands'
import { useSelectionState } from '@lawha/vue/editor/selection-state'

const selection = useSelectionState()
const commands = useEditorCommands()
```

## Esempio semplice

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
      Selezionati: {{ selectedCount }}
    </div>
  </div>
</template>
```

## Passaggi successivi

- [Architettura](./architecture)
- [Riferimento API](./api/)
- [useEditor](./api/composables/use-editor)
- [useCanvas](./api/composables/use-canvas)
- [useI18n](./api/composables/use-i18n)
