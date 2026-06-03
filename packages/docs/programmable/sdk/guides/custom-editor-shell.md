---
title: Custom Editor Shell
description: Build your own editor shell with provideEditor, CanvasRoot, menus, panels, and toolbars.
---

# Custom Editor Shell

A typical Inkly Vue app has three layers:

1. `@inkly/core` creates the editor
2. `@inkly/vue` adapts it into Vue composables and headless primitives
3. your app renders the shell, styling, and product UX

## Why this matters

The built-in Inkly app is only one possible shell.

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
import { createEditor } from '@inkly/core/editor'
import {
  provideEditor,
  CanvasRoot,
  CanvasSurface,
  ToolbarRoot,
  PageListRoot,
  LayerTreeRoot,
} from '@inkly/vue'

const editor = createEditor({ width: 1440, height: 900 })
provideEditor(editor)
</script>

<template>
  <div class="grid h-screen grid-cols-[240px_1fr_320px] grid-rows-[48px_1fr]">
    <ToolbarRoot v-slot="{ tools, activeTool, setTool }">
      <header class="col-span-3 flex items-center gap-2 border-b px-3">
        <button
          v-for="tool in tools"
          :key="tool.id"
          :data-active="activeTool === tool.id"
          @click="setTool(tool.id)"
        >
          {{ tool.label }}
        </button>
      </header>
    </ToolbarRoot>

    <aside class="border-r">
      <PageListRoot v-slot="{ pages, currentPageId, switchPage }">
        <nav>
          <button
            v-for="page in pages"
            :key="page.id"
            :data-active="page.id === currentPageId"
            @click="switchPage(page.id)"
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
