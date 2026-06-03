---
title: usePageList
description: Read pages and drive page switching, creation, deletion, and renaming.
---

# usePageList

`usePageList()` is the page-management composable behind page list UIs.

It exposes:

- `pages`
- `currentPageId`
- `switchPage`
- `addPage`
- `deletePage`
- `renamePage`

## Usage

```ts
import { usePageList } from '@inkly/vue'

const pageList = usePageList()
```

## Basic example

```ts
const { pages, currentPageId, switchPage, addPage } = usePageList()
```

## Practical examples

### Switch pages

```ts
switchPage(pageId)
```

### Create a new page

```ts
addPage()
```

## Related APIs

- [PageListRoot](../components/page-list-root)
- [useMenuModel](./use-menu-model)
