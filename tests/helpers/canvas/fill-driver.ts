import type { Page } from '@playwright/test'

/** Reads the selected layer's first fill and resets the editor's undo history. */
export function fillDriver(page: () => Page) {
  return {
    selectedColor() {
      return page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        const id = store ? [...store.state.selectedIds][0] : undefined
        return id ? (store?.graph.getNode(id)?.fills[0]?.color ?? null) : null
      })
    },

    /** As in a freshly opened document: nothing to undo yet. */
    clearHistory() {
      return page().evaluate(() => window.openPencil?.getStore?.().undo.clear())
    }
  }
}
