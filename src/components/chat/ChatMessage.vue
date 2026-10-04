<script setup lang="ts">
import { refAutoReset, useClipboard } from '@vueuse/core'
import { isReasoningUIPart, isTextUIPart } from 'ai'
import type { UIMessage } from 'ai'
import { computed } from 'vue'

import { useI18n, vTestId } from '@open-pencil/vue'

import { attachmentsForMessage } from '@/app/ai/attachment/presentation/store'
import type { AttachmentPresentation } from '@/app/ai/attachment/presentation/types'
import { reasoningDisplay } from '@/app/ai/chat/preferences'
import { visibleUserMessageText } from '@/app/ai/chat/presentation'
import { groupMessageParts, type MessagePartGroup } from '@/app/ai/chat/tool-calls/display'
import AttachmentList from '@/components/chat/attachment/AttachmentList.vue'
import ChatMarkdown from '@/components/chat/ChatMarkdown.vue'
import ReasoningBlock from '@/components/chat/ReasoningBlock.vue'
import ToolCallGroup from '@/components/chat/tool/ToolCallGroup.vue'
import IconButton from '@/components/ui/button/IconButton.vue'

const {
  message,
  streaming = false,
  presentation
} = defineProps<{
  message: UIMessage
  streaming?: boolean
  presentation?: { text?: string; attachments?: AttachmentPresentation[] }
}>()
const { ai } = useI18n()
const markdownMode = computed(() => (streaming ? 'streaming' : 'static'))
const storedAttachments = attachmentsForMessage(message.id)
const attachments = computed(() => presentation?.attachments ?? storedAttachments.value)
const assistantText = computed(() =>
  message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join('')
)
const firstAssistantTextPartIndex = computed(() =>
  message.parts.findIndex((part) => isTextUIPart(part) && part.text.length > 0)
)
const copied = refAutoReset(false, 1500)
const { copy, isSupported: clipboardSupported } = useClipboard()

async function copyResponse(): Promise<void> {
  if (!assistantText.value || !clipboardSupported.value) return
  await copy(assistantText.value)
  copied.value = true
}

// The AI SDK updates parts in place and replaces only the message, so copy each part for
// the cards' computed state to see the new values.
const groups = computed(() => groupMessageParts(message.parts.map((part) => ({ ...part }))))

function groupKey(group: MessagePartGroup): string {
  return group.kind === 'tools' ? `tools-${group.parts[0]?.index}` : `part-${group.index}`
}
</script>

<template>
  <div
    v-test-id="`chat-message-${message.role}`"
    :class="message.role === 'user' ? 'flex justify-end' : ''"
  >
    <div
      class="min-w-0 space-y-2 select-text"
      :class="message.role === 'user' ? 'max-w-[85%]' : ''"
    >
      <template v-if="message.role === 'assistant'">
        <template v-for="group in groups" :key="groupKey(group)">
          <ToolCallGroup
            v-if="group.kind === 'tools'"
            :parts="group.parts.map(({ part }) => part)"
          />

          <!-- Reasoning -->
          <ReasoningBlock
            v-else-if="isReasoningUIPart(group.part) && group.part.text"
            :text="group.part.text"
            :display="reasoningDisplay"
            :streaming="group.part.state === 'streaming'"
            :thinking-label="ai.thinking"
            :reasoning-label="ai.reasoning"
            :duration-label="(seconds) => ai.thoughtFor({ seconds })"
          />

          <!-- Text -->
          <div
            v-else-if="isTextUIPart(group.part) && group.part.text"
            data-test-id="chat-text-bubble"
            class="group/response relative rounded-xl rounded-tl-md bg-hover px-3 py-2 text-xs leading-relaxed text-surface"
          >
            <ChatMarkdown :content="group.part.text" :mode="markdownMode" />
            <IconButton
              v-if="
                group.index === firstAssistantTextPartIndex && assistantText && clipboardSupported
              "
              :label="copied ? ai.responseCopied : ai.copyResponse"
              size="xs"
              data-slot="chat-copy-response"
              class="absolute right-1 bottom-1 opacity-0 focus-visible:opacity-100 group-hover/response:opacity-100"
              @click="copyResponse"
            >
              <icon-lucide-check v-if="copied" class="size-3 text-green-400" />
              <icon-lucide-copy v-else class="size-3" />
            </IconButton>
          </div>
        </template>
      </template>

      <!-- User message -->
      <template v-else-if="message.role === 'user'">
        <AttachmentList v-if="attachments.length" :attachments="attachments" />
        <div
          data-test-id="chat-text-bubble"
          class="rounded-xl rounded-br-md bg-accent px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-white"
        >
          {{
            presentation?.text ??
            visibleUserMessageText(
              message.id,
              message.parts
                .filter(isTextUIPart)
                .map((p) => p.text)
                .join('')
            )
          }}
        </div>
      </template>
    </div>
  </div>
</template>
