<script setup lang="ts">
import { computed, useSlots, useTemplateRef } from 'vue'
import { UI } from 'vue-stream-markdown'

import Tip from '@/components/ui/overlay/Tip.vue'

defineOptions({ inheritAttrs: false })

const BuiltinTooltip = UI.Tooltip
type Placement = NonNullable<InstanceType<typeof BuiltinTooltip>['$props']['placement']>

/**
 * The markdown renderer's tooltip. A hover label uses the app's tooltip, in its style and without
 * the browser's own title tooltip beside it; menus, which the renderer builds from a click tooltip
 * with slot content, keep the renderer's.
 */
const {
  content,
  trigger = 'hover',
  placement = 'top',
  delay
} = defineProps<{
  content?: string
  trigger?: 'hover' | 'click'
  placement?: Placement
  delay?: number | [number, number]
}>()

const slots = useSlots()
const builtin = useTemplateRef<{ show: () => void; hide: () => void }>('builtin')
const usesBuiltin = computed(() => trigger === 'click' || slots.content !== undefined)

const side = computed(() => {
  const base = placement.split('-')[0]
  return base === 'bottom' || base === 'left' || base === 'right' ? base : 'top'
})

// The renderer's dropdown closes its menu through these.
defineExpose({
  show: () => builtin.value?.show(),
  hide: () => builtin.value?.hide()
})
</script>

<template>
  <component
    :is="BuiltinTooltip"
    v-if="usesBuiltin"
    ref="builtin"
    v-bind="$attrs"
    :content="content"
    :trigger="trigger"
    :placement="placement"
    :delay="delay"
  >
    <template v-for="(_, name) in $slots" #[name]="scope"
      ><slot :name="name" v-bind="scope"
    /></template>
  </component>
  <Tip v-else :label="content" :side="side" :disabled="!content"><slot /></Tip>
</template>
