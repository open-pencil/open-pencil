import type { Fill, SceneNode, WindingRule } from '@open-pencil/scene-graph'
import {
  fillGeometryMatchesRegions,
  hasRegionFills,
  regionSVGPaths
} from '@open-pencil/scene-graph/vector-network'

import { drawnFills, solidFillOpacity, type SVGExportContext } from './defs'
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
function paintedOutline(
  node: SceneNode,
  attrs: Record<string, string | number | undefined>,
  ctx: SVGExportContext,
  pathFills: Fill[] | undefined
): SVGNode[] {
  if (!pathFills) return [svg('path', attrs)]
  const drawn = drawnFills(
    pathFills.filter((fill) => fill.visible),
    node,
    ctx
  )
  if (drawn.length === 0) return [svg('path', { ...attrs, fill: 'none' })]
  return drawn.map(({ fill, paint }, index) =>
    svg('path', {
      ...attrs,
      fill: paint,
      'fill-opacity': solidFillOpacity(fill, ctx.colorSpace),
      stroke: index === drawn.length - 1 ? attrs.stroke : 'none'
    })
  )
}

/**
 * Filled outlines, each painted with its own paints or `fallbackFills`. A later outline's fill
 * would cover an earlier one's stroke, so with several the strokes go after every fill, as the
 * canvas draws them.
 */
export function outlineElements(
  node: SceneNode,
  outlines: readonly FillOutline[],
  common: Record<string, string | number | undefined>,
  ctx: SVGExportContext,
  fallbackFills: Fill[] | undefined
): SVGNode[] {
  const shape = (outline: FillOutline) => ({
    d: outline.d,
    'fill-rule': outline.windingRule === 'EVENODD' ? 'evenodd' : undefined
  })
  const strokesLater = outlines.length > 1 && !!common.stroke && common.stroke !== 'none'
  const fillCommon = strokesLater ? { ...common, stroke: 'none' } : common
  const fills = outlines.flatMap((outline) =>
    paintedOutline(node, { ...shape(outline), ...fillCommon }, ctx, outline.fills ?? fallbackFills)
  )
  if (!strokesLater) return fills
  const strokes = outlines.map((outline) =>
    svg('path', { ...shape(outline), ...common, fill: 'none', 'fill-opacity': undefined })
  )
  return [...fills, ...strokes]
}
