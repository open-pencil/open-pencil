import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  COMPONENT_LABEL_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  LABEL_FONT_SIZE,
  SECTION_TITLE_FONT_SIZE,
  SIZE_FONT_SIZE
} from '#core/constants'
import { fontManager } from '#core/text/fonts'
import { prepareGraphFonts } from '#core/text/prepare'
import type { FontResolutionSnapshot } from '#core/text/resolver'

export function syncFontGeneration(r: SkiaRenderer): void {
  r.fontGeneration = fontManager.generation()
}

export function trackFontDemand(r: SkiaRenderer, node: SceneNode, key: string): void {
  const pending = r.pendingFontNodes.get(node.id) ?? { node, keys: new Set<string>() }
  pending.node = node
  pending.keys.add(key)
  r.pendingFontNodes.set(node.id, pending)
}

interface TextPictureGenerationState {
  fontGeneration: number
  textPictureGenerations: Map<string, { data: Uint8Array; generation: number }>
}

export function isTextPictureCurrent(r: TextPictureGenerationState, node: SceneNode): boolean {
  const data = node.textPicture
  if (!data) {
    r.textPictureGenerations.delete(node.id)
    return false
  }
  const cached = r.textPictureGenerations.get(node.id)
  if (!cached || cached.data !== data) {
    r.textPictureGenerations.set(node.id, { data, generation: r.fontGeneration })
    return true
  }
  return cached.generation === r.fontGeneration
}

function settleFontDemand(
  r: SkiaRenderer,
  snapshot: FontResolutionSnapshot,
  nodeIds: readonly string[]
): void {
  syncFontGeneration(r)
  for (const nodeId of nodeIds) {
    const pending = r.pendingFontNodes.get(nodeId)
    if (pending) {
      pending.node.textPicture = null
      pending.keys.delete(snapshot.key)
      if (pending.keys.size === 0) r.pendingFontNodes.delete(nodeId)
    }
    r.textPictureGenerations.delete(nodeId)
    r.invalidateNodePicture(nodeId)
  }
}

export function getFontProvider(r: SkiaRenderer) {
  return r.isDestroyed() || !r.fontProvider ? null : r.fontProvider
}

export async function loadFonts(
  r: SkiaRenderer,
  onFallbackFontsLoaded?: () => void
): Promise<void> {
  if (r.isDestroyed()) return
  r.onFontResolutionSettled = (snapshot, nodeIds) => {
    if (r.isDestroyed()) return
    settleFontDemand(r, snapshot, nodeIds)
    onFallbackFontsLoaded?.()
  }
  r.fontProvider?.delete()
  r.fontProvider = r.ck.TypefaceFontProvider.Make()

  fontManager.attachProvider(r.ck, r.fontProvider)
  syncFontGeneration(r)

  const fontData = await fontManager.loadFont(DEFAULT_FONT_FAMILY, 'Regular')
  if (r.isDestroyed()) return
  if (fontData) {
    const typeface = r.ck.Typeface.MakeFreeTypeFaceFromData(fontData)
    if (typeface) {
      r.textFont?.delete()
      r.labelFont?.delete()
      r.sizeFont?.delete()
      r.sectionTitleFont?.delete()
      r.componentLabelFont?.delete()
      r.textFont = new r.ck.Font(typeface, DEFAULT_FONT_SIZE)
      r.labelFont = new r.ck.Font(typeface, LABEL_FONT_SIZE)
      r.sizeFont = new r.ck.Font(typeface, SIZE_FONT_SIZE)
      r.sectionTitleFont = new r.ck.Font(typeface, SECTION_TITLE_FONT_SIZE)
      r.componentLabelFont = new r.ck.Font(typeface, COMPONENT_LABEL_FONT_SIZE)
      r.profiler.setTypeface(typeface)
    }
    r.fontMgr = r.ck.FontMgr.FromData(fontData) ?? null
  }

  r.fontsLoaded = true
  syncFontGeneration(r)
  r.invalidateAllPictures()
}

export async function prepareForExport(
  r: SkiaRenderer,
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[]
): Promise<() => void> {
  const { getTextMeasurer, setTextMeasurer, computeAllLayouts } = await import('#core/layout')

  const previousTextMeasurer = getTextMeasurer()
  setTextMeasurer((node, maxWidth) => r.measureTextNode(node, maxWidth))

  await prepareGraphFonts(graph, nodeIds)
  syncFontGeneration(r)
  computeAllLayouts(graph, pageId)

  return () => setTextMeasurer(previousTextMeasurer)
}
