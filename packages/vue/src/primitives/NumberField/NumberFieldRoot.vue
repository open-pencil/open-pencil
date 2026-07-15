<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'

import {
  clampNumberValue,
  evaluateNumberExpression,
  normalizeNumberValue,
  stepNumberValue
} from '#vue/controls/number-expression'
import type { NumberExpressionError } from '#vue/controls/number-expression'
import { useOptionalBindableValue } from '#vue/primitives/BindableValue/context'
import { provideNumberField } from '#vue/primitives/NumberField/context'
import type {
  NumberFieldActions,
  NumberFieldEditPolicy,
  NumberFieldMutationSource,
  NumberFieldRootAttrs,
  NumberFieldRootEmits,
  NumberFieldRootProps,
  NumberFieldRootSlots,
  NumberFieldSlotProps,
  NumberFieldState,
  NumberFieldStateAttrs
} from '#vue/primitives/NumberField/types'
import { inputValue } from '#vue/shared/dom-events'

const {
  modelValue,
  min = -Infinity,
  max = Infinity,
  step = 1,
  sensitivity = 1,
  placeholder = 'Mixed',
  ariaLabel,
  disabled: disabledProp = false,
  bound: boundProp = false,
  editPolicy = 'editable'
} = defineProps<NumberFieldRootProps>()
const emit = defineEmits<NumberFieldRootEmits>()
defineSlots<NumberFieldRootSlots>()

const binding = useOptionalBindableValue<number>()
const editing = ref(false)
const scrubbing = ref(false)
const draftValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const invalidReason = ref<NumberExpressionError | null>(null)
const workingValue = ref(0)

const isMixed = computed(() => binding?.state.value === 'mixed' || typeof modelValue === 'symbol')
const numericValue = computed(() => {
  const resolved = binding?.resolvedValue.value
  if (binding?.state.value === 'bound' && typeof resolved === 'number') return resolved
  return typeof modelValue === 'number' ? modelValue : 0
})
const displayValue = computed(() =>
  isMixed.value ? '' : String(normalizeNumberValue(numericValue.value))
)
const disabled = computed(() => disabledProp)
const bound = computed(() => (binding ? binding.state.value === 'bound' : boundProp))
const effectiveEditPolicy = computed<NumberFieldEditPolicy>(() => {
  if (!binding) return editPolicy
  if (binding.policy.value === 'readonly-when-bound') return 'readonly'
  if (binding.policy.value === 'detach-on-edit') return 'detach-on-edit'
  return 'editable'
})
const minValue = computed(() => min)
const maxValue = computed(() => max)
const stepValue = computed(() => (Number.isFinite(step) && step > 0 ? step : 1))
const ariaLabelValue = computed(() => ariaLabel)

let interactionStartValue = 0
let interactionStartedMixed = false
let mutationRequested = false
let stopMove: (() => void) | undefined
let stopUp: (() => void) | undefined
let stopCancel: (() => void) | undefined
let scrubTarget: Element | undefined
let scrubPointerId: number | undefined

function canMutate(): boolean {
  return !disabled.value && !(bound.value && effectiveEditPolicy.value === 'readonly')
}

function requestMutation(source: NumberFieldMutationSource): boolean {
  if (mutationRequested) return true
  if (!canMutate()) return false
  if (binding && !binding.actions.beginMutation(source)) return false
  if (!binding && bound.value && effectiveEditPolicy.value === 'detach-on-edit') {
    emit('detach-request', source)
  }
  mutationRequested = true
  return true
}

function beginInteraction() {
  interactionStartValue = numericValue.value
  interactionStartedMixed = isMixed.value
  workingValue.value = numericValue.value
  mutationRequested = false
  invalidReason.value = null
}

function updateValue(value: number) {
  const normalized = normalizeNumberValue(clampNumberValue(value, min, max))
  workingValue.value = normalized
  if (binding?.actions.applyValue(normalized)) return
  if (modelValue !== normalized) emit('update:modelValue', normalized)
}

function restoreInteractionValue() {
  if (workingValue.value !== interactionStartValue || interactionStartedMixed !== isMixed.value) {
    workingValue.value = interactionStartValue
    if (!binding?.actions.applyValue(interactionStartValue)) {
      emit('update:modelValue', interactionStartValue)
    }
  }
}

function finishCommit(value: number) {
  updateValue(value)
  editing.value = false
  if (workingValue.value !== interactionStartValue) {
    emit('commit', workingValue.value, interactionStartValue)
  }
  binding?.actions.commitMutation()
}

function startEdit() {
  if (editing.value || !canMutate()) return
  beginInteraction()
  draftValue.value = interactionStartedMixed ? '' : String(interactionStartValue)
  editing.value = true
  void nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

function setDraft(value: string) {
  if (value !== draftValue.value && !requestMutation('edit')) return
  draftValue.value = value
  const absoluteNumber = /^\s*(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?\s*$/i.test(value)
  if (absoluteNumber) updateValue(Number(value))
}

function onInput(event: Event) {
  setDraft(inputValue(event))
}

function commitEdit() {
  if (!editing.value) return
  const expression = draftValue.value
  const result = evaluateNumberExpression(expression, {
    current: interactionStartValue,
    max,
    mixed: interactionStartedMixed
  })
  if (!result.ok) {
    invalidReason.value = result.error
    restoreInteractionValue()
    editing.value = false
    binding?.actions.cancelMutation()
    emit('invalid', expression, result.error)
    return
  }
  finishCommit(result.value)
}

function cancelEdit() {
  if (!editing.value) return
  restoreInteractionValue()
  invalidReason.value = null
  editing.value = false
  binding?.actions.cancelMutation()
}

function stopScrubListeners() {
  stopMove?.()
  stopUp?.()
  stopCancel?.()
  stopMove = undefined
  stopUp = undefined
  stopCancel = undefined
  if (scrubTarget && scrubPointerId != null && scrubTarget.hasPointerCapture(scrubPointerId)) {
    scrubTarget.releasePointerCapture(scrubPointerId)
  }
  scrubTarget = undefined
  scrubPointerId = undefined
  if (typeof document !== 'undefined') document.body.style.cursor = ''
}

function startScrub(event: PointerEvent) {
  if (!canMutate()) return
  event.preventDefault()
  beginInteraction()

  const startX = event.clientX
  let lastX = startX
  let accumulated = numericValue.value
  let hasMoved = false
  const target = event.currentTarget instanceof Element ? event.currentTarget : undefined
  scrubTarget = target
  scrubPointerId = event.pointerId
  target?.setPointerCapture(event.pointerId)
  const listenerTarget = target ?? document

  stopMove = useEventListener(listenerTarget, 'pointermove', (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== event.pointerId) return
    const dx = moveEvent.clientX - lastX
    lastX = moveEvent.clientX
    if (!hasMoved && Math.abs(moveEvent.clientX - startX) > 2) {
      if (!requestMutation('scrub')) return
      hasMoved = true
      scrubbing.value = true
      document.body.style.cursor = 'ew-resize'
    }
    if (!hasMoved) return
    accumulated += dx * stepValue.value * sensitivity
    updateValue(accumulated)
  })

  const finish = (cancelled: boolean) => {
    stopScrubListeners()
    scrubbing.value = false
    if (cancelled) {
      restoreInteractionValue()
      binding?.actions.cancelMutation()
      return
    }
    if (!hasMoved) {
      startEdit()
      return
    }
    if (workingValue.value !== interactionStartValue) {
      emit('commit', workingValue.value, interactionStartValue)
    }
    binding?.actions.commitMutation()
  }

  stopUp = useEventListener(listenerTarget, 'pointerup', (upEvent: PointerEvent) => {
    if (upEvent.pointerId === event.pointerId) finish(false)
  })
  stopCancel = useEventListener(listenerTarget, 'pointercancel', (cancelEvent: PointerEvent) => {
    if (cancelEvent.pointerId === event.pointerId) finish(true)
  })
}

function stepValueFromKeyboard(event: KeyboardEvent) {
  if (event.code !== 'ArrowUp' && event.code !== 'ArrowDown') return false
  if (!editing.value) beginInteraction()
  if (!requestMutation('step')) return true
  event.preventDefault()

  const draftResult = editing.value
    ? evaluateNumberExpression(draftValue.value, {
        current: interactionStartValue,
        max,
        mixed: interactionStartedMixed
      })
    : undefined
  const base = draftResult?.ok ? draftResult.value : workingValue.value
  const next = stepNumberValue(
    base,
    event.code === 'ArrowUp' ? 1 : -1,
    stepValue.value,
    event,
    min,
    max
  )
  updateValue(next)
  draftValue.value = String(next)

  if (!editing.value) {
    if (next !== interactionStartValue) emit('commit', next, interactionStartValue)
    binding?.actions.commitMutation()
  }
  return true
}

function onKeydown(event: KeyboardEvent) {
  if (stepValueFromKeyboard(event)) return
  if (event.code === 'Enter') {
    event.preventDefault()
    commitEdit()
  } else if (event.code === 'Escape') {
    event.preventDefault()
    cancelEdit()
  }
}

const state = computed<NumberFieldState>(() => ({
  editing: editing.value,
  scrubbing: scrubbing.value,
  mixed: isMixed.value,
  disabled: disabled.value,
  bound: bound.value
}))

const stateAttrs = computed<NumberFieldStateAttrs>(() => ({
  'data-editing': editing.value ? '' : undefined,
  'data-scrubbing': scrubbing.value ? '' : undefined,
  'data-mixed': isMixed.value ? '' : undefined,
  'data-disabled': disabled.value ? '' : undefined,
  'data-bound': bound.value ? '' : undefined
}))

const rootTabindex = computed<0 | -1 | undefined>(() => {
  if (editing.value) return undefined
  return disabled.value ? -1 : 0
})

const rootAttrs = computed<NumberFieldRootAttrs>(() => ({
  ...stateAttrs.value,
  role: editing.value ? undefined : 'spinbutton',
  tabindex: rootTabindex.value,
  'aria-valuenow': editing.value || isMixed.value ? undefined : numericValue.value,
  'aria-valuemin': !editing.value && Number.isFinite(min) ? min : undefined,
  'aria-valuemax': !editing.value && Number.isFinite(max) ? max : undefined,
  'aria-disabled': !editing.value && disabled.value ? 'true' : undefined,
  'aria-label': editing.value ? undefined : ariaLabel,
  onFocus: startEdit,
  onKeydown
}))

const actions: NumberFieldActions = {
  startScrub,
  startEdit,
  cancelEdit,
  commitEdit,
  setDraft,
  input: onInput,
  keydown: onKeydown
}

const slotProps = computed<NumberFieldSlotProps>(() => ({
  modelValue,
  displayValue: displayValue.value,
  draftValue: draftValue.value,
  isMixed: isMixed.value,
  placeholder,
  ...state.value,
  state: state.value,
  attrs: rootAttrs.value,
  actions
}))

provideNumberField({
  modelValue: computed(() => modelValue),
  numericValue,
  displayValue,
  draftValue,
  isMixed,
  editing,
  scrubbing,
  disabled,
  bound,
  min: minValue,
  max: maxValue,
  step: stepValue,
  ariaLabel: ariaLabelValue,
  inputRef,
  state,
  stateAttrs,
  rootAttrs,
  slotProps,
  actions,
  invalidReason
})

watch(editing, (value) => emit('editing-change', value))
watch(
  () => modelValue,
  (value) => {
    if (!editing.value && !scrubbing.value && typeof value === 'number') workingValue.value = value
  },
  { immediate: true }
)

onBeforeUnmount(stopScrubListeners)
</script>

<template>
  <slot v-bind="slotProps" />
</template>
