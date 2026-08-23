---
title: usePageList
description: Odczytywanie stron oraz ich przełączanie, tworzenie, usuwanie i przemianowywanie.
---

# usePageList

`usePageList()` udostępnia state i actions potrzebne interfejsowi listy stron.

Zwraca:

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

## Przykład

```ts
const { pages, currentPageId, switchPage, addPage } = usePageList()
```

### Przejście do strony

```ts
switchPage(pageId)
```

### Utworzenie strony

```ts
addPage()
```

## Zobacz też

- [PageListRoot](../components/page-list-root)
- [useMenuModel](./use-menu-model)
