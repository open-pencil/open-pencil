<script setup lang="ts">
import type { Color } from '@open-pencil/scene-graph/primitives'
import type { OkHCLControls } from '@open-pencil/vue'

import ColorAreaControl from '@/components/color-picker-panel/ColorAreaControl.vue'
import { provideColorPickerPanel } from '@/components/color-picker-panel/context'
import EyedropperButton from '@/components/color-picker-panel/EyedropperButton.vue'
import FormatControls from '@/components/color-picker-panel/FormatControls.vue'
import HueAlphaSliders from '@/components/color-picker-panel/HueAlphaSliders.vue'

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
    <div class="flex items-start gap-1.5">
      <EyedropperButton class="mt-0.5 shrink-0" />
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <HueAlphaSliders />
      </div>
    </div>
    <FormatControls />
  </div>
</template>
