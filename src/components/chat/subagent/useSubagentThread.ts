import type { UIMessage } from 'ai'
import { computed, provide, ref, watch, type Ref } from 'vue'

import { subagentTranscript, type SubagentTranscript } from '@/app/ai/chat/subagents'

import { OPEN_SUBAGENT_THREAD } from './context'

/**
 * The subagent thread the chat shows over its transcript, read from the chat's messages so it
 * follows a subagent still at work. Cards anywhere in the chat open it; another conversation
 * closes it.
 */
export function useSubagentThread(
  messages: Readonly<Ref<UIMessage[]>>,
  conversation: () => unknown
) {
  const session = ref<string | null>(null)

  const transcript = computed((): SubagentTranscript | null => {
    if (session.value === null) return null
    for (const message of messages.value) {
      for (const part of message.parts) {
        const found = subagentTranscript(part)
        if (found?.session === session.value) return found
      }
    }
    return null
  })

  // The last state shown stays on screen while the thread slides away.
  const shown = ref<SubagentTranscript | null>(null)
  watch(transcript, (value) => {
    if (value) shown.value = value
  })

  provide(OPEN_SUBAGENT_THREAD, (id) => {
    session.value = id
  })
  watch(conversation, () => {
    session.value = null
  })

  return {
    open: computed(() => transcript.value !== null),
    transcript: shown,
    close: () => {
      session.value = null
    }
  }
}
