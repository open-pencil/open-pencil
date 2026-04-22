---
title: Panele nawigacyjne
description: Buduj paski boczne stron i warstw z PageListRoot, LayerTreeRoot i stanem selekcji.
---

# Panele nawigacyjne

Paski boczne OpenPencil zazwyczaj łączą dwa obszary:

- nawigację po stronach
- nawigację po warstwach

Vue SDK udostępnia bezstanowe prymitywy dla obu.

## Nawigacja po stronach

Użyj `PageListRoot` lub `usePageList()`.

```vue
<PageListRoot v-slot="{ pages, currentPageId, switchPage, addPage }">
  <div>
    <button v-for="page in pages" :key="page.id" @click="switchPage(page.id)">
      {{ page.name }}
    </button>
    <button @click="addPage()">Nowa strona</button>
  </div>
</PageListRoot>
```

## Nawigacja po warstwach

Użyj `LayerTreeRoot`, gdy chcesz strukturę drzewa zarządzaną przez SDK, ale prezentację należącą do aplikacji.

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

## Praktyczny wzorzec

Popularny layout to:

- strony u góry paska bocznego
- warstwy poniżej
- szczegóły lub kontrolki inline zmiany nazwy osadzone w komponentach wierszy

## Powiązane API

- [usePageList](../api/composables/use-page-list)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
- [useSelectionState](../api/composables/use-selection-state)
