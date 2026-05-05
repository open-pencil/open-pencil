import { selectionToJSX } from '#core/design-jsx'
import type { EditorContext } from '#core/editor/types'
import { renderNodesToSVG } from '#core/io/formats/svg'

export function createClipboardExportActions(ctx: EditorContext) {
  function copySelectionAsText(ids: string[]): string {
    return ids.map((id) => ctx.graph.getNode(id)?.name ?? id).join('\n')
  }

  function copySelectionAsSVG(ids: string[]): string | null {
    const nodeIds =
      ids.length > 0 ? ids : ctx.graph.getChildren(ctx.state.currentPageId).map((n) => n.id)
    return renderNodesToSVG(ctx.graph, ctx.state.currentPageId, nodeIds)
  }

  function copySelectionAsJSX(ids: string[]): string | null {
    return ids.length > 0 ? selectionToJSX(ids, ctx.graph) : null
  }

  return { copySelectionAsText, copySelectionAsSVG, copySelectionAsJSX }
}
