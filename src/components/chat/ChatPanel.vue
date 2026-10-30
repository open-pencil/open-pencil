<script setup lang="ts">
import type { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'
import { computed, shallowRef, useTemplateRef, watch } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { revokeImagePreviewURL } from '@/app/ai/attachment/image/prepare'
import { chatDocumentId } from '@/app/ai/chat/history/document'
import {
  clearQueuedMessages,
  enqueueMessage,
  queuedMessages,
  removeQueuedMessage,
  takeNextMessage
} from '@/app/ai/chat/queue'
import { useChatRunLocation } from '@/app/ai/chat/run-location'
import type { ChatSubmission } from '@/app/ai/chat/submission/types'
import { useChatSubmission } from '@/app/ai/chat/submission/use'
import { saveChatTrace } from '@/app/ai/chat/trace/export'
import { useAIChat } from '@/app/ai/chat/use'
import { openAISetup } from '@/app/ai/models/settings/onboarding/dialog'
import { didHitStepLimit } from '@/app/ai/tools'
import { cloudBillingURL } from '@/app/cloud/integration'
import { getActiveEditorStore } from '@/app/editor/active-store'
import { useDateFormat } from '@/app/i18n/date'
import { openSettingsDialog } from '@/app/settings/dialog'
import { openExternalLink, toast } from '@/app/shell/ui'
import { activeTab } from '@/app/tabs'
import ChatFollowAgentsToggle from '@/components/chat/ChatFollowAgentsToggle.vue'
import ChatHistory from '@/components/chat/ChatHistory.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ChatPermissionDialog from '@/components/chat/ChatPermissionDialog.vue'
import ChatProviderSetup from '@/components/chat/ChatProviderSetup.vue'
import ChatRunLocation from '@/components/chat/ChatRunLocation.vue'
import ChatTranscript from '@/components/chat/ChatTranscript.vue'
import { useImageDrop } from '@/components/chat/input/useImageDrop'

const { isConfigured, ensureChat, history, chatFailure, clearChatFailure, providerID } = useAIChat()
const { ai } = useI18n()
const dates = useDateFormat()
const runLocation = useChatRunLocation()

const chat = shallowRef<Chat<UIMessage> | null>(null)
const submission = useChatSubmission({
  chat,
  ensureChat,
  flush: history.flush,
  clearFailure: clearChatFailure,
  getEditor: getActiveEditorStore,
  messages: computed(() => ({
    openSettings: ai.value.openProviderSettingsAction,
    requestFailed: ai.value.chatRequestFailed,
    visionUnavailable: ai.value.visionModelUnavailable,
    cloudUnavailable: ai.value.chatCloudUnavailable,
    runSetup: ai.value.aiSetupRun,
    agentSetup: {
      'companion-missing': ai.value.chatPiCompanionMissing,
      'companion-outdated': ai.value.chatPiCompanionOutdated,
      'mcp-outdated': ai.value.chatMCPOutdated,
      'pi-sign-in': ai.value.chatPiSignIn,
      'pi-model': ai.value.chatPiModel
    }
  })),
  reportError: toast.error,
  openModelSettings: () => openSettingsDialog('ai'),
  openSetup: () => openAISetup()
})

const chatInput = useTemplateRef<{
  restoreDraft: (submission: ChatSubmission) => void
  dropFiles: (files: File[]) => void
}>('chatInput')
const panel = useTemplateRef<HTMLElement>('panel')
// Images dropped anywhere on the chat go to the composer, when there is one to take them.
const { dragging: draggingImages } = useImageDrop(panel, {
  enabled: () => chatInput.value !== null,
  onImages: (files) => chatInput.value?.dropFiles(files)
})
let viewGeneration = 0

/** Puts an unsent message back only in the conversation it was written in. */
async function submitMessage(message: ChatSubmission) {
  const generation = viewGeneration
  if (await submission.submit(message)) return
  if (generation === viewGeneration) chatInput.value?.restoreDraft(message)
  else for (const image of message.images) revokeImagePreviewURL(image.previewURL)
}
// Restoring local history must not open a provider connection or read credentials.
void history.initialize().catch(() => {
  toast.error(ai.value.chatHistoryFailed)
})

const messages = computed(() => chat.value?.messages ?? history.messages.value)
const historyOptions = computed(() => {
  const current = history.current.value
  const rows = [...history.conversations.value]
  if (current && !rows.some((row) => row.id === current.id)) rows.unshift(current)
  return rows.map((conversation) => ({
    ...conversation,
    available: conversation.documentId === chatDocumentId(getActiveEditorStore())
  }))
})
const agentHistoryReadOnly = computed(
  () => !chat.value && messages.value.length > 0 && history.current.value?.backend !== 'direct'
)
/** Set while the conversation changes, so stopping its reply does not send what waits. */
let queueHeld = false
async function historyAction(action: () => Promise<unknown>) {
  const generation = ++viewGeneration
  const left = history.current.value?.id
  let switched = false
  submission.cancel()
  queueHeld = true
  try {
    await chat.value?.stop()
    await action()
    switched = true
  } catch {
    toast.error(ai.value.chatHistoryFailed)
  } finally {
    queueHeld = false
    if (generation === viewGeneration) {
      // Waiting messages belong to the conversation that was left, which a switch failing part
      // way, after it opened another, has left too; a switch that failed before keeps them.
      if (switched || history.current.value?.id !== left) {
        chat.value = null
        clearQueuedMessages()
      } else if (status.value === 'ready') {
        // The stopped reply may have ended while the switch held the queue, which then waits
        // for no reply to end.
        sendNextQueued()
      }
    }
  }
}

async function renameConversation(id: string, title: string) {
  try {
    await history.rename(id, title)
  } catch {
    toast.error(ai.value.chatHistoryFailed)
  }
}

async function saveTrace(id: string) {
  const conversation = history.current.value
  if (conversation?.id !== id) return
  try {
    await saveChatTrace(conversation, messages.value)
  } catch {
    toast.error(ai.value.chatTraceFailed)
  }
}

/**
 * A Cloud that bills sells more credits; a self-hosted one has only the allowance its
 * administrator set, which renews or is raised.
 */
function cloudCreditsMessage(resetsAt: string | undefined): string {
  if (cloudBillingURL.value) return ai.value.chatCloudCreditsExhausted
  if (!resetsAt) return ai.value.chatCloudAllowanceUsed
  return ai.value.chatCloudAllowanceUsedUntil({ date: dates.format(resetsAt, 'dayTime') })
}
const failureMessage = computed(() => {
  switch (chatFailure.value?.reason) {
    case 'authentication':
      return ai.value.chatAuthenticationFailed
    case 'forbidden':
      return ai.value.chatForbidden
    case 'insufficient-credit':
      return ai.value.chatInsufficientCredit
    case 'cloud-credits-exhausted':
      return cloudCreditsMessage(chatFailure.value.resetsAt)
    case 'model-not-found':
      return ai.value.chatModelNotFound
    case 'network':
      return ai.value.chatNetworkFailed
    case 'output-limit':
      return ai.value.chatOutputLimit
    case 'rate-limit':
      return ai.value.chatRateLimited
    case 'request-failed':
      return ai.value.chatRequestFailed
    case 'sign-in-expired':
      return ai.value.chatSignInExpired
    case 'plan-forbidden':
      return ai.value.chatPlanForbidden
    default:
      return null
  }
})
const failureHasSettingsAction = computed(() =>
  ['authentication', 'forbidden', 'model-not-found', 'sign-in-expired', 'plan-forbidden'].includes(
    chatFailure.value?.reason ?? ''
  )
)
const status = computed(() => chat.value?.status ?? 'ready')

/**
 * A message written while the agent works waits for it: Enter steers, which the built-in chat
 * takes in once the current tool calls finish, and Alt+Enter waits until all work is done.
 */
function sendOrQueue(message: ChatSubmission, afterWork: boolean) {
  if (status.value === 'streaming' || status.value === 'submitted') {
    enqueueMessage(message, afterWork ? 'follow-up' : 'steer')
    return
  }
  void submitMessage(message)
}
// Once a reply ends, what waited goes next, one message per reply; a failed reply keeps them.
function sendNextQueued() {
  const next = takeNextMessage()
  if (next) void submitMessage(next)
}
watch(status, (now, before) => {
  if (now !== 'ready' || before === 'ready' || queueHeld) return
  sendNextQueued()
})
const showContinue = computed(() => {
  if (history.readOnly.value || agentHistoryReadOnly.value) return false
  if (status.value !== 'ready') return false
  if (messages.value.length === 0) return false
  const last = messages.value[messages.value.length - 1]
  return last.role === 'assistant' && didHitStepLimit()
})

// Asking again clears the failure, and its notice goes with it.
let failureToast: number | null = null
/** The notice outlives a switch to another tab, whose chat its Retry must not touch. */
function retryFailed(messageId: string | undefined): void {
  if (messageId && chat.value?.messages.at(-1)?.id === messageId) void submission.regenerate()
}
watch(
  () => chatFailure.value?.reason,
  (reason) => {
    if (failureToast !== null) toast.remove(failureToast)
    failureToast = null
    if (!reason) return
    const failedId = chat.value?.messages.at(-1)?.id
    failureToast = toast.error(
      failureMessage.value ?? ai.value.chatRequestFailed,
      failureAction(failedId)
    )
  }
)
function failureAction(failedId: string | undefined): { label: string; run: () => void } {
  const billingURL = cloudBillingURL.value
  if (chatFailure.value?.reason === 'cloud-credits-exhausted' && billingURL) {
    return { label: ai.value.manageCloudPlanAction, run: () => void openExternalLink(billingURL) }
  }
  return failureHasSettingsAction.value
    ? { label: ai.value.openProviderSettingsAction, run: () => openSettingsDialog('ai') }
    : { label: ai.value.retryRequest, run: () => retryFailed(failedId) }
}
watch(
  () => [activeTab.value?.id, activeTab.value?.store.state.preparation] as const,
  async ([tabId, preparation], [previousTabId]) => {
    // Another tab's waiting messages never go to this one, even one that opens still preparing.
    if (tabId !== previousTabId) clearQueuedMessages()
    if (preparation) {
      viewGeneration++
      submission.cancel()
      return
    }
    const generation = ++viewGeneration
    const conversationId = history.current.value?.id
    submission.cancel()
    if (tabId !== previousTabId) chat.value = null
    try {
      await history.initialize()
    } catch {
      if (generation === viewGeneration) {
        chat.value = null
        toast.error(ai.value.chatHistoryFailed)
      }
      return
    }
    // A page switch keeps the document and its conversation, so a running chat stays attached.
    if (generation === viewGeneration && history.current.value?.id !== conversationId) {
      chat.value = null
    }
  }
)

function handleStop() {
  submission.stop()
}
</script>

<template>
  <div
    ref="panel"
    data-test-id="chat-panel"
    class="flex min-w-0 flex-1 flex-col overflow-hidden select-text"
  >
    <ChatHistory
      :saved="history.conversations.value.some((row) => row.id === history.current.value?.id)"
      :conversations="historyOptions"
      :selected-id="history.current.value?.id"
      :disabled="history.busy.value"
      @create="historyAction(history.newChat)"
      @select="historyAction(() => history.open($event))"
      @rename="renameConversation"
      @save-trace="saveTrace"
      @delete="historyAction(() => history.remove($event))"
    >
      <template #actions><ChatFollowAgentsToggle /></template>
    </ChatHistory>
    <p v-if="history.storageError.value" role="alert" class="px-3 py-2 text-xs text-error">
      {{ ai.chatStorageFailed }}
    </p>
    <ChatProviderSetup v-if="!isConfigured" />

    <template v-if="isConfigured || messages.length">
      <p
        v-if="history.current.value?.interrupted && status === 'ready'"
        role="status"
        class="px-3 py-2 text-xs text-muted"
      >
        {{ ai.chatInterrupted }}
      </p>
      <ChatTranscript
        :messages="messages"
        :status="status"
        :show-continue="showContinue"
        :queued="queuedMessages"
        :steers="!providerID.startsWith('acp:') && providerID !== 'harness:pi'"
        @remove-queued="removeQueuedMessage"
        :nodes-live="!history.readOnly.value"
        :interactive="chat !== null && !submission.busy.value"
        @regenerate="submission.regenerate()"
        @revert="(messageId) => submission.revert(messageId)"
        @restore="(messageId) => submission.restore(messageId)"
        @edit="(messageId, text) => submission.resend(messageId, text)"
        @continue="
          submission.submit({
            modelText: 'Continue where you left off',
            displayText: 'Continue where you left off',
            images: [],
            nodes: []
          })
        "
      />

      <p v-if="agentHistoryReadOnly" role="status" class="px-3 py-2 text-xs text-muted">
        {{ ai.chatAgentReadOnly }}
      </p>
      <p v-if="history.readOnly.value" role="status" class="px-3 py-2 text-xs text-muted">
        {{ ai.chatReadOnly }}
      </p>
      <ChatRunLocation
        v-if="runLocation"
        :agent="runLocation.agent"
        :page="runLocation.page"
        @open="runLocation.open"
      />
      <ChatInput
        v-if="isConfigured && !agentHistoryReadOnly && !history.readOnly.value"
        ref="chatInput"
        :status="status"
        :dragging="draggingImages"
        :disabled="submission.busy.value || history.busy.value"
        @submit="sendOrQueue"
        @stop="handleStop"
        @interrupt="handleStop"
        @error="toast.error"
      />

      <ChatPermissionDialog />
    </template>
  </div>
</template>
