import type { NodeChange, Paint, Effect as KiwiEffect } from '#core/kiwi/binary/codec'
import {
  convertFills,
  mapStackSizing,
  mapStackJustify,
  mapStackCounterAlign,
  mapAlignSelf,
  mapTextDecoration,
  convertLineHeight,
  convertLetterSpacing,
  mapArcData,
  importStyleRuns,
  convertStrokes,
  convertEffects
} from '#core/kiwi/node-change/convert'
import type { SceneNode, ArcData, TextAutoResize } from '#core/scene-graph'
import { styleToWeight } from '#core/text/fonts'

function applyOverridePaints(ov: Record<string, unknown>, updates: Partial<SceneNode>): void {
  if (ov.textData != null) {
    const td = ov.textData as { characters?: string }
    if (td.characters != null) updates.text = td.characters
    const runs = importStyleRuns(ov as NodeChange)
    if (runs.length > 0) updates.styleRuns = runs
  }
  if (ov.fillPaints != null) updates.fills = convertFills(ov.fillPaints as Paint[])
  if (ov.strokePaints != null)
    updates.strokes = convertStrokes(
      ov.strokePaints as Paint[],
      ov.strokeWeight as number | undefined,
      ov.strokeAlign as string | undefined
    )
  if (ov.effects != null) updates.effects = convertEffects(ov.effects as KiwiEffect[])
  if (ov.visible != null) updates.visible = ov.visible as boolean
  if (ov.opacity != null) updates.opacity = ov.opacity as number
  if (ov.name != null) updates.name = ov.name as string
  if (ov.locked != null) updates.locked = ov.locked as boolean
}

function applyOverrideGeometry(ov: Record<string, unknown>, updates: Partial<SceneNode>): void {
  if (ov.size != null) {
    const sz = ov.size as { x?: number; y?: number }
    if (sz.x != null) updates.width = sz.x
    if (sz.y != null) updates.height = sz.y
  }
  if (ov.cornerRadius != null) updates.cornerRadius = ov.cornerRadius as number
  if (ov.rectangleTopLeftCornerRadius != null)
    updates.topLeftRadius = ov.rectangleTopLeftCornerRadius as number
  if (ov.rectangleTopRightCornerRadius != null)
    updates.topRightRadius = ov.rectangleTopRightCornerRadius as number
  if (ov.rectangleBottomRightCornerRadius != null)
    updates.bottomRightRadius = ov.rectangleBottomRightCornerRadius as number
  if (ov.rectangleBottomLeftCornerRadius != null)
    updates.bottomLeftRadius = ov.rectangleBottomLeftCornerRadius as number
  if (ov.rectangleCornerRadiiIndependent != null)
    updates.independentCorners = ov.rectangleCornerRadiiIndependent as boolean
  if (ov.arcData != null) updates.arcData = mapArcData(ov.arcData as Partial<ArcData> | undefined)
  if (ov.frameMaskDisabled != null) updates.clipsContent = ov.frameMaskDisabled === false
}

function applyOverrideLayout(ov: Record<string, unknown>, updates: Partial<SceneNode>): void {
  if (ov.stackSpacing != null) updates.itemSpacing = ov.stackSpacing as number
  if (ov.stackPrimarySizing != null)
    updates.primaryAxisSizing = mapStackSizing(ov.stackPrimarySizing as string)
  if (ov.stackCounterSizing != null)
    updates.counterAxisSizing = mapStackSizing(ov.stackCounterSizing as string)
  if (ov.stackPrimaryAlignItems != null)
    updates.primaryAxisAlign = mapStackJustify(ov.stackPrimaryAlignItems as string)
  if (ov.stackCounterAlignItems != null)
    updates.counterAxisAlign = mapStackCounterAlign(ov.stackCounterAlignItems as string)
  if (ov.stackChildPrimaryGrow != null) updates.layoutGrow = ov.stackChildPrimaryGrow as number
  if (ov.stackChildAlignSelf != null)
    updates.layoutAlignSelf = mapAlignSelf(ov.stackChildAlignSelf as string)
  if (ov.stackPositioning != null)
    updates.layoutPositioning = (ov.stackPositioning as string) === 'ABSOLUTE' ? 'ABSOLUTE' : 'AUTO'
  if (ov.stackVerticalPadding != null) {
    updates.paddingTop = ov.stackVerticalPadding as number
    if (ov.stackPaddingBottom == null) updates.paddingBottom = ov.stackVerticalPadding as number
  }
  if (ov.stackHorizontalPadding != null) {
    updates.paddingLeft = ov.stackHorizontalPadding as number
    if (ov.stackPaddingRight == null) updates.paddingRight = ov.stackHorizontalPadding as number
  }
  if (ov.stackPaddingBottom != null) updates.paddingBottom = ov.stackPaddingBottom as number
  if (ov.stackPaddingRight != null) updates.paddingRight = ov.stackPaddingRight as number
}

function applyOverrideStrokes(ov: Record<string, unknown>, updates: Partial<SceneNode>): void {
  if (ov.strokeWeight != null && !ov.strokePaints) {
    updates.strokes = updates.strokes ?? []
  }
  if (ov.strokeAlign != null && updates.strokes) {
    let align: 'INSIDE' | 'OUTSIDE' | 'CENTER' = 'CENTER'
    if (ov.strokeAlign === 'INSIDE') align = 'INSIDE'
    else if (ov.strokeAlign === 'OUTSIDE') align = 'OUTSIDE'
    for (const s of updates.strokes) s.align = align
  }
  if (ov.borderTopWeight != null) updates.borderTopWeight = ov.borderTopWeight as number
  if (ov.borderRightWeight != null) updates.borderRightWeight = ov.borderRightWeight as number
  if (ov.borderBottomWeight != null) updates.borderBottomWeight = ov.borderBottomWeight as number
  if (ov.borderLeftWeight != null) updates.borderLeftWeight = ov.borderLeftWeight as number
  if (ov.borderStrokeWeightsIndependent != null)
    updates.independentStrokeWeights = ov.borderStrokeWeightsIndependent as boolean
}

function applyOverrideText(ov: Record<string, unknown>, updates: Partial<SceneNode>): void {
  if (ov.fontName != null) {
    const fn = ov.fontName as { family?: string; style?: string }
    if (fn.family) updates.fontFamily = fn.family
    if (fn.style) {
      updates.fontWeight = styleToWeight(fn.style)
      updates.italic = fn.style.toLowerCase().includes('italic')
    }
  }
  if (ov.fontSize != null) updates.fontSize = ov.fontSize as number
  if (ov.textAlignHorizontal != null)
    updates.textAlignHorizontal = ov.textAlignHorizontal as SceneNode['textAlignHorizontal']
  if (ov.textAutoResize != null) updates.textAutoResize = ov.textAutoResize as TextAutoResize
  if (ov.lineHeight != null)
    updates.lineHeight = convertLineHeight(
      ov.lineHeight as NodeChange['lineHeight'],
      ov.fontSize as number | undefined
    )
  if (ov.letterSpacing != null)
    updates.letterSpacing = convertLetterSpacing(
      ov.letterSpacing as NodeChange['letterSpacing'],
      ov.fontSize as number | undefined
    )
  if (ov.maxLines != null) updates.maxLines = ov.maxLines as number | null
  if (ov.textTruncation != null)
    updates.textTruncation = (ov.textTruncation as string) === 'ENDING' ? 'ENDING' : 'DISABLED'
  if (ov.textDecoration != null)
    updates.textDecoration = mapTextDecoration(ov.textDecoration as string)
}

export function convertOverrideToProps(ov: Record<string, unknown>): Partial<SceneNode> {
  const updates: Partial<SceneNode> = {}
  applyOverridePaints(ov, updates)
  applyOverrideGeometry(ov, updates)
  applyOverrideLayout(ov, updates)
  applyOverrideStrokes(ov, updates)
  applyOverrideText(ov, updates)
  return updates
}
