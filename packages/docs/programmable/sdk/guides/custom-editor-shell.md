---
title: Custom Editor Shell
description: Build your own editor shell with provideEditor, CanvasRoot, menus, panels, and toolbars.
---

# Custom Editor Shell

A typical OpenPencil Vue app has three layers:

1. `@open-pencil/core` creates the editor
2. `@open-pencil/vue` adapts it into Vue composables and headless primitives
3. your app renders the shell, styling, and product UX

## Why this matters

The built-in OpenPencil app is only one possible shell.

You can build a very different one for a focused workflow: an embedded editor inside another product, an internal asset tool, a template editor, an annotation UI, or an AI-assisted editing surface with custom controls.

That is the main reason the SDK exists.

## Recommended composition

A practical shell often looks like this:

- provider at the top with `provideEditor()`
- canvas in the center
- page/layer navigation on one side
- properties on the other side
- menus and toolbars driven by composables

## Example

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import { createDefaultEditorState, createEditor } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'
import { provideEditor } from '@open-pencil/vue'
import { CanvasRoot, CanvasSurface } from '@open-pencil/vue/canvas'
import { ToolbarRoot } from '@open-pencil/vue/primitives/Toolbar'
import { PageListRoot } from '@open-pencil/vue/primitives/PageList'

const graph = new SceneGraph()
const page = graph.getPages()[0]
if (!page) throw new Error('Expected an initial page')

const editor = createEditor({
  graph,
  state: reactive(createDefaultEditorState(page.id)),
  getViewportSize: () => ({ width: 1440, height: 900 }),
})
provideEditor(editor)
</script>

<template>
  <div class="grid h-screen grid-cols-[240px_1fr_320px] grid-rows-[48px_1fr]">
    <ToolbarRoot v-slot="{ tools, activeTool, actions }">
      <header class="col-span-3 flex items-center gap-2 border-b px-3">
        <button
          v-for="tool in tools"
          :key="tool.key"
          :data-active="activeTool === tool.key"
          @click="actions.setTool(tool.key)"
        >
          {{ tool.label }}
        </button>
      </header>
    </ToolbarRoot>

    <aside class="border-r">
      <PageListRoot v-slot="{ pages, currentPageId, actions }">
        <nav>
          <button
            v-for="page in pages"
            :key="page.id"
            :data-active="page.id === currentPageId"
            @click="actions.switch(page.id)"
          >
            {{ page.name }}
          </button>
        </nav>
      </PageListRoot>
    </aside>

    <main>
      <CanvasRoot>
        <CanvasSurface class="size-full" />
      </CanvasRoot>
    </main>

    <aside class="border-l">
      Properties panel here
    </aside>
  </div>
</template>
```

The fixed viewport dimensions above keep the example short. In a resizable shell, return the actual canvas container size from `getViewportSize`; do not include the surrounding sidebars or toolbar. See [SDK Getting Started](../getting-started) for installation requirements and migration notes.

## Why this split works

- the SDK owns editor integration and reusable headless logic
- your app owns layout, styling, and product-specific actions
- composables can power menus and panels without extra wrapper components

## Related APIs

- [provideEditor](../api/composables/provide-editor)
- [useCanvas](../api/composables/use-canvas)
- [ToolbarRoot](../api/components/toolbar-root)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
