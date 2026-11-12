import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { LayoutNode } from '@open-pencil/taffy'

import { asFlatLeaf } from './axis-sizing'
import { derivedGrowingLeafFitsParent } from './fills-parent'
import {
  applyLockedAspectRatio,
  applyMinMaxConstraints,
  configureNonTextLeaf,
  mapAlignSelf,
  measureByWidth
} from './node'
import {
  estimateTextSize,
  getTextMeasurer,
  measureAutoWidthText,
  measureTextForLayout
} from './text-measurement'

/**
 * Fill text shares its parent's main axis like a fill frame: it grows and shrinks from a zero
 * basis, so its stored width (100px for new text) never decides its share. Returns whether
 * it fills the row's width, where its stored width must not constrain it either.
 */
function configureGrowingText(
  item: LayoutNode,
  child: SceneNode,
  parent: SceneNode,
  fixedDerivedMainAxis: boolean
): boolean {
  if (child.layoutGrow <= 0 || fixedDerivedMainAxis) return false
  item.style.flexGrow = child.layoutGrow
  item.style.flexShrink = 1
  item.style.flexBasis = 0
  return parent.layoutMode === 'HORIZONTAL'
}

function configureTextLeafWithoutMeasurer(
  item: LayoutNode,
  child: SceneNode,
  parent: SceneNode,
  fixedDerivedMainAxis: boolean
): void {
  const hasStoredSize =
    child.width > 0 && child.height > 0 && !(child.width === 100 && child.height === 100)

  if (child.textAutoResize === 'WIDTH_AND_HEIGHT') {
    if (hasStoredSize) {
      item.style.width = child.width
      item.style.height = child.height
    } else {
      const estimated = estimateTextSize(child)
      item.style.width = estimated.width
      item.style.height = estimated.height
    }
    return
  }
  if (child.textAutoResize !== 'HEIGHT') return

  const growsWidth = configureGrowingText(item, child, parent, fixedDerivedMainAxis)
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const measurementWidth = fixedDerivedMainAxis
    ? (child.derivedLayout?.width ?? child.width)
    : child.width
  const stretches =
    child.layoutAlignSelf === 'STRETCH' ||
    (child.layoutAlignSelf === 'AUTO' && parent.counterAxisAlign === 'STRETCH')
  if (!(!isRow && stretches) && !fixedDerivedMainAxis && !growsWidth) {
    item.style.width = child.width
  }
  if (hasStoredSize) item.style.height = child.height
  else item.style.height = estimateTextSize(child, measurementWidth).height
}

/**
 * Sizes a child with no auto layout of its own in its auto layout parent: text measured as it
 * resizes, or estimated without a measurer, and any other layer at its own size.
 */
export function configureChildAsLeaf(
  item: LayoutNode,
  node: SceneNode,
  parent: SceneNode,
  graph: SceneGraph
): void {
  const child = asFlatLeaf(node, parent)
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const selfOverride = child.layoutAlignSelf !== 'AUTO'
  const stretchCross = selfOverride
    ? child.layoutAlignSelf === 'STRETCH'
    : parent.counterAxisAlign === 'STRETCH'

  const isText = child.type === 'TEXT'
  const textMeasurer = getTextMeasurer()
  const needsMeasureFunc = isText && textMeasurer && child.textAutoResize !== 'NONE'

  const fixedDerivedMainAxis = isRow
    ? derivedGrowingLeafFitsParent(graph, parent, child, 'width')
    : derivedGrowingLeafFitsParent(graph, parent, child, 'height')

  if (fixedDerivedMainAxis) {
    if (isRow) item.style.width = child.derivedLayout?.width ?? child.width
    else item.style.height = child.derivedLayout?.height ?? child.height
  }

  if (needsMeasureFunc) {
    configureTextLeaf(item, child, parent, fixedDerivedMainAxis)
  } else if (isText && !textMeasurer && child.textAutoResize !== 'NONE') {
    configureTextLeafWithoutMeasurer(item, child, parent, fixedDerivedMainAxis)
  } else {
    configureNonTextLeaf(item, child, isRow, stretchCross)
    // Fixed text still contributes its box to a HUG cross axis. Without
    // an intrinsic minimum, stretch collapses the text to its siblings.
    if (isText && stretchCross && parent.counterAxisSizing === 'HUG') {
      if (isRow) item.style.minHeight = child.height
      else item.style.minWidth = child.width
    }
  }

  const selfAlign = mapAlignSelf(child.layoutAlignSelf)
  if (selfAlign != null) item.style.alignSelf = selfAlign

  applyLockedAspectRatio(item, child, parent)
  applyMinMaxConstraints(item, child)
}

function configureTextLeaf(
  item: LayoutNode,
  child: SceneNode,
  parent: SceneNode,
  fixedDerivedMainAxis = false
): void {
  const autoResize = child.textAutoResize
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const growsWidth = configureGrowingText(item, child, parent, fixedDerivedMainAxis)
  const stretchesCross =
    child.layoutAlignSelf === 'STRETCH' ||
    (child.layoutAlignSelf === 'AUTO' && parent.counterAxisAlign === 'STRETCH')
  // Layout sets the width of text that grows along a row or stretches across a column.
  const fillsWidth = (!isRow && stretchesCross) || growsWidth

  const cache = new Map<number, { width: number; height: number }>()
  const UNCONSTRAINED_KEY = -1

  if (autoResize === 'WIDTH_AND_HEIGHT') {
    const importedSize = child.derivedLayout
    if (importedSize?.width !== undefined && importedSize.height !== undefined) {
      item.style.width = child.width
      item.style.height = child.height
      return
    }

    // Auto-width text keeps each line whole, as Figma's does, in a parent narrower than the text;
    // only a width that layout or a max width sets wraps it. Text that fills takes the width
    // layout gives it, narrowed by its max width; other text wraps at its max width alone.
    measureByWidth(item, (width) => {
      const limit = Math.min(
        fillsWidth ? (width ?? Infinity) : Infinity,
        child.maxWidth ?? Infinity
      )
      const maxW = Number.isFinite(limit) ? limit : undefined
      const cacheKey = maxW === undefined ? UNCONSTRAINED_KEY : Math.round(maxW)
      const cached = cache.get(cacheKey)
      if (cached) return cached

      const result = measureAutoWidthText(child, maxW)
      cache.set(cacheKey, result)
      return result
    })
  } else if (autoResize === 'HEIGHT') {
    const fixedWidth = fixedDerivedMainAxis
      ? (child.derivedLayout?.width ?? child.width)
      : child.width
    // Let layout stretch or grow fill-width text instead of fixing its stored width.
    if (child.layoutGrow <= 0 && !fillsWidth) {
      item.style.width = fixedWidth
    }
    measureByWidth(item, (width) => {
      let constraintW = fixedWidth
      if (fillsWidth) {
        if (width !== undefined) constraintW = width
      } else if (width !== undefined) {
        constraintW = Math.min(width, fixedWidth || width)
      }
      const cacheKey = Math.round(constraintW)
      const cached = cache.get(cacheKey)
      if (cached) return cached

      if (constraintW === child.width && (child.derivedTextGlyphs?.length ?? 0) > 0) {
        return { width: constraintW, height: child.height }
      }
      const result = { width: constraintW, height: measureTextForLayout(child, constraintW).height }
      cache.set(cacheKey, result)
      return result
    })
  }
}
