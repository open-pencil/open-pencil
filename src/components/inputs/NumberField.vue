<script lang="ts">
import type { VNode } from 'vue'

import type { NumberExpressionError } from '@open-pencil/vue/controls/number-expression'
import type {
  NumberFieldEditPolicy,
  NumberFieldSlotProps
} from '@open-pencil/vue/primitives/NumberField'

import type { ComponentUI } from '@/components/ui/types'
import type { NumberFieldTheme } from '@/theme/input/number-field'

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
  inheritBinding?: boolean
  bound?: boolean
  editPolicy?: NumberFieldEditPolicy
  /** Units a typed value may end with; the commit reports the one typed. */
  units?: readonly string[]
  ui?: NumberFieldUI
}

export interface NumberFieldSlots {
  icon?(): VNode[]
  suffix?(): VNode[]
  display?(props: NumberFieldSlotProps & { value: string }): VNode[]
  bound?(props: NumberFieldSlotProps & { value: string }): VNode[]
}
</script>

<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, normalizeClass, useAttrs } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'
import {
  NumberFieldRoot,
  NumberFieldInput,
  NumberFieldValue
} from '@open-pencil/vue/primitives/NumberField'

import { useEditorStore } from '@/app/editor/active-store'
import theme from '@/theme/input/number-field'

const attrs = useAttrs()
const slots = defineSlots<NumberFieldSlots>()
const store = useEditorStore()
const { panels } = useI18n()

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
  inheritBinding = true,
  bound,
  editPolicy,
  units,
  ui
} = defineProps<NumberFieldProps>()
const accessibleLabel = computed(() => {
  const ariaLabel = attrs['aria-label']
  return typeof ariaLabel === 'string' ? ariaLabel : (label ?? icon)
})
const styles = computed(() => tv(theme)({ suffix: Boolean(slots.suffix) }))

const emit = defineEmits<{
  'update:modelValue': [value: number, unit?: string]
  'editing-change': [editing: boolean]
  commit: [value: number, previous: number, unit?: string]
  cancel: []
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
    :placeholder="placeholder ?? panels.mixed"
    :aria-label="accessibleLabel"
    :disabled="disabled"
    :inherit-binding="inheritBinding"
    :bound="bound"
    :edit-policy="editPolicy"
    :units="units"
    @update:model-value="(value: number, unit?: string) => emit('update:modelValue', value, unit)"
    @commit="(val: number, prev: number, unit?: string) => emit('commit', val, prev, unit)"
    @cancel="emit('cancel')"
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
      v-bind="{ ...attrs, ...rootAttrs }"
      data-slot="root"
      :class="styles.root({ class: [ui?.root, normalizeClass(attrs.class)] })"
      @pointerdown="
        !editing &&
        !($event.target as HTMLElement)?.closest?.('button') &&
        actions.startScrub($event)
      "
    >
      <span
        v-if="editing || !slots.bound || rootAttrs['data-bound'] === undefined"
        :class="styles.leading({ class: ui?.leading })"
      >
        <slot name="icon">
          <span v-if="icon" class="text-[11px] leading-none">{{ icon }}</span>
        </slot>
        <span v-if="label" class="text-[11px] leading-none">{{ label }}</span>
      </span>
      <NumberFieldInput :class="styles.field({ class: ui?.field })" />
      <NumberFieldValue :class="styles.display({ class: ui?.display })">
        <template #default="display">
          <slot name="display" v-bind="display">
            <slot v-if="display.bound" name="bound" v-bind="display">
              <span :class="styles.value({ class: ui?.value })">{{ display.value }}</span>
              <span v-if="suffix" :class="styles.suffix({ class: ui?.suffix })">{{ suffix }}</span>
            </slot>
            <span v-else-if="display.isMixed" :class="styles.mixed({ class: ui?.mixed })">
              {{ ph }}
            </span>
            <template v-else>
              <span :class="styles.value({ class: ui?.value })">{{ display.value }}</span>
              <span v-if="suffix" :class="styles.suffix({ class: ui?.suffix })">{{ suffix }}</span>
            </template>
          </slot>
        </template>
      </NumberFieldValue>
      <span v-if="editing && suffix" :class="styles.suffix({ class: ui?.suffix })">{{
        suffix
      }}</span>
      <span
        v-if="slots.suffix"
        data-slot="trailing"
        :class="styles.trailing({ class: ui?.trailing })"
      >
        <slot name="suffix" />
      </span>
    </div>
  </NumberFieldRoot>
</template>
