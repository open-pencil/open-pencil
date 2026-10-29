---
title: GradientEditorStop
description: Accessible primitive for a selected or draggable gradient stop.
---

<script setup lang="ts">
import { data } from './gradient-editor-stop.data'
</script>

# GradientEditorStop

`GradientEditorStop` renders a polymorphic gradient stop with documented selection and dragging
state. Interactive stops use the slider role and expose their percentage position through ARIA.

Use interactive stops on the gradient bar. Arrow keys nudge by `positionStep`; holding Shift uses a
10× step. Home and End move to either boundary, while Delete and Backspace emit `remove` when the
stop is removable. Handled keys stop propagation so editor-level deletion and movement shortcuts
do not run. Native Tab order cycles between stops.

Set `interactive="false"` when reusing the primitive around a composite stop row. The row still
exposes slot actions and `data-selected`/`data-dragging`, but does not enter the slider tab order.

```vue twoslash
<script setup lang="ts">
import type { GradientStop } from '@open-pencil/scene-graph'
import { GradientEditorStop } from '@open-pencil/vue/primitives/GradientEditor'

const stop: GradientStop = {
  color: { r: 0.4, g: 0.2, b: 0.9, a: 1 },
  position: 0.5
}
</script>

<template>
  <GradientEditorStop
    :stop="stop"
    :index="0"
    active
    label="Middle gradient stop"
    @update-position="(_index, position) => console.log(position)"
  />
</template>
```

## Generated API reference

<SdkComponentAPI :components="data.components" />

## Related APIs

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorBar](./gradient-editor-bar)
- [useColorModel](../composables/use-color-model)
