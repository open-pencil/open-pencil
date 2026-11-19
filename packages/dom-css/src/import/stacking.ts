import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { parseCSSNumber } from '@open-pencil/scene-graph/css'

import type { DesignStyleDeclaration } from '../types'
import { pickStyle } from './css-values'
import type { FlowBlock } from './flow'

/** A child the parent paints out of tree order, by its `z-index`. */
interface StackedChild {
  id: string
  z: number
}

/**
 * A container whose positioned children paint in `z-index` order, recorded when its children are
 * made and applied once layout has sized them, by `applyStacking`.
 */
export interface Stacking {
  parentId: string
  /** Whether the parent is a stacking context, which keeps negative layers above its background. */
  isContext: boolean
  children: StackedChild[]
}

/** Stacking orders by the container each is for. */
export type Stackings = Stacking[]

function isPositioned(style: DesignStyleDeclaration): boolean {
  const position = pickStyle(style, 'position')?.trim()
  return position !== undefined && position !== 'static'
}

/** A positioned box's `z-index`, or null for `auto` and for a box that is not positioned. */
function zIndexOf(style: DesignStyleDeclaration): number | null {
  if (!isPositioned(style)) return null
  const z = parseCSSNumber(pickStyle(style, 'z-index'))
  return z !== null && Number.isInteger(z) ? z : null
}

/** Whether a box starts a stacking context of its own, as CSS decides it for the common cases. */
function formsStackingContext(style: DesignStyleDeclaration): boolean {
  const value = (property: string) => pickStyle(style, property)?.trim()
  const position = value('position')
  const opacity = parseCSSNumber(value('opacity'))
  return (
    zIndexOf(style) !== null ||
    position === 'fixed' ||
    position === 'sticky' ||
    (opacity !== null && opacity < 1) ||
    (value('transform') ?? 'none') !== 'none' ||
    (value('filter') ?? 'none') !== 'none' ||
    value('isolation') === 'isolate' ||
    (value('mix-blend-mode') ?? 'normal') !== 'normal'
  )
}

/**
 * The paint order a container's children have by their `z-index`, or null when none has one. Only
 * children out of the flow move, absolutely positioned ones or any in a container without auto
 * layout, so the order of the flow is kept.
 */
export function stackingOf(
  node: SceneNode,
  style: DesignStyleDeclaration,
  parts: readonly FlowBlock[]
): Stacking | null {
  const children: StackedChild[] = []
  for (const { layer, style: childStyle } of parts) {
    const z = zIndexOf(childStyle)
    const movable = layer.layoutPositioning === 'ABSOLUTE' || node.layoutMode === 'NONE'
    if (z !== null && z !== 0 && movable) children.push({ id: layer.id, z })
  }
  if (children.length === 0) return null
  return { parentId: node.id, isContext: formsStackingContext(style), children }
}

/**
 * Puts each container's children in the order CSS paints them: negative layers first, lowest
 * first, then the rest as they were, then positive ones, lowest first. A container that is not a
 * stacking context paints its negative layers under its own background, which a layer's fills
 * cannot go under, so its fills move to a layer of their own above those children.
 */
export function applyStacking(graph: SceneGraph, stackings: Stackings): void {
  for (const { parentId, isContext, children } of stackings) {
    const parent = graph.getNode(parentId)
    if (!parent) continue
    const below = children.filter((child) => child.z < 0).toSorted((a, b) => a.z - b.z)
    const above = children.filter((child) => child.z > 0).toSorted((a, b) => a.z - b.z)
    const moved = new Set(children.map((child) => child.id))
    const order = [
      ...below.map((child) => child.id),
      ...parent.childIds.filter((id) => !moved.has(id)),
      ...above.map((child) => child.id)
    ]
    for (const [index, id] of order.entries()) graph.insertChildAt(id, parentId, index)
    if (below.length > 0 && !isContext) liftBackground(graph, parent, below.length)
  }
}

/** Moves a container's fills into a layer of its own at `index`, its size and corners. */
function liftBackground(graph: SceneGraph, parent: SceneNode, index: number): void {
  if (!parent.fills.some((fill) => fill.visible)) return
  const background = graph.createNode('RECTANGLE', parent.id, {
    name: 'background',
    x: 0,
    y: 0,
    width: parent.width,
    height: parent.height,
    fills: parent.fills,
    cornerRadius: parent.cornerRadius,
    topLeftRadius: parent.topLeftRadius,
    topRightRadius: parent.topRightRadius,
    bottomRightRadius: parent.bottomRightRadius,
    bottomLeftRadius: parent.bottomLeftRadius,
    independentCorners: parent.independentCorners,
    layoutPositioning: parent.layoutMode === 'NONE' ? 'AUTO' : 'ABSOLUTE'
  })
  graph.insertChildAt(background.id, parent.id, index)
  graph.updateNode(parent.id, { fills: [] })
}
