import type { CompactColor, CompactStyle } from '#design-json/compact/types'
import { compact } from 'es-toolkit'

import type { Effect, Fill, SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { colorToHex8 } from '@open-pencil/scene-graph/color'

type PaintField = 'fills' | 'strokes'

/** The name of the variable the layer binds a paint's color to, by the paint's index. */
function paintVariable(
  graph: SceneGraph,
  node: SceneNode,
  field: PaintField,
  index: number
): string | undefined {
  const id = node.boundVariables[`${field}/${index}/color`]
  return id ? (graph.variables.get(id)?.name ?? id) : undefined
}

/** A paint: a solid's hex color, or the kind of paint it is otherwise, and its variable's name. */
function describePaint(paint: Fill | Stroke, name: string | undefined): CompactColor {
  const value =
    paint.type === 'SOLID'
      ? colorToHex8(paint.color, paint.color.a * paint.opacity)
      : paint.type.toLowerCase()
  return name ? { value, name } : { value }
}

/** The visible paints, except images, which the layer lists apart. */
export function visiblePaints(
  graph: SceneGraph,
  node: SceneNode,
  field: PaintField
): CompactColor[] {
  const paints: readonly (Fill | Stroke)[] = node[field]
  return paints.flatMap((paint, index) =>
    paint.visible && paint.type !== 'IMAGE'
      ? [describePaint(paint, paintVariable(graph, node, field, index))]
      : []
  )
}

/** The first visible solid color among the fills, as a text's color. */
export function firstSolidColor(graph: SceneGraph, node: SceneNode): CompactColor | undefined {
  const index = node.fills.findIndex((paint) => paint.visible && paint.type === 'SOLID')
  if (index === -1) return undefined
  return describePaint(node.fills[index], paintVariable(graph, node, 'fills', index))
}

function visibleEffects(effects: readonly Effect[]): string[] {
  return effects.filter((effect) => effect.visible).map((effect) => effect.type)
}

function describeBorder(graph: SceneGraph, node: SceneNode): CompactStyle['border'] {
  const colors = visiblePaints(graph, node, 'strokes')
  if (colors.length === 0 || node.strokeWeight === 0) return undefined
  return { colors, width: node.strokeWeight }
}

/** Only what makes the layer look different from a plain one; undefined when nothing does. */
export function describeStyle(
  graph: SceneGraph,
  node: SceneNode,
  ownsFills: boolean
): CompactStyle | undefined {
  const style: CompactStyle = {
    fills: ownsFills ? nonEmpty(visiblePaints(graph, node, 'fills')) : undefined,
    border: describeBorder(graph, node),
    radius: node.cornerRadius || undefined,
    opacity: node.opacity < 1 ? node.opacity : undefined,
    effects: nonEmpty(visibleEffects(node.effects)),
    clipsContent: node.clipsContent || undefined
  }
  return withoutUndefined(style)
}

function nonEmpty<T>(values: T[]): T[] | undefined {
  return values.length > 0 ? values : undefined
}

function withoutUndefined(style: CompactStyle): CompactStyle | undefined {
  const entries = compact(
    Object.entries(style).map(([key, value]) => (value === undefined ? null : [key, value]))
  )
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}
