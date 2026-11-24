import type { Effect, SceneNode } from '@open-pencil/scene-graph'
import { CSS_BLEND_MODE } from '@open-pencil/scene-graph/css'
import { widestBlurRadius } from '@open-pencil/scene-graph/geometry'
import Matrix from '@open-pencil/scene-graph/matrix'
import { maxOf } from '@open-pencil/std/arrays'

import { subtreeRenderBounds } from '#core/geometry/render-bounds'
import { shadowSpread } from '#core/geometry/shadows'

import { booleanOutlines } from './boolean/outline'
import { defRegion, nextDefId, type SVGExportContext } from './defs'
import { FilterBuilder, HARD_ALPHA } from './filter'
import { noiseFilter, textureFilter } from './grain'
import { svg, svgElement, type SVGNode } from './node'
import { boxOutlinePath, nodeOutlinePath, round } from './paths'
import { fillOutlines, outlineClips } from './regions'

/** An effect an export left out because its format cannot draw it. */
export interface ExportEffectWarning {
  code: 'unsupported-effect'
  /**
   * The effect's type as the document names it. A `.fig` file can carry types the scene graph does
   * not model yet, such as `NOISE` or `GRAIN` (Figma's texture).
   */
  effect: string
  nodeId: string
  nodeName: string
  message: string
}

/** The warning for an effect `format` leaves out of `node`. */
export function unsupportedEffectWarning(
  node: Pick<SceneNode, 'id' | 'name'>,
  effect: Pick<Effect, 'type'>,
  format: string
): ExportEffectWarning {
  return {
    code: 'unsupported-effect',
    effect: effect.type,
    nodeId: node.id,
    nodeName: node.name,
    message: `${format} cannot draw ${effect.type} on "${node.name}" (${node.id}); it was left out.`
  }
}

/**
 * The effects SVG export draws, as Figma's SVG export does. Glass, and types the scene graph does
 * not model, are left out with a warning; Figma leaves glass out silently.
 */
const SVG_EFFECTS: ReadonlySet<string> = new Set<Effect['type']>([
  'DROP_SHADOW',
  'INNER_SHADOW',
  'LAYER_BLUR',
  'FOREGROUND_BLUR',
  'BACKGROUND_BLUR',
  'NOISE',
  'TEXTURE'
])

/** What a layer's effects add to its SVG: a filter on its content, and a backdrop blur under it. */
export interface SVGLayerEffects {
  filter: string | null
  backdrop: SVGNode | null
}

/**
 * A layer's visible effects as SVG, as Figma exports them. A progressive blur is drawn as an even
 * blur of its end radius, as in Figma's SVG. Each effect SVG cannot draw is reported to
 * `ctx.onWarning` and left out.
 */
export function layerEffects(node: SceneNode, ctx: SVGExportContext): SVGLayerEffects {
  const visible: Effect[] = []
  for (const effect of node.effects) {
    if (!effect.visible) continue
    if (SVG_EFFECTS.has(effect.type)) visible.push(effect)
    else ctx.onWarning?.(unsupportedEffectWarning(node, effect, 'SVG'))
  }
  return { filter: effectFilter(node, visible, ctx), backdrop: backdropBlur(node, visible, ctx) }
}

/**
 * A layer's content with its effects: the filter on the layer's group, or, beside a background
 * blur, on a group of the content's own. The layer's opacity and blend mode go there too: on an
 * element around the blur's box they would make it a backdrop root, which cuts the box off from
 * what lies behind the layer.
 */
export function withLayerEffects(
  content: SVGNode[],
  { filter, backdrop }: SVGLayerEffects,
  groupAttrs: Record<string, string | number | undefined>
): SVGNode[] {
  const filterURL = filter ? `url(#${filter})` : undefined
  if (!backdrop) {
    if (filterURL) groupAttrs.filter = filterURL
    return content
  }
  const own = { opacity: groupAttrs.opacity, style: groupAttrs.style, filter: filterURL }
  groupAttrs.opacity = undefined
  groupAttrs.style = undefined
  if (Object.values(own).every((value) => value === undefined)) return [backdrop, ...content]
  return [backdrop, svgElement('g', own, content)]
}

/**
 * A background blur as Figma's SVG export writes it: an HTML box under the layer with a CSS
 * `backdrop-filter`, clipped to what the layer fills. SVG filters cannot read what lies behind an
 * element, so only renderers that draw HTML in SVG, such as browsers, show it. A progressive blur
 * blurs by its end radius, and the box holds its widest. The box takes the layer's opacity, which
 * Figma draws the blur with.
 */
function backdropBlur(node: SceneNode, effects: Effect[], ctx: SVGExportContext): SVGNode | null {
  const blurs = effects.filter((e) => e.type === 'BACKGROUND_BLUR')
  if (blurs.length === 0) return null
  const blur = maxOf(blurs.map((e) => e.radius))
  if (!(blur > 0)) return null
  const clip = fillClip(node, ctx)
  if (clip.length === 0) return null
  const pad = maxOf(blurs.map(widestBlurRadius))
  const clipId = nextDefId(ctx, 'bgblur')
  ctx.defs.push(
    svgElement(
      'clipPath',
      { id: clipId, transform: `translate(${round(pad)} ${round(pad)})` },
      clip
    )
  )
  const opacity = node.opacity < 1 ? `opacity:${round(node.opacity)};` : ''
  return svg(
    'foreignObject',
    {
      x: round(-pad),
      y: round(-pad),
      width: round(node.width + pad * 2),
      height: round(node.height + pad * 2)
    },
    svg('div', {
      xmlns: 'http://www.w3.org/1999/xhtml',
      style: `backdrop-filter:blur(${round(blur / 2)}px);${opacity}clip-path:url(#${clipId});height:100%;width:100%`
    })
  )
}

/**
 * What the layer fills, as clip paths: its fill outlines with their winding, or its outline. A
 * boolean operation with nothing left of it fills nothing.
 */
function fillClip(node: SceneNode, ctx: SVGExportContext): SVGNode[] {
  const combined = booleanOutlines(node, ctx)
  if (combined) return outlineClips(combined)
  const outlines = fillOutlines(node)?.outlines ?? []
  if (outlines.length === 0) {
    return [svg('path', { d: nodeOutlinePath(node) ?? boxOutlinePath(node) })]
  }
  return outlineClips(outlines)
}

/** An SVG `feBlend` mode for a shadow's blend mode; SVG has no plus-lighter or plus-darker. */
function feBlendMode(effect: Effect): string {
  const css = effect.blendMode ? CSS_BLEND_MODE[effect.blendMode] : undefined
  return css && !css.startsWith('plus-') ? css : 'normal'
}

/** The filter for a layer's shadows and layer blurs, `null` when it has none to draw. */
function effectFilter(node: SceneNode, effects: Effect[], ctx: SVGExportContext): string | null {
  const drawn = effects.filter((e) => e.type !== 'BACKGROUND_BLUR')
  if (drawn.length === 0) return null

  const id = nextDefId(ctx, 'fx')
  const filter = new FilterBuilder(id, ctx)
  let below = 'BackgroundImageFix'
  filter.push('feFlood', { 'flood-opacity': 0, result: below })
  filter.push('feColorMatrix', {
    in: 'SourceAlpha',
    type: 'matrix',
    values: '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0',
    result: HARD_ALPHA
  })

  for (const effect of drawn) {
    if (effect.type !== 'DROP_SHADOW') continue
    let alpha = filter.shadowAlpha(effect, shadowSpread(node, effect))
    // Hidden behind the layer, the shadow shows only outside what the layer covers.
    if (effect.showShadowBehindNode === false) {
      const outside = filter.result('knockout')
      filter.push('feComposite', { in: alpha, in2: HARD_ALPHA, operator: 'out', result: outside })
      alpha = outside
    }
    const shadow = filter.result('dropShadow')
    filter.shadowColor(effect, alpha, shadow)
    const blended = filter.result('dropShadowBlend')
    filter.push('feBlend', { mode: feBlendMode(effect), in: shadow, in2: below, result: blended })
    below = blended
  }

  let shape = filter.result('shape')
  filter.push('feBlend', { mode: 'normal', in: 'SourceGraphic', in2: below, result: shape })

  for (const effect of drawn) {
    if (effect.type !== 'INNER_SHADOW') continue
    // What the layer covers less its moved, shrunk, blurred copy: the rim inside its edge.
    const cast = filter.shadowAlpha(effect, -shadowSpread(node, effect))
    const rim = filter.result('rim')
    filter.push('feComposite', {
      in: cast,
      in2: HARD_ALPHA,
      operator: 'arithmetic',
      k2: -1,
      k3: 1,
      result: rim
    })
    const shadow = filter.result('innerShadow')
    filter.shadowColor(effect, rim, shadow)
    const blended = filter.result('innerShadowBlend')
    filter.push('feBlend', { mode: feBlendMode(effect), in: shadow, in2: shape, result: blended })
    shape = blended
  }

  // Texture roughens the layer and noise grains it, after its shadows and before any blur.
  for (const effect of drawn)
    if (effect.type === 'TEXTURE') shape = textureFilter(filter, effect, shape)
  for (const effect of drawn)
    if (effect.type === 'NOISE') shape = noiseFilter(filter, effect, shape)

  // A progressive blur blurs by its end radius, as in Figma's SVG; the region holds its widest.
  for (const effect of drawn) {
    if (effect.type !== 'LAYER_BLUR' && effect.type !== 'FOREGROUND_BLUR') continue
    if (effect.radius <= 0) continue
    const blurred = filter.result('layerBlur')
    const stdDeviation = round(effect.radius / 2)
    filter.push('feGaussianBlur', { in: shape, stdDeviation, result: blurred })
    shape = blurred
  }

  ctx.defs.push(svgElement('filter', filterRegion(node, id, ctx), filter.primitives))
  return id
}

/**
 * A filter's attributes, with its region around everything the layer and its children draw, as
 * Figma sizes it. Without one, SVG's default margin of a tenth of the layer cuts a wide shadow off.
 */
function filterRegion(
  node: SceneNode,
  id: string,
  ctx: SVGExportContext
): Record<string, string | number> {
  const attrs: Record<string, string | number> = { id, 'color-interpolation-filters': 'sRGB' }
  const drawn = subtreeRenderBounds(ctx.graph, node, Matrix.identity(), { reach: 'figma' })
  if (!drawn) return attrs
  // A texture moves the layer's edges by up to its radius, so Figma's region holds that much more.
  const roughened = maxOf(
    node.effects.map((e) => (e.visible && e.type === 'TEXTURE' ? e.radius : 0)).concat(0)
  )
  const region = defRegion({
    minX: Math.min(drawn.minX, -roughened),
    minY: Math.min(drawn.minY, -roughened),
    maxX: Math.max(drawn.maxX, node.width + roughened),
    maxY: Math.max(drawn.maxY, node.height + roughened)
  })
  return {
    id,
    ...region,
    filterUnits: 'userSpaceOnUse',
    'color-interpolation-filters': 'sRGB'
  }
}
