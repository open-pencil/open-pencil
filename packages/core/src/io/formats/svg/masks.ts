import type { SceneNode } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph/coordinate'
import { unionVisualBounds, type VisualBounds } from '@open-pencil/scene-graph/geometry'
import { asMaskShape, isVisibleMask, maskRuns } from '@open-pencil/scene-graph/masks'

import { subtreeRenderBounds } from '#core/geometry/render-bounds'

import {
  commitLayerIdCheckpoint,
  defRegion,
  nextDefId,
  pushLayerIdCheckpoint,
  rollbackLayerIdCheckpoint,
  type SVGExportContext
} from './defs'
import type { ExportEffectWarning } from './effects'
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
 * One mask of a run, drawn as the canvas draws it (`renderMaskNodeContent`): an outline mask with
 * its own fills opaque, its layers as they are, and its opacity and blur but not its blend mode.
 */
function renderMask(
  mask: SceneNode,
  bounds: VisualBounds | null,
  ctx: SVGExportContext,
  renderNode: RenderSVGChild
): SVGNode | null {
  const rendered = renderNode(asMaskShape({ ...mask, blendMode: 'PASS_THROUGH' }), ctx)
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
  const renderInto = (
    target: SVGNode[],
    nodes: readonly SceneNode[],
    renderCtx: SVGExportContext
  ) => {
    for (const node of nodes) {
      const rendered = renderNode(node, renderCtx)
      if (rendered) target.push(rendered)
    }
  }
  let next = 0
  for (const run of maskRuns(childNodes, isVisibleMask)) {
    renderInto(out, childNodes.slice(next, run.start), ctx)
    next = run.end
    if (run.maskedStart === run.end) continue

    const prevDefsLen = ctx.defs.length
    const prevDefIdCounter = ctx.defIdCounter
    if (ctx.layerIds) pushLayerIdCheckpoint(ctx.layerIds)
    const stagedWarnings: ExportEffectWarning[] = []
    const stagedCtx: SVGExportContext = ctx.onWarning
      ? { ...ctx, onWarning: (warning) => stagedWarnings.push(warning) }
      : ctx

    let runBounds: VisualBounds | null = null
    const maskElements: SVGNode[] = []
    for (const mask of childNodes.slice(run.start, run.maskedStart)) {
      const bounds = maskBounds(mask, stagedCtx)
      runBounds = unionVisualBounds(runBounds, bounds)
      const rendered = renderMask(mask, bounds, stagedCtx, renderNode)
      if (rendered) maskElements.push(rendered)
    }

    const masked: SVGNode[] = []
    if (maskElements.length > 0) {
      renderInto(masked, childNodes.slice(run.maskedStart, run.end), stagedCtx)
    }
    ctx.defIdCounter = stagedCtx.defIdCounter

    if (maskElements.length === 0 || masked.length === 0) {
      ctx.defs.length = prevDefsLen
      ctx.defIdCounter = prevDefIdCounter
      if (ctx.layerIds) rollbackLayerIdCheckpoint(ctx.layerIds)
      continue
    }

    if (ctx.layerIds) commitLayerIdCheckpoint(ctx.layerIds)
    for (const warning of stagedWarnings) ctx.onWarning?.(warning)

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
  renderInto(out, childNodes.slice(next), ctx)
  return out
}
