---
title: usePageList
description: Odczytuj strony i steruj przełączaniem, tworzeniem, usuwaniem i zmianą nazwy stron.
---

# usePageList

`usePageList()` to kompozyt zarządzania stronami za UI listy stron.

Udostępnia:

- `pages`
- `currentPageId`
- `switchPage`
- `addPage`
- `deletePage`
- `renamePage`

## Użycie

```ts
import { usePageList } from '@open-pencil/vue'

const pageList = usePageList()
```

## Podstawowy przykład

```ts
const { pages, currentPageId, switchPage, addPage } = usePageList()
```

## Przykłady praktyczne

### Przełącz strony

```ts
switchPage(pageId)
```

### Utwórz nową stronę

```ts
addPage()
```

## Powiązane API

- [PageListRoot](../components/page-list-root)
- [useMenuModel](./use-menu-model)
