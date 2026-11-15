---
title: Navigations-Panels
description: Seiten- und Ebenen-Panels mit PageListRoot, LayerTreeRoot und Auswahlzustand.
---

# Navigations-Panels

Ein Seiten-Panel enthält häufig eine Seitenliste und den Ebenenbaum. Das Vue SDK stellt für beide Bereiche Komponenten ohne vorgegebenes Erscheinungsbild bereit.

## Seiten

Verwenden Sie `PageListRoot` oder `usePageList()`.

```vue
<PageListRoot v-slot="{ pages, currentPageId, actions }">
  <button v-for="page in pages" :key="page.id" @click="actions.switch(page.id)">
    {{ page.name }}
  </button>
  <button @click="actions.add()">Neue Seite</button>
</PageListRoot>
```

## Ebenen

Verwenden Sie `LayerTreeRoot`, wenn das SDK Baumstruktur und Verhalten verwalten soll, während die Anwendung Markup und Gestaltung bestimmt.

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

## Typische Anordnung

- Seiten oben;
- Ebenen darunter;
- Details und direkte Umbenennung in den Zeilenkomponenten.

## Siehe auch

- [usePageList](../api/composables/use-page-list)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
