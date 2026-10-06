import { computed } from 'vue'

import { runAgentId } from '@/app/ai/tools'
import { presenceOf } from '@/app/presence/registry'
import { activeTab } from '@/app/tabs'

/** The page the chat's reply works on, while you look at a different one. */
export interface ChatRunLocation {
  agent: string
  page: string
  open: () => void
}

export function useChatRunLocation() {
  return computed<ChatRunLocation | null>(() => {
    const tab = activeTab.value
    if (!tab || tab.kind === 'home') return null
    const store = tab.store
    const agentId = runAgentId(store)
    const agent = presenceOf(store).agents.value.find((entry) => entry.id === agentId)
    if (!agent || agent.status === 'idle' || !agent.pageId) return null
    const pageId = agent.pageId
    if (pageId === store.state.currentPageId) return null
    const page = store.graph.getNode(pageId)?.name
    if (!page) return null
    return { agent: agent.name, page, open: () => void store.switchPage(pageId) }
  })
}
