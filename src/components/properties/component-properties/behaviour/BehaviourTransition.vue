<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { Easing } from '@open-pencil/scene-graph'
import { isEasing } from '@open-pencil/scene-graph/variables'
import type {
  BehaviourTransitionControl,
  BehaviourTransitionVariable
} from '@open-pencil/vue/controls/behaviour'
import { useMessages } from '@open-pencil/vue/i18n'

import PaintField from '@/components/inputs/PaintField.vue'
import { BindingPill, VariablePicker } from '@/components/ui/binding'
import type { VariablePickerItem } from '@/components/ui/binding/picker'
import IconButton from '@/components/ui/button/IconButton.vue'
import { useInlineSide } from '@/components/ui/direction/inline-side'
import AppInput from '@/components/ui/input/AppInput.vue'
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

/** The duration as typed, in milliseconds, committed on change as one undo step. */
const draft = ref('')
const milliseconds = (seconds: number) => String(Number((seconds * 1000).toFixed(2)))
watch(
  () => transition?.duration,
  (seconds) => (draft.value = seconds === undefined ? '' : milliseconds(seconds)),
  { immediate: true }
)
function commitDuration() {
  // A number field's model holds a number once typed in.
  const text = String(draft.value).trim()
  const ms = Number(text)
  if (text && Number.isFinite(ms) && ms >= 0) emit('set', { duration: ms / 1000 })
  else if (transition) draft.value = milliseconds(transition.duration)
}
/** Enter commits the duration and leaves the field, so the editor's shortcuts work again. */
function done(event: KeyboardEvent) {
  if (event.target instanceof HTMLElement) event.target.blur()
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
      <PaintField v-if="transition.durationVariable" tone="form">
        <template #preview><icon-lucide-clock class="size-3.5 text-muted" /></template>
        <template #value>
          <BindingPill class="min-w-0 flex-1" :label="transition.durationVariable.name" />
        </template>
        <template #binding><VariablePicker v-bind="durationPicker" /></template>
      </PaintField>
      <AppInput
        v-else
        v-model="draft"
        type="number"
        size="sm"
        :min="0"
        :aria-label="behaviourMessages.transitionDuration"
        data-test-id="behaviour-transition-duration"
        @change="commitDuration"
        @enter="done"
      >
        <template #leading><icon-lucide-clock class="size-3.5 text-muted" /></template>
        <template #trailing>
          <span class="text-3xs text-muted">ms</span>
          <VariablePicker v-bind="durationPicker" />
        </template>
      </AppInput>
      <PaintField v-if="transition.easingVariable" tone="form">
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
        :label="behaviourMessages.transitionEasing"
        @update="emit('set', { easing: $event })"
      >
        <template #binding><VariablePicker v-bind="easingPicker" /></template>
      </EasingField>
    </template>
  </div>
</template>
