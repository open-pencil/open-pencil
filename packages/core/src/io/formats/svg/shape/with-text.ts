import type { SceneNode } from '@open-pencil/scene-graph'
import {
  SHAPE_WITH_TEXT_LINE_GAP,
  shapeWithTextCutsFill
} from '@open-pencil/scene-graph/shape-with-text'

import { nextDefId, type SVGExportContext } from '#core/io/formats/svg/defs'
import { svg, type SVGNode } from '#core/io/formats/svg/node'
import { shapeWithTextDetailsPath, shapeWithTextOutlinePath } from '#core/io/formats/svg/paths'

type Attrs = Record<string, string | number | undefined>

/**
 * A FigJam shape's outline, and its inner lines, such as a database's front rim, stroked as the
 * canvas strokes them: at the stroke's own weight, ending where the outline does. Without a
 * stroke that draws them, the lines are cut out of the fill instead, as the canvas cuts them.
 */
export function shapeWithTextElements(
  node: SceneNode,
  common: Attrs,
  strokeAttrs: Attrs,
  ctx: SVGExportContext
): SVGNode[] {
  const outline = shapeWithTextOutlinePath(node)
  const details = shapeWithTextCutsFill(node) ? shapeWithTextDetailsPath(node) : null
  let mask: string | undefined
  if (details) {
    const id = nextDefId(ctx, 'mask')
    ctx.defs.push(
      svg(
        'mask',
        { id },
        svg('path', { d: outline, fill: 'white' }),
        svg('path', {
          d: outline + details,
          fill: 'none',
          stroke: 'black',
          'stroke-width': SHAPE_WITH_TEXT_LINE_GAP
        })
      )
    )
    mask = `url(#${id})`
  }
  return [
    svg('path', { d: outline, ...common, mask }),
    ...shapeWithTextDetailElements(node, strokeAttrs, ctx)
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
