<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'

import { constraintPins, useI18n } from '@open-pencil/vue'

import Tip from '@/components/ui/overlay/Tip.vue'
import constraintsTheme from '@/theme/constraints'

import type {
  ConstraintsControlActions,
  ConstraintAxis,
  ConstraintEdge,
  ConstraintValue
} from '@open-pencil/vue'

type PinPosition = keyof (typeof constraintsTheme)['variants']['pinPosition']
type PinItem = {
  axis: ConstraintAxis
  edge: ConstraintEdge | 'center'
  position: PinPosition
  label: string
  active: boolean
}

const { horizontal, vertical, actions } = defineProps<{
  horizontal: ConstraintValue
  vertical: ConstraintValue
  actions: ConstraintsControlActions
}>()

const { panels } = useI18n()
const constraintStyles = tv(constraintsTheme)
const horizontalPins = computed(() => constraintPins(horizontal))
const verticalPins = computed(() => constraintPins(vertical))
const diagramStyles = computed(() =>
  constraintStyles({ scale: horizontal === 'SCALE' || vertical === 'SCALE' })
)
const pins = computed<PinItem[]>(() => [
  {
    axis: 'horizontal',
    edge: 'leading',
    position: 'horizontalLeading',
    label: panels.value.constraintLeft,
    active: horizontalPins.value.leading
  },
  {
    axis: 'horizontal',
    edge: 'trailing',
    position: 'horizontalTrailing',
    label: panels.value.constraintRight,
    active: horizontalPins.value.trailing
  },
  {
    axis: 'vertical',
    edge: 'leading',
    position: 'verticalLeading',
    label: panels.value.constraintTop,
    active: verticalPins.value.leading
  },
  {
    axis: 'vertical',
    edge: 'trailing',
    position: 'verticalTrailing',
    label: panels.value.constraintBottom,
    active: verticalPins.value.trailing
  },
  {
    axis: 'horizontal',
    edge: 'center',
    position: 'horizontalCenter',
    label: panels.value.constraintHorizontalCenter,
    active: horizontalPins.value.center
  },
  {
    axis: 'vertical',
    edge: 'center',
    position: 'verticalCenter',
    label: panels.value.constraintVerticalCenter,
    active: verticalPins.value.center
  }
])

function pinStyles(pin: PinItem) {
  return constraintStyles({ active: pin.active, pinPosition: pin.position })
}

function activate(pin: PinItem, event: MouseEvent) {
  if (pin.edge === 'center') actions.setCenter(pin.axis)
  else actions.togglePin(pin.axis, pin.edge, event.shiftKey)
}
</script>

<template>
  <div
    role="group"
    :aria-label="panels.constraints"
    data-slot="diagram"
    :data-scale="horizontal === 'SCALE' || vertical === 'SCALE' || undefined"
    :class="diagramStyles.diagram()"
  >
    <Tip v-for="pin in pins" :key="pin.position" :label="pin.label">
      <button
        type="button"
        data-slot="pin"
        :data-axis="pin.axis"
        :data-edge="pin.edge"
        :aria-label="pin.label"
        :aria-pressed="pin.active"
        :class="pinStyles(pin).pin()"
        @click="activate(pin, $event)"
      >
        <span :class="pinStyles(pin).pinMark()" />
      </button>
    </Tip>
    <span
      v-if="horizontalPins.scale || verticalPins.scale"
      data-slot="scale-badge"
      :class="diagramStyles.scaleBadge()"
    >
      {{ panels.constraintScale }}
    </span>
  </div>
</template>
