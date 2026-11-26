<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Easing } from '@open-pencil/scene-graph'
import { isEasing } from '@open-pencil/scene-graph/variables'
import type {
  BehaviourTransitionControl,
  BehaviourTransitionVariable
} from '@open-pencil/vue/controls/behaviour'
import { useMessages } from '@open-pencil/vue/i18n'

import NumberField from '@/components/inputs/NumberField.vue'
import PaintField from '@/components/inputs/PaintField.vue'
import { BindingPill, VariablePicker } from '@/components/ui/binding'
import type { VariablePickerItem } from '@/components/ui/binding/picker'
import IconButton from '@/components/ui/button/IconButton.vue'
import { useInlineSide } from '@/components/ui/direction/inline-side'
import EasingField from '@/components/variables/easing/EasingField.vue'
import { easingLabel } from '@/components/variables/easing/presets'
import { easingThumbnail } from '@/components/variables/easing/thumbnail'

/**
 * How the control eases into each state, in preview and exported code: a duration in
 * milliseconds and an easing, each its own value or a TIMING or EASING variable's. Without one
 * the control changes state at once.
 */
const { transition } = defineProps<{ transition: BehaviourTransitionControl | null }>()
const emit = defineEmits<{
  add: []
  remove: []
  set: [patch: { duration?: number; easing?: Easing }]
  bind: [field: 'duration' | 'easing', variableId: string | null]
}>()
const behaviourMessages = useMessages('panels/behaviours')
const variables = useMessages('variables/panel')
const easingMessages = useMessages('variables/easing')
const side = useInlineSide('start')

/**
 * The duration in milliseconds, as the field shows it: the bound variable's value, or the
 * transition's own, following a scrub live; only the commit changes the document.
 */
/** Milliseconds to the hundredth, so a file's single-precision 0.15 reads 150. */
const toMs = (seconds: number) => Number((seconds * 1000).toFixed(2))
const durationVariableMs = computed(() => {
  const value = transition?.durationVariable?.value
  return typeof value === 'number' ? toMs(value) : undefined
})
const live = ref<number | null>(null)
const durationMs = computed(
  () => live.value ?? durationVariableMs.value ?? (transition ? toMs(transition.duration) : 0)
)
const milliseconds = (seconds: number) => String(toMs(seconds))
function commitDuration(ms: number) {
  live.value = null
  emit('set', { duration: Math.max(0, ms) / 1000 })
}

function timingText(variable: BehaviourTransitionVariable): string | undefined {
  return typeof variable.value === 'number' ? `${milliseconds(variable.value)}ms` : undefined
}
function easingText(variable: BehaviourTransitionVariable): string | undefined {
  return isEasing(variable.value) ? easingLabel(variable.value, easingMessages.value) : undefined
}

function picker(
  field: 'duration' | 'easing',
  label: string,
  items: VariablePickerItem[],
  bound: BehaviourTransitionVariable | null
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
  transition
    ? picker(
        'duration',
        behaviourMessages.value.transitionDuration,
        transition.timingVariables.map((item) => ({ ...item, text: timingText(item) })),
        transition.durationVariable
      )
    : null
)
const easingPicker = computed(() =>
  transition
    ? picker(
        'easing',
        behaviourMessages.value.transitionEasing,
        transition.easingVariables.map((item) => ({ ...item, text: easingText(item) })),
        transition.easingVariable
      )
    : null
)
const boundEasing = computed(() => {
  const value = transition?.easingVariable?.value
  return isEasing(value) ? value : transition?.easing
})
</script>

<template>
  <div class="flex flex-col gap-1.5" data-property="behaviour-transition">
    <div class="flex items-center justify-between gap-2">
      <span class="text-2xs text-muted">{{ behaviourMessages.transition }}</span>
      <IconButton
        v-if="transition"
        :label="behaviourMessages.removeTransition"
        data-test-id="behaviour-remove-transition"
        @click="emit('remove')"
      >
        <icon-lucide-minus class="size-3.5" />
      </IconButton>
      <IconButton
        v-else
        :label="behaviourMessages.addTransition"
        data-test-id="behaviour-add-transition"
        @click="emit('add')"
      >
        <icon-lucide-plus class="size-3.5" />
      </IconButton>
    </div>
    <template v-if="transition && durationPicker && easingPicker">
      <!-- A bound duration reads like any bound number: its value, the variable named by the
           variable button's tooltip; editing it lets go of the variable. -->
      <NumberField
        :model-value="durationMs"
        :min="0"
        :step="10"
        suffix="ms"
        :inherit-binding="false"
        :bound="Boolean(transition.durationVariable)"
        :aria-label="behaviourMessages.transitionDuration"
        data-test-id="behaviour-transition-duration"
        @update:model-value="live = $event"
        @commit="commitDuration"
        @cancel="live = null"
      >
        <template #icon><icon-lucide-clock class="size-3.5" /></template>
        <template #suffix><VariablePicker v-bind="durationPicker" /></template>
      </NumberField>
      <PaintField v-if="transition.easingVariable">
        <template #preview>
          <component
            :is="easingThumbnail(boundEasing ?? transition.easing)"
            class="size-4 shrink-0 text-muted"
          />
        </template>
        <template #value>
          <BindingPill class="min-w-0 flex-1" :label="transition.easingVariable.name" />
        </template>
        <template #binding><VariablePicker v-bind="easingPicker" /></template>
      </PaintField>
      <EasingField
        v-else
        :easing="transition.easing"
        tone="panel"
        :label="behaviourMessages.transitionEasing"
        @update="emit('set', { easing: $event })"
      >
        <template #binding><VariablePicker v-bind="easingPicker" /></template>
      </EasingField>
    </template>
  </div>
</template>
