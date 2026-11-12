import type { Page } from '@playwright/test'

import { readProbe } from './probe'

/** Own the instrumentation and remote handle for exactly one interaction. */
export async function measureInteraction(
  page: Page,
  run: () => Promise<void>,
  selectedId?: string
) {
  const probe = await page.evaluateHandle((selectedId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const update = store.updateNode
    const graphUpdate = store.graph.updateNode
    const counts = { storeUpdateCount: 0, graphUpdateCount: 0, repaintCount: 0 }
    store.updateNode = (id, changes) => {
      if (!selectedId || id === selectedId) counts.storeUpdateCount++
      return update.call(store, id, changes)
    }
    store.graph.updateNode = (id, changes) => {
      if (!selectedId || id === selectedId) counts.graphUpdateCount++
      return graphUpdate.call(store.graph, id, changes)
    }
    const unsubscribe = store.onEditorEvent('repaint:requested', () => {
      counts.repaintCount++
    })
    return {
      read: () => ({ ...counts }),
      dispose() {
        store.updateNode = update
        store.graph.updateNode = graphUpdate
        unsubscribe()
      }
    }
  }, selectedId)
  return readProbe(probe, run)
}
