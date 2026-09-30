---
title: FillSwatch
description: Binding-aware semantic preview for solid, gradient, and image fills.
---

<script setup lang="ts">
import { data } from './fill-swatch.data'
</script>

# FillSwatch

`FillSwatch` exposes a semantic preview for a fill without imposing application styling. Its slot
provides the effective fill, preview background, category, and transparency state. The root also
publishes `data-fill-type`, `data-fill-category`, and `data-transparent` for styling and tests.

When nested in `BindableValueRoot<Color>`, a bound solid fill previews the provider's resolved color
and forwards the binding state attributes. Reading or focusing a swatch never detaches the binding.
Consumers can place a checkerboard below the slot's `background` value for transparent paints.

```vue twoslash
<script setup lang="ts">
import type { Fill } from '@open-pencil/scene-graph'
import { FillSwatch } from '@open-pencil/vue'

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
