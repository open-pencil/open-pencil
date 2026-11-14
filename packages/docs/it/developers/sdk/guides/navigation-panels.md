---
title: Pannelli di navigazione
description: Pannelli laterali per pagine e livelli con PageListRoot, LayerTreeRoot e stato della selezione.
---

# Pannelli di navigazione

Un pannello laterale di OpenPencil contiene spesso un elenco di pagine e l’albero dei livelli. Il Vue SDK fornisce componenti senza stile per entrambe le aree.

## Pagine

Usa `PageListRoot` oppure `usePageList()`:

```vue
<PageListRoot v-slot="{ pages, currentPageId, actions }">
  <button v-for="page in pages" :key="page.id" @click="actions.switch(page.id)">
    {{ page.name }}
  </button>
  <button @click="actions.add()">Nuova pagina</button>
</PageListRoot>
```

## Livelli

Usa `LayerTreeRoot` se il SDK deve gestire struttura dell’albero e interazioni mentre l’applicazione definisce markup e stile.

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

## Disposizione comune

- pagine nella parte superiore del pannello;
- livelli sotto;
- dettagli e modifica del nome nelle righe.

## Vedi anche

- [usePageList](../api/composables/use-page-list)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
