<script lang="ts">
import type { NumberExpressionError, NumberFieldEditPolicy } from '@open-pencil/vue'

import type { ComponentUI } from '@/components/ui/types'
import type { NumberFieldTheme } from '@/theme/number-field'

export type NumberFieldUI = ComponentUI<NumberFieldTheme>

export interface NumberFieldProps {
  modelValue: number | symbol
  min?: number
  max?: number
  step?: number
  icon?: string
  label?: string
  suffix?: string
  sensitivity?: number
  placeholder?: string
  disabled?: boolean
  bound?: boolean
  editPolicy?: NumberFieldEditPolicy
  ui?: NumberFieldUI
}
</script>

<script setup lang="ts">
import { computed, normalizeClass, useAttrs, useSlots } from 'vue'
import { tv } from 'tailwind-variants'
import { NumberFieldRoot, NumberFieldInput, NumberFieldValue, testId } from '@open-pencil/vue'
import { useEditorStore } from '@/app/editor/active-store'
import theme from '@/theme/number-field'

const attrs = useAttrs()
const slots = useSlots()
const store = useEditorStore()

const rootTestId = computed(() => (attrs['data-test-id'] as string | undefined) ?? 'number-field')

const {
  modelValue,
  min,
  max,
  step,
  icon,
  label,
  suffix,
  sensitivity,
  placeholder,
  disabled,
  bound,
  editPolicy,
  ui
} = defineProps<NumberFieldProps>()
const accessibleLabel = computed(() => {
  const ariaLabel = attrs['aria-label']
  return typeof ariaLabel === 'string' ? ariaLabel : (label ?? icon)
})
const styles = computed(() => tv(theme)({ suffix: Boolean(slots.suffix) }))

const emit = defineEmits<{
  'update:modelValue': [value: number]
  'editing-change': [editing: boolean]
  commit: [value: number, previous: number]
  invalid: [expression: string, reason: NumberExpressionError]
  'detach-request': [source: 'edit' | 'scrub' | 'step']
}>()

defineOptions({ inheritAttrs: false })
</script>

<template>
  <NumberFieldRoot
    v-slot="{ editing, actions, attrs: rootAttrs, placeholder: ph }"
    :model-value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :sensitivity="sensitivity"
    :placeholder="placeholder"
    :aria-label="accessibleLabel"
    :disabled="disabled"
    :bound="bound"
    :edit-policy="editPolicy"
    @update:model-value="emit('update:modelValue', $event)"
    @commit="(val: number, prev: number) => emit('commit', val, prev)"
    @invalid="
      (expression: string, reason: NumberExpressionError) => emit('invalid', expression, reason)
    "
    @detach-request="emit('detach-request', $event)"
    @editing-change="
      (editing: boolean) => {
        store.state.numberFieldFocused = editing
        emit('editing-change', editing)
      }
    "
  >
    <div
      v-bind="{ ...attrs, ...rootAttrs, ...testId(rootTestId) }"
      :class="styles.root({ class: [ui?.root, normalizeClass(attrs.class)] })"
      @pointerdown="
        !editing &&
        !($event.target as HTMLElement)?.closest?.('button') &&
        actions.startScrub($event)
      "
    >
      <span v-if="attrs['data-test-id']" data-test-id="number-field" class="hidden" />
      <span :class="styles.leading({ class: ui?.leading })">
        <slot name="icon">
          <span v-if="icon" class="text-[11px] leading-none">{{ icon }}</span>
        </slot>
        <span v-if="label" class="text-[11px] leading-none">{{ label }}</span>
      </span>
      <NumberFieldInput
        data-test-id="number-field-input"
        :class="styles.field({ class: ui?.field })"
      />
      <slot v-if="editing" name="suffix" />
      <NumberFieldValue :class="styles.display({ class: ui?.display })">
        <template #default="{ value, isMixed: mixed }">
          <span v-if="mixed" :class="styles.mixed({ class: ui?.mixed })">{{ ph }}</span>
          <template v-else>
            <span :class="styles.value({ class: ui?.value })">{{ value }}</span>
            <span v-if="suffix" :class="styles.suffix({ class: ui?.suffix })">{{ suffix }}</span>
          </template>
          <slot name="suffix" />
        </template>
      </NumberFieldValue>
    </div>
  </NumberFieldRoot>
</template>
