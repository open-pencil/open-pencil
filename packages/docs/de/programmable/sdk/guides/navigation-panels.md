---
title: Navigations-Panels
description: Seiten- und Ebenen-Panels mit PageListRoot, LayerTreeRoot und Auswahlzustand.
---

# Navigations-Panels

Ein Seiten-Panel enthält häufig eine Seitenliste und den Ebenenbaum. Das Vue SDK stellt für beide Bereiche Komponenten ohne vorgegebenes Erscheinungsbild bereit.

## Seiten

Verwenden Sie `PageListRoot` oder `usePageList()`.

```vue
<PageListRoot v-slot="{ pages, currentPageId, switchPage, addPage }">
  <button v-for="page in pages" :key="page.id" @click="switchPage(page.id)">
    {{ page.name }}
  </button>
  <button @click="addPage()">Neue Seite</button>
</PageListRoot>
```

## Ebenen

Verwenden Sie `LayerTreeRoot`, wenn das SDK Baumstruktur und Verhalten verwalten soll, während die Anwendung Markup und Gestaltung bestimmt.

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

## Typische Anordnung

- Seiten oben;
- Ebenen darunter;
- Details und direkte Umbenennung in den Zeilenkomponenten.

## Siehe auch

- [usePageList](../api/composables/use-page-list)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
