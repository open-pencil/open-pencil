import type { Fill, SceneNode, Stroke } from '@open-pencil/scene-graph'
import {
  dimension,
  parseCSSAspectRatio,
  parseCSSNumber,
  splitCSSValue
} from '@open-pencil/scene-graph/css'
import type { Size } from '@open-pencil/scene-graph/primitives'
import { maxOf } from '@open-pencil/std/arrays'

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

export function setNodeBox(node: SceneNode, style: DesignStyleDeclaration): void {
  const width = firstCSSNumber(style, 'width')
  const height = firstCSSNumber(style, 'height')
  const minWidth = firstCSSNumber(style, 'min-width')
  const maxWidth = firstCSSNumber(style, 'max-width')
  const minHeight = firstCSSNumber(style, 'min-height')
  const maxHeight = firstCSSNumber(style, 'max-height')
  if (width !== null) node.width = width
  if (height !== null) node.height = height
  const aspect = parseCSSAspectRatio(pickStyle(style, 'aspect-ratio'))
  if (aspect && (width === null) !== (height === null)) {
    // The ratio sizes the box `box-sizing` names, or the content box beside `auto`.
    const insets =
      aspect.auto && pickStyle(style, 'box-sizing')?.trim() === 'border-box'
        ? contentInsets(style)
        : { top: 0, right: 0, bottom: 0, left: 0 }
    const across = insets.left + insets.right
    const down = insets.top + insets.bottom
    // Padding and borders wider than the box leave an empty content box, as CSS floors it.
    if (width !== null) node.height = Math.max(0, width - across) / aspect.ratio + down
    if (height !== null) node.width = Math.max(0, height - down) * aspect.ratio + across
  }
  if (minWidth !== null) node.minWidth = minWidth
  if (maxWidth !== null) node.maxWidth = maxWidth
  if (minHeight !== null) node.minHeight = minHeight
  if (maxHeight !== null) node.maxHeight = maxHeight
}

type BorderSide = 'top' | 'right' | 'bottom' | 'left'

const BORDER_SIDES: readonly BorderSide[] = ['top', 'right', 'bottom', 'left']

/**
 * Which of a one- to four-value box shorthand's values each side takes, as CSS assigns them:
 * top, right, bottom, left, with a missing value repeating the opposite side's.
 */
const SHORTHAND_VALUE_INDEX: Record<BorderSide, readonly number[]> = {
  top: [0, 0, 0, 0],
  right: [0, 1, 1, 1],
  bottom: [0, 0, 2, 2],
  left: [0, 1, 1, 3]
}

/** A side's own value, or the side's value in a one- to four-value box shorthand. */
function sideValue(
  style: DesignStyleDeclaration,
  longhand: string,
  shorthand: string,
  side: BorderSide
): string | undefined {
  const own = pickStyle(style, longhand)
  if (own !== undefined) return own
  const values = splitCSSValue(pickStyle(style, shorthand) ?? '')
  if (values.length === 0 || values.length > 4) return undefined
  return values[SHORTHAND_VALUE_INDEX[side][values.length - 1]]
}

/** A side's own border style, or its value in the `border-style` shorthand. */
function sideStyle(style: DesignStyleDeclaration, side: BorderSide): string | undefined {
  return sideValue(style, `border-${side}-style`, 'border-style', side)
}

/**
 * Whether a side's border is drawn: its style is neither `none`, CSS's default, nor `hidden`,
 * and it has a width, as a reset such as `* { border: 0 solid }` styles every side without
 * drawing any. A side with no width given is drawn, as `border: solid` gives it `medium`.
 */
function paints(style: DesignStyleDeclaration, side: BorderSide): boolean {
  const value = sideStyle(style, side)
  if (value === undefined || value === 'none' || value === 'hidden') return false
  const width = parseCSSNumber(sideValue(style, `border-${side}-width`, 'border-width', side))
  return width === null || width > 0
}

/** The sides whose borders are drawn, in CSS order. */
function paintedSides(style: DesignStyleDeclaration): BorderSide[] {
  return BORDER_SIDES.filter((side) => paints(style, side))
}

/** The property that colors the first side whose border is drawn. */
export function firstStrokeProperty(style: DesignStyleDeclaration): string | null {
  const side = paintedSides(style).at(0)
  return side ? `border-${side}-color` : null
}

/** The color of the first side whose border is drawn, or the shorthand's. */
export function firstStrokeColor(style: DesignStyleDeclaration) {
  const side = paintedSides(style).at(0)
  return (
    (side && pickStyle(style, `border-${side}-color`)) ??
    pickStyle(style, 'border-color') ??
    pickStyle(style, 'border-top-color')
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
  return maxOf(sideWeights)
}

/**
 * Whether the element has a border on any side: a side needs a style other than `none`, its CSS
 * default, or `hidden`, whatever its width and color.
 */
export function hasBorder(style: DesignStyleDeclaration): boolean {
  return paintedSides(style).length > 0
}

export function dashPatternFromCSS(style: DesignStyleDeclaration, strokeWeight: number): number[] {
  const side = paintedSides(style).at(0)
  const borderStyle = side && sideStyle(style, side)
  if (borderStyle === 'dashed') return [strokeWeight * 3, strokeWeight * 2]
  if (borderStyle === 'dotted') return [strokeWeight, strokeWeight]
  return []
}

export function setBorderWeights(
  node: SceneNode,
  style: DesignStyleDeclaration,
  stroke: Stroke
): void {
  // A side whose border is not drawn has none.
  const weight = (side: BorderSide) =>
    paints(style, side) ? (firstCSSNumber(style, `border-${side}-width`) ?? stroke.weight) : 0
  const [top, right, bottom, left] = BORDER_SIDES.map(weight)
  node.borderTopWeight = top
  node.borderRightWeight = right
  node.borderBottomWeight = bottom
  node.borderLeftWeight = left
  node.independentStrokeWeights = [top, right, bottom, left].some(
    (weight) => weight !== stroke.weight
  )
}

/**
 * A corner's radius in pixels. A percentage is of the box, across and down; a layer has one radius
 * per corner, so it takes the smaller, which turns `50%` on a square into a circle.
 */
function cornerRadiusOf(value: string | undefined, box: Size | undefined): number | null {
  const first = splitCSSValue(value ?? '').at(0)
  const percentage = first ? dimension(first) : null
  if (percentage?.unit === '%' && box) {
    return (percentage.number / 100) * Math.min(box.width, box.height)
  }
  return parseCSSNumber(first)
}

/** Corner radii, a percentage of `box`, the size the element was laid out at. */
export function applyCornerRadii(
  node: SceneNode,
  style: DesignStyleDeclaration,
  box: Size | undefined
): void {
  const radius = (property: string) => cornerRadiusOf(pickStyle(style, property), box)
  const cornerRadius = radius('border-radius')
  const topLeft = radius('border-top-left-radius')
  const topRight = radius('border-top-right-radius')
  const bottomRight = radius('border-bottom-right-radius')
  const bottomLeft = radius('border-bottom-left-radius')

  const corners = [topLeft, topRight, bottomRight, bottomLeft]
  // A runtime that reports only the longhands, as computed styles do, gives four equal corners
  // for one radius.
  const uniform =
    cornerRadius ??
    (corners.every((corner) => corner !== null && corner === topLeft) ? topLeft : null)
  if (uniform !== null) node.cornerRadius = uniform
  if (corners.every((corner) => corner === null)) return

  const fallback = uniform ?? 0
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

/** The width of each side's border that is drawn; a side whose border is not drawn has none. */
export function borderWidths(style: DesignStyleDeclaration): ContentInsets {
  const side = (name: BorderSide) =>
    paints(style, name)
      ? (parseCSSNumber(sideValue(style, `border-${name}-width`, 'border-width', name)) ?? 0)
      : 0
  return { top: side('top'), right: side('right'), bottom: side('bottom'), left: side('left') }
}

/**
 * A cell of a table with collapsed borders holds half of each, the neighbouring cell or the
 * table the other half (CSS 2.1 §17.6.2).
 */
function isCollapsedCell(style: DesignStyleDeclaration): boolean {
  return (
    pickStyle(style, 'display')?.trim() === 'table-cell' &&
    pickStyle(style, 'border-collapse')?.trim() === 'collapse'
  )
}

export function contentInsets(style: DesignStyleDeclaration): ContentInsets {
  const borders = borderWidths(style)
  const share = isCollapsedCell(style) ? 0.5 : 1
  const side = (name: BorderSide, axis: 'block' | 'inline') =>
    paddingOf(style, name, axis) + borders[name] * share
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

/**
 * Explicit sizes count the padding and borders CSS places outside them, and a border-box size
 * smaller than its padding and borders grows to hold them, as its content box is at least empty.
 */
export function applyBoxSizing(node: SceneNode, style: DesignStyleDeclaration): void {
  const width = firstCSSNumber(style, 'width')
  const height = firstCSSNumber(style, 'height')
  // A size `aspect-ratio` derives from the other is a content size too.
  const ratio = parseCSSAspectRatio(pickStyle(style, 'aspect-ratio')) !== null
  const sizedAcross = width !== null || (ratio && height !== null)
  const sizedDown = height !== null || (ratio && width !== null)
  if (pickStyle(style, 'box-sizing')?.trim() === 'border-box') {
    const insets = contentInsets(style)
    if (sizedAcross) node.width = Math.max(node.width, insets.left + insets.right)
    if (sizedDown) node.height = Math.max(node.height, insets.top + insets.bottom)
    return
  }
  const extras = contentBoxExtras(style)
  if (extras.width > 0) {
    if (sizedAcross) node.width += extras.width
    if (node.minWidth !== null) node.minWidth += extras.width
    if (node.maxWidth !== null) node.maxWidth += extras.width
  }
  if (extras.height > 0) {
    if (sizedDown) node.height += extras.height
    if (node.minHeight !== null) node.minHeight += extras.height
    if (node.maxHeight !== null) node.maxHeight += extras.height
  }
}

/** A side's padding: its own, its axis's, or its value in the `padding` shorthand. */
function paddingOf(style: DesignStyleDeclaration, side: BorderSide, axis: 'block' | 'inline') {
  return (
    firstCSSNumber(style, `padding-${side}`, `padding-${axis}`) ??
    parseCSSNumber(sideValue(style, `padding-${side}`, 'padding', side)) ??
    0
  )
}

export function applyPadding(node: SceneNode, style: DesignStyleDeclaration): void {
  node.paddingTop = paddingOf(style, 'top', 'block')
  node.paddingRight = paddingOf(style, 'right', 'inline')
  node.paddingBottom = paddingOf(style, 'bottom', 'block')
  node.paddingLeft = paddingOf(style, 'left', 'inline')
}
