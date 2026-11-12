---
title: FillSwatch
description: Semantic preview for solid, gradient, and image fills.
---

<script setup lang="ts">
import { data } from './fill-swatch.data'
</script>

# FillSwatch

`FillSwatch` exposes a semantic preview for a fill without imposing application styling. Its slot
provides the fill, preview background, category, and transparency state. The root also publishes
`data-fill-type`, `data-fill-category`, and `data-transparent` for styling and tests.

A swatch shows the fill it is given, also inside `BindableValueRoot`, so a variable picker's rows
keep their own colors. To preview a bound value, pass the root's `resolvedValue` as the fill's color
and bind its `stateAttrs` on the swatch. Consumers can place a checkerboard below the slot's `background` value for transparent paints.

```vue twoslash
<script setup lang="ts">
import type { Fill } from '@open-pencil/scene-graph'
import { FillSwatch } from '@open-pencil/vue/primitives/Fill'

const fill: Fill = {
  type: 'SOLID',
  color: { r: 0.2, g: 0.5, b: 0.9, a: 0.5 },
  opacity: 1,
  visible: true
}
</script>

<template>
  <FillSwatch :fill="fill" label="Brand fill" v-slot="swatch">
    <span :style="{ background: swatch.background }" />
  </FillSwatch>
</template>
```

## Generated API reference

<SdkComponentAPI :components="data.components" />

## Related APIs

- [FillRoot](./fill-root)
- [BindableValue](./bindable-value)
