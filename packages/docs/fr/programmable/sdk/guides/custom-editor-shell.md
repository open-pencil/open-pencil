---
title: Interface d’édition personnalisée
description: Créer une interface avec provideEditor, CanvasRoot, Menus, Panneaux et Toolbars.
---

# Interface d’édition personnalisée

Une application OpenPencil avec Vue comporte généralement trois couches :

1. `@open-pencil/core` crée l’éditeur ;
2. `@open-pencil/vue` le relie aux composables et composants sans styles de Vue ;
3. l’application définit la disposition, les styles et le comportement propre au produit.

## Cas d’usage

L’application OpenPencil n’est qu’une interface possible. Le SDK permet de créer un éditeur intégré à un autre produit, un outil interne pour les ressources, un éditeur de modèles, une interface d’annotation ou un éditeur spécialisé avec assistance AI.

## Structure recommandée

Une interface courante :

- exécute `provideEditor()` haut dans l’arbre des composants ;
- place le canvas au centre ;
- affiche les pages et les calques dans un panneau latéral ;
- affiche les propriétés dans le panneau opposé ;
- pilote Menus et Toolbars avec des composables.

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
      Panneau des propriétés
    </aside>
  </div>
</template>
```

## Responsabilités

- Le SDK gère l’intégration avec l’éditeur et la logique réutilisable sans styles.
- L’application contrôle la disposition, les styles et ses propres actions.
- Les composables fournissent les données des menus et panneaux sans imposer de composants enveloppants supplémentaires.

## Voir aussi

- [provideEditor](../api/composables/provide-editor)
- [useCanvas](../api/composables/use-canvas)
- [ToolbarRoot](../api/components/toolbar-root)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
