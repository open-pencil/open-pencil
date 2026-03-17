# @open-pencil/vue

Headless Vue 3 SDK for embedding an OpenPencil design editor. Renderless components expose logic via scoped slots — bring your own UI.

## Install

```bash
npm install @open-pencil/vue @open-pencil/core canvaskit-wasm
```

## Quick start

```vue
<script setup>
import { createEditor } from '@open-pencil/core/editor'
import { OpenPencilProvider, OpenPencilCanvas } from '@open-pencil/vue'

const editor = createEditor()
editor.createShape('RECTANGLE', 100, 100, 200, 150)
editor.zoomToFit()
</script>

<template>
  <OpenPencilProvider :editor="editor">
    <OpenPencilCanvas style="width: 100%; height: 100vh" />
  </OpenPencilProvider>
</template>
```

## Components

All components are **renderless** — they provide data and actions via scoped slots. You control the markup and styling.

### `<OpenPencilProvider>`

Provides the editor instance to all child components via Vue injection.

```vue
<OpenPencilProvider :editor="editor">
  <slot />
</OpenPencilProvider>
```

### `<OpenPencilCanvas>`

Renders the CanvasKit/Skia drawing surface. Handles WebGL/WebGPU setup, resize, and the render loop.

| Prop | Type | Description |
|------|------|-------------|
| `showRulers` | `boolean?` | Override ruler visibility |
| `preserveDrawingBuffer` | `boolean?` | Keep buffer for screenshots |
| `onReady` | `() => void` | Called when surface is ready |

### `<PageList>`

Exposes page data and navigation.

```vue
<PageList v-slot="{ pages, currentPageId, switchPage, addPage, deletePage, renamePage }">
  <div v-for="page in pages" :key="page.id" @click="switchPage(page.id)">
    {{ page.name }}
  </div>
</PageList>
```

### `<LayerTree>`

Exposes the flattened layer tree with selection state.

```vue
<LayerTree v-slot="{ layers, selectedIds, select, toggleVisibility, toggleLock }">
  <div
    v-for="layer in layers" :key="layer.node.id"
    :style="{ paddingLeft: layer.depth * 16 + 'px' }"
    @click="select([layer.node.id])"
  >
    {{ layer.node.name }}
  </div>
</LayerTree>
```

### `<ToolSelector>`

Exposes the active tool and setter.

```vue
<ToolSelector v-slot="{ activeTool, setTool }">
  <button :class="{ active: activeTool === 'SELECT' }" @click="setTool('SELECT')">Select</button>
  <button :class="{ active: activeTool === 'RECTANGLE' }" @click="setTool('RECTANGLE')">Rectangle</button>
</ToolSelector>
```

### `<NodeProperties>`

Exposes the selected node and an update function.

```vue
<NodeProperties v-slot="{ node, update }">
  <div v-if="node">
    <input :value="node.x" @change="update({ x: +$event.target.value })" />
  </div>
</NodeProperties>
```

## Composables

### `useEditor()`

Access the editor instance from any descendant of `<OpenPencilProvider>`.

```ts
import { useEditor } from '@open-pencil/vue'

const editor = useEditor()
editor.createShape('ELLIPSE', 0, 0, 100, 100)
```

### `useCanvas(canvasRef, editor, options?)`

Low-level composable for CanvasKit surface lifecycle. Used internally by `<OpenPencilCanvas>` — use directly only if you need custom canvas setup.

## Example

Run the included example:

```bash
cd packages/vue/example
bun install
bun run dev
```
