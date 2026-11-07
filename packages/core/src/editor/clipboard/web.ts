import type { DesignDocument } from '@open-pencil/dom-css'
import type { StyleRun } from '@open-pencil/scene-graph'

import { parentLocalPoint, resolvePasteTarget } from '#core/editor/clipboard/paste/target'
import { layerTheme, newLayerDefaults } from '#core/editor/shapes/defaults'
import type { EditorContext } from '#core/editor/types'
import { layoutAuthoredNodes } from '#core/layout'

import { captureClipboardSnapshot, type ClipboardSnapshot } from './snapshot'

/** A stretch of pasted text that links somewhere, as the copied page's `<a href>` did. */
export interface PastedTextLink {
  start: number
  length: number
  url: string
}

interface WebPasteDependencies {
  pushCreatedNodesUndo: (created: string[], previousSelection: Set<string>, label?: string) => void
  loadFontsForNodes: (nodeIds: string[]) => Promise<unknown>
}

function linkRuns(links: readonly PastedTextLink[]): StyleRun[] {
  return links.map(({ start, length, url }) => ({
    start,
    length,
    style: { hyperlink: { type: 'URL', value: url } }
  }))
}

/** Text and web pages pasted from outside OpenPencil, as Figma pastes them, and as layers. */
export function createClipboardWebActions(ctx: EditorContext, deps: WebPasteDependencies) {
  /**
   * Pastes text as one text layer in the default text style, sized to its content and centred on
   * the point, as Figma pastes text from outside; links keep their targets. Resolves to the new
   * layer's id.
   */
  async function pasteText(
    text: string,
    cx: number,
    cy: number,
    links: readonly PastedTextLink[] = []
  ): Promise<string | null> {
    if (text.trim().length === 0) return null
    const previousSelection = new Set(ctx.state.selectedIds)
    const parentId = resolvePasteTarget(ctx)
    const node = ctx.graph.createNode('TEXT', parentId, {
      ...newLayerDefaults('TEXT', layerTheme(ctx.state)),
      name: text.replace(/\s+/g, ' ').trim(),
      text,
      styleRuns: linkRuns(links),
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    const pageId = ctx.state.currentPageId
    await deps.loadFontsForNodes([node.id])
    // Leaving the page while the font loads cancels the paste rather than selecting off-page.
    if (ctx.state.currentPageId !== pageId) {
      ctx.graph.deleteNode(node.id)
      return null
    }
    layoutAuthoredNodes(ctx.graph, [node.id])
    const center = parentLocalPoint(ctx, parentId, cx, cy)
    node.x = center.x - node.width / 2
    node.y = center.y - node.height / 2
    ctx.setSelectedIds(new Set([node.id]))
    deps.pushCreatedNodesUndo([node.id], previousSelection, 'Paste text')
    ctx.requestRender()
    return node.id
  }

  /**
   * Builds a styled, laid-out document's layers as HTML import builds them, ready to paste as
   * copied layers are; null when it shows nothing. Building first lets a caller keep what it would
   * replace until the layers exist.
   */
  async function prepareStyledHTML(styled: DesignDocument): Promise<ClipboardSnapshot | null> {
    const { sceneGraphFromStyledHTML } = await import('#core/io/formats/html/layers')
    const graph = await sceneGraphFromStyledHTML(styled)
    const roots = graph.getChildren(graph.getPages()[0].id)
    return roots.length > 0 ? captureClipboardSnapshot(graph, roots) : null
  }

  /**
   * Where pasted HTML goes, and the width it is laid out in there: the content width of the frame
   * it goes into, or null on the canvas, where the caller picks one.
   */
  function htmlPasteTarget(): { id: string; width: number | null } {
    const id = resolvePasteTarget(ctx)
    const target = ctx.graph.getNode(id)
    if (!target || target.type === 'CANVAS') return { id, width: null }
    const inset = target.layoutMode === 'NONE' ? 0 : target.paddingLeft + target.paddingRight
    return { id, width: Math.max(0, target.width - inset) }
  }

  return { pasteText, prepareStyledHTML, htmlPasteTarget }
}
