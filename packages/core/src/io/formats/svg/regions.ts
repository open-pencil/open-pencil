import type { Fill, SceneNode, WindingRule } from '@open-pencil/scene-graph'
import { hasRegionFills, regionSVGPaths } from '@open-pencil/scene-graph/vector-network'

import { resolveFill, solidFillOpacity, type SVGExportContext } from './defs'
import { svg, type SVGNode } from './node'
import { geometryBlobToSVGPath } from './paths'

/** An outline to fill and the paints of its own, if any. */
export interface FillOutline {
  d: string
  windingRule: WindingRule
  fills?: Fill[]
}

/**
 * A vector's filled outlines with their region's paints: its fill geometry, one outline per
 * region; or, for a pasted vector with region paints and no fill geometry, its traced regions.
 */
export function fillOutlines(node: SceneNode): FillOutline[] | null {
  const regions = node.vectorNetwork?.regions ?? []
  if (node.fillGeometry.length > 0) {
    const regionGeometry = node.fillGeometry.length === regions.length
    return node.fillGeometry.flatMap((geometry, index) => {
      const d = geometryBlobToSVGPath(geometry.commandsBlob)
      if (!d) return []
      const fills = regionGeometry ? regions[index].fills : undefined
      return [{ d, windingRule: geometry.windingRule, fills }]
    })
  }
  if (!node.vectorNetwork || !hasRegionFills(node.vectorNetwork)) return null
  return regionSVGPaths(node.vectorNetwork).map((d, index) => ({
    d,
    windingRule: regions[index].windingRule,
    fills: regions[index].fills
  }))
}

/** An outline painted once per visible paint, the last one carrying the stroke. */
export function paintedOutline(
  node: SceneNode,
  attrs: Record<string, string | number | undefined>,
  ctx: SVGExportContext,
  pathFills: Fill[] | undefined
): SVGNode[] {
  if (!pathFills) return [svg('path', attrs)]
  const visibleFills = pathFills.filter((fill) => fill.visible)
  if (visibleFills.length === 0) return [svg('path', { ...attrs, fill: 'none' })]
  return visibleFills.flatMap((fill, index) => {
    const fillAttr = resolveFill(fill, node, ctx)
    if (!fillAttr) return []
    return [
      svg('path', {
        ...attrs,
        fill: fillAttr,
        'fill-opacity': solidFillOpacity(fill, ctx.colorSpace),
        stroke: index === visibleFills.length - 1 ? attrs.stroke : 'none'
      })
    ]
  })
}
