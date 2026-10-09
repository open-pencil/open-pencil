<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { turnEdits } from '@/app/ai/chat/turns'
import AppButton from '@/components/ui/button/AppButton.vue'

const {
  messageId,
  canRegenerate = false,
  empty = false,
  reverted = false
} = defineProps<{
  messageId: string
  canRegenerate?: boolean
  /** The reply failed before any content, so asking again is a retry. */
  empty?: boolean
  /** The reply's edits were reverted; it stays in the chat, marked. */
  reverted?: boolean
}>()
const emit = defineEmits<{ regenerate: []; revert: []; restore: [] }>()
const { ai } = useI18n()

const edits = computed(() => turnEdits(messageId))
const revertable = computed(() => edits.value?.revertable === true)
const restorable = computed(() => edits.value?.restorable === true)
</script>

<template>
  <div
    v-if="revertable || reverted || canRegenerate"
    class="flex flex-wrap items-center gap-1"
    data-slot="chat-turn-actions"
  >
    <AppButton
      v-if="reverted && restorable"
      size="xs"
      variant="ghost"
      data-test-id="chat-restore-turn"
      @click="emit('restore')"
    >
      <template #leading><icon-lucide-redo-2 aria-hidden="true" /></template>
      {{ ai.restoreTurn }}
    </AppButton>
    <!-- Edits made since the revert closed Redo; the reply stays marked. -->
    <span
      v-else-if="reverted"
      class="inline-flex items-center gap-1 px-2 text-[11px] text-muted"
      data-slot="chat-turn-reverted"
    >
      <icon-lucide-undo-2 class="size-3" aria-hidden="true" />
      {{ ai.turnReverted }}
    </span>
    <AppButton
      v-else-if="revertable"
      size="xs"
      variant="ghost"
      data-test-id="chat-revert-turn"
      @click="emit('revert')"
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
      {{ empty ? ai.retryRequest : revertable ? ai.revertAndRegenerate : ai.regenerate }}
    </AppButton>
  </div>
</template>
