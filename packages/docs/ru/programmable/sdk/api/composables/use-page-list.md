---
title: usePageList
description: Чтение страниц и управление переключением, созданием, удалением и переименованием.
---

# usePageList

`usePageList()` — компосабл управления страницами за UI списков страниц.

Предоставляет:

- `pages`
- `currentPageId`
- `switchPage`
- `addPage`
- `deletePage`
- `renamePage`

## Использование

```ts
import { usePageList } from '@open-pencil/vue'

const pageList = usePageList()
```

## Базовый пример

```ts
const { pages, currentPageId, switchPage, addPage } = usePageList()
```

## Практические примеры

### Переключить страницу

```ts
switchPage(pageId)
```

### Создать новую страницу

```ts
addPage()
```

## Связанные API

- [PageListRoot](../components/page-list-root)
- [useMenuModel](./use-menu-model)
