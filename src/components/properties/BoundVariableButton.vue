<script setup lang="ts">
import { vTestId, type TestIdProps } from '@open-pencil/vue'

import Tip from '@/components/ui/Tip.vue'

interface BoundVariableButtonProps extends TestIdProps {
  label: string
}

const { label, testId } = defineProps<BoundVariableButtonProps>()

const emit = defineEmits<{
  detach: []
}>()
</script>

<template>
  <Tip :label="label">
    <button
      v-test-id="testId"
      class="shrink-0 cursor-pointer border-none bg-transparent p-0 text-violet-400 hover:text-surface"
      @click="emit('detach')"
    >
      <icon-lucide-diamond-minus class="size-3.5" />
    </button>
  </Tip>
</template>
