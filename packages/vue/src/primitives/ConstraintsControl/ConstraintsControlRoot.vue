<script setup lang="ts">
import { useConstraints } from '#vue/controls/constraints/use'
import type {
  ConstraintsControlActions,
  ConstraintsControlRootSlots
} from '#vue/primitives/ConstraintsControl/types'

const constraints = useConstraints()
defineSlots<ConstraintsControlRootSlots>()

const actions: ConstraintsControlActions = {
  setHorizontal: (value) => constraints.setAxis('horizontal', value),
  setVertical: (value) => constraints.setAxis('vertical', value),
  setCenter: (axis) => constraints.setAxis(axis, 'CENTER'),
  togglePin: constraints.togglePin
}
</script>

<template>
  <slot
    :active="constraints.active.value"
    :is-multi="constraints.isMulti.value"
    :horizontal="constraints.horizontal.value"
    :vertical="constraints.vertical.value"
    :actions="actions"
  />
</template>
