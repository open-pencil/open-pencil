<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { useSelectionState } from '@open-pencil/vue/editor/selection-state'
import { useI18n } from '@open-pencil/vue/i18n'

import { revokeImagePreviewURL } from '@/app/ai/attachment/image/prepare'
import { MAX_IMAGE_ATTACHMENTS } from '@/app/ai/attachment/image/types'
import { takeBackMessages } from '@/app/ai/chat/queue'
import type { ChatSubmission } from '@/app/ai/chat/submission/types'
import { useAIChat } from '@/app/ai/chat/use'
import { designModelProfile } from '@/app/ai/models'
import { openSettingsDialog } from '@/app/settings/dialog'
import ChatCreditBalance from '@/components/chat/ChatCreditBalance.vue'
import ChatProfileSelect from '@/components/chat/ChatProfileSelect.vue'
import ChatThinkingSelect from '@/components/chat/ChatThinkingSelect.vue'
import { useComposerCompletions } from '@/components/chat/composer/useComposerCompletions'
import { useAttachmentDrafts } from '@/components/chat/input/useAttachments'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppDropOverlay from '@/components/ui/feedback/AppDropOverlay.vue'

import ChatComposer from './ChatComposer.vue'

const { providerID, providerDef, modelID, customModelID } = useAIChat()
const { editor, selectedIds } = useSelectionState()
const { ai } = useI18n()

const {
  status,
  disabled = false,
  dragging = false
} = defineProps<{
  status: 'ready' | 'submitted' | 'streaming' | 'error'
  disabled?: boolean
  /** Whether images are being dragged over the chat, which shows where they will go. */
  dragging?: boolean
}>()

const emit = defineEmits<{
  /** `afterWork`: while the agent works, wait until it has finished (Alt+Enter). */
  submit: [submission: ChatSubmission, afterWork: boolean]
  stop: []
  interrupt: []
  error: [message: string]
}>()

const attachments = useAttachmentDrafts({
  editor,
  selectedIds,
  reportError: (message) => emit('error', message)
})
const {
  images,
  canMentionSelection,
  selectionMentions,
  openImageDialog,
  addFiles,
  removeImage,
  handlePaste,
  takeSubmission,
  restoreSubmission
} = attachments

const composer = useTemplateRef<{
  restoreDraft: (text: string) => boolean
  insert: (text: string) => void
}>('composer')

const completions = useComposerCompletions()

/** Up on the first line takes waiting messages back to edit, their images with them. */
function takeBack(): string | null {
  const taken = takeBackMessages()
  if (taken.length === 0) return null
  for (const submission of taken) restoreSubmission(submission)
  return taken.map((submission) => submission.displayText).join('\n')
}

/** Puts back an unsent message with its attachments; releases them if newer text replaced it. */
function restoreDraft(submission: ChatSubmission): void {
  if (composer.value?.restoreDraft(submission.displayText)) restoreSubmission(submission)
  else for (const image of submission.images) revokeImagePreviewURL(image.previewURL)
}

/** A reply is on its way, so the credit balance waits to update until it ends. */
const replying = computed(() => status === 'streaming' || status === 'submitted')
/** Why images dropped now would not be attached, or null when they would. */
const dropRefusal = computed(() => {
  if (disabled) return ai.value.dropImagesAfterReply
  if (images.value.length >= MAX_IMAGE_ATTACHMENTS) {
    return ai.value.dropImagesLimit({ count: MAX_IMAGE_ATTACHMENTS })
  }
  return null
})

/** Attaches images dropped on the chat, unless they cannot be attached right now. */
function dropFiles(files: File[]): void {
  if (dropRefusal.value) {
    emit('error', dropRefusal.value)
    return
  }
  void addFiles(files)
}

defineExpose({ restoreDraft, dropFiles })

const isAgentProvider = computed(
  () => providerID.value.startsWith('acp:') || providerID.value === 'harness:pi'
)
const agentName = computed(() => {
  if (providerID.value === 'harness:pi') return 'Pi'
  const agentId = providerID.value.replace('acp:', '')
  return ACP_AGENTS.find((a) => a.id === agentId)?.name ?? agentId
})
const isCustomProvider = computed(
  () => providerID.value === 'openai-compatible' || providerID.value === 'anthropic-compatible'
)
const customModelName = computed(() => customModelID.value.trim())
const usesCustomModel = computed(
  () => !!providerDef.value.supportsCustomModel && !!customModelName.value
)

const selectedModelName = computed(() => {
  if (usesCustomModel.value) return customModelName.value
  if (isCustomProvider.value) return 'No model'
  return providerDef.value.models.find((m) => m.id === modelID.value)?.name ?? modelID.value
})

// The composer switches configured Design-role profiles; raw provider model selection lives in Settings.
const selectedProfileName = computed(
  () => designModelProfile.value?.name ?? selectedModelName.value
)
</script>

<template>
  <ChatComposer
    ref="composer"
    :status="status"
    :disabled="disabled"
    :completions="completions"
    :take-back="takeBack"
    @submit="(text, afterWork) => emit('submit', takeSubmission(text), afterWork)"
    @stop="emit('stop')"
    @interrupt="emit('interrupt')"
    @paste="handlePaste"
    @settings="openSettingsDialog('ai')"
  >
    <template v-if="images.length" #attachment>
      <div class="flex flex-wrap gap-1.5">
        <div
          v-for="(image, index) in images"
          :key="image.previewURL"
          class="flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-border bg-canvas p-1.5 shadow-xs"
        >
          <img
            :src="image.previewURL"
            :alt="image.file.name"
            width="40"
            height="40"
            class="size-10 shrink-0 rounded-md border border-border object-cover"
          />
          <span class="min-w-0 flex-1 truncate text-[10px] text-surface">
            {{ image.file.name }}
          </span>
          <IconButton
            :label="ai.removeImageAttachment({ name: image.file.name })"
            size="xs"
            @click="removeImage(index)"
          >
            <icon-lucide-x class="size-3" />
          </IconButton>
        </div>
      </div>
    </template>
    <template #overlay>
      <AppDropOverlay
        shape="field"
        :visible="dragging"
        :accepts="!dropRefusal"
        :label="dropRefusal ?? ai.dropImagesToAttach"
      />
    </template>
    <template #leading>
      <IconButton
        :label="ai.mentionSelection"
        size="sm"
        :disabled="disabled || !canMentionSelection"
        data-slot="chat-mention-selection"
        @click="composer?.insert(selectionMentions())"
      >
        <icon-lucide-mouse-pointer-2 class="size-4" />
      </IconButton>
      <IconButton
        :label="ai.attachImages"
        size="sm"
        :disabled="disabled || images.length >= MAX_IMAGE_ATTACHMENTS"
        @click="openImageDialog()"
      >
        <icon-lucide-image-plus class="size-4" />
      </IconButton>
    </template>
    <template #model>
      <div class="@container flex min-w-0 items-center">
        <template v-if="isAgentProvider">
          <div class="flex min-w-0 items-center gap-1 px-1.5 text-[10px] text-muted">
            <icon-lucide-bot class="size-3 shrink-0" />
            <span class="truncate">{{ agentName }}</span>
          </div>
        </template>
        <template v-else>
          <ChatProfileSelect>
            <template #value>
              <span class="min-w-0 truncate">{{ selectedProfileName }}</span>
            </template>
          </ChatProfileSelect>
          <ChatThinkingSelect />
          <ChatCreditBalance :replying="replying" />
        </template>
      </div>
    </template>
  </ChatComposer>
</template>
