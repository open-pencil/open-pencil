<script setup lang="ts">
import { useTextareaAutosize } from '@vueuse/core'
import { TooltipProvider } from 'reka-ui'
import { computed, ref } from 'vue'

import { useI18n, useSelectionState } from '@open-pencil/vue'

import ChatNodePreview from '@/components/chat/ChatNodePreview.vue'
import ChatProfileSelect from '@/components/chat/ChatProfileSelect.vue'
import { useAttachmentDrafts } from '@/components/chat/input/useAttachments'
import IconButton from '@/components/ui/IconButton.vue'
import InputGroup from '@/components/ui/InputGroup.vue'
import { MAX_IMAGE_ATTACHMENTS } from '@/app/ai/attachment/image/types'
import type { ChatSubmission } from '@/app/ai/chat/submission/types'
import { useAIChat } from '@/app/ai/chat/use'
import { designModelProfile } from '@/app/ai/models'
import { openSettingsDialog } from '@/app/settings/dialog'

import { ACP_AGENTS } from '@open-pencil/core/constants'

const { providerID, providerDef, modelID, customModelID } = useAIChat()
const { editor, selectedIds } = useSelectionState()
const { ai } = useI18n()

const { status, disabled = false } = defineProps<{
  status: 'ready' | 'submitted' | 'streaming' | 'error'
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [submission: ChatSubmission]
  stop: []
  error: [message: string]
}>()

const textarea = ref<HTMLTextAreaElement>()
const input = ref('')
const { triggerResize } = useTextareaAutosize({ element: textarea, input, maxHeight: 160 })
const attachments = useAttachmentDrafts({
  editor,
  selectedIds,
  reportError: (message) => emit('error', message)
})
const {
  images,
  nodes: referencedNodes,
  canToggleSelection: canAddSelection,
  selectionActive: selectionContextActive,
  openImageDialog,
  removeImage,
  removeNode: removeReferencedNode,
  toggleSelection: toggleCurrentSelection,
  handlePaste,
  takeSubmission
} = attachments

const isStreaming = computed(() => disabled || status === 'streaming' || status === 'submitted')
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

function handleInputKeydown(event: KeyboardEvent) {
  if (event.code !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  const target = event.currentTarget
  if (target instanceof HTMLElement) target.closest('form')?.requestSubmit()
}

function handleSubmit(e: Event) {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return
  emit('submit', takeSubmission(text))
  input.value = ''
  triggerResize()
}
</script>

<template>
  <TooltipProvider>
    <div class="shrink-0 border-t border-border p-2.5">
      <form @submit="handleSubmit" @paste.stop="handlePaste">
        <InputGroup :disabled="isStreaming">
          <template v-if="images.length || referencedNodes.length" #attachment>
            <div class="flex flex-wrap gap-1.5">
              <div
                v-for="node in referencedNodes"
                :key="node.id"
                data-slot="chat-context-chip"
                class="flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-border bg-canvas p-1.5 shadow-xs"
              >
                <ChatNodePreview :editor="editor" :node="node" />
                <span class="min-w-0 flex-1 truncate text-[10px] text-surface">
                  {{ node.name || node.type }}
                </span>
                <IconButton
                  :label="ai.removeNodeContext"
                  size="xs"
                  @click="removeReferencedNode(node.id)"
                >
                  <icon-lucide-x class="size-3" />
                </IconButton>
              </div>
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

          <textarea
            ref="textarea"
            v-model="input"
            data-test-id="chat-input"
            :placeholder="ai.describeChange"
            :disabled="isStreaming"
            rows="2"
            aria-label="Describe a change"
            class="block min-h-12 w-full resize-none overflow-y-auto bg-transparent px-3 pt-2.5 pb-1 text-xs leading-relaxed text-surface outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
            @keydown="handleInputKeydown"
            @copy.stop
            @cut.stop
          />

          <template #leading>
            <IconButton
              :label="ai.addSelectionContext"
              size="sm"
              :active="selectionContextActive"
              :disabled="isStreaming || !canAddSelection"
              data-slot="chat-add-selection-context"
              @click="toggleCurrentSelection"
            >
              <icon-lucide-mouse-pointer-2 class="size-4" />
            </IconButton>
            <IconButton
              :label="ai.attachImages"
              size="sm"
              :disabled="isStreaming || images.length >= MAX_IMAGE_ATTACHMENTS"
              @click="openImageDialog()"
            >
              <icon-lucide-image-plus class="size-4" />
            </IconButton>
          </template>

          <template #model>
            <div class="flex min-w-0 items-center">
              <template v-if="isAgentProvider">
                <div class="flex min-w-0 items-center gap-1 px-1.5 text-[10px] text-muted">
                  <icon-lucide-bot class="size-3 shrink-0" />
                  <span class="truncate">{{ agentName }}</span>
                </div>
              </template>
              <ChatProfileSelect v-else>
                <template #value>
                  <span class="min-w-0 truncate">{{ selectedProfileName }}</span>
                </template>
              </ChatProfileSelect>
            </div>
          </template>

          <template #actions>
            <IconButton
              :label="ai.providerSettings"
              size="sm"
              data-test-id="provider-settings-trigger"
              @click="openSettingsDialog('ai')"
            >
              <icon-lucide-settings class="size-3.5" />
            </IconButton>
            <IconButton
              v-if="isStreaming"
              :label="ai.stopGenerating"
              size="sm"
              data-test-id="chat-stop-button"
              class="border border-border"
              @click="emit('stop')"
            >
              <icon-lucide-square class="size-3" />
            </IconButton>
            <IconButton
              v-else
              :label="ai.sendMessage"
              size="sm"
              type="submit"
              data-test-id="chat-send-button"
              class="bg-accent text-white hover:bg-accent/90 hover:text-white"
              :disabled="!input.trim()"
            >
              <icon-lucide-send class="size-3.5" />
            </IconButton>
          </template>
        </InputGroup>
      </form>
    </div>
  </TooltipProvider>
</template>
