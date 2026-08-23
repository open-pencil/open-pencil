---
title: Панели навигации
description: Боковые панели со страницами и слоями на основе PageListRoot, LayerTreeRoot и состояния выделения.
---

# Панели навигации

На боковых панелях OpenPencil обычно находятся:

- список страниц;
- дерево слоёв.

Vue SDK предоставляет компоненты без встроенного оформления для обеих задач.

## Страницы

Используйте `PageListRoot` или `usePageList()`.

```vue
<PageListRoot v-slot="{ pages, currentPageId, switchPage, addPage }">
  <div>
    <button v-for="page in pages" :key="page.id" @click="switchPage(page.id)">
      {{ page.name }}
    </button>
    <button @click="addPage()">Новая страница</button>
  </div>
</PageListRoot>
```

## Слои

Используйте `LayerTreeRoot`, если SDK должен управлять структурой дерева, а приложение — его внешним видом.

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

## Типичная компоновка

- список страниц в верхней части боковой панели;
- дерево слоёв под ним;
- дополнительные сведения и поле переименования непосредственно в компонентах строк.

## См. также

- [usePageList](../api/composables/use-page-list)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
- [useSelectionState](../api/composables/use-selection-state)
