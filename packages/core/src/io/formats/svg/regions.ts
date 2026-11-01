import type { Fill, SceneNode, WindingRule } from '@open-pencil/scene-graph'
import {
  fillGeometryMatchesRegions,
  hasRegionFills,
  regionSVGPaths
} from '@open-pencil/scene-graph/vector-network'

import { resolveFill, solidFillOpacity, type SVGExportContext } from './defs'
import { svg, type SVGNode } from './node'
import { geometryBlobToSVGPath } from './paths'

/** An outline to fill and the paints of its own, if any. */
export interface FillOutline {
  d: string
  windingRule: WindingRule
  fills?: Fill[]
}

/** A vector's filled outlines, and whether they were traced from its network's regions. */
export interface FillOutlines {
  outlines: FillOutline[]
  traced: boolean
}

/**
 * A vector's filled outlines as the canvas draws them. Regions with paints of their own fill
 * their outlines from the fill geometry when it has one per region, or else their traced loops.
 */
export function fillOutlines(node: SceneNode): FillOutlines | null {
  const network = node.vectorNetwork
  if (network && hasRegionFills(network)) {
    const traced = !fillGeometryMatchesRegions(node.fillGeometry, network)
    const paths = traced
      ? regionSVGPaths(network)
      : node.fillGeometry.map((geometry) => geometryBlobToSVGPath(geometry.commandsBlob))
    const outlines = network.regions.flatMap((region, index) => {
      const d = paths[index]
      if (!d) return []
      const windingRule = traced ? region.windingRule : node.fillGeometry[index].windingRule
      return [{ d, windingRule, fills: region.fills }]
    })
    return { outlines, traced }
  }
  if (node.fillGeometry.length === 0) return null
  const outlines = node.fillGeometry.flatMap((geometry) => {
    const d = geometryBlobToSVGPath(geometry.commandsBlob)
    return d ? [{ d, windingRule: geometry.windingRule }] : []
  })
  return { outlines, traced: false }
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
