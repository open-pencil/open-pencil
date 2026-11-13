import { computed } from 'vue'

import type { SubagentTranscript } from '@/app/ai/chat/subagents'
import { useActiveEditorStoreRef } from '@/app/editor/active-store'
import { follow, presenceOf } from '@/app/presence/registry'

/**
 * Following a subagent's cursor in the active document: possible while it works and has one,
 * and stopped by following no one, as any follow is.
 */
export function useSubagentFollow(transcript: () => SubagentTranscript | null) {
  const storeRef = useActiveEditorStoreRef()
  const agentId = computed(() => transcript()?.agent?.id)
  const available = computed(() => {
    const state = transcript()?.state
    return !!storeRef.value && !!agentId.value && (state === undefined || state === 'running')
  })
  const following = computed(() => {
    const store = storeRef.value
    const target = store ? presenceOf(store).following.value : null
    return target?.kind === 'agent' && target.agentId === agentId.value
  })

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
