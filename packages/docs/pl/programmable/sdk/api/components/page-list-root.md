---
title: PageListRoot
description: Bezstanowy prymityw strukturalny dla UI listy stron.
---

# PageListRoot

`PageListRoot` to bezstanowy prymityw strukturalny dla interfejsów listy stron.

Udostępnia przez slot właściwości dla:

- stron
- id bieżącej strony
- wykrywania separatorów
- akcji stron jak dodawanie, przełączanie, zmiana nazwy i usuwanie

## Użycie

Użyj go, gdy chcesz strukturę listy stron dostarczaną przez SDK z renderowaniem i stylowaniem specyficznym dla aplikacji.

## Podstawowy przykład

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

## Powiązane API

- [usePageList](../composables/use-page-list)
