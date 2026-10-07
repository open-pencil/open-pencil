import { Chat } from '@ai-sdk/vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import type { UIMessage } from 'ai'
import { computed, onScopeDispose, shallowRef } from 'vue'

import { createToolLoopTransport } from '@/app/ai/chat/transports'
import type { EditorStore } from '@/app/editor/active-store'

import { findByName, GUARANTEES_JSX } from '../scenes'
import { createRecordedModel } from './recorded-model'

const ARTBOARD_NAME = 'Pricing'
const RESULT_NAME = 'Guarantees'
const CHUNK_DELAY_MS = 28
const OUTPUT_TOKEN_LIMIT = 4096

export interface RecordedChatCopy {
  request: string
  reasoning: string
  reply: string
}

/**
 * Plays a recorded turn through the app's own tool-loop transport, so the transcript, the
 * streamed canvas preview, the committed design, and its undo step all come from the real
 * agent path. Each replay starts from the scene as built, without the previous result.
 */
export function useRecordedChat(store: EditorStore, copy: () => RecordedChatCopy) {
  const reducedMotion = usePreferredReducedMotion()
  const chat = shallowRef<Chat<UIMessage> | null>(null)
  let disposed = false
  onScopeDispose(() => {
    disposed = true
    void chat.value?.stop()
  })

  const messages = computed(() => chat.value?.messages ?? [])
  const status = computed(() => chat.value?.status ?? 'ready')
  const running = computed(() => status.value === 'submitted' || status.value === 'streaming')
  const played = computed(() => messages.value.length > 0)

  function clearPreviousResult(): void {
    const previous = findByName(store, RESULT_NAME)
    if (!previous) return
    store.graph.deleteNode(previous)
    store.requestRender()
  }

  async function play(): Promise<void> {
    const parentId = findByName(store, ARTBOARD_NAME)
    if (running.value || disposed || !parentId) return
    clearPreviousResult()
    const { request, reasoning, reply } = copy()
    const model = createRecordedModel(
      { reasoning, reply, render: { parent_id: parentId, jsx: GUARANTEES_JSX } },
      reducedMotion.value === 'reduce' ? null : CHUNK_DELAY_MS
    )
    chat.value = new Chat<UIMessage>({
      transport: createToolLoopTransport({
        store,
        providerID: 'openai',
        model,
        effectiveModelID: model.modelId,
        maxOutputTokens: OUTPUT_TOKEN_LIMIT,
        thinkingLevel: () => 'off'
      })
    })
    await chat.value.sendMessage({ text: request })
  }

  return { messages, status, running, played, play }
}
