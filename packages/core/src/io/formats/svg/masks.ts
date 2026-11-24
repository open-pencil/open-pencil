import type { SceneNode } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph/coordinate'
import { unionVisualBounds, type VisualBounds } from '@open-pencil/scene-graph/geometry'
import { asMaskShape, isVisibleMask, maskRuns } from '@open-pencil/scene-graph/masks'
import { isLayerContainer } from '@open-pencil/scene-graph/node-defaults'

import { subtreeRenderBounds } from '#core/geometry/render-bounds'

import { defRegion, nextDefId, type SVGExportContext } from './defs'
import { svg, svgElement, type SVGNode } from './node'

type RenderSVGChild = (node: SceneNode, ctx: SVGExportContext) => SVGNode | null

function maskBounds(mask: SceneNode, ctx: SVGExportContext): VisualBounds | null {
  return subtreeRenderBounds(ctx.graph, mask, getNodeLocalMatrix(mask), { reach: 'drawn' })
}

/**
 * A luminance mask as the alpha it masks with. The canvas takes Skia's luma of the premultiplied
 * color and masks with the layer once more, so half opacity reveals a quarter of what it masks.
 * `luminanceToAlpha` reads the color before alpha, so the layer's alpha goes in twice.
 */
function luminanceAsAlpha(
  rendered: SVGNode,
  bounds: VisualBounds | null,
  ctx: SVGExportContext
): SVGNode {
  const id = nextDefId(ctx, 'maskLuma')
  const region = bounds ? { ...defRegion(bounds), filterUnits: 'userSpaceOnUse' } : {}
  ctx.defs.push(
    svgElement('filter', { id, ...region, 'color-interpolation-filters': 'sRGB' }, [
      svg('feColorMatrix', { in: 'SourceGraphic', type: 'luminanceToAlpha', result: 'luma' }),
      svg('feComposite', { in: 'luma', in2: 'SourceGraphic', operator: 'in', result: 'lumaAlpha' }),
      svg('feComposite', { in: 'lumaAlpha', in2: 'SourceGraphic', operator: 'in' })
    ])
  )
  return svgElement('g', { filter: `url(#${id})` }, [rendered])
}

/**
 * What a mask masks with: an outline mask its shape alone, without its blend mode, and a container
 * without its own shadows, which the canvas leaves out of a mask.
 */
function maskSource(mask: SceneNode): SceneNode {
  const effects = isLayerContainer(mask)
    ? mask.effects.filter((e) => e.type !== 'DROP_SHADOW' && e.type !== 'INNER_SHADOW')
    : mask.effects
  return asMaskShape({ ...mask, blendMode: 'PASS_THROUGH', effects })
}

/** One mask of a run (`maskSource`), as the alpha it masks with. */
function renderMask(
  mask: SceneNode,
  bounds: VisualBounds | null,
  ctx: SVGExportContext,
  renderNode: RenderSVGChild
): SVGNode | null {
  const rendered = renderNode(mask, ctx)
  if (!rendered) return null
  return mask.maskType === 'LUMINANCE' ? luminanceAsAlpha(rendered, bounds, ctx) : rendered
}

/**
 * A container's children bottom to top, as the canvas draws them (`renderMaskedChildIds`): each
 * mask run's masked siblings in a group held to an alpha `<mask>` of what its masks draw. A run
 * with nothing to mask draws nothing.
 */
export function renderMaskedChildren(
  childNodes: readonly SceneNode[],
  ctx: SVGExportContext,
  renderNode: RenderSVGChild
): SVGNode[] {
  const out: SVGNode[] = []
  const renderInto = (target: SVGNode[], nodes: readonly SceneNode[]) => {
    for (const node of nodes) {
      const rendered = renderNode(node, ctx)
      if (rendered) target.push(rendered)
    }
  }
  let next = 0
  for (const run of maskRuns(childNodes, isVisibleMask)) {
    renderInto(out, childNodes.slice(next, run.start))
    next = run.end
    if (run.maskedStart === run.end) continue

    // Masks come first, so a repeated name counts in layer order.
    let runBounds: VisualBounds | null = null
    const maskElements: SVGNode[] = []
    for (const mask of childNodes.slice(run.start, run.maskedStart).map(maskSource)) {
      const bounds = maskBounds(mask, ctx)
      runBounds = unionVisualBounds(runBounds, bounds)
      const rendered = renderMask(mask, bounds, ctx, renderNode)
      if (rendered) maskElements.push(rendered)
    }
    if (maskElements.length === 0) continue

    const masked: SVGNode[] = []
    renderInto(masked, childNodes.slice(run.maskedStart, run.end))
    if (masked.length === 0) continue

    const id = nextDefId(ctx, 'mask')
    const region = runBounds ? defRegion(runBounds) : {}
    ctx.defs.push(
      svgElement(
        'mask',
        { id, style: 'mask-type:alpha', maskUnits: 'userSpaceOnUse', ...region },
        maskElements
      )
    )
    out.push(svgElement('g', { mask: `url(#${id})` }, masked))
  }
  renderInto(out, childNodes.slice(next))
  return out
}
