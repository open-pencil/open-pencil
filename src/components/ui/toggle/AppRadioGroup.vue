<script setup lang="ts" generic="T extends string | number">
import { RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { useId } from 'vue'

import theme from '@/theme/toggle/radio'

import type { AppRadioGroupUI, AppRadioOption } from './radio'

const {
  label,
  labelledby,
  options,
  orientation,
  disabled = false,
  ui
} = defineProps<{
  label?: string
  labelledby?: string
  options: AppRadioOption<T>[]
  orientation?: 'vertical' | 'horizontal'
  disabled?: boolean
  ui?: AppRadioGroupUI
}>()
const modelValue = defineModel<T>({ required: true })
const styles = tv(theme)()
const id = useId()
</script>

<template>
  <RadioGroupRoot
    v-model="modelValue"
    :aria-label="labelledby ? undefined : label"
    :aria-labelledby="labelledby"
    :orientation="orientation"
    :disabled="disabled"
    :class="styles.root({ class: ui?.root })"
  >
    <label
      v-for="(option, index) in options"
      :key="option.value"
      :class="styles.option({ class: ui?.option })"
      data-slot="radio-option"
    >
      <RadioGroupItem
        :value="option.value"
        :disabled="option.disabled"
        :aria-labelledby="`${id}-${index}-label`"
        :aria-describedby="option.description ? `${id}-${index}-description` : undefined"
        :class="styles.item({ class: ui?.item })"
      >
        <RadioGroupIndicator :class="styles.indicator({ class: ui?.indicator })" />
      </RadioGroupItem>
      <span :class="styles.text({ class: ui?.text })">
        <span :id="`${id}-${index}-label`" :class="styles.label({ class: ui?.label })">{{
          option.label
        }}</span>
        <span
          v-if="option.description"
          :id="`${id}-${index}-description`"
          :class="styles.description({ class: ui?.description })"
        >
          {{ option.description }}
        </span>
      </span>
    </label>
  </RadioGroupRoot>
</template>
