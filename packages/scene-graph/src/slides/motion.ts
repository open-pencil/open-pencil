import { compact } from 'es-toolkit/array'

import type { SceneGraph } from '../graph'
import type { SceneNode } from '../types'
import { easingPreset } from '../variables/easing'
import {
  mapMotionVariables,
  motionVariableIds,
  resolveMotion,
  resolveTiming,
  type ResolvedMotion
} from '../variables/motion'
import type { LayerAnimation, SlideTransition, SlideTransitionStyle } from './types'

/** The transition a slide starts with when one is added. */
export function defaultSlideTransition(): SlideTransition {
  return {
    style: 'DISSOLVE',
    duration: 0.3,
    easing: easingPreset('OUT_CUBIC'),
    timing: { type: 'ON_CLICK' }
  }
}

/** Figma's curve for layer animations, which its panel does not offer to change. */
const LAYER_ANIMATION_BEZIER = { x1: 0.17, y1: 0, x2: 0.2, y2: 1 }

/** The animation a layer starts with when one is added, as in Figma: it slides in from the left. */
export function defaultLayerAnimation(order: number): LayerAnimation {
  return {
    style: 'SLIDE_FROM_LEFT',
    phase: 'IN',
    trigger: 'ON_CLICK',
    duration: 0.6,
    easing: { easing: 'CUSTOM_CUBIC', bezier: { ...LAYER_ANIMATION_BEZIER } },
    order
  }
}

/** A slide's transition as it plays, with its variables read for the slide. */
export interface ResolvedSlideTransition extends ResolvedMotion {
  style: SlideTransitionStyle
  /** Seconds before the deck moves on by itself, or null when it waits for the presenter. */
  delay: number | null
}

export function resolveSlideTransition(
  graph: SceneGraph,
  slide: SceneNode
): ResolvedSlideTransition | null {
  const transition = slide.slide?.transition
  if (!transition) return null
  const { timing } = transition
  return {
    style: transition.style,
    ...resolveMotion(graph, transition, slide.id),
    delay:
      timing.type === 'AFTER_DELAY'
        ? resolveTiming(graph, timing.delayVariableId, slide.id, timing.delay)
        : null
  }
}

/** The variables a layer's slide transition and animation follow. */
export function slideVariableIds(node: Pick<SceneNode, 'slide' | 'animation'>): string[] {
  const transition = node.slide?.transition
  return [
    ...(transition ? motionVariableIds(transition) : []),
    ...compact([transition?.timing.type === 'AFTER_DELAY' && transition.timing.delayVariableId]),
    ...(node.animation ? motionVariableIds(node.animation) : [])
  ]
}

/**
 * A layer's slide transition and animation following other variables, as a copy into another
 * document names them; a variable `map` gives nothing for is let go, keeping the value.
 */
export function mapSlideVariables(
  node: Pick<SceneNode, 'slide' | 'animation'>,
  map: (variableId: string) => string | undefined
): Pick<SceneNode, 'slide' | 'animation'> {
  const transition = node.slide?.transition
  let slide = node.slide && structuredClone(node.slide)
  if (slide && transition) {
    const mapped = mapMotionVariables(transition, map)
    if (transition.timing.type === 'AFTER_DELAY') {
      const { delayVariableId, ...timing } = transition.timing
      const delay = delayVariableId === undefined ? undefined : map(delayVariableId)
      mapped.timing = delay === undefined ? timing : { ...timing, delayVariableId: delay }
    }
    slide = { ...slide, transition: mapped }
  }
  return { slide, animation: node.animation && mapMotionVariables(node.animation, map) }
}

/** A layer's animation, with the layer it moves. */
export interface AnimatedLayer {
  id: string
  animation: LayerAnimation
}

/**
 * A step of a slide's build: its layers' animations, one after another. A step waits for the
 * presenter, except a first one made only of `AFTER_PREVIOUS` animations, which plays as the slide
 * appears.
 */
export interface BuildStep {
  onClick: boolean
  layers: AnimatedLayer[]
}

/** The animated layers of a slide, in the order they play: by `order`, then by layer order. */
export function animatedLayers(graph: SceneGraph, slideId: string): AnimatedLayer[] {
  const layers: AnimatedLayer[] = []
  const visit = (id: string) => {
    for (const child of graph.getChildren(id)) {
      if (child.animation) layers.push({ id: child.id, animation: child.animation })
      visit(child.id)
    }
  }
  visit(slideId)
  // Array sort is stable, so equal orders keep layer order.
  return layers.sort((a, b) => a.animation.order - b.animation.order)
}

/** A slide's build: its animations grouped into the steps a presenter clicks through. */
export function slideBuild(graph: SceneGraph, slideId: string): BuildStep[] {
  const steps: BuildStep[] = []
  for (const layer of animatedLayers(graph, slideId)) {
    const last = steps.at(-1)
    if (layer.animation.trigger === 'AFTER_PREVIOUS' && last) last.layers.push(layer)
    else steps.push({ onClick: layer.animation.trigger === 'ON_CLICK', layers: [layer] })
  }
  return steps
}

/**
 * The slide a layer animates on, or undefined for a layer that cannot have an animation: one on no
 * slide, a slide itself, or a layer inside an instance, whose component gives it its fields.
 */
export function animationSlide(graph: SceneGraph, layerId: string): SceneNode | undefined {
  const node = graph.getNode(layerId)
  if (!node?.parentId || node.type === 'SLIDE') return undefined
  if (graph.closest(node.parentId, (item) => item.type === 'INSTANCE')) return undefined
  return graph.closest(node.parentId, (item) => item.type === 'SLIDE') ?? undefined
}

/**
 * The layer an animation for `layerId` goes on, as Figma's Animate panel picks it: the layer
 * itself, or for a layer inside an instance the outermost instance on the slide, which Figma
 * animates instead. Undefined for a layer on no slide, or a slide.
 */
export function animationTarget(graph: SceneGraph, layerId: string): string | undefined {
  const node = graph.getNode(layerId)
  if (!node || node.type === 'SLIDE') return undefined
  let target = layerId
  let id = node.parentId
  // A parent cycle in bad data ends the walk.
  const seen = new Set<string>()
  while (id && !seen.has(id)) {
    seen.add(id)
    const parent = graph.getNode(id)
    if (!parent) return undefined
    if (parent.type === 'SLIDE') return target
    if (parent.type === 'INSTANCE') target = parent.id
    id = parent.parentId
  }
  return undefined
}
