<script setup lang="ts">
import { useAIMessages } from '@open-pencil/vue/i18n'

import type { QueuedMessage } from '@/app/ai/chat/queue'
import ChatReferenceText from '@/components/chat/reference/ChatReferenceText.vue'
import IconButton from '@/components/ui/button/IconButton.vue'

/** A message the person wrote while the agent works, dimmed until the agent takes it in. */
const { message, steers } = defineProps<{
  message: QueuedMessage
  /** Whether the agent takes a message mid-turn; ACP agents and Pi take it once the turn ends. */
  steers: boolean
}>()
const emit = defineEmits<{ remove: [] }>()
const ai = useAIMessages()
</script>

<template>
  <div
    class="group/queued flex flex-col items-end gap-1"
    data-test-id="chat-queued-message"
    :data-kind="message.kind"
  >
    <div
      class="max-w-[85%] rounded-xl rounded-br-md border border-dashed border-accent/60 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-muted"
    >
      <ChatReferenceText :text="message.submission.displayText" />
    </div>
    <div class="flex items-center gap-1 text-[10px] text-muted">
      <span>{{ message.kind === 'steer' && steers ? ai.queuedSteer : ai.queuedFollowUp }}</span>
      <IconButton :label="ai.removeQueuedMessage" size="xs" @click="emit('remove')">
        <icon-lucide-x class="size-3" />
      </IconButton>
    </div>
  </div>
</template>
