import { selectionToJSX } from '@open-pencil/design-jsx'

import type { EditorContext } from '#core/editor/types'
import { renderNodesToLaidOutSVG } from '#core/io/formats/svg/text/layout'

export function createClipboardExportActions(ctx: EditorContext) {
  /** The characters of one selected text layer, as Figma copies them; anything else copies nothing. */
  function copySelectionAsText(ids: string[]): string | null {
    const node = ids.length === 1 ? ctx.graph.getNode(ids[0]) : undefined
    return node?.type === 'TEXT' ? node.text : null
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
