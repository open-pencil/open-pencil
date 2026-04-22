---
title: PageListRoot
description: Primitiva strutturale headless per le UI della lista delle pagine.
---

# PageListRoot

`PageListRoot` è una primitiva strutturale headless per le interfacce della lista delle pagine.

Fornisce slot prop per:

- le pagine
- l'ID della pagina corrente
- il rilevamento dei divisori
- azioni sulle pagine come aggiunta, cambio, rinomina ed eliminazione

## Utilizzo

Usala quando vuoi struttura della lista delle pagine fornita dall'SDK con rendering e stile specifici dell'app.

## Esempio base

```vue
<PageListRoot v-slot="{ pages, currentPageId, switchPage }">
  <ul>
    <li v-for="page in pages" :key="page.id">
      <button
        :data-active="page.id === currentPageId"
        @click="switchPage(page.id)"
      >
        {{ page.name }}
      </button>
    </li>
  </ul>
</PageListRoot>
```

## API correlate

- [usePageList](../composables/use-page-list)
