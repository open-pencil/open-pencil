import { Chat } from '@ai-sdk/vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import type { UIMessage } from 'ai'
import { computed, onScopeDispose, shallowRef } from 'vue'

import { createToolLoopTransport } from '@/app/ai/chat/transports'
import type { EditorStore } from '@/app/editor/active-store'
import { getTabForStore, switchTab } from '@/app/tabs'

import { findByName, GUARANTEES_JSX } from '../scenes'
import { createRecordedModel, type StreamPace } from './recorded-model'

const ARTBOARD_NAME = 'Pricing'
const RESULT_NAME = 'Guarantees'
/**
 * Slow enough to follow the first time without waiting on the agent: the reasoning streams
 * quickly enough to skim, the cards build up on the canvas over a few seconds, and the reply
 * reads at an easy pace. A whole turn takes about ten seconds.
 */
const PACE: StreamPace = { start: 500, reasoning: 35, word: 110, pause: 500, argument: 55 }
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
    // The canvas previews streamed JSX only for the active document, as the app's chat does.
    const tab = getTabForStore(store)
    if (tab) switchTab(tab.id)
    const { request, reasoning, reply } = copy()
    const model = createRecordedModel(
      { reasoning, reply, render: { parent_id: parentId, jsx: GUARANTEES_JSX } },
      reducedMotion.value === 'reduce' ? null : PACE
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
    // The view follows the agent while it works; afterwards it shows the whole result, which
    // also ends following, as any view change of the person's own does in the app.
    if (!disposed) store.zoomToFit()
  }

  return { messages, status, running, played, play }
}
