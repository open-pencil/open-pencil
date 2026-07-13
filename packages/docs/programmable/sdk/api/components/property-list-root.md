---
title: PropertyList
description: Precisely typed headless list anatomy for fills, strokes, and effects.
---

<script setup lang="ts">
import { data } from './property-list.data'
</script>

# PropertyList

PropertyList is a controlled, headless list primitive for fills, strokes, and effects. The
`propKey` discriminator gives slots and actions exact `Fill`, `Stroke`, or `Effect` types. Editor
mutation and undo behavior stay in `useEditorPropertyList()` or an application adapter.

## Anatomy

- `PropertyListRoot` — controlled items, identity, mixed state, and semantic events
- `PropertyListItem` — exact item type plus `data-hidden` and `data-dragging`
- `PropertyListAdd` — adds a typed item
- `PropertyListRemove` — removes an indexed item
- `PropertyListVisibility` — toggles indexed visibility and exposes `aria-pressed`

```vue twoslash
<script setup lang="ts">
import { ref } from 'vue'
import type { Fill } from '@open-pencil/scene-graph'
import {
  PropertyListItem,
  PropertyListRemove,
  PropertyListRoot
} from '@open-pencil/vue'

const fills = ref<Fill[]>([])
</script>

<template>
  <PropertyListRoot
    prop-key="fills"
    :items="fills"
    @remove="fills.splice($event, 1)"
    v-slot="{ items }"
  >
    <PropertyListItem
      v-for="(_, index) in items"
      :key="index"
      prop-key="fills"
      :index="index"
      v-slot="{ item }"
    >
      <span>{{ item?.type }}</span>
      <PropertyListRemove prop-key="fills" :index="index">Remove</PropertyListRemove>
    </PropertyListItem>
  </PropertyListRoot>
</template>
```

See the [PropertySection demo](./property-section) for the shared interactive state matrix.

## Editor adapter

OpenPencil panels use `useEditorPropertyList(propKey)` to connect controlled events to selection,
multi-node updates, undo batching, and reordering. Third-party SDK consumers can provide their own
state adapter without an OpenPencil editor context.

## Generated API reference

<SdkComponentAPI :components="data.components" />
