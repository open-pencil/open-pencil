<script setup lang="ts">
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { OkHCLControls } from '#vue/controls/color-model/types'
import { useColorModel } from '#vue/controls/color-model/use'

const {
  color,
  editable = false,
  okhcl = null
} = defineProps<{
  color: Color
  editable?: boolean
  okhcl?: OkHCLControls | null
}>()

const emit = defineEmits<{ update: [color: Color] }>()
const model = useColorModel({
  color: () => color,
  onUpdate: (nextColor) => emit('update', nextColor)
})

const actions = {
  updateFromHex: model.updateHex,
  updateColor: model.updateColor
}
</script>

<template>
  <slot
    :color="color"
    :editable="editable"
    :hex="model.hex.value"
    :actions="actions"
    :okhcl="okhcl"
  />
</template>
