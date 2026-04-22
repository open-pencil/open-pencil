---
title: usePageList
description: Leggi le pagine e gestisci il cambio, la creazione, l'eliminazione e la rinomina delle pagine.
---

# usePageList

`usePageList()` è il composable di gestione delle pagine alla base delle UI della lista delle pagine.

Espone:

- `pages`
- `currentPageId`
- `switchPage`
- `addPage`
- `deletePage`
- `renamePage`

## Utilizzo

```ts
import { usePageList } from '@open-pencil/vue'

const pageList = usePageList()
```

## Esempio base

```ts
const { pages, currentPageId, switchPage, addPage } = usePageList()
```

## Esempi pratici

### Cambia pagina

```ts
switchPage(pageId)
```

### Crea una nuova pagina

```ts
addPage()
```

## API correlate

- [PageListRoot](../components/page-list-root)
- [useMenuModel](./use-menu-model)
