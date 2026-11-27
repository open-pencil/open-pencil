import type { Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

/**
 * Opens the editor with one Inter text selected, edits its characters, and reads back the type
 * details the Typography section sets on it.
 */
export function typeDetailsDriver(page: Page) {
  let id: string | undefined
  const textId = () => {
    if (!id) throw new Error('Open the text first')
    return id
  }

  return {
    async open() {
      await page.goto('/?test')
      await new CanvasHelper(page).waitForInit()
      id = await page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const text = store.createShape('TEXT', 120, 120, 300, 40)
        store.updateNode(text, { text: 'Hello world 0123', fontSize: 24 })
        store.select([text])
        return text
      })
    },

    /** Edits the text with the characters from `start` to `end` selected. */
    selectCharacters(start: number, end: number) {
      return page.evaluate(
        ({ nodeId, from, to }) => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('OpenPencil store not initialized')
          store.startTextEditing(nodeId)
          const state = store.textEditor?.state
          if (!state) throw new Error('Text is not being edited')
          state.selectionAnchor = from
          state.cursor = to
          store.textSelectionChanged()
        },
        { nodeId: textId(), from: start, to: end }
      )
    },

    details() {
      return page.evaluate((nodeId) => {
        const node = window.openPencil?.getStore?.().graph.getNode(nodeId)
        if (!node) throw new Error('Text not found')
        return {
          textDecoration: node.textDecoration,
          textDecorationStyle: node.textDecorationStyle,
          textDecorationThickness: node.textDecorationThickness,
          textDecorationFills: node.textDecorationFills,
          leadingTrim: node.leadingTrim,
          fontFeatures: node.fontFeatures,
          styleRuns: node.styleRuns
        }
      }, textId())
    },

    undo() {
      return page.evaluate(() => window.openPencil?.getStore?.().undoAction())
    }
  }
}
