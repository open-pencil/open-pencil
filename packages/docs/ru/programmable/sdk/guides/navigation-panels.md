---
title: Навигационные панели
description: Создавайте боковые панели для страниц и слоёв с PageListRoot, LayerTreeRoot и состоянием выделения.
---

# Навигационные панели

Боковые панели OpenPencil обычно решают две задачи:

- навигация по страницам
- навигация по слоям

Vue SDK предоставляет headless-примитивы для обеих.

## Навигация по страницам

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

## Навигация по слоям

Используйте `LayerTreeRoot`, когда хотите структуру дерева, управляемую SDK, но представление на стороне приложения.

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

## Практический паттерн

Распространённый макет:

- страницы вверху боковой панели
- слои ниже
- детали или элементы управления для переименования встроены в компоненты строк

## Связанные API

- [usePageList](../api/composables/use-page-list)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
- [useSelectionState](../api/composables/use-selection-state)
