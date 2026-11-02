import type { Font } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import type { NodeFontReadiness } from '#core/canvas/text'
import {
  COMPONENT_LABEL_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  LABEL_FONT_SIZE,
  SECTION_TITLE_FONT_FAMILY,
  SECTION_TITLE_FONT_SIZE,
  SECTION_TITLE_FONT_URL,
  SIZE_FONT_SIZE,
  VALUE_FONT_SIZE
} from '#core/constants'
import { withTextMeasurer } from '#core/layout/text-measurement'
import { EMOJI_METRICS_FAMILY } from '#core/text/emoji'
import { fontManager } from '#core/text/font/manager'
import { prepareGraphFonts } from '#core/text/prepare'
import {
  fontCoverageDemand,
  fontResolver,
  missingGlyphsByScript,
  type MissingGlyphOccurrence,
  type FontResolutionSnapshot
} from '#core/text/resolver'

/** The faces the canvas chrome draws with, and the plain face text falls back to. */
export interface ChromeFonts {
  text: Font | null
  label: Font | null
  size: Font | null
  /** Inter SemiBold at 11 px, which Figma sets the padding and gap values on the canvas in. */
  value: Font | null
  sectionTitle: Font | null
  componentLabel: Font | null
}

export function createChromeFonts(): ChromeFonts {
  return {
    text: null,
    label: null,
    size: null,
    value: null,
    sectionTitle: null,
    componentLabel: null
  }
}

export interface PendingFontNode {
  node: SceneNode
  keys: Set<string>
}

/** Font bookkeeping per text layer: demands in flight, saved pictures' generations, and readiness. */
export interface TextFontState {
  readonly pending: Map<string, PendingFontNode>
  readonly pictureGenerations: Map<string, { data: Uint8Array; generation: number }>
  /** Readiness of a text's fonts, found once per layer per font generation; a change to the layer drops it. */
  readonly readiness: Map<
    string,
    { node: SceneNode; generation: number; readiness: NodeFontReadiness }
  >
}

export function createTextFontState(): TextFontState {
  return { pending: new Map(), pictureGenerations: new Map(), readiness: new Map() }
}

export function resolveLabelFontCoverage(
  r: Pick<SkiaRenderer, 'isDestroyed' | 'onFontResolutionSettled'>,
  missing: readonly MissingGlyphOccurrence[],
  resolver = fontResolver
): void {
  if (r.isDestroyed()) return
  for (const [script, characters] of missingGlyphsByScript(missing)) {
    const demand = fontCoverageDemand(script, characters)
    const state = resolver.state(demand).state
    if (state === 'loaded') resolver.exhaust(demand)
    else if (state === 'idle' || state === 'loading') {
      // No fake TEXT node: the shared settlement callback refreshes font generation and repaints.
      void resolver.demand(demand, r.onFontResolutionSettled)
    }
  }
}

export function syncFontGeneration(r: SkiaRenderer): void {
  r.fontGeneration = fontManager.generation()
}

export function trackFontDemand(r: SkiaRenderer, node: SceneNode, key: string): void {
  const pending = r.textFonts.pending.get(node.id) ?? { node, keys: new Set<string>() }
  pending.node = node
  pending.keys.add(key)
  r.textFonts.pending.set(node.id, pending)
}

export function isTextPictureCurrent(
  r: Pick<SkiaRenderer, 'fontGeneration'> & {
    textFonts: Pick<TextFontState, 'pictureGenerations'>
  },
  node: SceneNode
): boolean {
  const data = node.textPicture
  if (!data) {
    r.textFonts.pictureGenerations.delete(node.id)
    return false
  }
  const cached = r.textFonts.pictureGenerations.get(node.id)
  if (!cached || cached.data !== data) {
    r.textFonts.pictureGenerations.set(node.id, { data, generation: r.fontGeneration })
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
    const pending = r.textFonts.pending.get(nodeId)
    if (pending) {
      pending.node.textPicture = null
      pending.keys.delete(snapshot.key)
      if (pending.keys.size === 0) r.textFonts.pending.delete(nodeId)
    }
    r.textFonts.pictureGenerations.delete(nodeId)
    r.invalidateNodePicture(nodeId)
  }
}

export function getFontProvider(r: SkiaRenderer) {
  return r.isDestroyed() || !r.fontProvider ? null : r.fontProvider
}

/** Section titles' face, for the canvas and for the field that renames a title in the page. */
function registerSectionTitleFont(r: SkiaRenderer, data: ArrayBuffer) {
  r.fontProvider?.registerFont(data, SECTION_TITLE_FONT_FAMILY)
  fontManager.registerFontInBrowser(SECTION_TITLE_FONT_FAMILY, 'SemiBold', data)
  const typeface = r.ck.Typeface.MakeFreeTypeFaceFromData(data)
  if (!typeface) return
  try {
    r.chromeFonts.value?.delete()
    r.chromeFonts.value = new r.ck.Font(typeface, VALUE_FONT_SIZE)
  } finally {
    // The font holds its own reference to the face.
    typeface.delete()
  }
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

  const [fontData, titleData] = await Promise.all([
    fontManager.loadFont(DEFAULT_FONT_FAMILY, 'Regular'),
    fontManager.fetchBundledFont(SECTION_TITLE_FONT_URL).catch(() => null),
    // Without it emoji only take the text font's missing-glyph width; text still draws.
    fontManager.loadFont(EMOJI_METRICS_FAMILY, 'Regular').catch(() => null)
  ])
  if (r.isDestroyed()) return
  if (titleData) registerSectionTitleFont(r, titleData)
  if (fontData) {
    const typeface = r.ck.Typeface.MakeFreeTypeFaceFromData(fontData)
    if (typeface) {
      r.chromeFonts.text?.delete()
      r.chromeFonts.label?.delete()
      r.chromeFonts.size?.delete()
      r.chromeFonts.sectionTitle?.delete()
      r.chromeFonts.componentLabel?.delete()
      r.chromeFonts.text = new r.ck.Font(typeface, DEFAULT_FONT_SIZE)
      r.chromeFonts.label = new r.ck.Font(typeface, LABEL_FONT_SIZE)
      r.chromeFonts.size = new r.ck.Font(typeface, SIZE_FONT_SIZE)
      r.chromeFonts.sectionTitle = new r.ck.Font(typeface, SECTION_TITLE_FONT_SIZE)
      r.chromeFonts.componentLabel = new r.ck.Font(typeface, COMPONENT_LABEL_FONT_SIZE)
      r.profiler.setTypeface(typeface)
    }
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
): Promise<void> {
  const { computeAllLayouts } = await import('#core/layout')
  await prepareGraphFonts(graph, nodeIds)
  syncFontGeneration(r)
  withTextMeasurer(
    (node, maxWidth) => r.measureTextNode(node, maxWidth),
    () => graph.applyDerivedLayoutDuring(() => computeAllLayouts(graph, pageId))
  )
}
