<script setup lang="ts">
import { Primitive } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { normalizeClass, useAttrs, useSlots, useTemplateRef, type HTMLAttributes } from 'vue'

import type { ControlSize } from '@/theme/control'
import theme, { inputAdornment } from '@/theme/input/input'

interface AppInputProps {
  density?: 'compact' | 'comfortable'
  class?: HTMLAttributes['class']
  ui?: { root?: string; input?: string; leading?: string; trailing?: string }
  id?: string
  type?: 'text' | 'password' | 'number' | 'search'
  placeholder?: string
  ariaLabel?: string
  readonly?: boolean
  disabled?: boolean
  autofocus?: boolean
  min?: number
  max?: number
  step?: number
  tone?: 'default' | 'panel'
  size?: ControlSize
  state?: 'idle' | 'mixed' | 'bound' | 'invalid'
}

const {
  density = 'compact',
  class: className,
  ui,
  id,
  type = 'text',
  placeholder,
  ariaLabel,
  readonly,
  disabled,
  autofocus,
  min,
  max,
  step,
  tone = 'default',
  size = 'md',
  state = 'idle'
} = defineProps<AppInputProps>()

defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
const input = useTemplateRef<HTMLInputElement>('input')
defineExpose({
  focus: (options?: FocusOptions) => input.value?.focus(options),
  select: () => input.value?.select(),
  blur: () => input.value?.blur()
})
const slots = useSlots()
function inputClass() {
  return tv(theme)({
    tone,
    size,
    state,
    density,
    class: [
      ui?.input,
      !slots.leading && !slots.trailing ? normalizeClass(className) : '',
      slots.leading ? 'pl-10' : '',
      slots.trailing ? 'pr-10 [&::-webkit-search-cancel-button]:appearance-none' : ''
    ]
  })
}

const modelValue = defineModel<string | number>({ required: true })
const emit = defineEmits<{
  change: []
  enter: [event: KeyboardEvent]
  focus: [event: FocusEvent]
  paste: [event: ClipboardEvent]
  copy: [event: ClipboardEvent]
  cut: [event: ClipboardEvent]
}>()
</script>

<template>
  <Primitive
    :as-child="!$slots.leading && !$slots.trailing"
    :class="
      $slots.leading || $slots.trailing ? [inputAdornment.root, className, ui?.root] : undefined
    "
  >
    <span v-if="$slots.leading" data-slot="leading" :class="[inputAdornment.leading, ui?.leading]"
      ><slot name="leading"
    /></span>
    <input
      ref="input"
      v-bind="attrs"
      :id="id"
      v-model="modelValue"
      :type="type"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      :readonly="readonly"
      :disabled="disabled"
      :autofocus="autofocus"
      :min="min"
      :max="max"
      :step="step"
      :class="inputClass()"
      @change="emit('change')"
      @keydown.enter="emit('enter', $event)"
      @focus="emit('focus', $event)"
      @paste="emit('paste', $event)"
      @copy="emit('copy', $event)"
      @cut="emit('cut', $event)"
    />
    <span
      v-if="$slots.trailing"
      data-slot="trailing"
      :class="[inputAdornment.trailing, ui?.trailing]"
      ><slot name="trailing"
    /></span>
  </Primitive>
</template>
