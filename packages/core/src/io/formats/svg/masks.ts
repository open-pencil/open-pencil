import type { SceneNode } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph/coordinate'
import { unionVisualBounds, type VisualBounds } from '@open-pencil/scene-graph/geometry'
import { isVisibleMask, maskRuns } from '@open-pencil/scene-graph/masks'

import { subtreeRenderBounds } from '#core/geometry/render-bounds'

import { nextDefId, type SVGExportContext } from './defs'
import { svgElement, type SVGNode } from './node'
import { round } from './paths'

type RenderSVGChild = (node: SceneNode, ctx: SVGExportContext) => SVGNode | null

function maskRunBounds(masks: readonly SceneNode[], ctx: SVGExportContext): VisualBounds | null {
  let bounds: VisualBounds | null = null
  for (const mask of masks) {
    bounds = unionVisualBounds(
      bounds,
      subtreeRenderBounds(ctx.graph, mask, getNodeLocalMatrix(mask), { reach: 'drawn' })
    )
  }
  return bounds
}

export function renderMaskedChildren(
  childNodes: readonly SceneNode[],
  ctx: SVGExportContext,
  renderNode: RenderSVGChild
): SVGNode[] {
  const out: SVGNode[] = []
  let next = 0
  for (const run of maskRuns(childNodes, isVisibleMask)) {
    for (; next < run.start; next++) {
      const rendered = renderNode(childNodes[next], ctx)
      if (rendered) out.push(rendered)
    }
    next = run.end
    if (run.maskedStart === run.end) continue

    const maskedContent: SVGNode[] = []
    for (const sibling of childNodes.slice(run.maskedStart, run.end)) {
      const rendered = renderNode(sibling, ctx)
      if (rendered) maskedContent.push(rendered)
    }
    if (maskedContent.length === 0) continue

    const masks = childNodes.slice(run.start, run.maskedStart)
    const maskElements: SVGNode[] = []
    for (const mask of masks) {
      const maskCtx: SVGExportContext =
        mask.maskType === 'VECTOR' && !ctx.inVectorMask ? { ...ctx, inVectorMask: true } : ctx
      // A mask's opacity and blur reach what it masks, while its blend mode does not.
      const rendered = renderNode({ ...mask, blendMode: 'PASS_THROUGH' }, maskCtx)
      if (rendered) maskElements.push(rendered)
    }
    if (maskElements.length === 0) continue

    const maskId = nextDefId(ctx, 'mask')
    const isLuminance = masks.some((mask) => mask.maskType === 'LUMINANCE')
    const bounds = maskRunBounds(masks, ctx)
    const boundsAttrs = bounds
      ? {
          x: round(bounds.minX),
          y: round(bounds.minY),
          width: round(Math.max(0, bounds.maxX - bounds.minX)),
          height: round(Math.max(0, bounds.maxY - bounds.minY))
        }
      : {}
    ctx.defs.push(
      svgElement(
        'mask',
        {
          id: maskId,
          style: `mask-type:${isLuminance ? 'luminance' : 'alpha'}`,
          maskUnits: 'userSpaceOnUse',
          ...boundsAttrs
        },
        maskElements
      )
    )
    out.push(svgElement('g', { mask: `url(#${maskId})` }, maskedContent))
  }
  for (; next < childNodes.length; next++) {
    const rendered = renderNode(childNodes[next], ctx)
    if (rendered) out.push(rendered)
  }
  return out
}
