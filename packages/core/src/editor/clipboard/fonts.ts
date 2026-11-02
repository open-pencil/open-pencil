import type { EditorContext } from '#core/editor/types'
import { computeAllLayouts } from '#core/layout'
import { prepareGraphFonts } from '#core/text/prepare'

export function createClipboardFontActions(ctx: EditorContext) {
  /**
   * Prepares the fonts of pasted layers, hiding them meanwhile, and lays the page out in them;
   * resolves to the faces that could not load.
   */
  async function loadFontsForNodes(nodeIds: string[]) {
    try {
      const status = await prepareGraphFonts(ctx.graph, nodeIds, {
        loadFont: ctx.loadFont,
        hide: true
      })
      computeAllLayouts(ctx.graph, ctx.state.currentPageId)
      return status.issues
        .filter((issue) => issue.status === 'unresolved')
        .map((issue) => [issue.family, issue.style] as [string, string])
    } finally {
      ctx.getRenderer()?.invalidateAllPictures()
      ctx.requestRender()
    }
  }

  return { loadFontsForNodes }
}
