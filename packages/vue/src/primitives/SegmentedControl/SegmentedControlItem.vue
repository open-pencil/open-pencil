<script setup lang="ts">
import { computed } from 'vue'
import { Primitive, RovingFocusItem, ToggleGroupItem } from 'reka-ui'

import { useSegmentedControl } from '#vue/primitives/SegmentedControl/context'
import type {
  SegmentedControlItemProps,
  SegmentedControlItemSlots
} from '#vue/primitives/SegmentedControl/types'

const {
  value,
  disabled: disabledProp = false,
  as = 'button',
  asChild = false
} = defineProps<SegmentedControlItemProps>()
defineSlots<SegmentedControlItemSlots>()
defineOptions({ inheritAttrs: false })

const ctx = useSegmentedControl()
const disabled = computed(() => disabledProp || ctx.disabled.value)
const selected = computed(() => ctx.selected(value))
const slotProps = computed(() => ({
  value,
  selected: selected.value,
  disabled: disabled.value,
  mode: ctx.mode.value
}))

function activate() {
  if (!disabled.value) ctx.activate(value)
}
</script>

<template>
  <ToggleGroupItem
    v-if="ctx.mode.value !== 'action'"
    v-bind="$attrs"
    :value="value"
    :disabled="disabled"
    :as="as"
    :as-child="asChild"
    data-slot="item"
  >
    <slot v-bind="slotProps" />
  </ToggleGroupItem>

  <RovingFocusItem v-else :focusable="!disabled" as-child>
    <Primitive
      v-bind="$attrs"
      :as="as"
      :as-child="asChild"
      :type="!asChild && as === 'button' ? 'button' : undefined"
      :disabled="disabled"
      data-slot="item"
      data-state="off"
      @click="activate"
    >
      <slot v-bind="slotProps" />
    </Primitive>
  </RovingFocusItem>
</template>
