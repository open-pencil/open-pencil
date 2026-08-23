---
title: Paneles de navegación
description: Paneles laterales de páginas y capas con PageListRoot, LayerTreeRoot y estado de selección.
---

# Paneles de navegación

Un panel lateral suele incluir una lista de páginas y el árbol de capas. El SDK de Vue ofrece componentes sin estilos para ambas áreas.

## Pages

Usa `PageListRoot` o `usePageList()`:

```vue
<PageListRoot v-slot="{ pages, currentPageId, switchPage, addPage }">
  <div>
    <button v-for="page in pages" :key="page.id" @click="switchPage(page.id)">
      {{ page.name }}
    </button>
    <button @click="addPage()">Nueva Page</button>
  </div>
</PageListRoot>
```

## Layers

Usa `LayerTreeRoot` si quieres que el SDK gestione Tree structure e Interactions y que la aplicación defina el Markup y los Styles:

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

## Disposición habitual

- Pages en la parte superior del panel;
- Layers debajo;
- detalles y cambio de nombre directo dentro de los componentes de fila.

## Consulta también

- [usePageList](../api/composables/use-page-list)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
- [useSelectionState](../api/composables/use-selection-state)
