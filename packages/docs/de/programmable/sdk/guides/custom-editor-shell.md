---
title: Benutzerdefinierte Editor-Shell
description: Erstellen Sie Ihre eigene Editor-Shell mit provideEditor, CanvasRoot, Menüs, Panels und Toolbars.
---

# Benutzerdefinierte Editor-Shell

Eine typische OpenPencil Vue-App hat drei Schichten:

1. `@open-pencil/core` erstellt den Editor
2. `@open-pencil/vue` passt ihn in Vue Composables und headless Primitive an
3. Ihre App rendert die Shell, das Styling und die produkt-spezifische UX

## Warum das wichtig ist

Die eingebaute OpenPencil-App ist nur eine mögliche Shell.

Sie können eine völlig andere für einen fokussierten Workflow erstellen: einen eingebetteten Editor innerhalb eines anderen Produkts, ein internes Asset-Tool, einen Template-Editor, eine Annotations-UI oder eine KI-gestützte Bearbeitungsoberfläche mit benutzerdefinierten Steuerelementen.

Das ist der Hauptgrund, warum das SDK existiert.

## Empfohlene Komposition

Eine praktische Shell sieht oft so aus:

- Provider an der Spitze mit `provideEditor()`
- Canvas in der Mitte
- Seiten-/Ebenennavigation auf einer Seite
- Eigenschaften auf der anderen Seite
- Menüs und Toolbars, gesteuert durch Composables

## Beispiel

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
      Eigenschafts-Panel hier
    </aside>
  </div>
</template>
```

## Warum diese Aufteilung funktioniert

- das SDK übernimmt Editor-Integration und wiederverwendbare headless Logik
- Ihre App übernimmt Layout, Styling und produktspezifische Aktionen
- Composables können Menüs und Panels ohne zusätzliche Wrapper-Komponenten antreiben

## Verwandte APIs

- [provideEditor](../api/composables/provide-editor)
- [useCanvas](../api/composables/use-canvas)
- [ToolbarRoot](../api/components/toolbar-root)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
