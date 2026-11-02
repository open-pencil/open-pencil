import type { EditorContext } from '#core/editor/types'
import { computeAllLayouts } from '#core/layout'
import { fontManager } from '#core/text/font/manager'
import { collectGraphFontRequirements } from '#core/text/requirements/collect'
import { missingGraphFontScripts } from '#core/text/requirements/resolved'

export function createClipboardFontActions(ctx: EditorContext) {
  async function loadFontsForNodes(nodeIds: string[]) {
    fontManager.blockNodesUntilFontsResolve(nodeIds)
    try {
      const requirements = collectGraphFontRequirements(ctx.graph, nodeIds)
      const toLoad = fontManager.collectFontKeys(ctx.graph, nodeIds)
      const results = await Promise.all(
        toLoad.map(([family, style]) => ctx.loadFont(family, style, requirements.characters))
      )
      const failed = toLoad.filter((_, index) => results[index] === null)
      const requiredFallbacks = missingGraphFontScripts(requirements)
      const fallbacks = await fontManager.ensureFallbackPack(
        requiredFallbacks,
        requirements.characters
      )
      const missingFallback = requiredFallbacks.some(
        (script) => (fallbacks[script]?.length ?? 0) === 0
      )
      if (failed.length === 0 && !missingFallback) {
        for (const node of requirements.nodes) if (node.type === 'TEXT') node.textPicture = null
      }
      computeAllLayouts(ctx.graph, ctx.state.currentPageId)
      return failed
    } finally {
      fontManager.unblockNodes(nodeIds)
      ctx.getRenderer()?.invalidateAllPictures()
      ctx.requestRender()
    }
  }

  return { loadFontsForNodes }
}
