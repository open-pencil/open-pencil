---
title: Navigation Panels
description: Build page and layer sidebars with PageListRoot, LayerTreeRoot, and selection state.
---

# Navigation Panels

Inkly sidebars usually combine two concerns:

- page navigation
- layer navigation

The Vue SDK provides headless primitives for both.

## Page navigation

Use `PageListRoot` or `usePageList()`.

```vue
<PageListRoot v-slot="{ pages, currentPageId, switchPage, addPage }">
  <div>
    <button v-for="page in pages" :key="page.id" @click="switchPage(page.id)">
      {{ page.name }}
    </button>
    <button @click="addPage()">New page</button>
  </div>
</PageListRoot>
```

## Layer navigation

Use `LayerTreeRoot` when you want SDK-managed tree structure but app-owned presentation.

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

## Practical pattern

A common layout is:

- pages at the top of the sidebar
- layers below
- details or inline rename controls embedded in your row components

## Related APIs

- [usePageList](../api/composables/use-page-list)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
- [useSelectionState](../api/composables/use-selection-state)
