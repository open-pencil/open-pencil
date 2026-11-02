---
title: Pierwsze kroki z SDK
description: Podłącz @lawha/vue, utwórz edytor i skonfiguruj obszar roboczy.
---

# Pierwsze kroki z SDK

## Instalacja

```bash
bun add @lawha/core @lawha/vue canvaskit-wasm
```

SDK znajduje się w monorepo Lawha i jest publikowany jako pakiet `@lawha/vue`.

```ts
import { createEditor } from '@lawha/core'
import { provideEditor } from '@lawha/vue'
import { useCanvas } from '@lawha/vue/canvas/surface'
```

## Warstwy aplikacji

Aplikacja oparta na SDK składa się z trzech warstw:

1. `@lawha/core` — silnik edytora niezależny od frameworka;
2. `@lawha/vue` — composables i komponenty bez narzuconego wyglądu dla Vue;
3. aplikacja — wygląd, routing, obsługa plików i interfejs produktu.

## Minimalna konfiguracja

### 1. Utwórz edytor

```ts
import { createEditor } from '@lawha/core'

const editor = createEditor({
  width: 1200,
  height: 800,
})
```

### 2. Udostępnij edytor komponentom potomnym

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

`provideEditor()` udostępnia instancję edytora wszystkim komponentom znajdującym się niżej w drzewie. Dokumentacja wywołuje tę funkcję bezpośrednio, ponieważ należy ona do aktualnego publicznego API.

### 3. Podłącz obszar roboczy

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

## Korzystanie z composables

Po wywołaniu `provideEditor()` komponenty potomne mogą odczytywać zaznaczenie i wykonywać polecenia edytora:

```ts
import { useEditorCommands } from '@lawha/vue/editor/commands'
import { useSelectionState } from '@lawha/vue/editor/selection-state'

const selection = useSelectionState()
const commands = useEditorCommands()
```

## Prosty przykład

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
      Zaznaczono: {{ selectedCount }}
    </div>
  </div>
</template>
```

## Co dalej

- [Architektura](./architecture)
- [Dokumentacja API](./api/)
- [useEditor](./api/composables/use-editor)
- [useCanvas](./api/composables/use-canvas)
- [useI18n](./api/composables/use-i18n)
