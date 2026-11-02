import { uniq, uniqBy } from 'es-toolkit'
import { limitAsync } from 'es-toolkit/promise'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { DEFAULT_FONT_FAMILY } from '#core/constants'
import {
  canDrawPlatformEmoji,
  mayHoldEmoji,
  NOTO_COLOR_EMOJI_FAMILY,
  savedEmojiCharacters
} from '#core/text/emoji'
import { fontGlyphCoverageSync } from '#core/text/font/glyphs'
import { fontManager } from '#core/text/font/manager'
import {
  collectFontRequirements,
  collectGraphFontRequirements,
  collectNodeFontFaces
} from '#core/text/requirements/collect'
import { missingGraphFontScripts } from '#core/text/requirements/resolved'

import { documentFontStatus, type DocumentFontStatus } from './font/status'

/**
 * The characters of a text its layout falls back to the emoji metrics font for: ones that may be
 * emoji and that none of the faces it draws in, nor the fallbacks after them, has. A face not
 * loaded cannot tell, and leaves the character to it.
 */
function laidOutEmojiCharacters(node: SceneNode): string {
  if (node.type !== 'TEXT' || !mayHoldEmoji(node.text)) return ''
  const faces = [
    ...collectNodeFontFaces(node),
    { family: DEFAULT_FONT_FAMILY, style: 'Regular' },
    ...[...fontManager.getArabicFallbackFamilies(), ...fontManager.getCJKFallbackFamilies()].map(
      (family) => ({ family, style: 'Regular' })
    )
  ]
  let characters = ''
  for (const character of node.text) {
    if (!mayHoldEmoji(character)) continue
    const drawnByText = faces.some(
      ({ family, style }) => fontGlyphCoverageSync(family, style, character) !== 'missing'
    )
    if (!drawnByText) characters += character
  }
  return characters
}

/** How far preparing a page's or a selection's fonts has got, for a loading indicator. */
export interface FontPreparationProgress {
  phase: 'resolving-fonts' | 'resolving-fallbacks'
  detail: string
  completed: number
  total: number
}

export interface PrepareGraphFontsOptions {
  /** Characters a writer draws besides the text's own, which the fonts must map too. */
  extraCharacters?: string
  /**
   * Loads one face for these characters, `null` when it cannot; the host's loader, which knows
   * its local and cached fonts, or the font manager's.
   */
  loadFont?: (
    family: string,
    style: string,
    characters: string,
    signal?: AbortSignal
  ) => Promise<unknown>
  /** Keeps the layers off the canvas until their fonts are in, so they draw once, in them. */
  hide?: boolean
  signal?: AbortSignal
  /** How many faces load at once; all of them without a limit. */
  concurrency?: number
  /** Names the layers for progress reports. */
  label?: string
  onProgress?: (progress: FontPreparationProgress) => void
  /**
   * Whether a script whose coverage the loaded faces cannot tell needs its fallback pack, as on a
   * desktop where faces load without their coverage.
   */
  treatUnknownCoverageAsMissing?: boolean
}

export interface PreparedGraphFonts extends DocumentFontStatus {
  /** Whether loading changed any face the text draws with, so it draws and measures anew. */
  changed: boolean
}

/**
 * The one way text gets its fonts before it is laid out or drawn: every face its runs name, for
 * the characters they show, the fallback packs for scripts those faces lack, and the emoji font
 * when the platform draws none. Layout measures text only once this has run for it. `nodes` is
 * the text as it is, or as a write is about to make it. Resolves to whether that changed any face
 * the text draws with.
 */
export async function prepareTextFonts(
  nodes: readonly SceneNode[],
  options: PrepareGraphFontsOptions = {}
): Promise<boolean> {
  const { signal, label = '', onProgress } = options
  const load =
    options.loadFont ??
    ((family: string, style: string, characters: string) =>
      fontManager.loadFont(family, style, characters))
  const collected = collectFontRequirements(nodes)
  const requirements = options.extraCharacters
    ? {
        ...collected,
        characters: uniq(Array.from(collected.characters + options.extraCharacters)).join('')
      }
    : collected
  const faces = uniqBy(
    requirements.nodes.flatMap(collectNodeFontFaces),
    ({ family, style }) => `${family}\u0000${style}`
  )
  const generationBefore = fontManager.generation()
  let completed = 0
  onProgress?.({ phase: 'resolving-fonts', detail: label, completed, total: faces.length })
  const loadFace = async ({ family, style }: { family: string; style: string }) => {
    signal?.throwIfAborted()
    await load(family, style, requirements.characters, signal)
    signal?.throwIfAborted()
    completed++
    onProgress?.({
      phase: 'resolving-fonts',
      detail: `${family} ${style}`,
      completed,
      total: faces.length
    })
  }
  await Promise.all(
    faces.map(options.concurrency ? limitAsync(loadFace, options.concurrency) : loadFace)
  )
  const scripts = missingGraphFontScripts(requirements, {
    treatUnknownCoverageAsMissing: options.treatUnknownCoverageAsMissing
  })
  onProgress?.({ phase: 'resolving-fallbacks', detail: label, completed: 0, total: scripts.length })
  const fallbacks = await fontManager.ensureFallbackPack(scripts, requirements.characters, signal)
  signal?.throwIfAborted()
  onProgress?.({
    phase: 'resolving-fallbacks',
    detail: label,
    completed: scripts.length,
    total: scripts.length
  })
  // Without a platform that draws emoji, emoji are drawn with Noto, loaded for just these: the
  // saved ones, and the ones the layout leaves to the emoji metrics font.
  const emoji =
    requirements.nodes.map(savedEmojiCharacters).join('') +
    requirements.nodes.map(laidOutEmojiCharacters).join('')
  if (emoji && !canDrawPlatformEmoji())
    await fontManager.loadRemoteFont(NOTO_COLOR_EMOJI_FAMILY, 'Regular', emoji)
  const changed =
    fontManager.generation() !== generationBefore ||
    Object.values(fallbacks).some((families) => families.length > 0)
  // Text drawn before these fonts came in draws again with them.
  if (changed)
    for (const node of requirements.nodes) if (node.type === 'TEXT') node.textPicture = null
  return changed
}

/** Prepares the fonts of the text in `nodeIds` and the layers inside them; see `prepareTextFonts`. */
export async function prepareGraphFonts(
  graph: SceneGraph,
  nodeIds: readonly string[],
  options: PrepareGraphFontsOptions = {}
): Promise<PreparedGraphFonts> {
  const { nodes } = collectGraphFontRequirements(graph, nodeIds)
  if (options.hide) fontManager.blockNodesUntilFontsResolve(graph, nodeIds)
  try {
    const changed = await prepareTextFonts(nodes, options)
    return { ...documentFontStatus(graph, nodeIds), changed }
  } finally {
    if (options.hide) fontManager.unblockNodes(graph, nodeIds)
  }
}
