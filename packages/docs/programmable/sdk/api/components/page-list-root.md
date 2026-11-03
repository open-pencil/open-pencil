---
title: PageListRoot
description: Headless structural primitive for page list UIs.
---

# PageListRoot

`PageListRoot` is a headless structural primitive for page list interfaces.

It provides slot props for:

- pages
- current page id
- divider detection
- page actions like add, switch, rename, and delete

## Usage

Use it when you want SDK-provided page-list structure with app-specific rendering and styling.

## Basic example

```vue
<PageListRoot v-slot="{ pages, currentPageId, actions }">
  <ul>
    <li v-for="page in pages" :key="page.id">
      <button
        :data-active="page.id === currentPageId"
        @click="actions.switch(page.id)"
      >
        {{ page.name }}
      </button>
    </li>
  </ul>
</PageListRoot>
```

## Related APIs

- [usePageList](../composables/use-page-list)
