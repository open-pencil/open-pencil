import { Chat } from '@ai-sdk/vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import type { UIMessage } from 'ai'
import { computed, onScopeDispose, shallowRef } from 'vue'

import { CHAPTERS } from '@open-pencil/demo-tools/chapters'

import { createToolLoopTransport } from '@/app/ai/transports/tool-loop'
import type { EditorStore } from '@/app/editor/active-store'
import { getTabForStore, switchTab } from '@/app/tabs'

import { findByName, reframeStage } from '../scenes'
import { createRecordedModel, type StreamPace } from './recorded-model'

/** The hero frame, which lays out the player and whatever the turn adds beside it in a row. */
const ARTBOARD_NAME = CHAPTERS.hello.subject
const RESULT_NAME = 'Up next'

const UP_NEXT = [
  { title: 'Side B', artist: 'The Tapes', length: '3:12' },
  { title: 'Lo-fi Hours', artist: 'Various', length: '4:05' },
  { title: 'Night Shift', artist: 'Lumen', length: '2:48' }
]

/**
 * The card the turn adds. Its colors and radius are the tour's Theme variables, as the player's
 * are, so it switches between dark and light with the player and the docs site. The hero spaces
 * its row by nothing, so the card keeps its distance from the player with padding of its own.
 */
const UP_NEXT_JSX = [
  `<Frame name="${RESULT_NAME}" w="hug" h="hug" pl={24}>`,
  `  <Frame name="Queue" w={280} h="hug" flex="col" gap={14} p={20} bg={designVar('Surface')} rounded={designVar('Radius')}>`,
  `    <Text name="Heading" size={14} weight={600} color={designVar('Text')}>${RESULT_NAME}</Text>`,
  ...UP_NEXT.flatMap(({ title, artist, length }) => [
    '    <Frame name="Track" w="fill" h="hug" flex="row" gap={12} items="center">',
    `      <Frame name="Cover" w={40} h={40} rounded={designVar('Radius/Control')} bg={designVar('Surface/Raised')} />`,
    '      <Frame name="Names" grow={1} h="hug" flex="col" gap={2}>',
    `        <Text name="Title" size={13} weight={500} color={designVar('Text')}>${title}</Text>`,
    `        <Text name="Artist" size={12} color={designVar('Text/Muted')}>${artist}</Text>`,
    '      </Frame>',
    `      <Text name="Length" size={12} color={designVar('Text/Muted')}>${length}</Text>`,
    '    </Frame>'
  ]),
  '  </Frame>',
  '</Frame>'
].join('\n')
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
  // A call rather than the flag itself, which a check before an await would narrow for good.
  const isDisposed = () => disposed
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
    if (running.value || isDisposed() || !parentId) return
    clearPreviousResult()
    // The canvas previews streamed JSX only for the active document, as the app's chat does.
    const tab = getTabForStore(store)
    if (tab) switchTab(tab.id)
    const { request, reasoning, reply } = copy()
    const model = createRecordedModel(
      { reasoning, reply, render: { parent_id: parentId, jsx: UP_NEXT_JSX } },
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
    // The view follows the agent while it works; afterwards it frames the hero with the new card
    // beside the player, which also ends following, as any view change of the person's own does.
    if (!isDisposed()) reframeStage(store)
  }

  return { messages, status, running, played, play }
}
