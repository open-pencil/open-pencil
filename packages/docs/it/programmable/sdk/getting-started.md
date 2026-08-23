---
title: Primi passi con l'SDK
description: Collega @open-pencil/vue, crea un editor e configura l'area di lavoro.
---

# Primi passi con l'SDK

## Installazione

```bash
bun add @open-pencil/core @open-pencil/vue canvaskit-wasm
```

L'SDK si trova nel monorepo OpenPencil ed è pubblicato come pacchetto `@open-pencil/vue`.

```ts
import { createEditor } from '@open-pencil/core/editor'
import { provideEditor, useCanvas } from '@open-pencil/vue'
```

## Livelli dell'applicazione

Un'applicazione basata sull'SDK è composta da tre livelli:

1. `@open-pencil/core` — il motore dell'editor, indipendente dal framework;
2. `@open-pencil/vue` — composable e componenti senza stile per Vue;
3. l'applicazione — stile, routing, gestione dei file e interfaccia specifica del prodotto.

## Configurazione minima

### 1. Crea un editor

```ts
import { createEditor } from '@open-pencil/core/editor'

const editor = createEditor({
  width: 1200,
  height: 800,
})
```

### 2. Rendi disponibile l'editor ai componenti discendenti

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

`provideEditor()` rende l'istanza dell'editor disponibile a tutti i componenti sottostanti. La documentazione chiama direttamente questa funzione perché fa parte dell'attuale API pubblica.

### 3. Collega l'area di lavoro

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

## Utilizzare i composable

Dopo la chiamata a `provideEditor()`, i componenti discendenti possono leggere la selezione ed eseguire i comandi dell'editor:

```ts
import { useEditorCommands, useSelectionState } from '@open-pencil/vue'

const selection = useSelectionState()
const commands = useEditorCommands()
```

## Esempio semplice

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
