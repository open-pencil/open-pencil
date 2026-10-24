import type { Page } from '@playwright/test'

/** Reads the selected layer's first fill or stroke and resets the editor's undo history. */
export function fillDriver(page: () => Page) {
  function selectedPaint(kind: 'fills' | 'strokes' = 'fills') {
    return page().evaluate((kind) => {
      const store = window.openPencil?.getStore?.()
      const id = store ? [...store.state.selectedIds][0] : undefined
      return id ? (store?.graph.getNode(id)?.[kind][0] ?? null) : null
    }, kind)
  }

  return {
    selectedPaint,

    async selectedColor() {
      return (await selectedPaint())?.color ?? null
    },

    /** As in a freshly opened document: nothing to undo yet. */
    clearHistory() {
      return page().evaluate(() => window.openPencil?.getStore?.().undo.clear())
    }
  }
}
