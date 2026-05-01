<script setup lang="ts">
import Tip from '@/components/ui/Tip.vue'

const { label, testId } = defineProps<{
  label: string
  testId?: string
}>()

const emit = defineEmits<{
  detach: []
}>()
</script>

<template>
  <Tip :label="label">
    <button
      :data-test-id="testId"
      class="shrink-0 cursor-pointer border-none bg-transparent p-0 text-violet-400 hover:text-surface"
      @click="emit('detach')"
    >
      <icon-lucide-diamond-minus class="size-3.5" />
    </button>
  </Tip>
</template>
