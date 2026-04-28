import { computeAllLayouts } from '#core/layout'
import { collectFontKeys } from '#core/text/fonts'

import type { EditorContext } from '#core/editor/types'

export function createClipboardFontActions(ctx: EditorContext) {
  async function loadFontsForNodes(nodeIds: string[]) {
    const toLoad = collectFontKeys(ctx.graph, nodeIds)
    if (toLoad.length === 0) return []

    const results = await Promise.all(toLoad.map(([family, style]) => ctx.loadFont(family, style)))
    const failed = toLoad.filter((_, i) => results[i] === null)
    computeAllLayouts(ctx.graph, ctx.state.currentPageId)
    return failed
  }

  return { loadFontsForNodes }
}
