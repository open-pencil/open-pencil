<script setup lang="ts">
import { computed } from 'vue'

export interface SegmentedControlOption {
  value: string
  label: string
  disabled?: boolean
  testHook?: string
}

const {
  options,
  label,
  size = 'sm'
} = defineProps<{
  options: SegmentedControlOption[]
  label?: string
  size?: 'sm' | 'md'
}>()

const modelValue = defineModel<string>({ required: true })
const emit = defineEmits<{ change: [value: string] }>()

const itemClass = computed(() =>
  size === 'md' ? 'min-h-7 px-2 text-xs' : 'min-h-6 px-1.5 text-[11px]'
)

function select(value: string) {
  modelValue.value = value
  emit('change', value)
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="inline-flex min-w-0 items-center gap-0.5 rounded bg-input p-0.5"
  >
    <button
      v-for="option in options"
      :key="option.value"
      :data-test-id="option.testHook"
      type="button"
      role="radio"
      :aria-label="option.label"
      :aria-checked="modelValue === option.value"
      :disabled="option.disabled"
      :class="[
        itemClass,
        'flex min-w-0 cursor-pointer items-center justify-center rounded border border-transparent text-muted hover:bg-hover hover:text-surface disabled:cursor-not-allowed disabled:opacity-50',
        modelValue === option.value
          ? 'border-accent bg-accent text-white hover:bg-accent hover:text-white'
          : ''
      ]"
      @click="select(option.value)"
    >
      <slot name="option" :option="option" :selected="modelValue === option.value">
        <span class="truncate">{{ option.label }}</span>
      </slot>
    </button>
  </div>
</template>
