import { convertFills, fillToKiwiPaint } from '@open-pencil/fig/node-change'
import type { Fill, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { copyFills } from '@open-pencil/scene-graph/copy'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { CANVAS_BG_COLOR } from '#core/constants'

function isColor(value: unknown): value is Color {
  if (!value || typeof value !== 'object') return false
  const color = value as Partial<Color>
  return (
    typeof color.r === 'number' &&
    typeof color.g === 'number' &&
    typeof color.b === 'number' &&
    typeof color.a === 'number'
  )
}

function fallbackBackground(page: SceneNode): Fill[] {
  const rawColor = page.source.fig.rawNodeFields.backgroundColor
  const color = isColor(rawColor) ? structuredClone(rawColor) : { ...CANVAS_BG_COLOR }
  return [{ type: 'SOLID', color, opacity: 1, visible: true, blendMode: 'NORMAL' }]
}

export function getPageBackgrounds(page: SceneNode): readonly Fill[] {
  const rawPaints = page.source.fig.rawNodeFields.backgroundPaints
  const fills = Array.isArray(rawPaints)
    ? convertFills(rawPaints as Parameters<typeof convertFills>[0])
    : fallbackBackground(page)
  return Object.freeze(copyFills(fills))
}

export function setPageBackgrounds(
  graph: SceneGraph,
  page: SceneNode,
  backgrounds: readonly Fill[]
): void {
  if (page.type !== 'CANVAS') throw new Error('backgrounds is only supported on pages')
  if (backgrounds.length > 1 || backgrounds.some((paint) => paint.type !== 'SOLID')) {
    throw new Error('Page backgrounds currently support at most one solid paint')
  }

  const rawNodeFields = structuredClone(page.source.fig.rawNodeFields)
  rawNodeFields.backgroundPaints = backgrounds.map((fill) => fillToKiwiPaint(fill))
  if (backgrounds[0]) rawNodeFields.backgroundColor = structuredClone(backgrounds[0].color)
  graph.updateNode(page.id, {
    source: {
      ...structuredClone(page.source),
      fig: { ...structuredClone(page.source.fig), rawNodeFields }
    }
  })
}
