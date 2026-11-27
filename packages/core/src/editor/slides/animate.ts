import type { SceneNode } from '@open-pencil/scene-graph'
import {
  animatedLayers,
  animationSlide,
  defaultLayerAnimation,
  defaultSlideTransition,
  slideSettings,
  type LayerAnimation,
  type SlideTransition
} from '@open-pencil/scene-graph/slides'

import type { EditorContext } from '#core/editor/types'

type Field = 'animation'

/**
 * A slide's transition and its layers' animations, edited as the Animate tab edits them: each
 * call is one undo step that puts back exactly the values it changed.
 */
export function createSlideAnimateActions(ctx: EditorContext) {
  /** Writes each layer's new value of `field`, as one undo step; a layer left out keeps its own. */
  function write<F extends Field>(
    label: string,
    field: F,
    next: ReadonlyMap<string, SceneNode[F]>
  ): void {
    const before = new Map<string, SceneNode[F]>()
    for (const id of next.keys()) {
      const node = ctx.graph.getNode(id)
      if (node) before.set(id, node[field])
    }
    if (before.size === 0) return
    const apply = (values: ReadonlyMap<string, SceneNode[F]>) => {
      for (const [id, value] of values)
        if (ctx.graph.getNode(id)) ctx.graph.updateNode(id, { [field]: structuredClone(value) })
      ctx.requestRender()
    }
    apply(next)
    ctx.undo.push({ label, forward: () => apply(next), inverse: () => apply(before) })
  }

  function slidesOf(ids: Iterable<string>): SceneNode[] {
    return [...ids].flatMap((id) => {
      const node = ctx.graph.getNode(id)
      return node && slideSettings(node) ? [node] : []
    })
  }

  /**
   * Sets how the slides move on to the next one, or with null takes their transition away; a
   * function gives each slide's own from its current one, as an edit of one setting does. Only the
   * transition is recorded, so undo and redo leave notes or skipping someone changed meanwhile.
   */
  function setSlideTransition(
    ids: Iterable<string>,
    transition: SlideTransition | null | ((current: SlideTransition) => SlideTransition)
  ): void {
    const before = new Map<string, SlideTransition | null>()
    const after = new Map<string, SlideTransition | null>()
    for (const slide of slidesOf(ids)) {
      const current = slideSettings(slide)?.transition ?? null
      const value =
        typeof transition === 'function'
          ? transition(current ?? defaultSlideTransition())
          : transition
      before.set(slide.id, current)
      after.set(slide.id, value && structuredClone(value))
    }
    if (after.size === 0) return
    const apply = (values: ReadonlyMap<string, SlideTransition | null>) => {
      for (const [id, value] of values) {
        const node = ctx.graph.getNode(id)
        const settings = node && slideSettings(node)
        if (settings)
          ctx.graph.updateNode(id, { slide: { ...settings, transition: structuredClone(value) } })
      }
      ctx.requestRender()
    }
    apply(after)
    ctx.undo.push({
      label: transition === null ? 'Remove transition' : 'Set transition',
      forward: () => apply(after),
      inverse: () => apply(before)
    })
  }

  /** The order of a slide's last step, or -1 for a slide with none. */
  function lastStep(slideId: string): number {
    let last = -1
    for (const { animation } of animatedLayers(ctx.graph, slideId))
      last = Math.max(last, animation.order)
    return last
  }

  /** Layers in the order their slides show them, depth first, as the layers panel lists them. */
  function inLayerOrder(ids: Iterable<string>): string[] {
    const wanted = new Set(ids)
    const ordered: string[] = []
    const visit = (id: string) => {
      for (const child of ctx.graph.getChildren(id)) {
        if (wanted.has(child.id)) ordered.push(child.id)
        visit(child.id)
      }
    }
    const slides = new Set([...wanted].flatMap((id) => animationSlide(ctx.graph, id)?.id ?? []))
    for (const slide of slides) visit(slide)
    return ordered
  }

  /**
   * Animates layers that are not yet, each with Figma's default: slide in from the left on a
   * click, after the steps their slide has.
   */
  function addLayerAnimations(ids: Iterable<string>): void {
    const next = new Map<string, LayerAnimation | null>()
    const lastOrder = new Map<string, number>()
    for (const id of inLayerOrder(ids)) {
      const node = ctx.graph.getNode(id)
      const slide = animationSlide(ctx.graph, id)
      if (!node || node.animation || !slide) continue
      const last = lastOrder.get(slide.id) ?? lastStep(slide.id)
      lastOrder.set(slide.id, last + 1)
      next.set(id, defaultLayerAnimation(last + 1))
    }
    write('Add animation', 'animation', next)
  }

  /** Changes layers' animations, each from its current one; layers with none are left alone. */
  function setLayerAnimations(
    ids: Iterable<string>,
    change: (current: LayerAnimation) => LayerAnimation
  ): void {
    const next = new Map<string, LayerAnimation | null>()
    for (const id of ids) {
      const animation = ctx.graph.getNode(id)?.animation
      if (animation) next.set(id, change(animation))
    }
    write('Edit animation', 'animation', next)
  }

  function removeLayerAnimations(ids: Iterable<string>): void {
    const next = new Map<string, LayerAnimation | null>()
    for (const id of ids) if (ctx.graph.getNode(id)?.animation) next.set(id, null)
    write('Remove animation', 'animation', next)
  }

  /** Moves a layer's animation to `index` among its slide's steps, renumbering them all. */
  function moveLayerAnimation(id: string, index: number): void {
    const slide = animationSlide(ctx.graph, id)
    if (!slide) return
    const layers = animatedLayers(ctx.graph, slide.id)
    const from = layers.findIndex((layer) => layer.id === id)
    if (from === -1) return
    const [moved] = layers.splice(from, 1)
    layers.splice(Math.max(0, Math.min(index, layers.length)), 0, moved)
    const next = new Map<string, LayerAnimation | null>()
    for (const [order, layer] of layers.entries())
      if (layer.animation.order !== order) next.set(layer.id, { ...layer.animation, order })
    write('Reorder animations', 'animation', next)
  }

  return {
    setSlideTransition,
    addLayerAnimations,
    setLayerAnimations,
    removeLayerAnimations,
    moveLayerAnimation
  }
}
