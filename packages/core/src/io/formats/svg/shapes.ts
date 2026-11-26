import type { Fill, SceneNode, Stroke, VectorNetwork } from '@open-pencil/scene-graph'
import { nodeHasRadius, nodeHasSmoothCorners } from '@open-pencil/scene-graph/corners'
import { isDrawnPaint } from '@open-pencil/scene-graph/paints'
import { looseSegments, regionSVGPaths } from '@open-pencil/scene-graph/vector-network'
import { appendAll } from '@open-pencil/std/arrays'

import { normalizeDashPattern } from '#core/canvas/strokes/draw'
import { lineStrokePath } from '#core/canvas/strokes/line'
import { fittedDashPattern } from '#core/canvas/strokes/sides'

import { arrowHeadElements, openPathElements, vectorArrowHeads } from './arrows'
import { booleanOutlines } from './boolean/outline'
import type { SVGExportContext } from './defs'
import { svg, type SVGNode } from './node'
import {
  arcPath,
  boxOutlinePath,
  geometryBlobToSVGPath,
  makePolygonPoints,
  round,
  roundedPolygonPath,
  shapeWithTextOutlinePath
} from './paths'
import { fillOutlines, outlineElements } from './regions'
import { shapeWithTextDetailElements } from './strokes'

/**
 * A vector network's paths: its regions as they are traced, and its open segments as the canvas
 * strokes them, rounded and pulled back under their heads.
 */
function networkElements(
  node: SceneNode,
  network: VectorNetwork,
  common: Record<string, string | number | undefined>
): SVGNode[] {
  const regions = regionSVGPaths(network).map((d) => svg('path', { d, ...common }))
  if (looseSegments(network).length === 0) return regions
  return [...regions, ...openPathElements(node, network, common, looseSegments)]
}

type SVGAttrs = Record<string, string | number | undefined>

export function vectorShapeElements(
  node: SceneNode,
  common: SVGAttrs,
  strokeAttrs: SVGAttrs,
  ctx: SVGExportContext,
  fallbackFills?: Fill[]
): SVGNode[] {
  const elements: SVGNode[] = []
  const filled = fillOutlines(node)
  // Saved stroke geometry draws the stroke below, filled; stroking the fill too would paint it twice.
  const stroked =
    node.strokeGeometry.length > 0 && !!strokeAttrs.stroke && strokeAttrs.stroke !== 'none'
  const outline = stroked ? { ...common, stroke: 'none' } : common
  appendAll(elements, outlineElements(node, filled?.outlines ?? [], outline, ctx, fallbackFills))
  const network = node.vectorNetwork
  if (network && !filled) appendAll(elements, networkElements(node, network, common))
  // Traced regions leave the open segments, which the canvas strokes, to add here.
  else if (network && filled?.traced && looseSegments(network).length > 0)
    appendAll(elements, openPathElements(node, network, common, looseSegments))
  if (stroked) {
    for (const geo of node.strokeGeometry) {
      const d = geometryBlobToSVGPath(geo.commandsBlob)
      if (d) {
        elements.push(
          svg('path', {
            d,
            fill: strokeAttrs.stroke,
            'fill-opacity': strokeAttrs['stroke-opacity'],
            stroke: 'none'
          })
        )
      }
    }
  }
  if (node.vectorNetwork)
    appendAll(elements, vectorArrowHeads(node, node.vectorNetwork, strokeAttrs))
  return elements.length > 0
    ? elements
    : [svg('rect', { width: round(node.width), height: round(node.height), ...common })]
}

/** A line's dashes stretched along it as the canvas lays them, half a dash at each end. */
function lineDashAttrs(stroke: Stroke | undefined, length: number) {
  const fitted = fittedDashPattern(length, normalizeDashPattern(stroke?.dashPattern))
  if (!fitted) return {}
  return {
    'stroke-dasharray': fitted.intervals.map((size) => round(size)).join(' '),
    'stroke-dashoffset': round(fitted.offset)
  }
}

export function nodeShapeElements(
  node: SceneNode,
  fillAttr: string | null,
  fillOpacity: number | undefined,
  strokeAttrs: Record<string, string | number | undefined>,
  ctx: SVGExportContext
): SVGNode[] {
  const common: Record<string, string | number | undefined> = {
    fill: fillAttr ?? 'none',
    'fill-opacity': fillOpacity,
    ...strokeAttrs
  }

  switch (node.type) {
    case 'ELLIPSE': {
      // Saved geometry first, as the canvas and hit testing draw an ellipse.
      if (node.fillGeometry.length > 0) return vectorShapeElements(node, common, strokeAttrs, ctx)
      if (node.arcData) {
        return [svg('path', { d: arcPath(node), ...common })]
      }
      return [
        svg('ellipse', {
          cx: round(node.width / 2),
          cy: round(node.height / 2),
          rx: round(node.width / 2),
          ry: round(node.height / 2),
          ...common
        })
      ]
    }

    case 'LINE': {
      // Where the canvas strokes it: to one side of the line, with its caps inside its length.
      const stroke = node.strokes.find(isDrawnPaint)
      const {
        network,
        from: start,
        to: end
      } = lineStrokePath(node, stroke?.weight ?? 0, stroke?.cap ?? node.strokeCap)
      return [
        svg('line', {
          x1: round(start.x),
          y1: round(start.y),
          x2: round(end.x),
          y2: round(end.y),
          fill: 'none',
          ...strokeAttrs,
          ...lineDashAttrs(stroke, Math.hypot(end.x - start.x, end.y - start.y))
        }),
        ...arrowHeadElements(node, network, stroke, strokeAttrs)
      ]
    }

    case 'STAR':
    case 'POLYGON':
      return node.cornerRadius > 0
        ? [svg('path', { d: roundedPolygonPath(node), ...common })]
        : [svg('polygon', { points: makePolygonPoints(node), ...common })]

    case 'VECTOR':
      return vectorShapeElements(node, common, strokeAttrs, ctx)

    case 'SHAPE_WITH_TEXT':
      return shapeWithTextElements(node, common, strokeAttrs, ctx)

    case 'BOOLEAN_OPERATION': {
      const outlines = booleanOutlines(node, ctx)
      return outlines
        ? outlineElements(node, outlines, common, ctx, undefined)
        : [boxOutlineElement(node, common)]
    }

    default:
      return [boxOutlineElement(node, common)]
  }
}

/**
 * A box layer's outline as one element: a rect, a rect with `rx`/`ry` for one radius, or the
 * shared box path for independent or smoothed corners, so fills and clips follow the same edge.
 */
export function boxOutlineElement(
  node: SceneNode,
  attrs: Record<string, string | number | undefined>
): SVGNode {
  const width = round(node.width)
  const height = round(node.height)
  if (!nodeHasRadius(node)) return svg('rect', { width, height, ...attrs })
  if (node.independentCorners || nodeHasSmoothCorners(node)) {
    return svg('path', { d: boxOutlinePath(node), ...attrs })
  }
  // SVG clamps rx and ry to their own sides; the canvas keeps a too-large radius circular.
  const radius = round(Math.min(node.cornerRadius, node.width / 2, node.height / 2))
  return svg('rect', { width, height, rx: radius, ry: radius, ...attrs })
}

/**
 * A FigJam shape's outline, and its inner lines, such as a database's front rim, stroked as the
 * canvas strokes them: at the stroke's own weight, ending where the outline does.
 */
function shapeWithTextElements(
  node: SceneNode,
  common: Record<string, string | number | undefined>,
  strokeAttrs: Record<string, string | number | undefined>,
  ctx: SVGExportContext
): SVGNode[] {
  return [
    svg('path', { d: shapeWithTextOutlinePath(node), ...common }),
    ...shapeWithTextDetailElements(node, strokeAttrs, ctx)
  ]
}
