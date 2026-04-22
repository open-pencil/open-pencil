---
title: Panneaux de navigation
description: Créez des barres latérales de pages et de calques avec PageListRoot, LayerTreeRoot et l'état de sélection.
---

# Panneaux de navigation

Les barres latérales OpenPencil combinent généralement deux préoccupations :

- la navigation entre pages
- la navigation entre calques

Le Vue SDK fournit des primitives headless pour les deux.

## Navigation entre pages

Utilisez `PageListRoot` ou `usePageList()`.

```vue
<PageListRoot v-slot="{ pages, currentPageId, switchPage, addPage }">
  <div>
    <button v-for="page in pages" :key="page.id" @click="switchPage(page.id)">
      {{ page.name }}
    </button>
    <button @click="addPage()">Nouvelle page</button>
  </div>
</PageListRoot>
```

## Navigation entre calques

Utilisez `LayerTreeRoot` quand vous voulez une structure d'arbre gérée par le SDK mais une présentation appartenant à l'application.

```vue
<LayerTreeRoot v-slot="{ items, selectedIds, select, toggleExpand, getKey, getChildren }">
  <TreeView
    :items="items"
    :selected-ids="selectedIds"
    :get-key="getKey"
    :get-children="getChildren"
    @select="select"
    @toggle-expand="toggleExpand"
  />
</LayerTreeRoot>
```

## Pattern pratique

Une mise en page courante est :

- les pages en haut de la barre latérale
- les calques en dessous
- les détails ou contrôles de renommage intégrés dans vos composants de ligne

## API associées

- [usePageList](../api/composables/use-page-list)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
- [useSelectionState](../api/composables/use-selection-state)
