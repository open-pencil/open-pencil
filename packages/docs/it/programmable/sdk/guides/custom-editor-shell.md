---
title: Shell Editor Personalizzata
description: Crea la tua shell editor con provideEditor, CanvasRoot, menu, pannelli e toolbar.
---

# Shell Editor Personalizzata

Una tipica app Vue con OpenPencil ha tre livelli:

1. `@open-pencil/core` crea l'editor
2. `@open-pencil/vue` lo adatta in composable Vue e primitive headless
3. la tua app renderizza la shell, lo stile e la UX specifica del prodotto

## Perché questo è importante

L'app OpenPencil integrata è solo una possibile shell.

Puoi costruirne una molto diversa per un flusso di lavoro specifico: un editor integrato in un altro prodotto, uno strumento asset interno, un editor di template, una UI per annotazioni, o una superficie di editing assistita dall'IA con controlli personalizzati.

Questo è il motivo principale per cui esiste l'SDK.

## Composizione consigliata

Una shell pratica spesso ha questa forma:

- provider in cima con `provideEditor()`
- canvas al centro
- navigazione pagine/layer su un lato
- proprietà sull'altro lato
- menu e toolbar guidati da composable

## Esempio

```vue
<script setup lang="ts">
import { createEditor } from '@open-pencil/core/editor'
import {
  provideEditor,
  CanvasRoot,
  CanvasSurface,
  ToolbarRoot,
  PageListRoot,
  LayerTreeRoot,
} from '@open-pencil/vue'

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
      Pannello proprietà qui
    </aside>
  </div>
</template>
```

## Perché questa separazione funziona

- l'SDK possiede l'integrazione con l'editor e la logica headless riutilizzabile
- la tua app possiede layout, stile e azioni specifiche del prodotto
- i composable possono alimentare menu e pannelli senza componenti wrapper aggiuntivi

## API correlate

- [provideEditor](../api/composables/provide-editor)
- [useCanvas](../api/composables/use-canvas)
- [ToolbarRoot](../api/components/toolbar-root)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
