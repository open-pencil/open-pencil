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
<PageListRoot v-slot="{ pages, currentPageId, actions }">
  <div>
    <button v-for="page in pages" :key="page.id" @click="actions.switch(page.id)">
      {{ page.name }}
    </button>
    <button @click="actions.add()">Nowa strona</button>
  </div>
</PageListRoot>
```

## Warstwy

Użyj `LayerTreeRoot`, jeśli SDK ma zarządzać strukturą drzewa, a aplikacja jego wyglądem.

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

## Typowy układ

- lista stron w górnej części panelu bocznego;
- drzewo warstw poniżej;
- dodatkowe informacje i pole zmiany nazwy bezpośrednio w komponentach wierszy.

## Zobacz też

- [usePageList](../api/composables/use-page-list)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
- [useSelectionState](../api/composables/use-selection-state)
