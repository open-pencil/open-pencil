import type { ColorProfile, Fill, SceneNode } from '@open-pencil/scene-graph'
import { CSS_BLEND_MODE } from '@open-pencil/scene-graph/css'
import { shaderOfPaint } from '@open-pencil/scene-graph/shaders'

import type { DesignStyleDeclaration } from '../types'
import {
  borderWidths,
  fillToCSS,
  gradientToCSS,
  strokeColorToCSS,
  strokeDrawsAsShadows
} from './css'

/** A field's CSS: its token reference where one is faithful, otherwise the literal value. */
export type FieldCSS = (field: string, literal: string) => string

const px = (value: number) => `${value}px`

/** A layer's first stroke as a CSS border, its color in the document's profile. */
export function addStroke(
  style: DesignStyleDeclaration,
  node: SceneNode,
  css: FieldCSS,
  profile: ColorProfile
): void {
  const stroke = node.strokes.at(0)
  const literalColor = strokeColorToCSS(stroke, profile)
  if (!literalColor || !stroke) return
  const color = css('strokes/0/color', literalColor)
  const borderStyle = node.dashPattern.length > 0 ? 'dashed' : 'solid'
  if (!node.independentStrokeWeights) {
    style.border = `${css('strokeWeight', px(stroke.weight))} solid ${color}`
    if (borderStyle !== 'solid') style['border-style'] = borderStyle
    return
  }

  style['border-style'] = borderStyle
  style['border-color'] = color
  style['border-top-width'] = css('borderTopWeight', px(node.borderTopWeight))
  style['border-right-width'] = css('borderRightWeight', px(node.borderRightWeight))
  style['border-bottom-width'] = css('borderBottomWeight', px(node.borderBottomWeight))
  style['border-left-width'] = css('borderLeftWeight', px(node.borderLeftWeight))
}

/** How much of a stroke lies inside the layer's edge, by where the stroke is aligned. */
const INSIDE_SHARE = { INSIDE: 1, CENTER: 0.5, OUTSIDE: 0 } as const

/**
 * A layer's first stroke as box shadows, as preview draws it: inside, centred on or outside the
 * edge as the canvas draws it, and taking no room. On the canvas only an inside stroke included in
 * layout takes room, and the padding gives it that. A dashed stroke has no shadow form.
 */
export function strokeShadows(
  node: SceneNode,
  css: FieldCSS,
  profile: ColorProfile
): string[] | undefined {
  const stroke = node.strokes.at(0)
  const literalColor = strokeColorToCSS(stroke, profile)
  if (!literalColor || !stroke || !strokeDrawsAsShadows(node)) return undefined
  const color = css('strokes/0/color', literalColor)
  const inside = INSIDE_SHARE[stroke.align]
  if (!node.independentStrokeWeights) {
    const literal = px(stroke.weight)
    const weight = css('strokeWeight', literal)
    const part = (share: number) => {
      if (share === 1) return weight
      return weight === literal ? px(stroke.weight * share) : `calc(${weight} * ${share})`
    }
    return [
      ...(inside > 0 ? [`inset 0 0 0 ${part(inside)} ${color}`] : []),
      ...(inside < 1 ? [`0 0 0 ${part(1 - inside)} ${color}`] : [])
    ]
  }
  // A band along each side: a shadow moved off the box by the band's width, inside or out.
  const widths = borderWidths(node)
  return SIDE_BANDS.flatMap(({ side, field, dx, dy }) => {
    const literal = px(widths[side])
    const weight = css(field, literal)
    // The weight times `share`, which carries the direction the shadow moves in.
    const scaled = (share: number) => {
      if (weight === literal) return px(widths[side] * share)
      if (share === 0) return '0px'
      return share === 1 ? weight : `calc(${weight} * ${share})`
    }
    const band = (inset: boolean, share: number) => {
      const toward = inset ? -share : share
      return `${inset ? 'inset ' : ''}${scaled(dx * toward)} ${scaled(dy * toward)} 0 0 ${color}`
    }
    return [
      ...(widths[side] > 0 && inside > 0 ? [band(true, inside)] : []),
      ...(widths[side] > 0 && inside < 1 ? [band(false, 1 - inside)] : [])
    ]
  })
}

/** Each side's weight field, and the way a shadow moves to show a band along that side. */
const SIDE_BANDS = [
  { side: 'top', field: 'borderTopWeight', dx: 0, dy: -1 },
  { side: 'right', field: 'borderRightWeight', dx: 1, dy: 0 },
  { side: 'bottom', field: 'borderBottomWeight', dx: 0, dy: 1 },
  { side: 'left', field: 'borderLeftWeight', dx: -1, dy: 0 }
] as const

/**
 * The layer's visible fills, painted bottom to top: its lowest solid fill as `background-color`,
 * and every gradient and every colour stacked above another fill as `background-image`, the top
 * one first, as CSS stacks them. A colour can only stack as an image, so it is written as a
 * gradient of itself. An image fill is the element's own image.
 */
export function addBackground(
  style: DesignStyleDeclaration,
  node: SceneNode,
  css: FieldCSS,
  profile: ColorProfile
): void {
  const layers: { image: string; blend: string }[] = []
  let color: string | undefined
  node.fills.forEach((fill, index) => {
    if (!fill.visible) return
    const blend = layerBlendMode(fill.blendMode)
    if (fill.type === 'SOLID') {
      const value = css(`fills/${index}/color`, fillToCSS(fill, profile) ?? '')
      if (color === undefined && layers.length === 0) color = value
      else layers.unshift({ image: `linear-gradient(${value}, ${value})`, blend })
      return
    }
    const gradient = gradientToCSS(fill, node.width, node.height, profile)
    if (gradient) layers.unshift({ image: gradient, blend })
    // A paint below every colour, such as an image, leaves no colour for the bottom.
    else if (color === undefined) color = ''
  })
  if (layers.length > 0) {
    style['background-image'] = layers.map((layer) => layer.image).join(', ')
    if (layers.some((layer) => layer.blend !== 'normal')) {
      style['background-blend-mode'] = layers.map((layer) => layer.blend).join(', ')
    }
  }
  if (color) style['background-color'] = color
}

/**
 * A fill's blend mode as `background-blend-mode` takes it, which has no `plus-` modes: linear
 * burn and dodge blend normally there.
 */
function layerBlendMode(mode: Fill['blendMode']): string {
  const css = mode ? CSS_BLEND_MODE[mode] : undefined
  return css && !css.startsWith('plus-') ? css : 'normal'
}

export function addImageStyle(style: DesignStyleDeclaration, node: SceneNode): void {
  const fill = node.fills.at(0)
  if (fill?.type !== 'IMAGE' || !fill.visible || shaderOfPaint(node, fill)) return
  if (node.width > 0 && node.height > 0) style['aspect-ratio'] = `${node.width} / ${node.height}`
  if (fill.imageScaleMode === 'FIT') style['object-fit'] = 'contain'
  if (fill.imageScaleMode === 'FILL') style['object-fit'] = 'cover'
}
