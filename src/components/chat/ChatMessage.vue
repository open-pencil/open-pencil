<script setup lang="ts">
import { isReasoningUIPart, isTextUIPart } from 'ai'
import type { UIMessage } from 'ai'
import { computed, ref } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'
import { vTestId } from '@open-pencil/vue/testing'

import { attachmentsForMessage } from '@/app/ai/attachment/presentation/store'
import type { AttachmentPresentation } from '@/app/ai/attachment/presentation/types'
import { replyCompactions } from '@/app/ai/chat/compaction/marker'
import { undoOf, usageOf, wasStopped } from '@/app/ai/chat/metadata'
import {
  reasoningDisplay as preferredReasoningDisplay,
  tokenUsageDisplay
} from '@/app/ai/chat/preferences'
import { visibleUserMessageText } from '@/app/ai/chat/presentation'
import { groupMessageParts, type MessagePartGroup } from '@/app/ai/chat/tool-calls/display'
import type { ReasoningDisplay } from '@/app/settings/preferences/store'
import ChatAttachmentList from '@/components/chat/attachment/ChatAttachmentList.vue'
import ChatMarkdown from '@/components/chat/ChatMarkdown.vue'
import ChatReasoning from '@/components/chat/ChatReasoning.vue'
import ChatReferenceText from '@/components/chat/reference/ChatReferenceText.vue'
import ChatToolCallGroup from '@/components/chat/tool/ChatToolCallGroup.vue'
import ChatCompactionDivider from '@/components/chat/turn/ChatCompactionDivider.vue'
import ChatMessageEditor from '@/components/chat/turn/ChatMessageEditor.vue'
import ChatTurnActions from '@/components/chat/turn/ChatTurnActions.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppCopyButton from '@/components/ui/button/AppCopyButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'

import { usageParts } from './turn/usage'
import { chatReplyTheme } from './ui'

const {
  message,
  streaming = false,
  presentation,
  canRegenerate = false,
  canRetry = false,
  canEdit = false,
  reasoningDisplay
} = defineProps<{
  message: UIMessage
  streaming?: boolean
  presentation?: { text?: string; attachments?: AttachmentPresentation[] }
  /** The last reply, when the chat is idle. */
  canRegenerate?: boolean
  /** The last message, a request that got no reply, when the chat is idle. */
  canRetry?: boolean
  /** The last user message without attachments, when the chat is idle. */
  canEdit?: boolean
  /** Overrides the reasoning display preference, for a surface that always shows it. */
  reasoningDisplay?: ReasoningDisplay
}>()
const emit = defineEmits<{ regenerate: []; revert: []; restore: []; edit: [text: string] }>()
const editing = ref(false)
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
const userText = computed(
  () =>
    presentation?.text ??
    visibleUserMessageText(
      message.id,
      message.parts
        .filter(isTextUIPart)
        .map((p) => p.text)
        .join('')
    )
)

function saveEdit(text: string): void {
  editing.value = false
  emit('edit', text)
}

const firstAssistantTextPartIndex = computed(() =>
  message.parts.findIndex((part) => isTextUIPart(part) && part.text.length > 0)
)
const lastAssistantTextPartIndex = computed(() =>
  message.parts.findLastIndex((part) => isTextUIPart(part) && part.text.length > 0)
)
const ui = chatReplyTheme()
/** The text the copy button sits on: the reply's first, when there is text to copy. */
const copyPartIndex = computed(() => (assistantText.value ? firstAssistantTextPartIndex.value : -1))

// The AI SDK updates parts in place and replaces only the message, so copy each part for
// the cards' computed state to see the new values.
const undo = computed(() => undoOf(message))
const usage = computed(() => usageOf(message))
/** With usage shown on hover, the reply's last text shows it on hover, beside the copy button. */
const usageOnHover = computed(() =>
  usage.value && tokenUsageDisplay.value === 'hover'
    ? usageParts(ai.value, usage.value).join(' · ')
    : undefined
)
const undoneCalls = computed(() => new Set(undo.value?.undone))
const reverted = computed(
  () =>
    !!undo.value &&
    undo.value.edits.length > 0 &&
    undoneCalls.value.size === undo.value.edits.length
)
const stopped = computed(() => wasStopped(message))
// A request that failed once its reply had started leaves the reply without content.
const empty = computed(() => message.parts.every((part) => part.type === 'step-start'))
/** Compactions between the reply's steps, which the reply draws where they ran. */
const compactions = computed(() => replyCompactions(message))
const groups = computed(() =>
  groupMessageParts(
    message.parts.map((part) => ({ ...part })),
    compactions.value.map((compaction) => compaction.step)
  )
)

function groupKey(group: MessagePartGroup): string {
  if (group.kind === 'tools') return `tools-${group.parts[0]?.index}`
  return `${group.kind}-${group.index}`
}
</script>

<template>
  <div
    v-test-id="`chat-message-${message.role}`"
    class="group/reply"
    :class="message.role === 'user' ? 'flex justify-end' : ''"
  >
    <div
      class="min-w-0 space-y-2 select-text"
      :class="message.role === 'user' ? 'max-w-[85%]' : ''"
    >
      <template v-if="message.role === 'assistant'">
        <!-- A reverted reply's edits are gone; its content stays, dimmed, under its actions. Text
             dims to the muted color rather than through opacity, so it still reads at 4.5:1. -->
        <div
          class="space-y-2 data-[reverted=true]:**:text-muted data-[reverted=true]:[&_img]:opacity-50"
          data-slot="chat-reply-content"
          :data-reverted="reverted"
        >
          <template v-for="group in groups" :key="groupKey(group)">
            <template v-if="group.kind === 'compaction'">
              <!-- Only the latest compaction's request is the one the reply's usage ends on. -->
              <ChatCompactionDivider
                v-if="compactions[group.compaction]"
                :compaction="compactions[group.compaction]"
                :tokens-after="
                  streaming || group.compaction < compactions.length - 1
                    ? null
                    : (usage?.contextTokens ?? null)
                "
              />
            </template>
            <ChatToolCallGroup
              v-else-if="group.kind === 'tools'"
              :parts="group.parts.map(({ part }) => part)"
              :undone="undoneCalls"
            />

            <!-- Reasoning -->
            <ChatReasoning
              v-else-if="isReasoningUIPart(group.part) && group.part.text"
              :text="group.part.text"
              :display="reasoningDisplay ?? preferredReasoningDisplay"
              :streaming="streaming && group.part.state === 'streaming'"
              :thinking-label="ai.thinking"
              :reasoning-label="ai.reasoning"
              :duration-label="(seconds) => ai.thoughtFor({ seconds })"
            />

            <!-- Text -->
            <div
              v-else-if="isTextUIPart(group.part) && group.part.text"
              data-test-id="chat-text-bubble"
              class="group/response relative rounded-xl rounded-ss-md bg-hover px-3 py-2 text-xs leading-relaxed text-surface"
            >
              <ChatMarkdown :content="group.part.text" :mode="markdownMode" />
              <!-- With usage shown on hover, the usage and the copy button appear in the last
                   text's corner over the bubble's own colour, fading the line's end out under
                   them, so they take no room at rest; otherwise the button sits there alone. -->
              <div
                v-if="
                  (usageOnHover && group.index === lastAssistantTextPartIndex) ||
                  group.index === copyPartIndex
                "
                :class="
                  ui.corner({
                    usage: !!usageOnHover && group.index === lastAssistantTextPartIndex
                  })
                "
              >
                <span
                  v-if="usageOnHover && group.index === lastAssistantTextPartIndex"
                  class="px-1"
                  data-slot="chat-reply-usage"
                >
                  {{ usageOnHover }}
                </span>
                <AppCopyButton
                  v-if="group.index === copyPartIndex"
                  icon
                  :value="assistantText"
                  :label="ai.copyResponse"
                  :copied-label="ai.responseCopied"
                />
              </div>
            </div>
          </template>
        </div>
        <ChatTurnActions
          v-if="!streaming"
          :message-id="message.id"
          :can-regenerate="canRegenerate"
          :empty="empty"
          :reverted="reverted"
          :stopped="stopped"
          :undone="undoneCalls.size"
          :edits="undo?.edits.length ?? 0"
          :usage="usage"
          @regenerate="emit('regenerate')"
          @revert="emit('revert')"
          @restore="emit('restore')"
        />
      </template>

      <!-- User message -->
      <template v-else-if="message.role === 'user'">
        <ChatAttachmentList v-if="attachments.length" :attachments="attachments" />
        <ChatMessageEditor
          v-if="editing"
          :text="userText"
          @save="saveEdit"
          @cancel="editing = false"
        />
        <div v-else class="group/request relative">
          <div
            data-test-id="chat-text-bubble"
            class="rounded-xl rounded-ee-md bg-accent px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-on-accent"
          >
            <ChatReferenceText :text="userText" />
          </div>
          <IconButton
            v-if="canEdit"
            :label="ai.editMessage"
            size="xs"
            class="absolute top-1/2 -inset-s-7 -translate-y-1/2 opacity-0 focus-visible:opacity-100 group-hover/request:opacity-100"
            @click="editing = true"
          >
            <icon-lucide-pencil class="size-3" />
          </IconButton>
        </div>
        <div v-if="canRetry && !editing" class="flex justify-end">
          <AppButton
            size="xs"
            variant="ghost"
            data-test-id="chat-retry"
            @click="emit('regenerate')"
          >
            <template #leading><icon-lucide-refresh-cw aria-hidden="true" /></template>
            {{ ai.retryRequest }}
          </AppButton>
        </div>
      </template>
    </div>
  </div>
</template>
