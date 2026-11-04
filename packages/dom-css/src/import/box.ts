import type { Fill, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { parseCSSNumber } from '@open-pencil/scene-graph/css'

import type { DesignStyleDeclaration } from '../types'
import { colorToFillFromCSS, pickStyle } from './css-values'

function firstCSSNumber(style: DesignStyleDeclaration, ...properties: string[]): number | null {
  for (const property of properties) {
    const parsed = parseCSSNumber(pickStyle(style, property))
    if (parsed !== null) return parsed
  }
  return null
}

export function fillsFromStyle(style: DesignStyleDeclaration, property: string): Fill[] {
  return colorToFillFromCSS(pickStyle(style, property))
}

function aspectRatioFromCSS(value: string | undefined): number | null {
  if (!value || value === 'auto') return null
  const parts = value
    .split('/')
    .map((part) => Number.parseFloat(part.trim()))
    .filter(Number.isFinite)
  if (parts.length === 1 && parts[0] > 0) return parts[0]
  if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) return parts[0] / parts[1]
  return null
}

export function setNodeBox(node: SceneNode, style: DesignStyleDeclaration): void {
  const width = firstCSSNumber(style, 'width')
  const height = firstCSSNumber(style, 'height')
  const minWidth = firstCSSNumber(style, 'min-width')
  const maxWidth = firstCSSNumber(style, 'max-width')
  const minHeight = firstCSSNumber(style, 'min-height')
  const maxHeight = firstCSSNumber(style, 'max-height')
  const aspectRatio = aspectRatioFromCSS(pickStyle(style, 'aspect-ratio'))
  if (width !== null) node.width = width
  if (height !== null) node.height = height
  if (height === null && width !== null && aspectRatio !== null) node.height = width / aspectRatio
  if (width === null && height !== null && aspectRatio !== null) node.width = height * aspectRatio
  if (minWidth !== null) node.minWidth = minWidth
  if (maxWidth !== null) node.maxWidth = maxWidth
  if (minHeight !== null) node.minHeight = minHeight
  if (maxHeight !== null) node.maxHeight = maxHeight
}

export function firstStrokeColor(style: DesignStyleDeclaration) {
  return (
    pickStyle(style, 'border-color') ??
    pickStyle(style, 'border-top-color') ??
    pickStyle(style, 'border-right-color') ??
    pickStyle(style, 'border-bottom-color') ??
    pickStyle(style, 'border-left-color')
  )
}

export function strokeWeightFromStyle(style: DesignStyleDeclaration) {
  const borderWidth = firstCSSNumber(style, 'border-width')
  if (borderWidth !== null) return borderWidth

  const sideWeights = [
    firstCSSNumber(style, 'border-top-width'),
    firstCSSNumber(style, 'border-right-width'),
    firstCSSNumber(style, 'border-bottom-width'),
    firstCSSNumber(style, 'border-left-width')
  ].filter((weight): weight is number => weight !== null)
  if (sideWeights.length === 0) return null
  return Math.max(...sideWeights)
}

function borderStyleFromCSS(style: DesignStyleDeclaration): string | undefined {
  return (
    pickStyle(style, 'border-style') ??
    pickStyle(style, 'border-top-style') ??
    pickStyle(style, 'border-right-style') ??
    pickStyle(style, 'border-bottom-style') ??
    pickStyle(style, 'border-left-style')
  )
}

export function dashPatternFromCSS(style: DesignStyleDeclaration, strokeWeight: number): number[] {
  const borderStyle = borderStyleFromCSS(style)
  if (borderStyle === 'dashed') return [strokeWeight * 3, strokeWeight * 2]
  if (borderStyle === 'dotted') return [strokeWeight, strokeWeight]
  return []
}

export function setBorderWeights(
  node: SceneNode,
  style: DesignStyleDeclaration,
  stroke: Stroke
): void {
  const top = firstCSSNumber(style, 'border-top-width') ?? stroke.weight
  const right = firstCSSNumber(style, 'border-right-width') ?? stroke.weight
  const bottom = firstCSSNumber(style, 'border-bottom-width') ?? stroke.weight
  const left = firstCSSNumber(style, 'border-left-width') ?? stroke.weight
  node.borderTopWeight = top
  node.borderRightWeight = right
  node.borderBottomWeight = bottom
  node.borderLeftWeight = left
  node.independentStrokeWeights = [top, right, bottom, left].some(
    (weight) => weight !== stroke.weight
  )
}

export function applyCornerRadii(node: SceneNode, style: DesignStyleDeclaration): void {
  const cornerRadius = firstCSSNumber(style, 'border-radius')
  const topLeft = firstCSSNumber(style, 'border-top-left-radius')
  const topRight = firstCSSNumber(style, 'border-top-right-radius')
  const bottomRight = firstCSSNumber(style, 'border-bottom-right-radius')
  const bottomLeft = firstCSSNumber(style, 'border-bottom-left-radius')

  if (cornerRadius !== null) node.cornerRadius = cornerRadius
  if (topLeft === null && topRight === null && bottomRight === null && bottomLeft === null) return

  const fallback = cornerRadius ?? 0
  node.topLeftRadius = topLeft ?? fallback
  node.topRightRadius = topRight ?? fallback
  node.bottomRightRadius = bottomRight ?? fallback
  node.bottomLeftRadius = bottomLeft ?? fallback
  node.independentCorners = [
    node.topLeftRadius,
    node.topRightRadius,
    node.bottomRightRadius,
    node.bottomLeftRadius
  ].some((radius) => radius !== fallback)
}

export function applyFlexGap(node: SceneNode, style: DesignStyleDeclaration): void {
  const gap = firstCSSNumber(style, 'gap')
  const rowGap = firstCSSNumber(style, 'row-gap')
  const columnGap = firstCSSNumber(style, 'column-gap')
  const isHorizontal = node.layoutMode === 'HORIZONTAL'
  const isWrapped = node.layoutWrap === 'WRAP'

  node.itemSpacing = (isHorizontal ? columnGap : rowGap) ?? gap ?? 0
  node.counterAxisSpacing = (isHorizontal ? rowGap : columnGap) ?? (isWrapped ? (gap ?? 0) : 0)
}

export function applyPositioning(node: SceneNode, style: DesignStyleDeclaration): void {
  const position = pickStyle(style, 'position')
  if (position === 'absolute' || position === 'fixed') node.layoutPositioning = 'ABSOLUTE'

  const left = firstCSSNumber(style, 'left')
  const top = firstCSSNumber(style, 'top')
  if (left !== null) node.x = left
  if (top !== null) node.y = top
}

/** The padding and borders between an element's border box and its content box, per side. */
export interface ContentInsets {
  top: number
  right: number
  bottom: number
  left: number
}

export function contentInsets(style: DesignStyleDeclaration): ContentInsets {
  // A border takes room once it has a style other than none, its CSS default, whatever its color.
  const borderStyle = borderStyleFromCSS(style)
  const bordered = borderStyle !== undefined && borderStyle !== 'none' && borderStyle !== 'hidden'
  const side = (name: keyof ContentInsets, axis: 'block' | 'inline') =>
    (firstCSSNumber(style, `padding-${name}`, `padding-${axis}`, 'padding') ?? 0) +
    (bordered ? (firstCSSNumber(style, `border-${name}-width`, 'border-width') ?? 0) : 0)
  return {
    top: side('top', 'block'),
    right: side('right', 'inline'),
    bottom: side('bottom', 'block'),
    left: side('left', 'inline')
  }
}

/**
 * What CSS adds outside an explicit size: padding and borders, unless `box-sizing: border-box`
 * puts them inside it as auto layout does.
 */
function contentBoxExtras(style: DesignStyleDeclaration): { width: number; height: number } {
  if (pickStyle(style, 'box-sizing')?.trim() === 'border-box') return { width: 0, height: 0 }
  const insets = contentInsets(style)
  return { width: insets.left + insets.right, height: insets.top + insets.bottom }
}

/** Explicit sizes count the padding and borders CSS places outside them. */
export function applyBoxSizing(node: SceneNode, style: DesignStyleDeclaration): void {
  const extras = contentBoxExtras(style)
  const width = firstCSSNumber(style, 'width')
  const height = firstCSSNumber(style, 'height')
  // A size `aspect-ratio` derives from the other is a content size too.
  const ratio = aspectRatioFromCSS(pickStyle(style, 'aspect-ratio')) !== null
  if (extras.width > 0) {
    if (width !== null || (ratio && height !== null)) node.width += extras.width
    if (node.minWidth !== null) node.minWidth += extras.width
    if (node.maxWidth !== null) node.maxWidth += extras.width
  }
  if (extras.height > 0) {
    if (height !== null || (ratio && width !== null)) node.height += extras.height
    if (node.minHeight !== null) node.minHeight += extras.height
    if (node.maxHeight !== null) node.maxHeight += extras.height
  }
}

export function applyPadding(node: SceneNode, style: DesignStyleDeclaration): void {
  node.paddingTop = firstCSSNumber(style, 'padding-top', 'padding-block', 'padding') ?? 0
  node.paddingRight = firstCSSNumber(style, 'padding-right', 'padding-inline', 'padding') ?? 0
  node.paddingBottom = firstCSSNumber(style, 'padding-bottom', 'padding-block', 'padding') ?? 0
  node.paddingLeft = firstCSSNumber(style, 'padding-left', 'padding-inline', 'padding') ?? 0
}
