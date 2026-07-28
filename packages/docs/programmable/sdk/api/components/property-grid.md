---
title: PropertyGrid
description: Headless field-grid and action-rail anatomy for property panels.
---

<script setup lang="ts">
import { data } from './property-grid.data'
</script>

# PropertyGrid

`PropertyGridRoot` separates responsive property fields from optional intrinsic-width actions. It exposes structural data attributes without imposing column widths, gaps, or presentation.

```vue twoslash
<script setup lang="ts">
import { PropertyGridRoot } from '@open-pencil/vue'
</script>

<template>
  <PropertyGridRoot :columns="2">
    <label>
      Width
      <input type="number" />
    </label>
    <label>
      Height
      <input type="number" />
    </label>
    <template #actions>
      <button type="button" aria-label="Constrain proportions">Link</button>
    </template>
  </PropertyGridRoot>
</template>
```

Themes can target `data-slot="fields"`, `data-slot="actions"`, `data-columns`, and `data-distribution`. The `wide-first` distribution is semantic; consumers choose its exact ratio.

## Generated API reference

<SdkComponentAPI :components="data.components" />
