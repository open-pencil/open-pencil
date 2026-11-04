import { selectionToJSX } from '@open-pencil/design-jsx'

import type { EditorContext } from '#core/editor/types'
import { renderNodesToLaidOutSVG } from '#core/io/formats/svg/text/layout'

export function createClipboardExportActions(ctx: EditorContext) {
  function copySelectionAsText(ids: string[]): string {
    return ids.map((id) => ctx.graph.getNode(id)?.name ?? id).join('\n')
  }

  function copySelectionAsSVG(ids: string[]): Promise<string | null> {
    const nodeIds =
      ids.length > 0 ? ids : ctx.graph.getChildren(ctx.state.currentPageId).map((n) => n.id)
    return renderNodesToLaidOutSVG(ctx.graph, ctx.state.currentPageId, nodeIds)
  }

  function copySelectionAsJSX(ids: string[]): string | null {
    return ids.length > 0 ? selectionToJSX(ids, ctx.graph) : null
  }

  return { copySelectionAsText, copySelectionAsSVG, copySelectionAsJSX }
}
