---
title: Navigations-Panels
description: Seiten- und Ebenen-Seitenleisten mit PageListRoot, LayerTreeRoot und Auswahlzustand erstellen.
---

# Navigations-Panels

OpenPencil-Seitenleisten kombinieren gewöhnlich zwei Belange:

- Seitennavigation
- Ebenennavigation

Das Vue SDK stellt headless Primitive für beide bereit.

## Seitennavigation

Verwenden Sie `PageListRoot` oder `usePageList()`.

```vue
<PageListRoot v-slot="{ pages, currentPageId, switchPage, addPage }">
  <div>
    <button v-for="page in pages" :key="page.id" @click="switchPage(page.id)">
      {{ page.name }}
    </button>
    <button @click="addPage()">Neue Seite</button>
  </div>
</PageListRoot>
```

## Ebenennavigation

Verwenden Sie `LayerTreeRoot`, wenn Sie SDK-verwaltete Baumstruktur, aber app-eigene Darstellung möchten.

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

## Praktisches Muster

Ein gebräuchliches Layout ist:

- Seiten am oberen Rand der Seitenleiste
- Ebenen darunter
- Details oder Inline-Umbenennen-Steuerelemente in Ihren Zeilenkomponenten eingebettet

## Verwandte APIs

- [usePageList](../api/composables/use-page-list)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
- [useSelectionState](../api/composables/use-selection-state)
