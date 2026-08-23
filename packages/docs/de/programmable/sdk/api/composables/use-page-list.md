---
title: usePageList
description: Pages lesen, wechseln, erstellen, löschen und umbenennen.
---

# usePageList

`usePageList()` stellt State und Actions für eine Page list bereit:

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

## Beispiel

```ts
const { pages, currentPageId, switchPage, addPage } = usePageList()
```

### Zu einer Page wechseln

```ts
switchPage(pageId)
```

### Page erstellen

```ts
addPage()
```

## Siehe auch

- [PageListRoot](../components/page-list-root)
- [useMenuModel](./use-menu-model)
