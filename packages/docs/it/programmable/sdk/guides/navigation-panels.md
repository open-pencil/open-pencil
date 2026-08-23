---
title: Pannelli di navigazione
description: Pannelli laterali per pagine e livelli con PageListRoot, LayerTreeRoot e stato della selezione.
---

# Pannelli di navigazione

Un pannello laterale di OpenPencil contiene spesso un elenco di pagine e l’albero dei livelli. Il Vue SDK fornisce componenti senza stile per entrambe le aree.

## Pagine

Usa `PageListRoot` oppure `usePageList()`:

```vue
<PageListRoot v-slot="{ pages, currentPageId, switchPage, addPage }">
  <button v-for="page in pages" :key="page.id" @click="switchPage(page.id)">
    {{ page.name }}
  </button>
  <button @click="addPage()">Nuova pagina</button>
</PageListRoot>
```

## Livelli

Usa `LayerTreeRoot` se il SDK deve gestire struttura dell’albero e interazioni mentre l’applicazione definisce markup e stile.

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

## Disposizione comune

- pagine nella parte superiore del pannello;
- livelli sotto;
- dettagli e modifica del nome nelle righe.

## Vedi anche

- [usePageList](../api/composables/use-page-list)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
