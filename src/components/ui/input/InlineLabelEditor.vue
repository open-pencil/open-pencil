<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const {
  modelValue,
  label,
  variant = 'section'
} = defineProps<{
  modelValue: string
  label: string
  /** The typography of the label it edits: a section title's pill or a frame's plain name. */
  variant?: 'section' | 'name'
}>()

// The canvas draws section titles in 11px semibold with 6px padding, names in 11px regular.
const TEXT = {
  section: 'px-1.5 text-[11px] font-semibold leading-6',
  name: 'px-0.5 text-[11px] font-normal leading-[18px]'
}

const emit = defineEmits<{
  'update:modelValue': [value: string]
  commit: []
  cancel: []
}>()

const input = ref<HTMLInputElement | null>(null)

function updateValue(event: Event) {
  const target = event.target
  if (target instanceof HTMLInputElement) emit('update:modelValue', target.value)
}

watch(
  () => input.value,
  (element) => {
    if (!element) return
    void nextTick(() => {
      element.focus()
      element.select()
    })
  },
  { immediate: true }
)
</script>

<template>
  <div class="grid h-full">
    <span
      aria-hidden="true"
      class="invisible col-start-1 row-start-1 h-full whitespace-pre"
      :class="TEXT[variant]"
      >{{ modelValue || ' ' }}</span
    >
    <input
      ref="input"
      :value="modelValue"
      :aria-label="label"
      class="col-start-1 row-start-1 h-full w-0 min-w-full bg-transparent outline-none"
      :class="TEXT[variant]"
      @input="updateValue"
      @keydown.enter.prevent="emit('commit')"
      @keydown.escape.prevent="emit('cancel')"
      @blur="emit('commit')"
    />
  </div>
</template>
