import type { Effect, Fill, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { colorToCSS, colorToHex } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { DesignStyleDeclaration } from '../types'

/** Opaque colors as hex, which Tailwind matches to its palette; translucent ones as `rgba()`. */
export function cssColor(color: Color): string {
  return color.a >= 1 ? colorToHex(color) : colorToCSS(color)
}

export function fillToCSS(fill: Fill | undefined): string | undefined {
  if (fill?.type !== 'SOLID' || !fill.visible) return undefined
  return cssColor({ ...fill.color, a: fill.opacity })
}

export function strokeColorToCSS(stroke: Stroke | undefined): string | undefined {
  if (!stroke?.visible) return undefined
  return cssColor({ ...stroke.color, a: stroke.opacity })
}

export function strokeToCSS(stroke: Stroke | undefined): string | undefined {
  const color = strokeColorToCSS(stroke)
  if (!color || !stroke) return undefined
  return `${stroke.weight}px solid ${color}`
}

function shadowToCSS(effect: Effect): string {
  const inset = effect.type === 'INNER_SHADOW' ? 'inset ' : ''
  return `${inset}${effect.offset.x}px ${effect.offset.y}px ${effect.radius}px ${effect.spread}px ${cssColor(effect.color)}`
}

export function dropShadowToCSS(effect: Effect | undefined): string | undefined {
  if (effect?.type !== 'DROP_SHADOW' || !effect.visible) return undefined
  return shadowToCSS(effect)
}

/** Every visible shadow, in order, plus layer and background blur. */
export function effectsToCSS(effects: Effect[]): DesignStyleDeclaration {
  const style: DesignStyleDeclaration = {}
  const visible = effects.filter((effect) => effect.visible)
  const shadows = visible.filter(
    (effect) => effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW'
  )
  if (shadows.length > 0) style['box-shadow'] = shadows.map(shadowToCSS).join(', ')
  for (const effect of visible) {
    if (effect.type === 'LAYER_BLUR' || effect.type === 'FOREGROUND_BLUR')
      style.filter = `blur(${effect.radius}px)`
    if (effect.type === 'BACKGROUND_BLUR') style['backdrop-filter'] = `blur(${effect.radius}px)`
  }
  return style
}

/** Whether a layer sizes itself to its content along an axis, so CSS should too. */
function hugs(node: SceneNode, axis: 'width' | 'height'): boolean {
  if (node.type === 'TEXT')
    return (
      node.textAutoResize === 'WIDTH_AND_HEIGHT' ||
      (axis === 'height' && node.textAutoResize === 'HEIGHT')
    )
  if (node.layoutMode !== 'HORIZONTAL' && node.layoutMode !== 'VERTICAL') return false
  const primary = (node.layoutMode === 'HORIZONTAL') === (axis === 'width')
  return (primary ? node.primaryAxisSizing : node.counterAxisSizing) === 'HUG'
}

/**
 * A layer's size: fixed on the axes the design fixes, and left to the content where the layer
 * hugs it (an auto layout frame set to Hug, or auto-sizing text), so the page grows with it.
 */
export function sceneNodeSizeStyle(node: SceneNode): DesignStyleDeclaration {
  const style: DesignStyleDeclaration = {}
  if (node.width > 0 && !hugs(node, 'width')) style.width = `${node.width}px`
  if (node.height > 0 && !hugs(node, 'height')) style.height = `${node.height}px`
  return style
}
