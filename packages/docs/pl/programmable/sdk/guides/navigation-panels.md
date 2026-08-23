---
title: Panele nawigacyjne
description: Panele boczne ze stronami i warstwami oparte na PageListRoot, LayerTreeRoot i stanie zaznaczenia.
---

# Panele nawigacyjne

Panele boczne OpenPencil zwykle zawierają:

- listę stron;
- drzewo warstw.

Vue SDK udostępnia komponenty bez narzuconego wyglądu dla obu zastosowań.

## Strony

Użyj `PageListRoot` albo `usePageList()`.

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

## Warstwy

Użyj `LayerTreeRoot`, jeśli SDK ma zarządzać strukturą drzewa, a aplikacja jego wyglądem.

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

## Typowy układ

- lista stron w górnej części panelu bocznego;
- drzewo warstw poniżej;
- dodatkowe informacje i pole zmiany nazwy bezpośrednio w komponentach wierszy.

## Zobacz też

- [usePageList](../api/composables/use-page-list)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
- [useSelectionState](../api/composables/use-selection-state)
