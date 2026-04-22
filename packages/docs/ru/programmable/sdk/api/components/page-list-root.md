---
title: PageListRoot
description: Headless-структурный примитив для UI списка страниц.
---

# PageListRoot

`PageListRoot` — headless-структурный примитив для интерфейсов списка страниц.

Предоставляет пропы слота для:

- страниц
- id текущей страницы
- определения разделителей
- действий со страницами: добавить, переключить, переименовать, удалить

## Использование

Используйте его, когда нужна структура списка страниц от SDK с рендерингом и стилями на стороне приложения.

## Базовый пример

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

## Связанные API

- [usePageList](../composables/use-page-list)
