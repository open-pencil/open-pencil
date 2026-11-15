import type { UIMessage } from 'ai'
import { computed, provide, ref, watch, type Ref } from 'vue'

import { subagentTranscript, type SubagentTranscript } from '@/app/ai/chat/subagents'
import { appPreferences } from '@/app/settings/preferences/store'

import { OPEN_SUBAGENT_THREAD } from './context'
import { useSubagentFollow } from './useSubagentFollow'

/**
 * The subagent thread the chat shows over its transcript, read from the chat's messages so it
 * follows a subagent still at work. Cards anywhere in the chat open it; another conversation
 * closes it. With Follow agents on, opening a working subagent's thread follows its cursor, since
 * that is the one being watched; going back leaves following as it is.
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

  const follow = useSubagentFollow(() => transcript.value)
  /** A follow the opened thread asked for before its subagent had a cursor to follow. */
  let followOnOpen = false
  watch(follow.available, (ready) => {
    if (!ready || !followOnOpen) return
    followOnOpen = false
    follow.start()
  })
  function close() {
    session.value = null
    followOnOpen = false
  }

  provide(OPEN_SUBAGENT_THREAD, (id) => {
    session.value = id
    followOnOpen = appPreferences.value.chat.followAgents
    if (followOnOpen) follow.start()
    if (follow.following.value) followOnOpen = false
  })
  watch(conversation, close)

  return { open: computed(() => transcript.value !== null), transcript: shown, close }
}
