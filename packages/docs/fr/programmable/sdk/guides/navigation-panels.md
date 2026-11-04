---
title: Panneaux de navigation
description: Panneaux latéraux de pages et de calques avec PageListRoot, LayerTreeRoot et état de sélection.
---

# Panneaux de navigation

Un panneau latéral contient souvent une liste de pages et l’arbre des calques. Le SDK Vue fournit des composants sans styles pour ces deux zones.

## Pages

Utilisez `PageListRoot` ou `usePageList()` :

```vue
<PageListRoot v-slot="{ pages, currentPageId, actions }">
  <div>
    <button v-for="page in pages" :key="page.id" @click="actions.switch(page.id)">
      {{ page.name }}
    </button>
    <button @click="actions.add()">Nouvelle Page</button>
  </div>
</PageListRoot>
```

## Calques

Utilisez `LayerTreeRoot` lorsque le SDK doit gérer la structure de l’arbre et les interactions tandis que l’application définit le balisage et les styles :

```vue
<LayerTreeRoot v-slot="{ visibleRows }">
  <LayerTreeItem
    v-for="row in visibleRows"
    :key="row.node.id"
    v-slot="{ node, isSelected, padLeft, actions }"
    :node="row.node"
    :level="row.level"
    :has-children="row.hasChildren"
  >
    <button
      :data-selected="isSelected"
      :style="{ paddingLeft: padLeft }"
      @click="actions.select($event.shiftKey)"
    >
      {{ node.name }}
    </button>
  </LayerTreeItem>
</LayerTreeRoot>
```

## Disposition courante

- pages en haut du panneau ;
- calques en dessous ;
- détails et changement de nom direct dans les composants de ligne.

## Voir aussi

- [usePageList](../api/composables/use-page-list)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
- [useSelectionState](../api/composables/use-selection-state)
