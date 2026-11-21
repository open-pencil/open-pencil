import type { SceneNode } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph/coordinate'
import { unionVisualBounds, type VisualBounds } from '@open-pencil/scene-graph/geometry'
import { isVisibleMask, maskRuns } from '@open-pencil/scene-graph/masks'

import { subtreeRenderBounds } from '#core/geometry/render-bounds'

import { nextDefId, type SVGExportContext } from './defs'
import { svg, svgElement, type SVGNode } from './node'
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

function renderLuminanceMaskMember(
  mask: SceneNode,
  rendered: SVGNode,
  ctx: SVGExportContext
): SVGNode {
  const filterId = nextDefId(ctx, 'maskLuma')
  const bounds = subtreeRenderBounds(ctx.graph, mask, getNodeLocalMatrix(mask), { reach: 'drawn' })
  const regionAttrs: Record<string, string | number> = bounds
    ? {
        x: round(bounds.minX),
        y: round(bounds.minY),
        width: round(Math.max(0, bounds.maxX - bounds.minX)),
        height: round(Math.max(0, bounds.maxY - bounds.minY)),
        filterUnits: 'userSpaceOnUse'
      }
    : {}
  ctx.defs.push(
    svgElement('filter', { id: filterId, ...regionAttrs, 'color-interpolation-filters': 'sRGB' }, [
      svg('feColorMatrix', { in: 'SourceGraphic', type: 'luminanceToAlpha', result: 'luma' }),
      // Skia scales luminance by the mask alpha once via premultiplied color and a second time
      // via DstIn, so half opacity reveals a quarter of what it masks.
      svg('feComposite', { in: 'luma', in2: 'SourceGraphic', operator: 'in' })
    ])
  )
  return svgElement('g', { filter: `url(#${filterId})` }, [rendered])
}

function renderMaskMember(
  mask: SceneNode,
  ctx: SVGExportContext,
  renderNode: RenderSVGChild
): SVGNode | null {
  const previousInVectorMask = ctx.inVectorMask
  if (mask.maskType === 'VECTOR') {
    ctx.inVectorMask = true
  }
  let rendered: SVGNode | null
  try {
    // A mask's opacity and blur reach what it masks, while its blend mode does not.
    rendered = renderNode({ ...mask, blendMode: 'PASS_THROUGH' }, ctx)
  } finally {
    ctx.inVectorMask = previousInVectorMask
  }
  if (!rendered) return null
  if (mask.maskType === 'LUMINANCE') {
    return renderLuminanceMaskMember(mask, rendered, ctx)
  }
  return rendered
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
      const rendered = renderMaskMember(mask, ctx, renderNode)
      if (rendered) maskElements.push(rendered)
    }
    if (maskElements.length === 0) continue

    const maskId = nextDefId(ctx, 'mask')
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
          style: 'mask-type:alpha',
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
