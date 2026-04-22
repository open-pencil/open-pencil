---
title: usePageList
description: Seiten lesen und Seitenwechsel, -erstellung, -löschung und -umbenennung steuern.
---

# usePageList

`usePageList()` ist das Seitenverwaltungs-Composable hinter Seitenlisten-UIs.

Es gibt zurück:

- `pages`
- `currentPageId`
- `switchPage`
- `addPage`
- `deletePage`
- `renamePage`

## Verwendung

```ts
import { usePageList } from '@open-pencil/vue'

const pageList = usePageList()
```

## Einfaches Beispiel

```ts
const { pages, currentPageId, switchPage, addPage } = usePageList()
```

## Praktische Beispiele

### Seiten wechseln

```ts
switchPage(pageId)
```

### Eine neue Seite erstellen

```ts
addPage()
```

## Verwandte APIs

- [PageListRoot](../components/page-list-root)
- [useMenuModel](./use-menu-model)
