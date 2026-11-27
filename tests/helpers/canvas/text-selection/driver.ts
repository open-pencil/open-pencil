import { expect, type Page } from '@playwright/test'

import type { StyleRun } from '@open-pencil/scene-graph'

import { CanvasHelper } from '#tests/helpers/canvas'
import { loadSceneFonts, pageScene, showView } from '#tests/helpers/canvas/page-scene'
import type * as TextSelectionScenes from '#tests/helpers/canvas/text-selection/scene'

/** What a text layer holds of its own, apart from its ranges. */
export interface LayerBindings {
  boundVariables: Record<string, string>
  textStyleId: string | null
}

/**
 * A text whose word a person selects while editing it, with a colour variable and a text style
 * at hand; reads back the ranges and the layer as the panel leaves them.
 */
export function textSelectionDriver(page: () => Page) {
  const scenes = pageScene<typeof TextSelectionScenes>(
    page,
    '/tests/helpers/canvas/text-selection/scene.ts'
  )
  let textId = ''
  return {
    async show() {
      await showView(page(), { zoom: 1, panX: 0, panY: 0 })
      textId = await scenes.build('createSelectionStyleScene')
      await loadSceneFonts(page(), [textId])
    },

    /** Edits the text and selects "world" with the keyboard, as a person would. */
    async selectWorld() {
      const canvas = new CanvasHelper(page())
      await canvas.dblclick(260, 215)
      await expect
        .poll(() => page().evaluate(() => window.openPencil?.getStore?.().state.editingTextId))
        .toBe(textId)
      await page().keyboard.press('End')
      for (let step = 0; step < 5; step++) await page().keyboard.press('Shift+ArrowLeft')
    },

    runs(): Promise<StyleRun[]> {
      return page().evaluate(
        (id) => window.openPencil?.getStore?.().graph.getNode(id)?.styleRuns ?? [],
        textId
      )
    },

    layer(): Promise<LayerBindings | null> {
      return page().evaluate((id) => {
        const node = window.openPencil?.getStore?.().graph.getNode(id)
        return node ? { boundVariables: node.boundVariables, textStyleId: node.textStyleId } : null
      }, textId)
    }
  }
}
