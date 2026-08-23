---
title: Eigene Editor-Oberfläche
description: Eine eigene Oberfläche mit provideEditor, CanvasRoot, Menüs, Panels und Toolbars entwickeln.
---

# Eigene Editor-Oberfläche

Eine OpenPencil-Anwendung mit Vue besteht typischerweise aus drei Schichten:

1. `@open-pencil/core` erstellt den Editor;
2. `@open-pencil/vue` verbindet ihn mit Vue Composables und Komponenten ohne vorgegebenes Erscheinungsbild;
3. die Anwendung bestimmt Anordnung, Gestaltung und produktspezifisches Verhalten.

## Mögliche Anwendungen

Die fertige OpenPencil-App ist nur eine mögliche Oberfläche. Mit dem SDK können beispielsweise ein in ein anderes Produkt eingebetteter Editor, ein internes Asset tool, ein Template editor, eine Annotation UI oder ein spezialisierter AI-assisted editor entwickelt werden.

## Empfohlene Struktur

Eine typische Oberfläche:

- ruft `provideEditor()` weit oben im Komponentenbaum auf;
- platziert den Canvas in der Mitte;
- zeigt Pages und Layers in einem Side panel;
- zeigt Eigenschaften im gegenüberliegenden Panel;
- steuert Menüs und Toolbars über composables.

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
      Properties-Panel
    </aside>
  </div>
</template>
```

## Zuständigkeiten

- Das SDK übernimmt die Integration mit dem Editor und wiederverwendbare, gestaltungsunabhängige Logik.
- Die Anwendung übernimmt Anordnung, Gestaltung und eigene Aktionen.
- Composables stellen Menüs und Panels die benötigten Daten bereit, ohne zusätzliche Hüllkomponenten zu erzwingen.

## Siehe auch

- [provideEditor](../api/composables/provide-editor)
- [useCanvas](../api/composables/use-canvas)
- [ToolbarRoot](../api/components/toolbar-root)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
