---
title: Pierwsze kroki z SDK
description: Skonfiguruj @open-pencil/vue z createEditor, provideEditor i kanwasem.
---

# Pierwsze kroki z SDK

## Instalacja

```bash
bun add @open-pencil/core @open-pencil/vue canvaskit-wasm
```

SDK mieszka dziś w monorepo i jest również publikowany jako `@open-pencil/vue`.

```ts
import { createEditor } from '@open-pencil/core/editor'
import { provideEditor, useCanvas } from '@open-pencil/vue'
```

## Model mentalny

Są trzy warstwy:

1. `@open-pencil/core` — silnik edytora niezależny od frameworka
2. `@open-pencil/vue` — kompozyty Vue i bezstanowe prymitywy
3. twoja aplikacja — stylowanie, routing, przepływy plików, UI specyficzne dla produktu

## Minimalna konfiguracja

### 1. Utwórz edytor

```ts
import { createEditor } from '@open-pencil/core/editor'

const editor = createEditor({
  width: 1200,
  height: 800,
})
```

### 2. Dostarcz go do Vue

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

Możesz traktować to jako warstwę dostawcy dla drzewa edytora. Dokumentacja preferuje bezpośrednie użycie `provideEditor()`, ponieważ to jest rzeczywista powierzchnia API.

### 3. Podłącz kanvas

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

## Używanie kompozytów

Gdy edytor jest dostarczony, komponenty potomne mogą odczytywać selekcję i wydawać polecenia:

```ts
import { useEditorCommands, useSelectionState } from '@open-pencil/vue'

const selection = useSelectionState()
const commands = useEditorCommands()
```

## Podstawowy przykład

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
      Zaznaczono: {{ selectedCount }}
    </div>
  </div>
</template>
```

## Następne kroki

- [Architektura](./architecture)
- [Dokumentacja API](./api/)
- [useEditor](./api/composables/use-editor)
- [useCanvas](./api/composables/use-canvas)
- [useI18n](./api/composables/use-i18n)
