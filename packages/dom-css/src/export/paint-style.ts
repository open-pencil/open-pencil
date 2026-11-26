import type { ColorProfile, Fill, SceneNode } from '@open-pencil/scene-graph'
import { CSS_BLEND_MODE } from '@open-pencil/scene-graph/css'
import { shaderOfPaint } from '@open-pencil/scene-graph/shaders'

import type { DesignStyleDeclaration } from '../types'
import { fillToCSS, gradientToCSS, strokeColorToCSS } from './css'

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
