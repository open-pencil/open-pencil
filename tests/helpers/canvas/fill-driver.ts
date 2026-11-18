import type { Page } from '@playwright/test'

/** Reads the selected layer's first fill or stroke, with the variable its colour is bound to. */
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

    /** The first paint's colour and the variable bound to it, if any. */
    boundPaint(kind: 'fills' | 'strokes' = 'fills') {
      return page().evaluate((kind) => {
        const store = window.openPencil?.getStore?.()
        const id = store ? [...store.state.selectedIds][0] : undefined
        const node = id ? store?.graph.getNode(id) : undefined
        return { color: node?.[kind][0]?.color, binding: node?.boundVariables[`${kind}/0/color`] }
      }, kind)
    }
  }
}
