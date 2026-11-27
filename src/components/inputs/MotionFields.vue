<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Easing } from '@open-pencil/scene-graph'
import { isEasing } from '@open-pencil/scene-graph/variables'
import type { MotionControl, MotionVariable } from '@open-pencil/vue/controls/motion'
import { useMessages } from '@open-pencil/vue/i18n'

import NumberField from '@/components/inputs/NumberField.vue'
import PaintField from '@/components/inputs/PaintField.vue'
import { BindingPill, VariablePicker } from '@/components/ui/binding'
import type { VariablePickerItem } from '@/components/ui/binding/picker'
import { useInlineSide } from '@/components/ui/direction/inline-side'
import EasingField from '@/components/variables/easing/EasingField.vue'
import { easingLabel } from '@/components/variables/easing/presets'
import { easingThumbnail } from '@/components/variables/easing/thumbnail'

/**
 * A duration in milliseconds and an easing, each its own value or a TIMING or EASING variable's,
 * as a behaviour's transition, a slide's transition, and a layer's animation have them.
 */
const {
  motion,
  durationLabel,
  easingLabel: easingFieldLabel,
  name
} = defineProps<{
  motion: MotionControl
  durationLabel: string
  easingLabel: string
  /** Names the fields for tests: `<name>-duration` and `<name>-easing`. */
  name: string
}>()
const emit = defineEmits<{
  set: [patch: { duration?: number; easing?: Easing }]
  bind: [field: 'duration' | 'easing', variableId: string | null]
}>()
const variables = useMessages('variables/panel')
const easingMessages = useMessages('variables/easing')
const side = useInlineSide('start')

/** Milliseconds to the hundredth, so a file's single-precision 0.15 reads 150. */
const toMs = (seconds: number) => Number((seconds * 1000).toFixed(2))
/**
 * The duration in milliseconds, as the field shows it: the bound variable's value, or the
 * motion's own, following a scrub live; only the commit changes the document.
 */
const durationVariableMs = computed(() => {
  const value = motion.durationVariable?.value
  return typeof value === 'number' ? toMs(value) : undefined
})
const live = ref<number | null>(null)
const durationMs = computed(() => live.value ?? durationVariableMs.value ?? toMs(motion.duration))
function commitDuration(ms: number) {
  live.value = null
  emit('set', { duration: Math.max(0, ms) / 1000 })
}

function timingText(variable: MotionVariable): string | undefined {
  return typeof variable.value === 'number' ? `${toMs(variable.value)}ms` : undefined
}
function easingText(variable: MotionVariable): string | undefined {
  return isEasing(variable.value) ? easingLabel(variable.value, easingMessages.value) : undefined
}

function picker(
  field: 'duration' | 'easing',
  label: string,
  items: VariablePickerItem[],
  bound: MotionVariable | null
) {
  return {
    items,
    selected: bound?.id,
    state: bound ? ('bound' as const) : ('unbound' as const),
    triggerLabel: `${label}: ${variables.value.useVariable}`,
    searchPlaceholder: variables.value.searchVariables,
    emptyLabel: variables.value.noMatchingVariables,
    detachLabel: variables.value.detachVariable,
    side: side.value,
    onSelect: (id: string) => emit('bind', field, id),
    onDetach: () => emit('bind', field, null)
  }
}
const durationPicker = computed(() =>
  picker(
    'duration',
    durationLabel,
    motion.timingVariables.map((item) => ({ ...item, text: timingText(item) })),
    motion.durationVariable
  )
)
const easingPicker = computed(() =>
  picker(
    'easing',
    easingFieldLabel,
    motion.easingVariables.map((item) => ({ ...item, text: easingText(item) })),
    motion.easingVariable
  )
)
const boundEasing = computed(() => {
  const value = motion.easingVariable?.value
  return isEasing(value) ? value : motion.easing
})
</script>

<template>
  <!-- A bound duration reads like any bound number: its value, the variable named by the
       variable button's tooltip; editing it lets go of the variable. -->
  <NumberField
    :model-value="durationMs"
    :min="0"
    :step="10"
    suffix="ms"
    :inherit-binding="false"
    :bound="Boolean(motion.durationVariable)"
    :aria-label="durationLabel"
    :data-test-id="`${name}-duration`"
    @update:model-value="live = $event"
    @commit="commitDuration"
    @cancel="live = null"
  >
    <template #icon><icon-lucide-clock class="size-3.5" /></template>
    <template #suffix><VariablePicker v-bind="durationPicker" /></template>
  </NumberField>
  <PaintField v-if="motion.easingVariable" :data-test-id="`${name}-easing`">
    <template #preview>
      <component :is="easingThumbnail(boundEasing)" class="size-4 shrink-0 text-muted" />
    </template>
    <template #value>
      <BindingPill class="min-w-0 flex-1" :label="motion.easingVariable.name" />
    </template>
    <template #binding><VariablePicker v-bind="easingPicker" /></template>
  </PaintField>
  <EasingField
    v-else
    :easing="motion.easing"
    tone="panel"
    :label="easingFieldLabel"
    :data-test-id="`${name}-easing`"
    @update="emit('set', { easing: $event })"
  >
    <template #binding><VariablePicker v-bind="easingPicker" /></template>
  </EasingField>
</template>
