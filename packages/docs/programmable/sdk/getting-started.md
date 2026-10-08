---
title: SDK Getting Started
description: Set up @open-pencil/vue with createEditor, provideEditor, and a canvas.
---

# SDK Getting Started

## Installation

```bash
bun add @open-pencil/core @open-pencil/scene-graph @open-pencil/vue canvaskit-wasm
```

The SDK lives in the monorepo and is published as `@open-pencil/vue`. The current development version requires Vue `^3.5.41` and, when using its optional CanvasKit peer, `canvaskit-wasm >=0.41.1`. Check the installed package's peer requirements when using an older release.

```ts
import { createEditor } from '@open-pencil/core/editor'
import { provideEditor, useCanvas } from '@open-pencil/vue'
```

## Mental model

There are three layers:

1. `@open-pencil/core` — framework-agnostic editor engine
2. `@open-pencil/vue` — Vue composables and headless primitives
3. your app — styling, routing, file flows, product-specific UI

## Minimal setup

### 1. Create an editor

```ts twoslash
// @module: esnext
// @moduleResolution: bundler
// ---cut---
import { reactive } from 'vue'
import { createDefaultEditorState, createEditor } from '@open-pencil/core/editor'
import { SceneGraph } from '@open-pencil/scene-graph'

const graph = new SceneGraph()
const page = graph.getPages()[0]
if (!page) throw new Error('Expected an initial page')

const editor = createEditor({
  graph,
  state: reactive(createDefaultEditorState(page.id)),
  getViewportSize: () => ({ width: 1200, height: 800 }),
})
```

Core state is framework-neutral; passing reactive state lets Vue controls observe editor changes. For a resizable editor, have `getViewportSize` return the current canvas container dimensions. `width` and `height` are not `EditorOptions` properties.

Icons come from Iconify by default. To serve them from elsewhere, such as a bundled or self-hosted set, pass an `IconProvider` from `@open-pencil/core/icons` as `icons`; the editor's commands, its icon picker, and its AI tools all use it.

### 2. Provide it to Vue

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

You can think of this as the provider layer for the editor tree. The docs prefer `provideEditor()` directly because that is the current real API surface.

### 3. Attach a canvas

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

## Using composables

Once the editor is provided, child components can read selection and issue commands:

```ts
import { useEditorCommands, useSelectionState } from '@open-pencil/vue'

const selection = useSelectionState()
const commands = useEditorCommands()
```

## Basic example

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
      Selected: {{ selectedCount }}
    </div>
  </div>
</template>
```

## Migrating from v0.14.0

These changes describe the current development version; use them when upgrading beyond v0.14.0.

- **Scene Graph overrides:** replace `SceneNode.overrides` records with `instanceOverrides`, whose `self` and `descendants` maps distinguish instance-level and descendant overrides. Use the public override helpers from `@open-pencil/scene-graph` rather than treating this as a simple field rename.
- **Derived geometry:** rename `figmaDerivedLayout` to `derivedLayout`, `figmaDerivedTextGlyphs` to `derivedTextGlyphs`, and the exported `FigmaDerivedTextGlyph` type to `DerivedTextGlyph`.
- **Binding providers:** implement `getBindingId()` and handle `unresolved`. For `edit-variable`, replace `setValue()` with `prepareEdit()`, which captures the edit key, value, setter, and restoration callback. See [BindableValue](./api/components/bindable-value).
- **Translations:** replace `useDialogMessages()` and `dialogMessages` with the relevant product-domain composables and catalogs, such as `useSettingsMessages()` or `useRenameMessages()`. Catalog keys have also moved; do not just rename the import. See [useI18n](./api/composables/use-i18n).
- **CanvasKit:** use `PathBuilder` for mutable construction and retain the returned paths from immutable `Path` operations instead of expecting in-place mutation.
- **Custom tools:** use native Valibot `input` schemas and execution metadata instead of `params`, `ParamDef`, or `paramToZod()`. Programmatic MCP integrations use MCP SDK v2 server/client types; see [MCP](../mcp-server).

## Next steps

- [Architecture](./architecture)
- [API Reference](./api/)
- [useEditor](./api/composables/use-editor)
- [useCanvas](./api/composables/use-canvas)
- [useI18n](./api/composables/use-i18n)
