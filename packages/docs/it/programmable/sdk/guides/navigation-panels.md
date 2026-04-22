---
title: Pannelli di Navigazione
description: Crea sidebar per pagine e layer con PageListRoot, LayerTreeRoot e lo stato della selezione.
---

# Pannelli di Navigazione

Le sidebar di OpenPencil di solito combinano due aspetti:

- navigazione tra pagine
- navigazione tra layer

Il Vue SDK fornisce primitive headless per entrambi.

## Navigazione tra pagine

Usa `PageListRoot` o `usePageList()`.

```vue
<PageListRoot v-slot="{ pages, currentPageId, switchPage, addPage }">
  <div>
    <button v-for="page in pages" :key="page.id" @click="switchPage(page.id)">
      {{ page.name }}
    </button>
    <button @click="addPage()">Nuova pagina</button>
  </div>
</PageListRoot>
```

## Navigazione tra layer

Usa `LayerTreeRoot` quando vuoi struttura ad albero gestita dall'SDK ma presentazione di proprietà dell'app.

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

## Pattern pratico

Un layout comune è:

- le pagine in cima alla sidebar
- i layer sotto
- controlli per dettagli o rinomina inline incorporati nei componenti di riga

## API correlate

- [usePageList](../api/composables/use-page-list)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
- [useSelectionState](../api/composables/use-selection-state)
