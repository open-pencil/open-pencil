---
title: ColorPickerRoot
description: Headless popover-based color picker with interaction lifecycle events.
---

<script setup lang="ts">
import { data } from './color-picker-root.data'
</script>

# ColorPickerRoot

`ColorPickerRoot` composes a color swatch trigger with a popover surface while leaving the editor UI
to its slots. The trigger slot receives the current swatch style; the default slot receives the
current scene-graph color and `update()`. Send the editor's changes through `update()` so the picker
can group them into undo steps.

`openChange` reports when the picker opens and closes. `commit` ends one undo step: the release of a
press inside the picker, or a change made with no press held, such as a typed value. Escape during a
press that changed the color puts the color from before it back through `update` and emits `cancel` with `'press'`, so a BindableValue
consumer can roll back a variable detach and the paint change together; the picker stays open.
Otherwise Escape closes the picker and keeps its changes. For a color with no undo history, such as
a preference, set `escapeReverts`: Escape then also puts back the color the picker opened with and
emits `cancel` with `'escape'`. Opening or focusing the picker does not
emit a color update.

```vue twoslash
<script setup lang="ts">
import { ref } from 'vue'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { ColorPickerRoot } from '@open-pencil/vue/primitives/ColorPicker'

const color = ref<Color>({ r: 0.2, g: 0.5, b: 0.9, a: 1 })
</script>

<template>
  <ColorPickerRoot
    :color="color"
    @update="color = $event"
    @open-change="open => console.log(open)"
    @commit="console.log('commit')"
    @cancel="console.log('cancel')"
  >
    <template #trigger="{ style }">
      <button :style="style" aria-label="Edit color" />
    </template>
    <template #default="{ color: currentColor, update }">
      <button @click="update({ ...currentColor, r: 1 })">Full red</button>
      <output>{{ currentColor.r }}, {{ currentColor.g }}, {{ currentColor.b }}</output>
    </template>
  </ColorPickerRoot>
</template>
```

## Generated API reference

<SdkComponentAPI :components="data.components" />

## Related APIs

- [ColorInputRoot](./color-input-root)
- [useColorModel](../composables/use-color-model)
- [BindableValue](./bindable-value)
