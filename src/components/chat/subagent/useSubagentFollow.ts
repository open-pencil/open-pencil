import { computed } from 'vue'

import type { SubagentTranscript } from '@/app/ai/chat/subagents'
import { useActiveEditorStoreRef } from '@/app/editor/active-store'
import { follow, presenceOf } from '@/app/presence/registry'

/**
 * Following a subagent's cursor in the active document: it can start while the subagent works and
 * has one, and a follow already on can always be stopped, also once the subagent rests.
 */
export function useSubagentFollow(transcript: () => SubagentTranscript | null) {
  const storeRef = useActiveEditorStoreRef()
  const agentId = computed(() => transcript()?.agent?.id)
  const following = computed(() => {
    const store = storeRef.value
    const target = store ? presenceOf(store).following.value : null
    return target?.kind === 'agent' && target.agentId === agentId.value
  })
  const startable = computed(() => {
    const state = transcript()?.state
    return !!storeRef.value && !!agentId.value && (state === undefined || state === 'running')
  })
  /** Whether its follow control shows: to start following, or to stop. */
  const available = computed(() => following.value || startable.value)

  function start() {
    const store = storeRef.value
    const id = agentId.value
    if (store && id && available.value && !following.value)
      follow(store, { kind: 'agent', agentId: id })
  }

  function toggle() {
    const store = storeRef.value
    if (!store) return
    if (following.value) follow(store, null)
    else start()
  }

  return { available, following, start, toggle }
}
