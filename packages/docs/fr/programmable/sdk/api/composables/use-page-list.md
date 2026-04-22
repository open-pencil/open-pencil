---
title: usePageList
description: Lit les pages et pilote le changement de page, la création, la suppression et le renommage.
---

# usePageList

`usePageList()` est le composable de gestion des pages derrière les interfaces de liste de pages.

Il expose :

- `pages`
- `currentPageId`
- `switchPage`
- `addPage`
- `deletePage`
- `renamePage`

## Utilisation

```ts
import { usePageList } from '@open-pencil/vue'

const pageList = usePageList()
```

## Exemple de base

```ts
const { pages, currentPageId, switchPage, addPage } = usePageList()
```

## Exemples pratiques

### Changer de page

```ts
switchPage(pageId)
```

### Créer une nouvelle page

```ts
addPage()
```

## API associées

- [PageListRoot](../components/page-list-root)
- [useMenuModel](./use-menu-model)
