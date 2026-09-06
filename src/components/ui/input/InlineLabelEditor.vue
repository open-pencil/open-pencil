<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const { modelValue, label } = defineProps<{
  modelValue: string
  label: string
}>()

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
      class="invisible col-start-1 row-start-1 h-full whitespace-pre px-2 text-xs leading-6"
      >{{ modelValue || ' ' }}</span
    >
    <input
      ref="input"
      :value="modelValue"
      :aria-label="label"
      class="col-start-1 row-start-1 h-full w-0 min-w-full bg-transparent px-2 text-xs leading-6 outline-none"
      @input="updateValue"
      @keydown.enter.prevent="emit('commit')"
      @keydown.escape.prevent="emit('cancel')"
      @blur="emit('commit')"
    />
  </div>
</template>
