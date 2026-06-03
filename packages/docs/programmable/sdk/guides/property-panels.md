---
title: Property Panels
description: Build property panels with control composables and headless list primitives.
---

# Property Panels

Property panels in `@inkly/vue` are intentionally composable-first.

If a panel mostly needs selection-derived values and update actions, prefer composables.
If a panel needs reusable array/list structure, use a headless primitive like `PropertyListRoot`.

## Common control composables

For standard property sections, start with:

- `usePosition()`
- `useLayout()`
- `useAppearance()`
- `useTypography()`
- `useExport()`

For list-style panels, use:

- `useFillControls()`
- `useStrokeControls()`
- `useEffectsControls()`

## Example: position panel

```vue
<script setup lang="ts">
import { usePosition } from '@inkly/vue'

const { x, y, width, height, updateProp, commitProp } = usePosition()
</script>

<template>
  <div class="grid grid-cols-2 gap-2">
    <input :value="x" @input="updateProp('x', Number(($event.target as HTMLInputElement).value))" />
    <input :value="y" @input="updateProp('y', Number(($event.target as HTMLInputElement).value))" />
    <input :value="width" @input="updateProp('width', Number(($event.target as HTMLInputElement).value))" />
    <input :value="height" @input="updateProp('height', Number(($event.target as HTMLInputElement).value))" />
  </div>
</template>
```

## Example: fills panel

```vue
<script setup lang="ts">
import { PropertyListRoot, useFillControls } from '@inkly/vue'

const fillControls = useFillControls()
</script>

<template>
  <PropertyListRoot prop-key="fills" v-slot="{ items, add, remove }">
    <div v-for="(fill, index) in items" :key="index">
      {{ fill.type }}
      <button @click="remove(index)">Remove</button>
    </div>

    <button @click="add(fillControls.defaultFill)">Add fill</button>
  </PropertyListRoot>
</template>
```

## Rule of thumb

- use composables for direct control logic
- use structural primitives when repeated list/tree/slot coordination is the hard part

## Related APIs

- [usePosition](../api/composables/use-position)
- [useLayout](../api/composables/use-layout)
- [useAppearance](../api/composables/use-appearance)
- [useTypography](../api/composables/use-typography)
- [useFillControls](../api/composables/use-fill-controls)
- [useStrokeControls](../api/composables/use-stroke-controls)
- [useEffectsControls](../api/composables/use-effects-controls)
- [PropertyListRoot](../api/components/property-list-root)
