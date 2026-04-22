---
title: Paneles de Navegación
description: Construye barras laterales de páginas y capas con PageListRoot, LayerTreeRoot y el estado de selección.
---

# Paneles de Navegación

Las barras laterales de OpenPencil suelen combinar dos preocupaciones:

- navegación de páginas
- navegación de capas

El SDK de Vue proporciona primitivos headless para ambas.

## Navegación de páginas

Usa `PageListRoot` o `usePageList()`.

```vue
<PageListRoot v-slot="{ pages, currentPageId, switchPage, addPage }">
  <div>
    <button v-for="page in pages" :key="page.id" @click="switchPage(page.id)">
      {{ page.name }}
    </button>
    <button @click="addPage()">Nueva página</button>
  </div>
</PageListRoot>
```

## Navegación de capas

Usa `LayerTreeRoot` cuando quieras estructura de árbol gestionada por el SDK pero presentación propia de la app.

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

## Patrón práctico

Un layout habitual es:

- páginas en la parte superior de la barra lateral
- capas debajo
- detalles o controles de renombrado inline integrados en los componentes de fila

## APIs relacionadas

- [usePageList](../api/composables/use-page-list)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
- [useSelectionState](../api/composables/use-selection-state)
