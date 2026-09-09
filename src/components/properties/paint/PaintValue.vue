<script setup lang="ts">
import { computed } from 'vue'

import type { Color } from '@open-pencil/scene-graph/primitives'
import { inputValue, useColorModel } from '@open-pencil/vue'

import { BindingPill } from '@/components/ui/binding'

const { color, resolvedColor, variableName, label } = defineProps<{
  color: Color
  resolvedColor?: Color
  variableName?: string
  label: string
}>()
const emit = defineEmits<{ update: [color: Color] }>()

const displayColor = computed(() => resolvedColor ?? color)
const model = useColorModel({
  color: displayColor,
  onUpdate: (updated) => emit('update', updated)
})
const tooltip = computed(() => (variableName ? `${variableName} · #${model.hex.value}` : undefined))
</script>

<template>
  <BindingPill
    v-if="variableName"
    class="min-w-0 flex-1"
    :label="variableName"
    :tooltip="tooltip"
  />
  <input
    v-else
    :aria-label="label"
    data-property="color-hex"
    class="min-w-0 flex-1 border-none bg-transparent font-mono text-xs text-surface outline-none"
    :value="model.hex.value"
    maxlength="6"
    @change="model.updateHex(inputValue($event))"
  />
</template>
