import type { Effect, SceneNode } from '@open-pencil/scene-graph'
import { maxOf } from '@open-pencil/scene-graph/arrays'
import { CSS_BLEND_MODE } from '@open-pencil/scene-graph/css'
import { widestBlurRadius } from '@open-pencil/scene-graph/geometry'
import Matrix from '@open-pencil/scene-graph/matrix'

import { subtreeRenderBounds } from '#core/geometry/render-bounds'
import { shadowSpread } from '#core/geometry/shadows'

import { formatColor, nextDefId, type SVGExportContext } from './defs'
import { svg, svgElement, type SVGNode } from './node'
import { boxOutlinePath, nodeOutlinePath, round } from './paths'

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
  'BACKGROUND_BLUR'
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
 * A layer's content with its effects: the filter on the layer's group, or, under a background
 * blur, which the filter must not blur, on a group of its own beside it.
 */
export function withLayerEffects(
  content: SVGNode[],
  { filter, backdrop }: SVGLayerEffects,
  groupAttrs: Record<string, string | number | undefined>
): SVGNode[] {
  if (!backdrop) {
    if (filter) groupAttrs.filter = `url(#${filter})`
    return content
  }
  if (!filter) return [backdrop, ...content]
  return [backdrop, svgElement('g', { filter: `url(#${filter})` }, content)]
}

/**
 * A background blur as Figma's SVG export writes it: an HTML box under the layer with a CSS
 * `backdrop-filter`, clipped to the layer's outline. SVG filters cannot read what lies behind an
 * element, so only renderers that draw HTML in SVG, such as browsers, show it.
 */
function backdropBlur(node: SceneNode, effects: Effect[], ctx: SVGExportContext): SVGNode | null {
  const blurs = effects.filter((e) => e.type === 'BACKGROUND_BLUR')
  if (blurs.length === 0) return null
  const radius = maxOf(blurs.map(widestBlurRadius))
  if (!(radius > 0)) return null
  const clipId = nextDefId(ctx, 'bgblur')
  ctx.defs.push(
    svg(
      'clipPath',
      { id: clipId, transform: `translate(${round(radius)} ${round(radius)})` },
      svg('path', { d: nodeOutlinePath(node) ?? boxOutlinePath(node) })
    )
  )
  return svg(
    'foreignObject',
    {
      x: round(-radius),
      y: round(-radius),
      width: round(node.width + radius * 2),
      height: round(node.height + radius * 2)
    },
    svg('div', {
      xmlns: 'http://www.w3.org/1999/xhtml',
      style: `backdrop-filter:blur(${round(radius / 2)}px);clip-path:url(#${clipId});height:100%;width:100%`
    })
  )
}

/** An SVG `feBlend` mode for a shadow's blend mode; SVG has no plus-lighter or plus-darker. */
function feBlendMode(effect: Effect): string {
  const css = effect.blendMode ? CSS_BLEND_MODE[effect.blendMode] : undefined
  return css && !css.startsWith('plus-') ? css : 'normal'
}

/** Every pixel the layer covers at full strength, which Figma casts its shadows from. */
const HARD_ALPHA = 'hardAlpha'

class FilterBuilder {
  readonly primitives: SVGNode[] = []
  private count = 0

  constructor(
    private readonly id: string,
    private readonly ctx: SVGExportContext
  ) {}

  /** A new result name, unique in this filter. */
  result(name: string): string {
    this.count += 1
    return `${this.id}_${name}${this.count}`
  }

  push(tag: string, attrs: Record<string, string | number | undefined>): void {
    this.primitives.push(svg(tag, attrs))
  }

  /**
   * A shadow's alpha: the layer's grown by `spread` (shrunk when negative), moved by the offset,
   * and blurred. Returns its result name.
   */
  shadowAlpha(effect: Effect, spread: number): string {
    let input = HARD_ALPHA
    if (spread !== 0) {
      const morphed = this.result('spread')
      this.push('feMorphology', {
        in: HARD_ALPHA,
        operator: spread > 0 ? 'dilate' : 'erode',
        radius: round(Math.abs(spread)),
        result: morphed
      })
      input = morphed
    }
    const offset = this.result('offset')
    this.push('feOffset', {
      in: input,
      dx: round(effect.offset.x),
      dy: round(effect.offset.y),
      result: offset
    })
    if (effect.radius <= 0) return offset
    const blurred = this.result('blur')
    this.push('feGaussianBlur', {
      in: offset,
      stdDeviation: round(effect.radius / 2),
      result: blurred
    })
    return blurred
  }

  /** The shadow's colour inside `alpha`, under the name `result`. */
  shadowColor(effect: Effect, alpha: string, result: string): void {
    const color = this.result('color')
    this.push('feFlood', {
      'flood-color': formatColor(effect.color, 1, this.ctx.colorSpace),
      'flood-opacity': round(effect.color.a),
      result: color
    })
    this.push('feComposite', { in: color, in2: alpha, operator: 'in', result })
  }
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

  for (const effect of drawn) {
    if (effect.type !== 'LAYER_BLUR' && effect.type !== 'FOREGROUND_BLUR') continue
    const radius = widestBlurRadius(effect)
    if (radius <= 0) continue
    const blurred = filter.result('layerBlur')
    filter.push('feGaussianBlur', { in: shape, stdDeviation: round(radius / 2), result: blurred })
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
  const region = subtreeRenderBounds(ctx.graph, node, Matrix.identity(), { reach: 'figma' })
  if (!region) return attrs
  return {
    id,
    x: round(region.minX),
    y: round(region.minY),
    width: round(region.maxX - region.minX),
    height: round(region.maxY - region.minY),
    filterUnits: 'userSpaceOnUse',
    'color-interpolation-filters': 'sRGB'
  }
}
