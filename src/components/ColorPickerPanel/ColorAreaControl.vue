<script setup lang="ts">
import { ColorAreaArea, ColorAreaRoot, ColorAreaThumb } from 'reka-ui'

import { useColorPickerPanelContext } from '@/components/ColorPickerPanel/context'

const ctx = useColorPickerPanelContext()
</script>

<template>
  <ColorAreaRoot
    v-slot="{ style }"
    :model-value="ctx.rekaColor"
    color-space="hsb"
    x-channel="saturation"
    y-channel="brightness"
    @update:color="ctx.onRekaColorUpdate"
  >
    <ColorAreaArea
      class="relative h-[140px] w-full cursor-crosshair overflow-hidden rounded"
      :style="style"
    >
      <ColorAreaThumb
        class="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
      />
    </ColorAreaArea>
  </ColorAreaRoot>
</template>
