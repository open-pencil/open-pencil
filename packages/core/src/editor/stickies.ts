import type { SceneNode } from '@open-pencil/scene-graph'
import {
  figJamTextSizeFields,
  figJamTypeface,
  type FigJamTextSize
} from '@open-pencil/scene-graph/figjam'
import {
  createSticky,
  DEFAULT_STICKY_COLOR,
  stickyScale,
  stickyWidth,
  STICKY_SIZE,
  stickySublayers
} from '@open-pencil/scene-graph/generated'
import type { Color, Vector } from '@open-pencil/scene-graph/primitives'
import { rescaleNodeTree } from '@open-pencil/scene-graph/scaling'

import { recordSubtreeEdit } from '#core/editor/components/slots/history'
import type { EditorContext } from '#core/editor/types'
import { pushCreatedSubtreesUndo } from '#core/editor/undo'

/**
 * Sticky note commands. A note's colour sits on the note and its text on its sublayers, so each
 * change records the notes' whole subtrees as one step.
 */
export function createStickyActions(ctx: EditorContext) {
  /** The colour the sticky tool places notes in: the one picked last, as in FigJam. */
  let stickyColor: Color = DEFAULT_STICKY_COLOR

  function selectedStickies(ids: Iterable<string>): SceneNode[] {
    return [...ids].flatMap((id) => {
      const node = ctx.graph.getNode(id)
      return node?.type === 'STICKY' ? [node] : []
    })
  }

  /**
   * Places a note centred on `center`, in `parentId`'s coordinates, signed with the user's
   * name and in the colour picked last, and selects it.
   */
  function createStickyNote(parentId: string, center: Vector): SceneNode {
    const previousSelection = new Set(ctx.state.selectedIds)
    const sticky = createSticky(
      ctx.graph,
      parentId,
      { author: ctx.getUserName(), color: stickyColor },
      {
        x: Math.round(center.x - STICKY_SIZE / 2),
        y: Math.round(center.y - STICKY_SIZE / 2)
      }
    )
    ctx.runLayoutForNode(sticky.id)
    pushCreatedSubtreesUndo(ctx, 'Create sticky', [sticky.id], previousSelection)
    ctx.setSelectedIds(new Set([sticky.id]))
    ctx.requestRender()
    return sticky
  }

  function editStickies(label: string, ids: Iterable<string>, change: (sticky: SceneNode) => void) {
    const stickies = selectedStickies(ids)
    if (stickies.length === 0) return
    recordSubtreeEdit(
      ctx,
      label,
      stickies.map((sticky) => sticky.id),
      () => stickies.forEach(change)
    )
  }

  /** Paints the notes `ids` in `color`, which new notes take from now on. */
  function setStickyColor(ids: Iterable<string>, color: Color) {
    stickyColor = { ...color }
    editStickies('Change sticky color', ids, (sticky) => {
      const fill = sticky.fills.at(0)
      const fills = fill
        ? [{ ...fill, type: 'SOLID' as const, color: { ...color } }, ...sticky.fills.slice(1)]
        : [{ type: 'SOLID' as const, color: { ...color }, opacity: 1, visible: true }]
      ctx.graph.updateNode(sticky.id, { fills })
    })
  }

  /** Sets the size of the notes' body text to one of FigJam's presets, in the body's typeface. */
  function setStickyTextSize(ids: Iterable<string>, size: FigJamTextSize) {
    editStickies('Change sticky text size', ids, (sticky) => {
      const body = stickySublayers(ctx.graph, sticky)?.body
      if (body) {
        ctx.graph.updateNode(body.id, figJamTextSizeFields(size, figJamTypeface(body) ?? 'simple'))
      }
    })
  }

  /** Shows or hides the notes' author lines. */
  function setStickyAuthorVisible(ids: Iterable<string>, visible: boolean) {
    editStickies(visible ? 'Show sticky author' : 'Hide sticky author', ids, (sticky) => {
      const author = stickySublayers(ctx.graph, sticky)?.author
      if (author) ctx.graph.updateNode(author.id, { visible })
    })
  }

  /**
   * Scales the note `id`, its text and spacing included, and places its top-left at `position`,
   * as dragging a FigJam note's corner does.
   */
  function scaleStickyNote(id: string, scale: number, position: Vector) {
    if (ctx.graph.getNode(id)?.type !== 'STICKY') return
    recordSubtreeEdit(ctx, 'Scale sticky', id, () => {
      rescaleNodeTree(ctx.graph, id, scale)
      ctx.graph.updateNode(id, { x: position.x, y: position.y })
    })
  }

  /**
   * Makes the note `id` wide or square at its scale, keeping the edge on the `anchor` side in
   * place, as dragging a FigJam note's side does.
   */
  function setStickyWide(id: string, wide: boolean, anchor: 'left' | 'right' = 'left') {
    const sticky = ctx.graph.getNode(id)
    if (sticky?.type !== 'STICKY') return
    const scale = stickyScale(stickySublayers(ctx.graph, sticky)?.author)
    const width = stickyWidth(scale, wide)
    if (width === sticky.width) return
    const x = anchor === 'right' ? sticky.x + sticky.width - width : sticky.x
    recordSubtreeEdit(ctx, wide ? 'Make sticky wide' : 'Make sticky square', id, () => {
      ctx.graph.updateNode(id, { x, width })
    })
  }

  return {
    setStickyWide,
    createStickyNote,
    setStickyColor,
    setStickyTextSize,
    setStickyAuthorVisible,
    scaleStickyNote
  }
}
