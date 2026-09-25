---
title: ChannelSlider
description: Accessible scalar channel slider for OkHCL controls.
---

<script setup lang="ts">
import FillStates from '#vue/primitives/Fill/examples/States.vue'
import { data } from './channel-slider.data'
</script>

# ChannelSlider

`ChannelSlider` provides the same Root/Track/Thumb composition and keyboard behavior as Reka's
Slider while accepting an arbitrary scalar channel. OpenPencil uses it only for OkHCL channels;
standard RGB, HSL, and HSB controls should use Reka `ColorSlider` directly.

<FillStates />

## Anatomy

- `ChannelSliderRoot` — controlled value, range, step, orientation, and accessible channel label
- `ChannelSliderTrack` — polymorphic track element
- `ChannelSliderThumb` — slider thumb with range ARIA and formatted value text

Arrow keys step the value. Page Up and Page Down use larger steps, while Home and End move to the
range boundaries. The primitive is temporary until [Reka issue #2798](https://github.com/unovue/reka-ui/issues/2798)
provides first-class OkHCL support.

```vue twoslash
<script setup lang="ts">
import { ref } from 'vue'
import {
  ChannelSliderRoot,
  ChannelSliderThumb,
  ChannelSliderTrack
} from '@open-pencil/vue'

const chroma = ref(0.16)
</script>

<template>
  <ChannelSliderRoot v-model="chroma" label="Chroma" :min="0" :max="0.4" :step="0.001">
    <ChannelSliderTrack />
    <ChannelSliderThumb />
  </ChannelSliderRoot>
</template>
```

## Generated API reference

<SdkComponentAPI :components="data.components" />

## Related APIs

- [useColorModel](../composables/use-color-model)
- [FillRoot](./fill-root)
