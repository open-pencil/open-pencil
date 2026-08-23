---
title: PageListRoot
description: Headless component für Pages und die Actions einer Page list.
---

# PageListRoot

`PageListRoot` stellt über seinen Slot bereit:

- Pages;
- ID der aktuellen Page;
- Informationen über Separators;
- Actions zum Erstellen, Wechseln, Umbenennen und Löschen von Pages.

Die Anwendung rendert die Liste und bestimmt ihr Styling.

## Beispiel

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

## Siehe auch

- [usePageList](../composables/use-page-list)
