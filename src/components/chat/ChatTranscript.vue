<script setup lang="ts">
import type { ChatStatus, UIMessage } from 'ai'
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'
import { computed, provide, ref } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { attachmentsForMessage } from '@/app/ai/attachment/presentation/store'
import type { AttachmentPresentation } from '@/app/ai/attachment/presentation/types'
import { CHAT_NODES_LIVE } from '@/components/chat/tool/context'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'

import ChatMessage from './ChatMessage.vue'
import { useScrollFollowing } from './transcript/useScrollFollowing'

const {
  messages,
  status,
  showContinue = false,
  presentations,
  interactive = false,
  nodesLive = true
} = defineProps<{
  messages: UIMessage[]
  status: ChatStatus
  showContinue?: boolean
  presentations?: Record<string, { text?: string; attachments?: AttachmentPresentation[] }>
  /** Offers regenerating the last reply, retrying an unanswered request, and editing the last request. */
  interactive?: boolean
  /** False for a conversation from another document: its layer IDs are not this document's. */
  nodesLive?: boolean
}>()
const emit = defineEmits<{
  continue: []
  regenerate: []
  revert: [messageId: string]
  restore: [messageId: string]
  edit: [messageId: string, text: string]
}>()
const { ai } = useI18n()
provide(
  CHAT_NODES_LIVE,
  computed(() => nodesLive)
)
const running = computed(() => status === 'submitted' || status === 'streaming')
const isThinking = computed(() => {
  if (!running.value) return false
  const last = messages.at(-1)
  if (!last || last.role !== 'assistant') return true
  const part = last.parts.at(-1)
  if (!part || part.type === 'step-start') return true
  if ('toolCallId' in part && (part.state === 'output-available' || part.state === 'output-error'))
    return true
  return status === 'submitted'
})
const idle = computed(() => interactive && (status === 'ready' || status === 'error'))
// A request that failed before any reply is the last message; it is retried, not an older reply.
const lastMessage = computed(() => messages.at(-1))
const lastRequest = computed(() => messages.findLast((m) => m.role === 'user'))
/** Messages with attachments carry context a plain text edit would drop. */
const editableRequestId = computed(() => {
  const request = lastRequest.value
  if (!request || presentations?.[request.id]?.attachments?.length) return undefined
  return attachmentsForMessage(request.id).value.length > 0 ? undefined : request.id
})
const transcriptContent = ref<HTMLDivElement>()
const viewportComponent = ref<{ viewportElement?: HTMLElement }>()
const viewport = computed(() => viewportComponent.value?.viewportElement)
const { arrivedState, resumeFollowing } = useScrollFollowing(
  viewport,
  transcriptContent,
  computed(() => status === 'submitted')
)
</script>

<template>
  <ScrollAreaRoot class="relative min-h-0 flex-1">
    <ScrollAreaViewport ref="viewportComponent" class="h-full px-3 py-3 [&>div]:h-full">
      <AppPlaceholder
        v-if="messages.length === 0"
        data-test-id="chat-empty-state"
        :label="ai.describeCreateOrChange"
        :ui="{ root: 'h-full' }"
      >
        <template #icon>
          <icon-lucide-message-circle class="size-5" />
        </template>
      </AppPlaceholder>

      <!-- Messages -->
      <div v-else ref="transcriptContent" data-test-id="chat-messages" class="flex flex-col gap-3">
        <ChatMessage
          v-for="(msg, index) in messages"
          :key="msg.id"
          :message="msg"
          :presentation="presentations?.[msg.id]"
          :streaming="running && msg.role === 'assistant' && index === messages.length - 1"
          :can-regenerate="idle && msg.id === lastMessage?.id && msg.role === 'assistant'"
          :can-retry="idle && msg.id === lastMessage?.id && msg.role === 'user'"
          :can-edit="idle && msg.id === editableRequestId"
          @regenerate="emit('regenerate')"
          @revert="emit('revert', msg.id)"
          @restore="emit('restore', msg.id)"
          @edit="(text) => emit('edit', msg.id, text)"
        />

        <!-- Thinking indicator: shown when AI is working but no visible activity -->
        <div v-if="isThinking" data-test-id="chat-typing-indicator" class="flex gap-2">
          <div
            class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/20 text-[10px] font-bold text-muted"
          >
            AI
          </div>
          <div class="flex items-center gap-1 py-2">
            <span
              class="size-1.5 animate-bounce motion-reduce:animate-none rounded-full bg-muted"
            />
            <span
              class="size-1.5 animate-bounce motion-reduce:animate-none rounded-full bg-muted"
              :style="{ animationDelay: '150ms' }"
            />
            <span
              class="size-1.5 animate-bounce motion-reduce:animate-none rounded-full bg-muted"
              :style="{ animationDelay: '300ms' }"
            />
          </div>
        </div>

        <!-- Continue button when step limit reached -->
        <div v-if="showContinue" class="flex justify-center py-2">
          <AppButton color="primary" variant="soft" shape="pill" @click="emit('continue')">
            <template #leading><icon-lucide-play class="size-3" /></template>
            {{ ai.continueChat }}
          </AppButton>
        </div>
      </div>
    </ScrollAreaViewport>
    <ScrollAreaScrollbar orientation="vertical" class="flex w-1.5 touch-none p-px select-none">
      <ScrollAreaThumb class="relative flex-1 rounded-full bg-muted/30" />
    </ScrollAreaScrollbar>
    <IconButton
      v-if="messages.length && !arrivedState.bottom"
      :label="ai.jumpToLatest"
      class="absolute right-3 bottom-3 border border-border bg-panel shadow-sm"
      @click="resumeFollowing"
      ><icon-lucide-arrow-down class="size-4"
    /></IconButton>
  </ScrollAreaRoot>
</template>
