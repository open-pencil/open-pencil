---
title: Shell d'éditeur personnalisé
description: Construisez votre propre shell d'éditeur avec provideEditor, CanvasRoot, menus, panneaux et barres d'outils.
---

# Shell d'éditeur personnalisé

Une application Vue OpenPencil typique comporte trois couches :

1. `@open-pencil/core` crée l'éditeur
2. `@open-pencil/vue` l'adapte en composables Vue et primitives headless
3. votre application affiche le shell, les styles et l'UX du produit

## Pourquoi c'est important

L'application OpenPencil intégrée n'est qu'un shell possible parmi d'autres.

Vous pouvez en construire un très différent pour un flux de travail ciblé : un éditeur intégré dans un autre produit, un outil d'assets interne, un éditeur de templates, une interface d'annotation, ou une surface d'édition assistée par IA avec des contrôles personnalisés.

C'est la raison principale pour laquelle le SDK existe.

## Composition recommandée

Un shell pratique ressemble souvent à ceci :

- provider au sommet avec `provideEditor()`
- canvas au centre
- navigation pages/calques sur un côté
- propriétés de l'autre côté
- menus et barres d'outils pilotés par des composables

## Exemple

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
      Panneau de propriétés ici
    </aside>
  </div>
</template>
```

## Pourquoi cette séparation fonctionne

- le SDK possède l'intégration éditeur et la logique headless réutilisable
- votre application possède la mise en page, les styles et les actions spécifiques au produit
- les composables peuvent alimenter menus et panneaux sans composants wrapper supplémentaires

## API associées

- [provideEditor](../api/composables/provide-editor)
- [useCanvas](../api/composables/use-canvas)
- [ToolbarRoot](../api/components/toolbar-root)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
