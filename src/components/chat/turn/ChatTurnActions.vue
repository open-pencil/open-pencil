<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { turnEdits } from '@/app/ai/reply/turns'
import AppButton from '@/components/ui/button/AppButton.vue'

const {
  messageId,
  canRegenerate = false,
  empty = false,
  reverted = false,
  stopped = false,
  undone = 0,
  edits = 0
} = defineProps<{
  messageId: string
  canRegenerate?: boolean
  /** The reply failed before any content, so asking again is a retry. */
  empty?: boolean
  /** Every edit of the reply was undone, by Undo or Revert; it stays in the chat, marked. */
  reverted?: boolean
  /** How many of the reply's edits are undone, and how many it made. */
  undone?: number
  edits?: number
  /** The user stopped the reply before it finished. */
  stopped?: boolean
}>()
const emit = defineEmits<{ regenerate: []; revert: []; restore: [] }>()
const { ai } = useI18n()

const turn = computed(() => turnEdits(messageId))
const revertable = computed(() => turn.value?.revertable === true)
const restorable = computed(() => turn.value?.restorable === true)
const partlyUndone = computed(() => undone > 0 && undone < edits)
</script>

<template>
  <div
    v-if="stopped || partlyUndone || revertable || reverted || canRegenerate"
    class="flex flex-wrap items-center gap-1"
    data-slot="chat-turn-actions"
  >
    <span
      v-if="stopped"
      class="inline-flex items-center gap-1 px-2 text-[11px] text-muted"
      data-slot="chat-turn-stopped"
    >
      <icon-lucide-circle-stop class="size-3" aria-hidden="true" />
      {{ ai.turnStopped }}
    </span>
    <!-- What is undone shows whether or not Redo can still bring it back. -->
    <span
      v-if="partlyUndone"
      class="inline-flex items-center gap-1 px-2 text-[11px] text-muted"
      data-slot="chat-turn-undone"
    >
      <icon-lucide-undo-2 class="size-3" aria-hidden="true" />
      {{ ai.turnPartlyUndone({ undone, total: edits }) }}
    </span>
    <span
      v-else-if="reverted"
      class="inline-flex items-center gap-1 px-2 text-[11px] text-muted"
      data-slot="chat-turn-reverted"
    >
      <icon-lucide-undo-2 class="size-3" aria-hidden="true" />
      {{ ai.turnReverted }}
    </span>
    <AppButton
      v-if="restorable"
      size="xs"
      variant="ghost"
      data-test-id="chat-restore-turn"
      @click="emit('restore')"
    >
      <template #leading><icon-lucide-redo-2 aria-hidden="true" /></template>
      {{ ai.restoreTurn }}
    </AppButton>
    <AppButton
      v-if="revertable"
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
