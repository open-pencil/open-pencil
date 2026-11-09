import { MeasureMode, type Node as YogaNode } from 'yoga-layout'

import type { SceneNode } from '@open-pencil/scene-graph'

import { measuredSize } from '#core/layout/measured-size'
import { setYogaFlexGrow, setYogaHeight, setYogaWidth } from '#core/layout/yoga-helpers'

import { estimateTextSize, measureAutoWidthText, measureTextForLayout } from './measurement'

/**
 * Fill text shares its parent's main axis like a fill frame: it grows and shrinks from a zero
 * basis, so its stored width (100px for new text) never decides its share. Returns whether
 * it fills the row's width, where its stored width must not constrain it either.
 */
function configureGrowingText(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  fixedDerivedMainAxis: boolean
): boolean {
  if (child.layoutGrow <= 0 || fixedDerivedMainAxis) return false
  setYogaFlexGrow(yogaChild, child.layoutGrow)
  yogaChild.setFlexShrink(1)
  yogaChild.setFlexBasis(0)
  return parent.layoutMode === 'HORIZONTAL'
}

export function configureTextLeafWithoutMeasurer(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  fixedDerivedMainAxis: boolean
): void {
  const hasStoredSize =
    child.width > 0 && child.height > 0 && !(child.width === 100 && child.height === 100)

  if (child.textAutoResize === 'WIDTH_AND_HEIGHT') {
    if (hasStoredSize) {
      setYogaWidth(yogaChild, child.width)
      setYogaHeight(yogaChild, child.height)
    } else {
      const estimated = estimateTextSize(child)
      setYogaWidth(yogaChild, estimated.width)
      setYogaHeight(yogaChild, estimated.height)
    }
    return
  }
  if (child.textAutoResize !== 'HEIGHT') return

  const growsWidth = configureGrowingText(yogaChild, child, parent, fixedDerivedMainAxis)
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const measurementWidth = fixedDerivedMainAxis
    ? (child.derivedLayout?.width ?? child.width)
    : child.width
  const stretches =
    child.layoutAlignSelf === 'STRETCH' ||
    (child.layoutAlignSelf === 'AUTO' && parent.counterAxisAlign === 'STRETCH')
  if (!(!isRow && stretches) && !fixedDerivedMainAxis && !growsWidth) {
    setYogaWidth(yogaChild, child.width)
  }
  if (hasStoredSize) setYogaHeight(yogaChild, child.height)
  else setYogaHeight(yogaChild, estimateTextSize(child, measurementWidth).height)
}

export function configureTextLeaf(
  yogaChild: YogaNode,
  child: SceneNode,
  parent: SceneNode,
  fixedDerivedMainAxis = false
): void {
  const autoResize = child.textAutoResize
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const growsWidth = configureGrowingText(yogaChild, child, parent, fixedDerivedMainAxis)
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
      setYogaWidth(yogaChild, child.width)
      setYogaHeight(yogaChild, child.height)
      return
    }

    // Auto-width text keeps each line whole, as Figma's does, in a parent narrower than the text;
    // only a width that layout or a max width sets wraps it.
    const wraps = fillsWidth || child.maxWidth != null
    yogaChild.setMeasureFunc((width, widthMode, _height, _heightMode) => {
      const maxW = wraps && widthMode !== MeasureMode.Undefined ? width : undefined
      const cacheKey = maxW === undefined ? UNCONSTRAINED_KEY : Math.round(maxW)
      const cached = cache.get(cacheKey)
      if (cached) return cached

      const result = measuredSize(
        () => ({ width: child.width, height: child.height }),
        () => measureAutoWidthText(child, maxW)
      )
      cache.set(cacheKey, result)
      return result
    })
  } else if (autoResize === 'HEIGHT') {
    const fixedWidth = fixedDerivedMainAxis
      ? (child.derivedLayout?.width ?? child.width)
      : child.width
    // Let Yoga stretch or grow fill-width text instead of fixing its stored width.
    if (child.layoutGrow <= 0 && !fillsWidth) {
      setYogaWidth(yogaChild, fixedWidth)
    }
    yogaChild.setMeasureFunc((width, widthMode, _height, _heightMode) => {
      let constraintW = fixedWidth
      if (fillsWidth) {
        if (widthMode !== MeasureMode.Undefined) constraintW = width
      } else if (widthMode !== MeasureMode.Undefined) {
        constraintW = Math.min(width, fixedWidth || width)
      }
      const cacheKey = Math.round(constraintW)
      const cached = cache.get(cacheKey)
      if (cached) return cached

      if (constraintW === child.width && (child.derivedTextGlyphs?.length ?? 0) > 0) {
        return { width: constraintW, height: child.height }
      }
      const result = measuredSize(
        () => ({ width: constraintW, height: child.height }),
        () => ({ width: constraintW, height: measureTextForLayout(child, constraintW).height })
      )
      cache.set(cacheKey, result)
      return result
    })
  }
}
