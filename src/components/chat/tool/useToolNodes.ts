import { computed, inject, ref } from 'vue'

import { getActiveEditorStoreOrNull, useActiveEditorStoreRef } from '@/app/editor/active-store'
import { focusNodesOnTheirPage } from '@/app/editor/selection/focus'
import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'
import { CHAT_NODES_LIVE } from '@/components/chat/tool/context'

const MAX_NODES = 8

export interface ToolNode {
  id: string
  label: string
  /** Whether the node is still in the open document, so it can be shown. */
  present: boolean
}

/**
 * The layers a tool call touched, looked up in the open document, and a way to show one on
 * the canvas. A conversation from another document lists its IDs without resolving them.
 */
export function useToolNodes(ids: () => string[]) {
  const live = inject(CHAT_NODES_LIVE, ref(true))
  const activeStore = useActiveEditorStoreRef()

  const nodes = computed<ToolNode[]>(() => {
    const store = activeStore.value
    // The graph is not reactive; the scene version changes with every edit to it.
    void store?.state.sceneVersion
    const graph = live.value ? store?.graph : undefined
    return ids()
      .slice(0, MAX_NODES)
      .map((id) => {
        const node = graph?.getNode(id)
        return {
          id,
          label: node?.name || id,
          present: node !== undefined && node.type !== 'CANVAS'
        }
      })
  })

  async function show(id: string): Promise<void> {
    const store = getActiveEditorStoreOrNull()
    if (!store || !live.value) return
    try {
      await focusNodesOnTheirPage(store, [id])
    } catch (error) {
      // A newer page switch supersedes this one.
      if (error instanceof Error && error.name === 'AbortError') return
      toast.error(
        notificationMessages.get().operationFailed({
          error: error instanceof Error ? error.message : String(error)
        })
      )
    }
  }

  return { nodes, show }
}
