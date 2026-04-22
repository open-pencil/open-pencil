---
title: Niestandardowa powłoka edytora
description: Zbuduj własną powłokę edytora z provideEditor, CanvasRoot, menu, panelami i paskami narzędzi.
---

# Niestandardowa powłoka edytora

Typowa aplikacja Vue z OpenPencil ma trzy warstwy:

1. `@open-pencil/core` tworzy edytor
2. `@open-pencil/vue` adaptuje go do kompozytów Vue i bezstanowych prymitywów
3. twoja aplikacja renderuje powłokę, stylowanie i UX specyficzny dla produktu

## Dlaczego to ważne

Wbudowana aplikacja OpenPencil to tylko jedna możliwa powłoka.

Możesz zbudować zupełnie inną dla skupionego przepływu pracy: edytor wbudowany w inny produkt, wewnętrzne narzędzie do zasobów, edytor szablonów, UI do adnotacji lub powierzchnię edycji wspomaganą AI z niestandardowymi kontrolkami.

To główny powód, dla którego SDK istnieje.

## Zalecana kompozycja

Praktyczna powłoka często wygląda tak:

- dostawca na górze z `provideEditor()`
- kanvas w środku
- nawigacja strony/warstwy po jednej stronie
- właściwości po drugiej stronie
- menu i paski narzędzi napędzane przez kompozyty

## Przykład

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
      Panel właściwości tutaj
    </aside>
  </div>
</template>
```

## Dlaczego ten podział działa

- SDK odpowiada za integrację edytora i wielokrotnie używalną logikę bezstanową
- twoja aplikacja odpowiada za layout, stylowanie i akcje specyficzne dla produktu
- kompozyty mogą napędzać menu i panele bez dodatkowych komponentów opakowujących

## Powiązane API

- [provideEditor](../api/composables/provide-editor)
- [useCanvas](../api/composables/use-canvas)
- [ToolbarRoot](../api/components/toolbar-root)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
