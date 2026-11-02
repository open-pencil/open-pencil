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
current scene-graph color.

`openChange` reports the complete picker interaction boundary. `cancel` fires before an Escape
close, allowing BindableValue consumers to roll back a variable detach and paint update together.
Opening or focusing the picker does not emit a color update.

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
    @cancel="console.log('cancel')"
  >
    <template #trigger="{ style }">
      <button :style="style" aria-label="Edit color" />
    </template>
    <template #default="{ color: currentColor }">
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
