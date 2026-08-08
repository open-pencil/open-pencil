<script setup lang="ts">
import { TooltipProvider } from 'reka-ui'
import { computed, nextTick, ref } from 'vue'

import ChatProfileSelect from '@/components/chat/ChatProfileSelect.vue'
import ChatContextUsage from '@/components/chat/ChatContextUsage.vue'
import ProviderModelSelect from '@/components/chat/ProviderModelSelect.vue'
import Tip from '@/components/ui/Tip.vue'
import { useButtonUI } from '@/components/ui/button'
import { useAIChat } from '@/app/ai/chat/use'
import { designModelProfile, designModelProfiles } from '@/app/ai/models'
import { openSettingsDialog } from '@/app/settings/dialog'
import { useI18n } from '@open-pencil/vue'

import { ACP_AGENTS } from '@open-pencil/core/constants'

const { providerID, providerDef, modelID, customModelID } = useAIChat()
const { dialogs } = useI18n()

const { status } = defineProps<{
  status: 'ready' | 'submitted' | 'streaming' | 'error'
}>()

const emit = defineEmits<{
  submit: [text: string]
  stop: []
}>()

const input = ref('')
const inputElement = ref<HTMLTextAreaElement>()

const isStreaming = computed(() => status === 'streaming' || status === 'submitted')
const hasInput = computed(() => input.value.trim().length > 0)
const isACPProvider = computed(() => providerID.value.startsWith('acp:'))
const acpAgentName = computed(() => {
  const agentId = providerID.value.replace('acp:', '')
  return ACP_AGENTS.find((a) => a.id === agentId)?.name ?? agentId
})
const isCustomProvider = computed(
  () => providerID.value === 'openai-compatible' || providerID.value === 'anthropic-compatible'
)
const stopButton = useButtonUI({
  tone: 'ghost',
  shape: 'rounded',
  size: 'sm',
  ui: { base: 'shrink-0 border border-border px-2 py-1.5' }
})
const sendButton = useButtonUI({
  tone: 'accent',
  shape: 'rounded',
  size: 'sm',
  ui: { base: 'shrink-0 px-2.5 py-1.5 font-medium' }
})
const customModelName = computed(() => customModelID.value.trim())
const usesCustomModel = computed(
  () => !!providerDef.value.supportsCustomModel && !!customModelName.value
)

const selectedModelName = computed(() => {
  if (usesCustomModel.value) return customModelName.value
  if (isCustomProvider.value) return 'No model'
  return providerDef.value.models.find((m) => m.id === modelID.value)?.name ?? modelID.value
})

// Switching between saved profiles only makes sense once more than one can drive the design agent.
const switchableProfiles = computed(designModelProfiles)
const canSwitchProfile = computed(() => switchableProfiles.value.length > 1)
const selectedProfileName = computed(
  () => designModelProfile.value?.name ?? selectedModelName.value
)

function submitInput() {
  const text = input.value.trim()
  if (!text) return
  emit('submit', text)
  input.value = ''
  void nextTick(resizeInput)
}

function handleSubmit(e: Event) {
  e.preventDefault()
  submitInput()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' || e.isComposing) return
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  submitInput()
}

function resizeInput() {
  const element = inputElement.value
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${Math.min(element.scrollHeight, 160)}px`
}
</script>

<template>
  <TooltipProvider>
    <div class="shrink-0 border-t border-border px-3 py-2">
      <!-- Model selector & settings -->
      <div class="mb-1.5 flex items-center gap-1">
        <template v-if="isACPProvider">
          <div class="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted">
            <icon-lucide-bot class="size-3" />
            {{ acpAgentName }}
          </div>
        </template>
        <ChatProfileSelect v-else-if="canSwitchProfile && (isCustomProvider || usesCustomModel)">
          <template #value>
            <span class="min-w-0 truncate">{{ selectedProfileName }}</span>
          </template>
        </ChatProfileSelect>
        <template v-else-if="isCustomProvider || usesCustomModel">
          <div
            class="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted"
            data-test-id="chat-custom-model-label"
          >
            <icon-lucide-bot class="size-3" />
            {{ selectedModelName }}
          </div>
        </template>
        <ProviderModelSelect v-else>
          <template #value>{{ selectedModelName }}</template>
        </ProviderModelSelect>

        <div class="ml-auto flex items-center gap-1">
          <ChatContextUsage />
          <Tip :label="dialogs.providerSettings">
            <button
              type="button"
              data-test-id="provider-settings-trigger"
              :aria-label="dialogs.providerSettings"
              class="rounded p-0.5 text-muted hover:bg-hover hover:text-surface"
              @click="openSettingsDialog('ai')"
            >
              <icon-lucide-settings class="size-3" />
            </button>
          </Tip>
        </div>
      </div>

      <!-- Input form -->
      <form class="flex items-end gap-1.5" @submit="handleSubmit">
        <textarea
          ref="inputElement"
          v-model="input"
          data-test-id="chat-input"
          :placeholder="dialogs.describeChange"
          rows="1"
          class="min-h-6 min-w-0 flex-1 resize-none overflow-y-auto rounded border border-transparent bg-panel-field px-2 py-1 text-[11px] leading-4 text-surface outline-none placeholder:text-muted hover:bg-panel-field-hover focus:border-panel-focus focus:bg-panel-field-hover"
          @input="resizeInput"
          @keydown="handleKeydown"
          @paste.stop
          @copy.stop
          @cut.stop
        />
        <Tip v-if="isStreaming && !hasInput" :label="dialogs.stopGenerating">
          <button
            type="button"
            data-test-id="chat-stop-button"
            :class="stopButton.base"
            @click="emit('stop')"
          >
            <icon-lucide-square class="size-3" />
          </button>
        </Tip>
        <Tip v-else :label="isStreaming ? dialogs.queueMessage : dialogs.sendMessage">
          <button
            type="submit"
            data-test-id="chat-send-button"
            :class="sendButton.base"
            :disabled="!hasInput"
          >
            <icon-lucide-send class="size-3" />
          </button>
        </Tip>
      </form>
    </div>
  </TooltipProvider>
</template>
