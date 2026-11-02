import type { Page } from '@playwright/test'

/** Own the instrumentation and remote handle for exactly one interaction. */
export async function measureInteraction(
  page: Page,
  run: () => Promise<void>,
  selectedId?: string
) {
  const probe = await page.evaluateHandle((selectedId) => {
    const store = window.lawha?.getStore?.()
    if (!store) throw new Error('Lawha store not initialized')
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
  try {
    await run()
    return await probe.evaluate((probe) => probe.read())
  } finally {
    try {
      await probe.evaluate((probe) => probe.dispose())
    } finally {
      await probe.dispose()
    }
  }
}
