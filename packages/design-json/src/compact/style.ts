import type { CompactStyle } from '#design-json/compact/types'
import { compact } from 'es-toolkit'

import type { Effect, Fill, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { colorToHex8 } from '@open-pencil/scene-graph/color'

/** A paint as one string: a solid's hex color, or the kind of paint it is otherwise. */
function describePaint(paint: Fill | Stroke): string {
  if (paint.type === 'SOLID') return colorToHex8(paint.color, paint.color.a * paint.opacity)
  return paint.type.toLowerCase()
}

/** The visible paints, except images, which the layer lists apart. */
export function visiblePaints(paints: readonly (Fill | Stroke)[]): string[] {
  return paints.filter((paint) => paint.visible && paint.type !== 'IMAGE').map(describePaint)
}

/** The first visible solid color among the paints, as a text's color. */
export function firstSolidColor(paints: readonly Fill[]): string | undefined {
  const solid = paints.find((paint) => paint.visible && paint.type === 'SOLID')
  return solid ? describePaint(solid) : undefined
}

function visibleEffects(effects: readonly Effect[]): string[] {
  return effects.filter((effect) => effect.visible).map((effect) => effect.type)
}

function describeBorder(node: SceneNode): CompactStyle['border'] {
  const colors = visiblePaints(node.strokes)
  if (colors.length === 0 || node.strokeWeight === 0) return undefined
  return { colors, width: node.strokeWeight }
}

/** Only what makes the layer look different from a plain one; undefined when nothing does. */
export function describeStyle(node: SceneNode, ownsFills: boolean): CompactStyle | undefined {
  const style: CompactStyle = {
    fills: ownsFills ? nonEmpty(visiblePaints(node.fills)) : undefined,
    border: describeBorder(node),
    radius: node.cornerRadius || undefined,
    opacity: node.opacity < 1 ? node.opacity : undefined,
    effects: nonEmpty(visibleEffects(node.effects)),
    clipsContent: node.clipsContent || undefined
  }
  return withoutUndefined(style)
}

function nonEmpty(values: string[]): string[] | undefined {
  return values.length > 0 ? values : undefined
}

function withoutUndefined(style: CompactStyle): CompactStyle | undefined {
  const entries = compact(
    Object.entries(style).map(([key, value]) => (value === undefined ? null : [key, value]))
  )
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}
