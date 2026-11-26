import { noop } from 'es-toolkit'

import type { SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import {
  collectResizeDescendants,
  computeConstrainedResizeChanges,
  type ResizeSnapshot
} from '@open-pencil/scene-graph/resize'

import { scaleLayers } from '#core/editor/structure/scale'
import type { EditorContext } from '#core/editor/types'

type Size = Pick<SceneNode, 'width' | 'height'>

/** What a new size does to what is on a slide. */
export type SlideContentFit = 'scale' | 'constraints'

/**
 * Resizing a deck's slides. Its layers either scale evenly to fit and stay centred, as the Scale
 * tool scales them, or keep their size and follow their constraints, as in a resized frame.
 */
export function createSlideSizeActions(ctx: EditorContext, zoomToFit: () => void) {
  function write(id: string, size: Size, children: ReadonlyMap<string, Partial<SceneNode>>) {
    ctx.graph.updateNode(id, { ...size })
    for (const [childId, changes] of children) {
      if (ctx.graph.getNode(childId)) ctx.graph.updateNode(childId, changes)
    }
    ctx.runLayoutForNode(id)
  }

  /** Each layer of a resized slide where its constraints put it, as one undo entry. */
  function resizeByConstraints(slide: SceneNode, size: Size): void {
    const before = { width: slide.width, height: slide.height }
    const originals: ReadonlyMap<string, ResizeSnapshot> =
      collectResizeDescendants(ctx.graph, slide.id) ?? new Map()
    const apply = () => {
      write(slide.id, size, new Map())
      write(
        slide.id,
        size,
        computeConstrainedResizeChanges(ctx.graph, slide.id, before, size, originals)
      )
    }
    apply()
    ctx.undo.push({
      label: 'Resize slide',
      forward: apply,
      // Constraint math rounds and clamps, so only the snapshot puts the layers back exactly.
      inverse: () => write(slide.id, before, originals)
    })
  }

  /** The slide's layers scaled evenly to fit, centred in the new size, as one undo entry. */
  function resizeByScale(slide: SceneNode, size: Size): void {
    const before = { width: slide.width, height: slide.height }
    const factor = Math.min(size.width / slide.width, size.height / slide.height)
    const layers = ctx.graph.getChildren(slide.id)
    scaleLayers(ctx, layers, factor, ctx.graph.getAbsolutePosition(slide.id))
    const shift: Vector = {
      x: (size.width - before.width * factor) / 2,
      y: (size.height - before.height * factor) / 2
    }
    const moved = (sign: 1 | -1) =>
      new Map(
        layers.flatMap(({ id }) => {
          const node = ctx.graph.getNode(id)
          if (!node || node.locked) return []
          return [[id, { x: node.x + sign * shift.x, y: node.y + sign * shift.y }]]
        })
      )
    write(slide.id, size, moved(1))
    ctx.undo.push({
      label: 'Resize slide',
      forward: () => write(slide.id, size, moved(1)),
      inverse: () => write(slide.id, before, moved(-1))
    })
  }

  /**
   * Gives slides a new size as one undo step, fitting what is on them by `fit`; slides already at
   * that size are left alone.
   */
  function setSlideSize(ids: Iterable<string>, size: Size, fit: SlideContentFit): void {
    if (!(size.width >= 1 && size.height >= 1)) return
    const slides = [...ids].flatMap((id) => {
      const node = ctx.graph.getNode(id)
      return node?.type === 'SLIDE' && (node.width !== size.width || node.height !== size.height)
        ? [node]
        : []
    })
    if (slides.length === 0) return
    const grid = slides[0].parentId ? ctx.graph.getNode(slides[0].parentId)?.parentId : undefined
    const relayout = () => {
      if (grid) ctx.runLayoutForNode(grid)
      ctx.requestRender()
    }
    // The slide on the stage fills it again after the resize, and after its undo and redo, when
    // it is one of those resized then.
    const resized = new Set(slides.map(({ id }) => id))
    const settle = () => {
      relayout()
      const staged = ctx.state.focusedSlideId
      if (staged !== null && resized.has(staged)) zoomToFit()
    }
    ctx.undo.runBatch('Resize slides', () => {
      // Undo replays the batch backwards, so this entry settles the deck once the sizes are back.
      ctx.undo.push({ label: 'Fit slide', forward: noop, inverse: settle })
      for (const slide of slides) {
        if (fit === 'scale') resizeByScale(slide, size)
        else resizeByConstraints(slide, size)
      }
      ctx.undo.push({ label: 'Fit slide', forward: settle, inverse: noop })
    })
    settle()
  }

  return { setSlideSize }
}
