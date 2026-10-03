<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { revertTurn, turnEdits } from '@/app/ai/chat/turns'
import AppButton from '@/components/ui/button/AppButton.vue'

const { messageId, canRegenerate = false } = defineProps<{
  messageId: string
  canRegenerate?: boolean
}>()
const emit = defineEmits<{ regenerate: [] }>()
const { ai } = useI18n()

const edits = computed(() => turnEdits(messageId))
const revertable = computed(() => edits.value?.revertable === true)
</script>

<template>
  <div
    v-if="revertable || canRegenerate"
    class="flex flex-wrap items-center gap-1"
    data-slot="chat-turn-actions"
  >
    <AppButton
      v-if="revertable"
      size="xs"
      variant="ghost"
      data-test-id="chat-revert-turn"
      @click="revertTurn(messageId)"
    >
      <template #leading><icon-lucide-undo-2 aria-hidden="true" /></template>
      {{ ai.revertTurn }}
    </AppButton>
    <AppButton
      v-if="canRegenerate"
      size="xs"
      variant="ghost"
      data-test-id="chat-regenerate"
      @click="emit('regenerate')"
    >
      <template #leading><icon-lucide-refresh-cw aria-hidden="true" /></template>
      {{ revertable ? ai.revertAndRegenerate : ai.regenerate }}
    </AppButton>
  </div>
</template>
