import type { EditorContext } from '#core/editor/types'
import { getTextMeasurer, type TextMeasurer } from '#core/layout/text-measurement'
import { fontManager } from '#core/text/font/manager'

/** What sized a page's text when it was laid out. */
interface TextBasis {
  fontGeneration: number
  measurer: TextMeasurer | null
}

function currentTextBasis(): TextBasis {
  return { fontGeneration: fontManager.generation(), measurer: getTextMeasurer() }
}

/**
 * Which pages are laid out as they are now, so switching back to one does not lay it out again.
 * A page needs layout again once a layer on it changes, other than by layout itself, or once
 * the fonts or text measurer that size its text change. Layout reads variables only through the
 * layers they are bound to, whose updates count as changes.
 */
export function createPageLayouts(ctx: Pick<EditorContext, 'graph' | 'onEditorEvent'>) {
  const laidOut = new Map<string, TextBasis>()

  function changed(nodeId: string | null | undefined) {
    if (!nodeId || ctx.graph.isApplyingLayout) return
    const pageId = ctx.graph.pageOf(nodeId)
    if (pageId) laidOut.delete(pageId)
  }

  ctx.onEditorEvent('node:created', (node) => changed(node.id))
  ctx.onEditorEvent('node:updated', (id) => changed(id))
  ctx.onEditorEvent('node:deleted', (_id, parentId) => changed(parentId))
  ctx.onEditorEvent('node:reparented', (_id, oldParentId, newParentId) => {
    changed(oldParentId)
    changed(newParentId)
  })
  ctx.onEditorEvent('node:reordered', (_id, parentId, _index, previousParentId) => {
    changed(parentId)
    changed(previousParentId)
  })
  ctx.onEditorEvent('graph:replaced', () => laidOut.clear())

  /** Whether `pageId` is laid out as its layers, fonts and text measurer are now. */
  function isCurrent(pageId: string): boolean {
    const last = laidOut.get(pageId)
    const now = currentTextBasis()
    return last?.fontGeneration === now.fontGeneration && last.measurer === now.measurer
  }

  /** Call once `pageId` has been laid out. */
  function record(pageId: string) {
    laidOut.set(pageId, currentTextBasis())
  }

  return { isCurrent, record }
}
