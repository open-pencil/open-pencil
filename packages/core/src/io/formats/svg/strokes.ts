import type { SceneNode, Stroke } from '@open-pencil/scene-graph'

import type { SVGExportContext } from './defs'
import { nextDefId } from './defs'
import { svg, type SVGNode } from './node'
import { nodeOutlinePath, round, shapeWithTextDetailsPath, shapeWithTextOutlinePath } from './paths'

type Attrs = Record<string, string | number | undefined>

/**
 * The closed outline an aligned stroke follows, as path data in the layer's box: a FigJam shape's,
 * an ellipse, polygon or star, or a box with its corners for any other layer. Null for lines,
 * arcs, and vectors, whose strokes the canvas centres on their paths.
 */
function closedOutlinePath(node: SceneNode): string | null {
  switch (node.type) {
    case 'LINE':
    case 'VECTOR':
    case 'BOOLEAN_OPERATION':
      return null
    case 'SHAPE_WITH_TEXT':
      return shapeWithTextOutlinePath(node)
    case 'ELLIPSE':
      return node.arcData ? null : nodeOutlinePath(node)
    case 'POLYGON':
    case 'STAR':
      return nodeOutlinePath(node)
    default:
      return nodeOutlinePath({ ...node, type: 'RECTANGLE' })
  }
}

/** The stroke an aligned stroke paints, when it is inside or outside a closed outline. */
export function alignedStroke(node: SceneNode, stroke: Stroke | undefined): Stroke | null {
  if (!stroke || stroke.align === 'CENTER') return null
  return closedOutlinePath(node) === null ? null : stroke
}

/**
 * A stroke inside or outside the layer's outline, as the canvas draws it: centred at twice its
 * weight and clipped to the outline, or to everything around it.
 */
export function alignedStrokeElement(
  node: SceneNode,
  stroke: Stroke,
  strokeAttrs: Attrs,
  ctx: SVGExportContext
): SVGNode[] {
  const outline = closedOutlinePath(node)
  if (outline === null) return []
  const clipId = nextDefId(ctx, 'clip')
  if (stroke.align === 'INSIDE') {
    ctx.defs.push(svg('clipPath', { id: clipId }, svg('path', { d: outline })))
  } else {
    // A box wide enough for the stroke, its mitred tips included, with the outline cut out of it.
    // The doubled stroke mitres out to its weight times the miter limit.
    const margin = stroke.weight * Math.max(2, node.strokeMiterLimit)
    const left = round(-margin)
    const top = round(-margin)
    const right = round(node.width + margin)
    const bottom = round(node.height + margin)
    const around = `M${left} ${top}H${right}V${bottom}H${left}Z`
    ctx.defs.push(
      svg('clipPath', { id: clipId }, svg('path', { d: around + outline, 'clip-rule': 'evenodd' }))
    )
  }
  return [
    svg('path', {
      d: outline,
      fill: 'none',
      ...strokeAttrs,
      'stroke-width': round(stroke.weight * 2),
      'clip-path': `url(#${clipId})`
    })
  ]
}

/**
 * A FigJam shape's inner lines, such as a database's front rim, stroked as the canvas strokes
 * them: at the stroke's own weight whatever its alignment, ending where the outline does.
 */
export function shapeWithTextDetailElements(
  node: SceneNode,
  strokeAttrs: Attrs,
  ctx: SVGExportContext
): SVGNode[] {
  const details = strokeAttrs.stroke ? shapeWithTextDetailsPath(node) : null
  if (!details) return []
  const clipId = nextDefId(ctx, 'clip')
  ctx.defs.push(svg('clipPath', { id: clipId }, svg('path', { d: shapeWithTextOutlinePath(node) })))
  return [svg('path', { d: details, fill: 'none', ...strokeAttrs, 'clip-path': `url(#${clipId})` })]
}
