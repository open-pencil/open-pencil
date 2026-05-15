<script setup lang="ts">
import { testId as testIdAttr, type RequiredTestIdProps } from '@open-pencil/vue'
import type { Component } from 'vue'

interface ToolButtonProps extends RequiredTestIdProps {
  icon: Component
  active?: boolean
  mobile?: boolean
}

const {
  icon,
  active = false,
  mobile = false,
  testId
} = defineProps<ToolButtonProps>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    v-bind="testIdAttr(testId)"
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
