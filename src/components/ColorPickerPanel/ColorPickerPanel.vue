<script setup lang="ts">
import type { Color } from '@open-pencil/core/types'
import type { OkHCLControls } from '@open-pencil/vue'

import ColorAreaControl from '@/components/ColorPickerPanel/ColorAreaControl.vue'
import FormatControls from '@/components/ColorPickerPanel/FormatControls.vue'
import HueAlphaSliders from '@/components/ColorPickerPanel/HueAlphaSliders.vue'
import { provideColorPickerPanel } from '@/components/ColorPickerPanel/context'

const { color, okhcl = null } = defineProps<{
  color: Color
  okhcl?: OkHCLControls | null
}>()

const emit = defineEmits<{
  update: [color: Color]
}>()

provideColorPickerPanel(
  {
    get color() {
      return color
    },
    get okhcl() {
      return okhcl
    }
  },
  emit
)
</script>

<template>
  <div class="flex flex-col gap-2">
    <ColorAreaControl />
    <HueAlphaSliders />
    <FormatControls />
  </div>
</template>
