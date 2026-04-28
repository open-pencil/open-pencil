<script setup lang="ts">
import type { Component } from 'vue'

const {
  icon,
  active = false,
  mobile = false,
  testId
} = defineProps<{
  icon: Component
  active?: boolean
  mobile?: boolean
  testId: string
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    :data-test-id="testId"
    class="flex size-8 cursor-pointer items-center justify-center border-none transition-colors"
    :class="[
      mobile ? 'rounded-[6px] select-none' : 'rounded-lg',
      active
        ? 'bg-accent text-white'
        : mobile
          ? 'bg-transparent text-muted active:bg-hover'
          : 'bg-transparent text-muted hover:bg-hover hover:text-surface'
    ]"
    @click="emit('click')"
  >
    <component :is="icon" class="size-4" />
  </button>
</template>
