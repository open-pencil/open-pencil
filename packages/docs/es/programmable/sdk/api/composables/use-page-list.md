---
title: usePageList
description: Lee las páginas e impulsa el cambio, la creación, la eliminación y el renombrado de páginas.
---

# usePageList

`usePageList()` es el composable de gestión de páginas detrás de las interfaces de lista de páginas.

Expone:

- `pages`
- `currentPageId`
- `switchPage`
- `addPage`
- `deletePage`
- `renamePage`

## Uso

```ts
import { usePageList } from '@open-pencil/vue'

const pageList = usePageList()
```

## Ejemplo básico

```ts
const { pages, currentPageId, switchPage, addPage } = usePageList()
```

## Ejemplos prácticos

### Cambiar de página

```ts
switchPage(pageId)
```

### Crear una nueva página

```ts
addPage()
```

## APIs relacionadas

- [PageListRoot](../components/page-list-root)
- [useMenuModel](./use-menu-model)
