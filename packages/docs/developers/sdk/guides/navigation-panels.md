---
title: Navigation Panels
description: Build page and layer sidebars with PageListRoot, LayerTreeRoot, and selection state.
---

# Navigation Panels

OpenPencil sidebars usually combine two concerns:

- page navigation
- layer navigation

The Vue SDK provides headless primitives for both.

## Page navigation

Use `PageListRoot` or `usePageList()`.

```vue
<PageListRoot v-slot="{ pages, currentPageId, actions }">
  <div>
    <button v-for="page in pages" :key="page.id" @click="actions.switch(page.id)">
      {{ page.name }}
    </button>
    <button @click="actions.add()">New page</button>
  </div>
</PageListRoot>
```

## Layer navigation

Use `LayerTreeRoot` when you want SDK-managed tree structure but app-owned presentation.

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
